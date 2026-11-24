/* engine/census.js — people, stays, bed chains, the light "plan" for a stay, the value function, census rows,
   consult lists and search. Everything here is cheap; the full chart is built in chart.js. */
(function(H){
'use strict';
var M=H.model,T=H.T,DAY=86400000;
var EPOCH_DAYS=30;                       // bed histories start this many days before BASE_NOW
var chains={},planMemo={};
H._resetCensus=function(){chains={};planMemo={};};

/* ---------- hand-written patients ---------- */
H.hand={list:[],byId:{},byBed:{}};
var HAND_UNIT={p1:'icu',p2:'sx',p3:'card'};
H.registerHandwritten=function(arr){H.hand={list:[],byId:{},byBed:{}};(arr||[]).forEach(function(p){if(!p||!p.id)return;if(!p.unitKey)p.unitKey=HAND_UNIT[p.id]||'';
  H.hand.list.push(p);H.hand.byId[p.id]=p;H.hand.byBed[p.bed]=p;});H._resetCensus();if(H._resetOutpatient)H._resetOutpatient();};

/* ---------- people ---------- */
function pedsNorm(age){var t=T.pedsVitals;for(var i=0;i<t.length;i++)if(age<=t[i][0])return t[i];return null;}
H.pedsNorm=pedsNorm;
/* makePerson(key, {age:[min,max,mode], sex:[m,f], ageDays:[min,max], wt:[min,max]}, refDate) */
H.makePerson=function(key,spec,ref){var r=H.R('person|'+key),p={key:key};spec=spec||{};
  var sw=spec.sex||[50,50];p.sex=r.f()*(sw[0]+sw[1])<sw[0]?'M':'F';
  var n=H.personName('pt|'+key,p.sex);p.given=n.given;p.sur=n.sur;p.name=n.sur+', '+n.given;
  var ageY,dob;
  if(spec.ageDays){var dd=r.int(spec.ageDays[0],spec.ageDays[1]);ageY=dd/365.25;dob=H.addD(H.day0(ref),-dd);p.age=0;p.ageText=dd+(dd===1?' day':' days');}
  else{var a=spec.age||[30,85,60];ageY=r.tri(a[0],a[1]+0.99,a[2]);if(ageY<2){var mo=Math.max(1,Math.round(ageY*12));p.age=Math.floor(ageY);p.ageText=mo+(mo===1?' month':' months');dob=H.addD(H.day0(ref),-Math.round(mo*30.4)-r.int(0,20));}
    else{p.age=Math.floor(ageY);dob=H.addD(new Date(ref.getFullYear()-p.age,ref.getMonth(),ref.getDate()),-r.int(1,360));}}
  p.ageY=ageY;p.dobDate=dob;p.dob=H.dmy(dob);p.mrn='LX-'+(100000+H.hash('mrn'+H.cfg.seed+key)%900000);
  if(spec.wt){p.wtKg=H.round(r.tri(spec.wt[0],spec.wt[1]),2);p.htCm=Math.round(45+p.wtKg*2.2);}
  else if(ageY<18){var w=ageY<1?3.5+ageY*12*0.55:ageY<=10?2*ageY+9:3.3*ageY-3;p.wtKg=H.round(w*r.tri(.85,1.25,1),1);p.htCm=Math.round(ageY<1?50+ageY*25:Math.min(172,77+6.2*ageY));}
  else{p.htCm=Math.round(r.norm(p.sex==='M'?176:162,6.5));p.bmi=H.clamp(r.norm(27.5,4.8),17.5,46);p.wtKg=H.round(p.bmi*p.htCm*p.htCm/10000,1);}
  p.title=ageY<16?'':p.sex==='M'?'Mr':(r.chance(.6)?'Mrs':'Ms');p.side=r.chance(.5)?'left':'right';
  return p;};
H.priorAt=function(prior,age){if(prior==null)return 0;if(typeof prior==='number')return prior;return H.interp([[18,0],[40,prior[0]],[60,prior[1]],[80,prior[2]],[95,prior[2]]],age);};
H.pickComorbs=function(r,person,over,pop,max){var out=[],keys=Object.keys(H.comorbidities).sort();over=over||{};if(pop==='peds'||pop==='neonate')return out;
  keys.forEach(function(k){var c=H.comorbidities[k];if(person.ageY<(c.minAge||18))return;if(pop==='ob'&&!c.ob)return;if(c.sex&&c.sex!==person.sex)return;
    var p=over[k]!=null?over[k]:H.priorAt(c.prior,person.ageY);if(!r.chance(p))return;
    if(c.excludes&&c.excludes.some(function(x){return out.indexOf(x)>=0;}))return;if(out.some(function(o){return (H.comorbidities[o].excludes||[]).indexOf(k)>=0;}))return;
    out.push(k);});
  while(out.length>(max||5))out.splice(r.int(0,out.length-1),1);
  if(out.indexOf('obesity')>=0&&person.bmi&&person.bmi<31){person.bmi=31+r.f()*9;person.wtKg=H.round(person.bmi*person.htCm*person.htCm/10000,1);}
  return out;};

/* ---------- module choice for a unit ---------- */
var candMemo={};
function candidates(u){if(candMemo[u.key])return candMemo[u.key];var out=[];
  Object.keys(H.conditions).sort().forEach(function(k){var m=H.conditions[k];if((m.pop||'adult')!==u.pop)return;
    for(var i=0;i<u.kinds.length;i++){var w=m.units&&m.units[u.kinds[i]];if(w){out.push([m,w*(i===0?1:i===1?.5:.3)]);return;}}});
  if(!out.length)throw new Error('No condition module (not even a generic one) matches unit '+u.key+' kinds '+u.kinds.join(','));
  return candMemo[u.key]=out;}
H._resetCand=function(){candMemo={};effMemo={};};
/* test hook used by tools/validate-module.js: a stay of a chosen module and variant in a chosen unit, admitted at tFree */
H._forcePlan=function(unitKey,modKey,variantKey,n,tFree){var u=M.unitByKey[unitKey],id='t.'+modKey+'.'+(variantKey||'x')+'.'+n,P=makePlan(u,n%u.beds,n,tFree,H.R('force|'+id),{id:id,mod:H.conditions[modKey],variant:variantKey});planMemo[id]=P;return P;};
/* effective module for a variant: single-value fields of the variant replace the module's; lists are added elsewhere */
var OVR=['phases','custom','io','dc','iso','entry','entryNurse','pod','std','track','anaes','flow','ranges','service','icd','draws','rhythm'],effMemo={};
function effective(mod,v){var k=mod.key+'|'+v.key;if(effMemo[k])return effMemo[k];var o={},f;for(f in mod)o[f]=mod[f];OVR.forEach(function(f){if(v[f]!=null)o[f]=v[f];});
  if(v.nostd)o.nostd=(mod.nostd||[]).concat(v.nostd);if(v.holds)o.holds=(mod.holds||[]).concat(v.holds);
  ['nursing','notes','anc'].forEach(function(f){if(v[f]){o[f]={};var x;for(x in (mod[f]||{}))o[f][x]=mod[f][x];for(x in v[f])o[f][x]=v[f][x];}});
  return effMemo[k]=o;}
/* does a list item apply to this variant?  v:[...] = only these variants, notv:[...] = all but these */
H.forVariant=function(it,P){if(!it||typeof it!=='object')return true;if(it.v&&it.v.indexOf(P.variant.key)<0)return false;if(it.notv&&it.notv.indexOf(P.variant.key)>=0)return false;return true;};
function resolveComp(c){if(!c.use)return c;var b=H.complications[c.use];if(!b)throw new Error('Unknown shared complication '+c.use);var o={};for(var k in b)o[k]=b[k];for(k in c)if(k!=='use')o[k]=c[k];return o;}
H.resolveComp=resolveComp;

/* ---------- a stay plan ---------- */
function bedLabel(u,i){return u.prefix+'-'+H.p2(i+1);}
H.bedLabel=bedLabel;
function makePlan(u,bedIdx,idx,tFree,r,force){
  var id=force?force.id:'g.'+u.key+'.'+H.p2(bedIdx)+'.'+idx,mod=force?force.mod:r.wpick(candidates(u),function(x){return x[1];})[0];
  var vs=mod.variants||[{key:'std',w:1,sev:1}],match=vs.filter(function(v){return v.units&&v.units.some(function(k){return u.kinds.indexOf(k)>=0;});});
  if(!match.length)match=vs.filter(function(v){return !v.units;});if(!match.length)match=vs;
  var v=r.wpick(match,function(x){return x.w||1;}),ed=u.acuity==='ed',base0=mod;if(force&&force.variant)v=vs.filter(function(x){return x.key===force.variant;})[0]||v;mod=effective(mod,v);
  var P={id:id,unit:u,bedIdx:bedIdx,bed:bedLabel(u,bedIdx),idx:idx,mod:mod,variant:v,via:v.via||mod.via||'ed'};
  /* admission time */
  var admit;if(ed)admit=H.addMin(tFree,r.int(5,50));
  else if(P.via==='elective'){admit=H.at(tFree,5,45+r.int(0,90));if(admit<tFree)admit=H.addD(admit,1);}
  else admit=H.addMin(tFree,r.int(20,300));
  P.admit=admit;P.arrive=ed?H.addMin(admit,-r.int(70,160)):P.via==='ed'?H.addMin(admit,-r.int(150,420)):P.via==='elective'?admit:H.addMin(admit,-r.int(55,110));
  var born=(mod.entry==='delivery room');var person=P.person=H.makePerson(id,{age:v.age||mod.age,sex:v.sex||mod.sex,ageDays:born?[0,0]:(v.ageDays||mod.ageDays),wt:v.wt||mod.wt},born?P.arrive:admit);
  var over={},k;for(k in (mod.comorb||{}))over[k]=mod.comorb[k];for(k in (v.comorb||{}))over[k]=v.comorb[k];
  P.comorbs=H.pickComorbs(r,person,over,u.pop,v.maxComorb);
  P.flags={};P.comorbs.forEach(function(ck){(H.comorbidities[ck].flags||[]).forEach(function(f){P.flags[f]=1;});});
  P.sev=(v.sev||1)*(1+0.12*(r.f()-.5));
  /* length of stay */
  var lr=v.los||mod.los||[2,5],nominal=mod.los&&!(v.phases&&v.los)?(mod.los[0]+mod.los[1])/2:(lr[0]+lr[1])/2,base;
  if(ed){var lh=v.losH||mod.losH||[3,9];base=r.tri(lh[0],lh[1])/24;P.f=1;}
  else{base=r.tri(lr[0],lr[1]);P.comorbs.forEach(function(ck){base+=H.comorbidities[ck].los||0;});P.f=H.clamp(base/nominal,.6,2.2);}
  /* complication: first one whose dice roll succeeds */
  P.comp=null;var comps=(mod.comps||[]).concat(v.comps||[]);
  for(var i=0;i<comps.length&&!ed;i++){var cd=resolveComp(comps[i]);if(cd.v&&cd.v.indexOf(v.key)<0)continue;if(cd.notv&&cd.notv.indexOf(v.key)>=0)continue;if(cd.minAge&&person.ageY<cd.minAge)continue;
    if(cd.needs&&!cd.needs.some(function(n){return P.comorbs.indexOf(n)>=0;}))continue;
    var p=cd.p||0;P.comorbs.forEach(function(ck){var it=H.comorbidities[ck].interact;if(it&&it[cd.key])p*=it[cd.key];});
    if(r.chance(Math.min(.9,p))){var dr=cd.d||[1,3],on=Math.min(r.tri(dr[0],dr[1])*P.f,base*0.75),lag=cd.lag||[4,12];
      P.comp={def:cd,key:cd.key,onsetD:on,onset:H.addH(admit,on*24),recog:H.addH(admit,on*24+r.tri(lag[0],lag[1]))};base+=cd.los||0;break;}}
  P.los=base;
  if(ed)P.discharge=H.addH(admit,base*24);
  else{var dd=H.addH(admit,base*24);P.discharge=H.at(dd,10+r.int(0,6),r.int(0,11)*5);if(H.days(admit,P.discharge)<0.6)P.discharge=H.addD(P.discharge,1);}
  /* course: module course with variant overrides */
  P.course={};for(k in (mod.course||{}))P.course[k]=mod.course[k];for(k in (v.course||{}))P.course[k]=v.course[k];
  /* service and team */
  var svc=(u.acuity==='icu'||ed||!mod.service||!M.serviceByKey[v.service||mod.service])?(mod.generic||u.acuity==='icu'||ed?r.wpick(u.acuity==='icu'||ed?[u.services[0]]:u.services,function(s){return s[1];})[0]:u.services[0][0]):(v.service||mod.service);
  P.service=svc;P.teamIdx=r.int(0,50);
  var cr=r.f(),cs=T.defaults.code,old=person.ageY>80?3:person.ageY>70?1.6:person.ageY<60?.2:1,acc=0;P.code=cs[0][0];
  for(i=1;i<cs.length;i++){acc+=cs[i][1]*old;if(cr<acc){P.code=cs[i][0];break;}}
  P.vars={};if(mod.vars)for(k in mod.vars)P.vars[k]=r.pick(mod.vars[k]);if(v.vars)for(k in v.vars)P.vars[k]=r.pick(v.vars[k]);
  for(var pass=0;pass<2;pass++)for(k in P.vars)if(/[\{\[]/.test(P.vars[k]))P.vars[k]=H.fill(P.vars[k],dxCtx(P),H.R(id+'|var|'+k).f);
  P.dispoRoll=r.f();P.base={};
  P.dx=H.fill(v.name||mod.name,dxCtx(P));if(P.dx.length>60)P.dx=P.dx.slice(0,59).replace(/[ ,;]+\S*$/,'');
  return P;}
function dxCtx(P){var sd=P.person.side,ot=sd==='left'?'right':'left',o={side:sd,Side:H.cap(sd),otherside:ot,Otherside:H.cap(ot)};for(var k in P.vars)o[k]=P.vars[k];return o;}
H.dxCtx=dxCtx;
H.teamOf=function(P,date){var ts=H.serviceTeams(P.service,date||H.cfg.now);return ts[P.teamIdx%ts.length];};

/* ---------- bed chains ---------- */
function chain(u,bedIdx,until){var key=u.key+'|'+bedIdx,c=chains[key];
  if(!c){var r=H.R('bed|'+key),ed=u.acuity==='ed';c=chains[key]={r:r,stays:[],t:H.addH(H.addD(H.BASE_NOW,-EPOCH_DAYS),-r.f()*(ed?6:96)),i:0};}
  var ed2=u.acuity==='ed';
  while(c.t.getTime()<=until.getTime()){var rr=c.r;
    if(ed2){if(rr.chance(.45))c.t=H.addMin(c.t,rr.int(10,200));}else if(rr.chance(.3))c.t=H.addH(c.t,4+rr.f()*30);
    var P=makePlan(u,bedIdx,c.i,c.t,rr);c.stays.push(P);planMemo[P.id]=P;c.i++;c.t=ed2?H.addMin(P.discharge,rr.int(15,45)):H.addH(P.discharge,1.5+rr.f()*3.5);}
  return c.stays;}
function stayAt(u,bedIdx,now){var s=chain(u,bedIdx,now);for(var i=s.length-1;i>=0;i--){if(s[i].admit<=now)return s[i].discharge>now?s[i]:{vacated:s[i]};}return null;}
/* H.plan(id) -> light plan for any generated stay id (current, past or future within the generated window) */
H.plan=function(id){if(planMemo[id])return planMemo[id];var m=/^g\.([a-z0-9]+)\.(\d+)\.(\d+)$/.exec(id);if(!m)return null;var u=M.unitByKey[m[1]];if(!u||+m[2]>=u.beds)return null;
  var idx=+m[3],guard=0,until=H.cfg.now;while(!planMemo[id]&&guard++<400){var s=chain(u,+m[2],until);if(s.length>idx)break;until=H.addD(until,30);}return planMemo[id]||null;};

/* ---------- the value function: any vital sign or lab at any time ---------- */
/* reference ("typical normal") value: the midpoint of the module's own range when it gives one (children, newborns, pregnancy), else the table value */
function ref(P,key,tab){var rg=P.mod.ranges&&P.mod.ranges[key];if(rg&&T.labs[key])return (rg[0]+rg[1])/2;if(tab.sex&&tab.sex[P.person.sex])return tab.sex[P.person.sex].mean;return tab.mean;}
function softClamp(v,s){if(!s)return v;if(v<s[0])return s[0]-(s[0]-v)*.2;if(v>s[1])return s[1]+(v-s[1])*.2;return v;}
/* age in words at a given time: '3-day-old', '5-month-old', '67-year-old' */
H.ageAt=function(pr,t){var d=H.calDays(pr.dobDate,t);if(d<0)d=0;if(d<60)return {age:0,text:d+(d===1?' day':' days'),adj:d+'-day-old'};if(d<730){var m=Math.floor(d/30.4);return {age:Math.floor(d/365.25),text:m+' months',adj:m+'-month-old'};}
  var y=t.getFullYear()-pr.dobDate.getFullYear();if(t.getMonth()<pr.dobDate.getMonth()||(t.getMonth()===pr.dobDate.getMonth()&&t.getDate()<pr.dobDate.getDate()))y--;return {age:y,text:null,adj:y+'-year-old'};};
function baseline(P,key){if(P.base[key]!=null)return P.base[key];if(T.labs[key]&&H.opdOf){var ob=H.opdOf(P).base;if(ob[key]!=null)return P.base[key]=ob[key];}var tab=T.vitals[key]||T.labs[key],b=0;if(tab){b=ref(P,key,tab);
    if(T.vitals[key]&&P.person.ageY<18){var pn=pedsNorm(P.person.ageY);if(pn){if(key==='hr')b=pn[1];if(key==='rr')b=pn[2];if(key==='sbp')b=pn[3];if(key==='dbp')b=pn[4];}}
    b+=tab.sd*H.noise(P.id+'|b|'+key)*(T.vitals[key]&&P.person.ageY<18?.6:1)*(T.labs[key]?Math.min(1.3,Math.max(.3,b/(tab.mean||1))):1);
    P.comorbs.forEach(function(ck){var c=H.comorbidities[ck],s=(c.labs&&c.labs[key])||(c.vitals&&c.vitals[key]);if(s)b+=s*(0.8+0.4*H.unit01(P.id+ck+key));});}
  return P.base[key]=b;}
H.baseline=baseline;
/* true (noise-free) value at d days after admission */
function trueVal(P,key,d){var tab=T.vitals[key]||T.labs[key],cus=P.mod.custom&&P.mod.custom[key],c=P.course[key],x=d>0?d/P.f:d,v;
  if(cus)v=c?H.interp(c,x):cus.base||0;
  else{v=baseline(P,key);if(c){var r0=ref(P,key,tab);if(T.vitals[key]&&P.person.ageY<18){var pn=pedsNorm(P.person.ageY);if(pn){r0=key==='hr'?76:key==='rr'?16:key==='sbp'?124:key==='dbp'?74:r0;
        var sc=key==='hr'?pn[1]/76:key==='rr'?pn[2]/16:key==='sbp'?pn[3]/124:key==='dbp'?pn[4]/74:1;v+=P.sev*(H.interp(c,x)-r0)*sc;c=null;}}
      if(c)v+=P.sev*(H.interp(c,x)-r0);}}
  if(P.comp&&P.comp.def.course&&P.comp.def.course[key]){var dc=d-P.comp.onsetD;if(dc>0)v+=H.interp(P.comp.def.course[key],dc);}
  return v;}
H.trueVal=trueVal;
H.valueAt=function(P,key,t,slot){var tab=T.vitals[key]||T.labs[key]||(P.mod.custom&&P.mod.custom[key])||{noise:0,dec:0,min:-1e9,max:1e9};
  var d=H.days(P.admit,t),v=trueVal(P,key,d);
  if(key==='o2'){v=v<0.5?0:v<=6?Math.round(v):v<=15?Math.round(v/2)*2:v<90?Math.round(v/10)*10:100;return v;}
  v+=(tab.noise||0)*H.noise(P.id+'|'+key+'|'+(slot!=null?slot:Math.round(t.getTime()/60000)));
  if(key==='spo2'&&v>99.4&&H.valueAt(P,'o2',t)===0)v=96+3*H.unit01(P.id+'s'+t.getTime());
  v=softClamp(v,tab.soft);v=H.clamp(v,tab.min!=null?tab.min:-1e9,tab.max!=null?tab.max:1e9);return H.round(v,tab.dec||0);};
H.o2Text=function(v,P){if(v<0.5)return 'Room air';if(v<=6)return v+' L nasal';if(v<=15)return 'Mask '+v+' L';if(v<90)return 'High-flow '+v+' L/min';return 'Ventilator';};
/* observation times for a stay up to `now` */
H.obsTimes=function(P,now){var end=now<P.discharge?now:P.discharge,out=[],u=P.unit,t;
  if(u.acuity==='icu'){var from=H.addH(end,-23.99);if(from<P.arrive)from=P.arrive;t=new Date(from.getFullYear(),from.getMonth(),from.getDate(),from.getHours()+1);
    out.push(P.arrive<from?null:P.arrive);for(;t<=end;t=H.addH(t,1))out.push(t);out=out.filter(Boolean);if(!out.length)out=[P.arrive];return out;}
  if(P.arrive<P.admit){for(t=P.arrive;t<P.admit&&out.length<(u.acuity==='ed'?1:4);t=H.addH(t,u.acuity==='ed'?1:1.5))out.push(t);}
  var step=u.acuity==='ed'?1:u.pop==='psych'?12:4,off=u.pop==='psych'?8:0,g=new Date(P.admit.getFullYear(),P.admit.getMonth(),P.admit.getDate(),Math.ceil((P.admit.getHours()+P.admit.getMinutes()/60+0.01-off)/step)*step+off);
  if(!out.length&&g>end)out.push(P.admit);
  for(t=g;t<=end;t=H.addH(t,step))out.push(t);
  if(!out.length)out.push(P.admit<=end?P.admit:P.arrive);
  return out.length>16?out.slice(out.length-16):out;};
H.vitalsAt=function(P,t){var o={},ks=['temp','hr','rr','sbp','dbp','spo2','o2','pain'];for(var i=0;i<ks.length;i++)o[ks[i]]=H.valueAt(P,ks[i],t);
  if(o.dbp>o.sbp-18)o.dbp=o.sbp-18;o.bp=o.sbp+'/'+o.dbp;o.o2text=H.o2Text(o.o2,P);return o;};

/* ---------- census ---------- */
function phaseIdx(P,d){var ph=P.mod.phases||[['acute',0]],x=d>0?d/P.f:d,i=0;for(var j=0;j<ph.length;j++)if(x>=ph[j][1])i=j;return i;}
H.phaseIdx=phaseIdx;
function row(P,now){var end=now<P.discharge?now:P.discharge,ot=H.obsTimes(P,now),v=H.vitalsAt(P,ot[ot.length-1]),team=H.teamOf(P,end),pr=P.person,flags=[];
  var d=H.days(P.admit,now);
  if(d<0.5)flags.push('New admission');if(H.calDays(now,P.discharge)===0&&d>0.3)flags.push('Discharge today');else if(H.calDays(now,P.discharge)===1)flags.push('Discharge tomorrow');
  if(P.code!=='Full code')flags.push('No CPR');if(v.o2>=7)flags.push('High oxygen need');if(v.hr>120||v.sbp<90||v.spo2<90||v.temp>=38.5)flags.push('Abnormal vital signs');
  if(P.comp&&now>=P.comp.recog)flags.push(P.comp.def.name);if(isoOf(P,now)!=='Standard precautions')flags.push('Isolation');if(pr.ageY>=75&&P.unit.pop==='adult')flags.push('Fall risk');
  var ag=H.ageAt(pr,now);return {id:P.id,unitKey:P.unit.key,unit:P.unit.name,bed:P.bed,status:'occupied',name:pr.name,age:ag.age,ageText:ag.text,sex:pr.sex,mrn:pr.mrn,dx:P.dx,
    admit:P.admit,day:H.calDays(P.admit,now)+1,expectedDischarge:P.discharge,service:M.serviceByKey[P.service].name,serviceKey:P.service,team:team.name,attending:team.attending.name,code:P.code,
    iso:isoOf(P,now),flags:flags,phase:(P.mod.phases||[['acute',0]])[phaseIdx(P,d)][0],nurse:H.nurseFor(P.unit.key,P.bedIdx,now,shiftOf(now)).name,
    vitals:{t:ot[ot.length-1],temp:v.temp,hr:v.hr,rr:v.rr,bp:v.bp,spo2:v.spo2,o2:v.o2text,pain:v.pain},condition:P.mod.key,handwritten:false};}
function isoOf(P,now){if(P.comp&&P.comp.def.iso&&now>=P.comp.recog)return P.comp.def.iso;return P.variant.iso||P.mod.iso||'Standard precautions';}
H.isoOf=isoOf;
function shiftOf(t){var h=t.getHours();return h>=7&&h<19?'day':'night';}
H.shiftOf=shiftOf;
function handRow(p,now){var vt=p.flows[0],n=vt.times.length-1,g=function(k){var r=vt.rows.filter(function(x){return x.k===k;})[0];return r?r:null;},bp=g('bp');
  return {id:p.id,unitKey:p.unitKey,unit:p.unit,bed:p.bed,status:'occupied',name:p.name,age:p.age,ageText:p.ageText||null,sex:p.sex,mrn:p.mrn,dx:p.dx,admit:p.admit,day:H.calDays(p.admit,now)+1,
    expectedDischarge:null,service:p.service,serviceKey:null,team:p.service,attending:p.attending,code:p.code,iso:p.iso,flags:['Hand-written case'].concat(p.code!=='Full code'?['No CPR']:[]),phase:null,
    nurse:((p.team||[]).filter(function(x){return /nurse/i.test(x[0]);})[0]||['',''])[1],
    vitals:{t:vt.times[n],temp:g('temp').v[n],hr:g('hr').v[n],rr:g('rr').v[n],bp:bp.s[n]+'/'+bp.d[n],spo2:g('spo2').v[n],o2:g('o2').v[n],pain:g('pain').v[n]},condition:null,handwritten:true};}
/* HOSP.census(unitKey) -> one row per bed, in bed order */
H.census=function(unitKey,now){var u=M.unitByKey[unitKey];if(!u)return [];now=now||H.cfg.now;var out=[];
  for(var b=0;b<u.beds;b++){var lab=bedLabel(u,b),hp=H.hand.byBed[lab];
    if(hp&&hp.unitKey===unitKey){out.push(hp.admit<=now?handRow(hp,now):{id:null,unitKey:unitKey,unit:u.name,bed:lab,status:'empty'});continue;}
    var s=stayAt(u,b,now);
    if(s&&!s.vacated)out.push(row(s,now));
    else out.push({id:null,unitKey:unitKey,unit:u.name,bed:lab,status:s&&s.vacated&&H.days(s.vacated.discharge,now)<0.12?'cleaning':'empty',lastPatient:s&&s.vacated?s.vacated.id:null});}
  return out;};
/* all generated stays that are in a bed at `now` (plans, not rows) */
H.currentPlans=function(now){now=now||H.cfg.now;var out=[];M.units.forEach(function(u){for(var b=0;b<u.beds;b++){if(H.hand.byBed[bedLabel(u,b)])continue;var s=stayAt(u,b,now);if(s&&!s.vacated)out.push(s);}});return out;};
/* stays that ended in the last `days` days (default 14), newest first: [{id, name, dx, unit, bed, admit, discharge}] */
H.discharges=function(unitKey,days,now){now=now||H.cfg.now;days=days||14;var out=[];M.units.forEach(function(u){if(unitKey&&u.key!==unitKey)return;
  for(var b=0;b<u.beds;b++){if(H.hand.byBed[bedLabel(u,b)])continue;chain(u,b,now).forEach(function(P){if(P.discharge<=now&&H.days(P.discharge,now)<=days)
    out.push({id:P.id,unitKey:u.key,unit:u.name,bed:P.bed,name:P.person.name,age:H.ageAt(P.person,P.discharge).age,sex:P.person.sex,mrn:P.person.mrn,dx:P.dx,admit:P.admit,discharge:P.discharge,lengthOfStayDays:H.round(H.days(P.admit,P.discharge),1)});});}});
  return out.sort(function(a,b){return b.discharge-a.discharge;});};
H.allPlans=function(now,backDays){now=now||H.cfg.now;var out=[],from=H.addD(now,-(backDays||21));M.units.forEach(function(u){for(var b=0;b<u.beds;b++){if(H.hand.byBed[bedLabel(u,b)])continue;
  chain(u,b,now).forEach(function(P){if(P.admit<=now&&P.discharge>=from)out.push(P);});}});return out;};

/* ---------- consults ---------- */
/* consults of a plan: [{svc, t, seen, reason, recs, by, src}] (all, including future ones; filter by time when using) */
H.consultsOf=function(P){if(P._cons)return P._cons;var out=[],r=H.R('cons|'+P.id),have={};
  function dayTime(d){var t=H.addH(P.admit,d*24);if(t.getHours()<8)t=H.at(t,8,r.int(0,50));else if(t.getHours()>=18)t=H.at(H.addD(t,1),8,r.int(0,50));return t<P.admit?H.addMin(P.admit,r.int(20,90)):t;}
  function add(c,d,src){if(!c||!c.svc||have[c.svc]||!M.serviceByKey[c.svc]||c.svc===P.service)return;have[c.svc]=1;var t=src==='comp'?H.addMin(P.comp.recog,r.int(20,120)):dayTime(d);
    out.push({svc:c.svc,t:t,seen:H.addMin(t,r.int(50,300)),reason:c.reason||'',recs:c.recs||'',src:src,def:c});}
  (P.mod.consults||[]).concat(P.variant.consults||[]).forEach(function(c){if(!H.forVariant(c,P))return;if(c.p!=null&&!r.chance(c.p))return;add(c,(c.d||0.3)*P.f,'mod');});
  if(P.comp&&P.comp.def.consult)add(P.comp.def.consult,0,'comp');
  P.comorbs.forEach(function(ck){var c=H.comorbidities[ck].consult;if(c&&r.chance(c.p==null?.3:c.p))add(c,c.d||0.6,'comorb');});
  if(P.unit.acuity!=='ed'){if(P.unit.pop==='adult'&&(P.person.ageY>=70||P.los>4))add({svc:'pt',reason:'mobility and discharge needs',recs:''},0.8,'std');
    if(!out.length)add({svc:P.unit.pop==='psych'?'sw':P.unit.pop==='ob'||P.unit.pop==='neonate'||P.unit.pop==='peds'?'sw':'pharm',reason:P.unit.pop==='adult'?'medicine reconciliation and dosing review':'family support and discharge planning',recs:''},0.05,'std');}
  out.sort(function(a,b){return a.t-b.t;});return P._cons=out;};
var HAND_SVC=[[/kidney|nephro|dialysis/i,'neph'],[/cardiol|heart/i,'card'],[/infectious/i,'idsvc'],[/palliative/i,'pallsvc'],[/neurosurg/i,'nsgy'],[/neurol|stroke/i,'neurol'],[/psychiat/i,'psych'],[/endocrin|diabetes/i,'endo'],
 [/pulmon|respiratory med/i,'pulm'],[/gastro/i,'gi'],[/hepatol|liver/i,'hep'],[/haemato/i,'haem'],[/oncolog/i,'onc'],[/physical therap|physio/i,'pt'],[/occupational/i,'ot'],[/speech|swallow/i,'slp'],[/dietit|nutrition/i,'nutr'],
 [/social work/i,'sw'],[/case manage/i,'cm'],[/pharmac/i,'pharm'],[/wound/i,'wound'],[/urolog/i,'urol'],[/orthopaed/i,'ortho'],[/general surg|surgery/i,'gensurg'],[/geriatr/i,'geri'],[/anaesth|pain service/i,'pain'],[/interventional/i,'ir']];
H.handSvc=function(text){for(var i=0;i<HAND_SVC.length;i++)if(HAND_SVC[i][0].test(text))return HAND_SVC[i][1];return null;};
/* HOSP.consultList(serviceKey) -> patients across the hospital with a consult to that service */
H.consultList=function(svcKey,now){now=now||H.cfg.now;var out=[];
  H.currentPlans(now).forEach(function(P){H.consultsOf(P).forEach(function(c){if(c.svc!==svcKey||c.t>now)return;var pr=P.person,seen=c.seen<=now,off=seen&&H.days(c.seen,now)>2.5&&c.src!=='comp';
    out.push({id:P.id,unitKey:P.unit.key,unit:P.unit.name,bed:P.bed,name:pr.name,age:H.ageAt(pr,now).age,ageText:H.ageAt(pr,now).text,sex:pr.sex,mrn:pr.mrn,dx:P.dx,reason:H.fill(c.reason,dxCtx(P)),requested:c.t,
      requestedBy:H.teamOf(P,c.t).attending.name,primaryService:M.serviceByKey[P.service].name,status:!seen?'New':off?'Signed off':'Following',seen:seen?c.seen:null,handwritten:false});});});
  H.hand.list.forEach(function(p){if(p.admit>now)return;var hit=null;(p.orders||[]).forEach(function(o){var cat=o.cat||o[0],text=o.text||o[1],st=o.st||o[2],t=o.t||o[3];if(cat==='Consult'&&H.handSvc(text)===svcKey&&t<=now)hit={text:text,st:st,t:t};});
    if(!hit)(p.notes||[]).forEach(function(n){if(n.type==='Consult'&&H.handSvc(n.title)===svcKey&&n.t<=now&&!hit)hit={text:n.title,st:'Completed',t:n.t};});
    if(hit)out.push({id:p.id,unitKey:p.unitKey,unit:p.unit,bed:p.bed,name:p.name,age:p.age,ageText:p.ageText||null,sex:p.sex,mrn:p.mrn,dx:p.dx,reason:hit.text,requested:hit.t,requestedBy:p.attending,primaryService:p.service,
      status:hit.st==='Pending'?'New':'Following',seen:null,handwritten:true});});
  return out.sort(function(a,b){return (a.status==='New'?0:a.status==='Following'?1:2)-(b.status==='New'?0:b.status==='Following'?1:2)||b.requested-a.requested;});};

/* ---------- search ---------- */
H.search=function(text,limit){var q=String(text||'').toLowerCase().trim(),out=[];limit=limit||50;if(q.length<2)return out;var now=H.cfg.now;
  function hit(){for(var i=0;i<arguments.length;i++)if(arguments[i]&&String(arguments[i]).toLowerCase().indexOf(q)>=0)return true;return false;}
  H.hand.list.forEach(function(p){if(hit(p.name,p.mrn,p.dx,p.bed))out.push({kind:'inpatient',id:p.id,name:p.name,mrn:p.mrn,age:p.age,sex:p.sex,where:p.unit+' '+p.bed,dx:p.dx,handwritten:true});});
  var inLim=Math.ceil(limit*.6);H.currentPlans(now).forEach(function(P){if(out.length<inLim&&hit(P.person.name,P.person.mrn,P.dx,P.bed))out.push({kind:'inpatient',id:P.id,name:P.person.name,mrn:P.person.mrn,age:H.ageAt(P.person,now).age,sex:P.person.sex,where:P.unit.name+' '+P.bed,dx:P.dx,handwritten:false});});
  if(out.length<limit&&H.searchOutpatients)H.searchOutpatients(q,limit-out.length).forEach(function(x){out.push(x);});
  return out.slice(0,limit);};
})(HOSP);
