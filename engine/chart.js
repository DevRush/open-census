/* engine/chart.js — builds the full inpatient chart (the SCHEMA.md patient object) for one stay plan, as of `now`.
   Every number that appears in a note is read from the same value function that fills the flowsheets and results,
   so notes, vital signs, laboratory results, medicines, orders and dates agree by construction. */
(function(H){
'use strict';
var M=H.model,T=H.T;
function rnd(P,tag){return H.R(P.id+'|'+tag).f;}
function egfr(cr,age,sex){var k=sex==='F'?.7:.9,a=sex==='F'?-.241:-.302,m=Math.min(cr/k,1),x=Math.max(cr/k,1);return Math.round(H.clamp(142*Math.pow(m,a)*Math.pow(x,-1.2)*Math.pow(.9938,age)*(sex==='F'?1.012:1),3,125));}
H.egfr=egfr;

/* ---------- medicines ---------- */
function medName(def,P){if(!def.kg)return def.name;var d=Math.min(def.kg[1],P.person.wtKg*def.kg[0]),rt=def.kg[2]||1;d=Math.max(rt,Math.round(d/rt)*rt);return def.name.replace('{d}',H.num(H.round(d,2)));}
function sigOf(def,item){var route=T.routes[def.route]||def.route,fk=item.f||def.freq,f=T.freq[fk];if(!f)throw new Error('Unknown frequency '+fk+' for '+def.key);
  if(fk==='inf')return route+' · continuous infusion';if(/^prn/.test(fk))return route+' · '+f[0]+' for '+(item.prn||def.extra||'symptoms');return route+' · '+f[0];}
H.medText=function(key,P){var d=T.meds[key];if(!d)return key;var f=T.freq[d.freq];return medName(d,P)+' '+(d.freq==='inf'?'infusion':/^prn/.test(d.freq)?f[0]+' for '+(d.extra||'symptoms'):f[0]);};
/* day d (module days) -> clock time. Positive days snap to morning rounds so that a stop and a start on the same day coincide. */
function snap(P,d,tag){if(d<=0)return P.admit;var t=H.addH(P.admit,d*P.f*24),s=H.at(t,9,30+H.hash(P.id+'snap'+Math.round(d*10))%90);return s>H.addH(P.admit,3)?s:H.addH(P.admit,d*P.f*24);}
function allergiesOf(P){if(P._alg)return P._alg;var r=H.R(P.id+'|alg'),out=[],blocked={};if(P.unit.pop!=='neonate')T.allergies.forEach(function(a){if(out.length<2&&r.chance(a[3]*(P.person.ageY<18?.5:1))){out.push([a[0],a[1]]);a[2].forEach(function(c){blocked[c]=1;});}});
  P._blocked=blocked;return P._alg=out.length?out:[['No known allergies','']];}
function resolveMedKey(key,P,avoid){var d=T.meds[key];if(!d)throw new Error('Unknown medicine key "'+key+'" in module '+P.mod.key);
  if(P.flags.renal&&d.renal)d=T.meds[d.renal];
  var cls=d.cls;if(P._blocked[cls]||avoid[cls]){var sw=(T.allergySwap[cls]||{})[d.key];if(!sw)return null;d=T.meds[sw];if(P._blocked[d.cls]||avoid[d.cls])return null;}
  return d;}
function buildMeds(P,end){if(P._meds)return P._meds;allergiesOf(P);var opT=null;(P.mod.procs||[]).concat(P.variant.procs||[]).forEach(function(pc){if(pc.type==='Operative note'&&H.forVariant(pc,P)&&(pc.h!=null||(pc.d||0)<1)){var t=pc.h!=null?H.addH(P.admit,pc.h):snap(P,pc.d||0);if(!opT||t<opT)opT=t;}});var items=[],byKey={},avoid={},holdCls={},r=H.R(P.id+'|meds'),opd=H.opdOf(P);
  P.comorbs.forEach(function(ck){var c=H.comorbidities[ck];(c.avoid||[]).forEach(function(x){avoid[x]=ck;});(c.hold||[]).forEach(function(x){holdCls[x]=ck;});});
  (P.mod.holds||[]).forEach(function(x){holdCls[x]=P.mod.key;});
  function add(it,src,t0){var m=it.m||it;if(!H.forVariant(it,P))return;if(it.needs&&!it.needs.some(function(n){return P.comorbs.indexOf(n)>=0||P.flags[n];}))return;
    if(it.unless&&it.unless.some(function(n){return P.comorbs.indexOf(n)>=0||P.flags[n];}))return;
    var def=resolveMedKey(m,P,src==='home'?{}:avoid);if(!def)return;if(byKey[def.key])return;
    var d=it.d||[0],start,stop=null;
    if(src==='comp'){start=H.addH(t0,(d[0]||0)*24+0.4);if(d[0]>0)start=H.at(start,10,0);if(d.length>1)stop=H.at(H.addH(t0,d[1]*24),10,0);if(stop&&stop<=start)stop=H.addH(start,2);}
    else{start=snap(P,d[0]);if(d.length>1)stop=snap(P,d[1]);if(src==='home'||src==='std')start=H.addMin(P.admit,src==='home'?25:15);
      if((src==='home'||src==='std'||src==='comorb')&&opT&&opT>start)start=H.addH(opT,3);
      if(it.ed&&P.arrive<P.admit)start=H.addMin(P.arrive,60+H.hash(P.id+def.key)%55);if(d[0]<0)start=H.addH(P.admit,d[0]*24);}
    var o={key:def.key,orig:m,def:def,item:typeof it==='string'?{}:it,src:src,start:start,stop:stop,name:medName(def,P),held:null};o.sig=sigOf(def,o.item);
    byKey[def.key]=o;items.push(o);}
  (P.mod.meds||[]).concat(P.variant.meds||[]).forEach(function(it){add(it,'mod');});
  P.comorbs.forEach(function(ck){(H.comorbidities[ck].meds||[]).forEach(function(it){add(it,'comorb');});});
  var nonStdCls={},stems={};
  opd.home.forEach(function(h){if(h.inpt==='stop')return;var before=items.length;add({m:h.key},'home');if(items.length>before){var o=items[items.length-1];o.homeKey=h.key;if(h.inpt==='hold'||holdCls[o.def.cls]){o.held={t:o.start,why:h.why||('held on admission'+(holdCls[o.def.cls]&&H.comorbidities[holdCls[o.def.cls]]?'':' for the acute illness'))};}}});
  if(P.comp)(P.comp.def.meds||[]).forEach(function(it){add(it,'comp',P.comp.recog);});
  items.forEach(function(o){nonStdCls[o.def.cls]=1;stems[o.name.split(' ')[0]]=1;});
  var std=(P.mod.std||T.defaults.meds[P.unit.pop==='adult'&&P.unit.acuity==='icu'?'icu':P.unit.pop]||[]),no=P.mod.nostd||[];
  std.forEach(function(k){if(no.indexOf(k)>=0)return;var d=T.meds[k];if(!d)return;if(d.cls==='anticoagulant'&&(nonStdCls.anticoagulant||P.mod.nostd==='vte'))return;if(stems[d.name.split(' ')[0]])return;if(d.cls==='nicotine'&&!r.chance(.25))return;add(k,'std');});
  /* complication: hold classes / keys from the time it is recognised */
  if(P.comp){var cd=P.comp.def;items.forEach(function(o){if(o.src==='comp')return;if(((cd.holds||[]).indexOf(o.def.cls)>=0||(cd.holdsKeys||[]).indexOf(o.key)>=0)&&!o.held&&(!o.stop||o.stop>P.comp.recog))o.held={t:P.comp.recog,why:'held: '+cd.name.toLowerCase()};});}
  items.forEach(function(o){if(o.held&&o.held.t<=o.start)o.heldFromStart=true;});
  return P._meds=items;}
H.buildMeds=buildMeds;
function activeAt(o,t){return o.start<=t&&(!o.stop||o.stop>t)&&!(o.held&&o.held.t<=t);}
function doseTimes(o,from,to){var f=T.freq[o.item.f||o.def.freq],hrs=f[1],out=[],fk=o.item.f||o.def.freq;if(!hrs.length)return out;
  for(var d=H.day0(from);d<=to;d=H.addD(d,1)){if(fk==='weekly'&&d.getDay()!==o.start.getDay())continue;if(fk==='mwf'&&[1,3,5].indexOf(d.getDay())<0)continue;if(fk==='q48h'&&H.calDays(o.start,d)%2)continue;
    for(var i=0;i<hrs.length;i++){var t=H.at(d,Math.floor(hrs[i]),Math.round((hrs[i]%1)*60));if(t>=from&&t<=to)out.push(t);}}return out;}
function nurseAt(P,t){return t<P.admit&&P.arrive<P.admit?(P.mod.entryNurse||'ED nurse'):H.nurseFor(P.unit.key,P.bedIdx,t,H.shiftOf(t)).name;}
/* as-needed doses are a fixed function of clock time (one possible dose per 6-hour block), so any window of the stay can be listed */
function prnDoses(P,o,from,to){var out=[],fk=o.item.f||o.def.freq,cls=o.def.cls,stop=o.stop&&o.stop<to?o.stop:to,start=o.start>from?o.start:from;if(o.held&&o.held.t<stop)stop=o.held.t;
  if(start<H.addMin(P.admit,10))start=H.addMin(P.admit,10);var blk=6*3600000;
  for(var b=Math.floor(start.getTime()/blk)*blk;b<stop.getTime();b+=blk){var u=H.unit01(P.id+'prn'+o.key+b),t=new Date(b+Math.floor(H.unit01(P.id+'prt'+o.key+b)*340+5)*60000);if(t<start||t>stop)continue;
    var pain=H.valueAt(P,'pain',t),p;if(cls==='analgesic'||cls==='opioid'||cls==='nsaid')p=(cls==='opioid'?pain-3.5:pain-1.5)/5;else if(cls==='antiemetic')p=.07;else if(cls==='bronchodilator')p=H.valueAt(P,'o2',t)>0?.3:.05;else if(cls==='sleep'||cls==='sedative')p=t.getHours()>=18?.25:0;else if(cls==='glucose')p=H.valueAt(P,'glu',t)<45?1:0;else if(cls==='benzodiazepine'||cls==='antipsychotic'||cls==='antihistamine')p=H.phaseIdx(P,H.days(P.admit,t))===0?.2:.04;else p=.04;
    if(u<p)out.push({t:t,st:'given',by:nurseAt(P,t),note:cls==='analgesic'||cls==='opioid'||cls==='nsaid'?'Pain '+H.clamp(pain+1,3,9)+' of 10 before dose':''});}
  return out;}
function medAdmin(P,o,end,dis){var a=[],fk=o.item.f||o.def.freq,stop=o.stop&&o.stop<end?o.stop:end,heldT=o.held?o.held.t:null,win=H.addH(end,-24);
  function G(t,st,note){return {t:t,st:st,by:st==='due'?'':nurseAt(P,t),note:note||''};}
  function jit(t){return H.hash(P.id+o.key+t.getTime())%24-7;}
  if(fk==='once'){var t1=H.addMin(o.start,8+H.hash(P.id+o.key)%15);if(t1<=end&&!o.heldFromStart)a.push(G(t1,'given'));else if(o.start<=end&&!o.heldFromStart&&!dis)a.push(G(t1,'due'));return a;}
  if(/^prn/.test(fk))return o.start>end?a:prnDoses(P,o,win,end);
  var first=o.start;if((o.item.ed&&o.start<P.admit)||(o.src==='comp')||(o.src==='mod'&&(o.item.d||[0])[0]<=0&&P.via!=='elective'&&T.freq[fk][1].length<=3&&o.def.route==='IV')){if(o.start<=end&&!o.heldFromStart&&o.start>=win)a.push(G(H.addMin(o.start,10+H.hash(P.id+o.key)%20),'given',o.start<P.admit?'First dose before transfer to the unit':'First dose'));first=H.addH(o.start,Math.max(3,24/Math.max(1,T.freq[fk][1].length)*.6));}
  var from=first>win?first:win;doseTimes(o,from,stop).forEach(function(t){if(heldT&&t>=heldT){if(t>=win)a.push(G(H.addMin(t,3),'held',H.cap(o.held.why)));}else a.push(G(H.addMin(t,jit(t)),'given'));});
  a=a.filter(function(x){return x.t<=end;});
  if(!dis&&!o.held&&(!o.stop||o.stop>end)){var nx=doseTimes(o,H.addMin(end,1),H.addD(end,fk==='weekly'?8:3));if(nx.length)a.push(G(nx[0],'due'));}
  return a;}
H.prnDoses=prnDoses;

/* ---------- laboratory draws ---------- */
function drawTimes(P,end){if(P._draws&&P._drawsEnd===end.getTime())return P._draws;var out=[],r=H.R(P.id+'|draws'),t0;
  if(P.via==='elective')t0=H.at(H.addD(P.admit,-r.int(5,12)),9+r.int(0,6),r.int(0,11)*5);else t0=H.addMin(P.arrive,P.arrive<P.admit?12+r.int(0,25):10+r.int(0,30));
  out.push(t0);if(P.unit.acuity==='ed'&&P.los*24>4.5){var t2=H.addMin(t0,180+r.int(0,30));if(t2<=end)out.push(t2);}
  /* how often blood is drawn: module field `draws` (days between morning draws, 0.5 = twice daily, 'day1' = once on the first morning, 'adm' = admission only) */
  var u=P.unit,cad=P.mod.draws!=null?P.mod.draws:u.acuity==='icu'&&u.pop!=='neonate'?.5:u.pop==='psych'?7:u.pop==='ob'?'day1':u.pop==='peds'?(u.acuity==='icu'?1:'adm'):u.pop==='neonate'?(u.acuity==='icu'?2:'day1'):u.kinds[0]==='rehab'||u.kinds[0]==='pall'?3:1,nDay=0;
  if(u.acuity!=='ed'&&cad!=='adm')for(var d=H.day0(P.admit),i=0;d<=end&&i<400;d=H.addD(d,1),i++){var mins=H.hash(P.id+'dr'+i)%45,a=H.at(d,5,mins);if(a>H.addH(P.admit,3)&&a>H.addH(t0,5)){nDay++;if(cad==='day1'?nDay===1:(cad<=1||(nDay-1)%cad===0)){if(a<=end)out.push(a);}}
    if(cad===.5){var b=H.at(d,17,mins);if(b>H.addH(P.admit,3)&&b>H.addH(out[out.length-1],5)&&b<=end)out.push(b);}}
  P._draws=out;P._drawsEnd=end.getTime();return out;}
function labKeys(P){if(P._lk)return P._lk;var spec={},order=[],from={},add=function(s){var m=String(s).split('@'),k=m[0];if(!T.labs[k])throw new Error('Unknown lab key "'+k+'" in module '+P.mod.key);if(spec[k]==null)order.push(k);spec[k]=m[1]?+m[1]:(spec[k]||0);};
  T.corePanels.Chemistry.concat(T.corePanels['Blood count']).forEach(add);(P.mod.labs||[]).concat(P.variant.labs||[]).forEach(add);
  P.comorbs.forEach(function(ck){(H.comorbidities[ck].showLabs||[]).forEach(add);});
  var panels={};order.forEach(function(k){panels[T.labs[k].panel]=1;});if(Object.keys(panels).length<3)T.thirdPanel.forEach(function(k){add(k+'@1');});
  /* tests sent because of a complication appear only from the time it is recognised */
  if(P.comp)for(var k in (P.comp.def.course||{}))if(T.labs[k]&&spec[k]==null){add(k);from[k]=P.comp.recog;}
  return P._lk={order:order,spec:spec,from:from};}
function hasLab(P,k,draws,i){var lk=labKeys(P),lim=lk.spec[k];if(lk.from[k])return draws[i]>=lk.from[k];return !lim||i<lim;}
function labValue(P,k,draws,i){if(k==='egfr')return egfr(labValue(P,'cr',draws,i),Math.max(18,P.person.ageY),P.person.sex);return H.valueAt(P,k,draws[i],'L'+i);}
function labsAt(P,draws,i){var o={},lk=labKeys(P);lk.order.forEach(function(k){if(hasLab(P,k,draws,i))o[k]=labValue(P,k,draws,i);});return o;}
function labRange(P,k){var t=T.labs[k],lo=t.lo,hi=t.hi;if(t.sex&&t.sex[P.person.sex]){lo=t.sex[P.person.sex].lo;hi=t.sex[P.person.sex].hi;}var rg=P.mod.ranges&&P.mod.ranges[k];if(rg){lo=rg[0];hi=rg[1];}return [lo,hi];}
function buildLabs(P,draws){var lk=labKeys(P),n=draws.length,show=[];for(var i=0;i<n;i++)if(i===0||i>=n-4)show.push(i);
  var byPanel={};lk.order.forEach(function(k){var p=T.labs[k].panel;(byPanel[p]=byPanel[p]||[]).push(k);});
  var out=[];T.panelOrder.forEach(function(pn){var ks=byPanel[pn];if(!ks)return;var cols=show.filter(function(i){return ks.some(function(k){return hasLab(P,k,draws,i);});});if(!cols.length)return;
    out.push({panel:pn,times:cols.map(function(i){return draws[i];}),rows:ks.map(function(k){var t=T.labs[k],rg=labRange(P,k);return [t.name,t.unit,rg[0],rg[1],cols.map(function(i){return hasLab(P,k,draws,i)?labValue(P,k,draws,i):null;})];})});});
  return out;}

/* ---------- context for templates ---------- */
function fmtLab(k,v){var t=T.labs[k];return v==null?'':(t.dec?v.toFixed(t.dec):H.num(v));}
function ctxAt(P,t,draws){var pr=P.person,ot=H.obsTimes(P,t),vt=ot[ot.length-1];if(vt>t)vt=t;var v=H.vitalsAt(P,vt),i=-1;for(var j=0;j<draws.length;j++)if(draws[j]<=t)i=j;
  var lk=labKeys(P),lab={},prev={},lab0={},peak={},cur={},prv={},k,ii=i<0?0:i;
  lk.order.forEach(function(k){var lim=lk.spec[k],last=lim?Math.min(ii,lim-1):ii;if(lk.from[k]){if(draws[ii]<lk.from[k])return;var f1=0;while(draws[f1]<lk.from[k])f1++;if(last-1<f1){var v0=labValue(P,k,draws,last);cur[k]=v0;prv[k]=v0;lab[k]=prev[k]=lab0[k]=peak[k]=fmtLab(k,v0);return;}}
    var v=labValue(P,k,draws,last),pv=last>0?labValue(P,k,draws,last-1):v,f0=labValue(P,k,draws,0),mx=f0;
    for(var j=1;j<=last;j++){var x=labValue(P,k,draws,j);if(x>mx)mx=x;}
    cur[k]=v;prv[k]=pv;lab[k]=fmtLab(k,v);prev[k]=fmtLab(k,pv);lab0[k]=fmtLab(k,f0);peak[k]=fmtLab(k,mx);});
  var adult=pr.ageY>=16,male=pr.sex==='M',ag=H.ageAt(pr,t<P.arrive?P.arrive:t),c={age:ag.adj,ageN:ag.age,sex:pr.ageY<1?'baby':adult?(male?'man':'woman'):(male?'boy':'girl'),he:male?'he':'she',He:male?'He':'She',his:male?'his':'her',His:male?'His':'Her',him:male?'him':'her',
    name:pr.given+' '+pr.sur,given:pr.given,surname:pr.sur,title:pr.title?pr.title+' '+pr.sur:pr.given,side:pr.side,otherside:pr.side==='left'?'right':'left',Side:H.cap(pr.side),
    day:H.calDays(P.admit,t)+1,unit:P.unit.name,service:M.serviceByKey[P.service].name,dx:P.dx,hospital:M.name,code:P.code,
    rhythm:rhythmAt(P,t,v),Rhythm:H.cap(rhythmAt(P,t,v)),pulse:/fibrillation/.test(rhythmAt(P,t,v))?'irregular':'regular',Pulse:/fibrillation/.test(rhythmAt(P,t,v))?'Irregular':'Regular',fever:v.temp>=38?'febrile':v.temp>=37.6?'low-grade temperature':'afebrile',temp:v.temp.toFixed(1),hr:v.hr,rr:v.rr,bp:v.bp,sbp:v.sbp,spo2:v.spo2,o2:o2Phrase(v.o2),pain:v.pain,wt:wtAt(P,t),
    lab:lab,prev:prev,lab0:lab0,peak:peak,attending:H.teamOf(P,t).attending.name,admitdate:H.dm(P.admit),weightkg:pr.wtKg,_v:v,_lab:cur,_prev:prv,_i:i};
  c.Otherside=H.cap(c.otherside);for(k in (P.mod.custom||{}))c[k]=H.valueAt(P,k,vt);
  for(k in P.vars)c[k]=P.vars[k];
  c.med={};buildMeds(P).forEach(function(o){if(c.med[o.orig]==null)c.med[o.orig]=lc(o.name);});(P.mod.meds||[]).concat(P.variant.meds||[]).forEach(function(it){var mk=it.m||it;if(c.med[mk]==null)c.med[mk]='an alternative (usual choice not suitable)';});c.rx=rxText(P,t,'mod');c.crx=rxText(P,t,'comp');
  if(P.mod.pod!=null){var pd=H.calDays(H.addH(P.admit,P.mod.pod*24),t);c.pod=pd;}
  return c;}
function rhythmAt(P,t,v){var af=P.comorbs.indexOf('af')>=0||(P.comp&&P.comp.key==='afrvr'&&t>=P.comp.onset)||P.variant.rhythm==='af'||P.mod.rhythm==='af';if(P.mod.rhythm&&P.mod.rhythm!=='af')return P.mod.rhythm;
  return af?'atrial fibrillation':P.person.ageY>=12&&v.hr>100?'sinus tachycardia':P.person.ageY>=12&&v.hr<50?'sinus bradycardia':'sinus rhythm';}
function o2Phrase(v){return v<0.5?'room air':v<=6?v+' L nasal oxygen':v<=15?'mask oxygen at '+v+' L/min':v<90?'high-flow oxygen at '+v+' L/min':'the ventilator';}
H.o2Phrase=o2Phrase;
function lc(s){return s.charAt(0).toLowerCase()+s.slice(1);}
function rxText(P,t,src){var out=[];buildMeds(P).forEach(function(o){var fk=o.item.f||o.def.freq;if(o.src!==src||o.item.aux||/^prn/.test(fk)||o.def.cls==='fluid'||!activeAt(o,t))return;out.push(lc(o.name)+' '+o.sig.split(' \u00b7 ').join(' ').toLowerCase());});return out.length?H.list(out):'supportive treatment';}
function wtAt(P,t){var kg=P.person.wtKg,c=P.course.wt;if(c){var d=H.days(P.admit,t);kg+=P.sev*H.interp(c,d>0?d/P.f:d);var wd=H.day0(t);kg+=0.15*H.noise(P.id+'wt'+wd.getTime());}
  return P.unit.pop==='neonate'?H.num(Math.round(kg*1000/5)*5)+' g':H.round(kg,1).toFixed(1)+' kg';}
H.ctxAt=ctxAt;
function phaseBank(P,bank,t,r){var i=H.phaseIdx(P,H.days(P.admit,t));return H.byPhase(bank,P.mod.phases||[['acute',0]],i);}
function txt(P,tpl,ctx,r){return H.fill(tpl,ctx,r);}
function sent(s){s=String(s||'').trim();return s&&!/[.!?:]$/.test(s)?s+'.':s;}

/* ---------- flowsheets ---------- */
function limits(P,k){var t=T.vitals[k],lo=t.lo,hi=t.hi,a=P.person.ageY;if(a<18){var pn=H.pedsNorm(a);if(pn){if(k==='hr'){lo=Math.round(pn[1]*.7);hi=Math.round(pn[1]*1.3);}if(k==='rr'){lo=Math.round(pn[2]*.6);hi=Math.round(pn[2]*1.45);}if(k==='temp'){lo=36.3;hi=37.9;}}}
  if(a>=75&&k==='temp'){lo=35.8;hi=37.8;}return [lo,hi];}
function buildVitals(P,times){var V=times.map(function(t){return H.vitalsAt(P,t);}),a=P.person.ageY,pn=a<18?H.pedsNorm(a):null;
  function row(k){var l=limits(P,k),t=T.vitals[k];return {k:k,l:t.l,u:t.u,lo:l[0],hi:l[1],v:V.map(function(x){return x[k];})};}
  return {group:{name:'Vitals',chart:true,times:times,rows:[row('temp'),row('hr'),row('rr'),{k:'bp',l:'Blood pressure',u:'mmHg',type:'bp',s:V.map(function(x){return x.sbp;}),d:V.map(function(x){return x.dbp;})},
    {k:'map',l:'Mean arterial pressure',u:'mmHg',type:'map',lo:pn?Math.round(pn[3]*.55):65,hi:pn?Math.round(pn[3]*.95):110},row('spo2'),{k:'o2',l:'Oxygen delivery',v:V.map(function(x){return x.o2text;})},
    {k:'pain',l:P.unit.pop==='neonate'||a<4?'Pain (observed discomfort)':'Pain',u:'0–10',lo:-1,hi:6,v:V.map(function(x){return x.pain;})}]},V:V};}
function urineHour(P,t){var a=P.person.ageY,perKg=a<1?2.2:a<12?1.4:0.85,base=P.course.uo?H.interp(P.course.uo,H.days(P.admit,t)/P.f):perKg*Math.min(P.person.wtKg,90);
  return Math.max(0,Math.round(base*(1+.35*H.noise(P.id+'uo'+Math.floor(t.getTime()/3600000)))/(a<1?1:5))*(a<1?1:5));}
function buildSpecialty(P,times,ctx){var f=P.mod.flow||{},rows=[],r=rnd(P,'flow'),dia=P.flags.diabetic;
  (f.rows||[]).forEach(function(rw){var o={l:H.fill(rw.l,ctx)};if(rw.u)o.u=rw.u;
    if(rw.k){var tab=T.labs[rw.k]||T.vitals[rw.k]||(P.mod.custom||{})[rw.k]||{};if(rw.lo!=null||tab.lo!=null){o.lo=rw.lo!=null?rw.lo:tab.lo;o.hi=rw.hi!=null?rw.hi:tab.hi;}if(tab.dec)o.dec=tab.dec;if(!o.u&&tab.u)o.u=tab.u;
      o.v=times.map(function(t,i){if(rw.every&&(times.length-1-i)%rw.every)return '';if(rw.k==='wt')return i===times.length-1||t.getHours()<=7&&t.getHours()>=4?wtAt(P,t).replace(/ (kg|g)$/,''):'';if(rw.k==='uo')return urineHour(P,t);return H.valueAt(P,rw.k,t);});if(rw.k==='wt')o.u=P.unit.pop==='neonate'?'g':'kg';}
    else o.v=times.map(function(t,i){if(rw.every&&(times.length-1-i)%rw.every)return '';var c2={};for(var k in ctx)c2[k]=ctx[k];var v=H.vitalsAt(P,t);c2.hr=v.hr;c2.spo2=v.spo2;c2.o2=v.o2text;c2.rhythm=rhythmAt(P,t,v);c2.Rhythm=H.cap(c2.rhythm);return txt(P,phaseBank(P,rw.p||rw.t,t),c2,H.R(P.id+'f'+rw.l+H.day0(t).getTime()+(t.getHours()<12?'a':'p')).f);});
    rows.push(o);});
  var pad=[];if(P.unit.acuity==='icu')pad.push({l:'Urine output',u:'mL/h',lo:P.person.ageY<18?Math.round(P.person.wtKg):30,hi:9999,v:times.map(function(t){return urineHour(P,t);})});
  pad.push({l:'Bedside glucose',u:'mg/dL',lo:70,hi:180,v:times.map(function(t,i){var h=t.getHours();if(!(dia||P.unit.acuity==='icu'||P.unit.pop==='neonate'))return i===0?H.valueAt(P,'glu',t,'bg'+i):'';return (dia?[8,12,16,20].indexOf(h)>=0:h%6===0)||i===0?Math.round(H.valueAt(P,'glu',t,'bg'+i)*(dia?1.12:1)):'';})});
  pad.push({l:'Level of alertness',v:times.map(function(t){var d=P.comp&&P.comp.key==='delirium'&&t>=P.comp.onset&&H.days(P.comp.onset,t)<2.5;return d?(t.getHours()>=18||t.getHours()<6?'Confused, restless':'Drowsy, inattentive'):(t.getHours()<6?'Asleep, rouses easily':'Alert');})});
  pad.push({l:P.unit.pop==='neonate'?'Feeds taken':'Oral intake (share of meal)',u:'%',v:times.map(function(t){var h=t.getHours(),pi=H.phaseIdx(P,H.days(P.admit,t)),np=(P.mod.phases||[1]).length;if([8,12,16,20].indexOf(h)<0)return '';return Math.min(100,Math.round((30+60*(np>1?pi/(np-1):1)+20*H.noise(P.id+'eat'+t.getTime()))/5)*5);})});
  pad.push({l:'Position and activity',v:times.map(function(t){var h=t.getHours(),pi=H.phaseIdx(P,H.days(P.admit,t));return h<6||h>=22?'In bed, asleep':pi===0?'In bed, head up':['Chair','Walking with help','In bed, resting'][H.hash(P.id+'act'+t.getTime())%3];})});
  pad.push({l:'Weight',u:P.unit.pop==='neonate'?'g':'kg',v:times.map(function(t,i){return i===0||(t.getHours()>=4&&t.getHours()<=7)?wtAt(P,t).replace(/ (kg|g)$/,''):'';})});
  pad.push({l:'Comfort round',v:times.map(function(){return 'Done';})});
  for(var i=0;rows.length<5&&i<pad.length;i++)if(!rows.some(function(x){return x.l===pad[i].l;}))rows.push(pad[i]);
  if(P.unit.acuity==='icu'&&!rows.some(function(x){return /Urine output/.test(x.l);}))rows.push(pad[0]);
  return {name:f.name||(P.unit.acuity==='icu'?'Critical care observations':'Condition observations'),times:times,rows:rows.slice(0,8)};}
function buildNursing(P,end,ctx){var pop=P.unit.pop==='adult'&&P.unit.acuity==='icu'?'icu':P.unit.pop,def=T.defaults.nursing[pop]||T.defaults.nursing.adult,cols=[],t;
  for(t=H.at(P.admit,8);t<=end;t=H.addH(t,12))if(t>=P.admit)cols.push(t);cols=cols.slice(-3);if(!cols.length)cols=[P.admit];
  var np=(P.mod.phases||[1]).length,labels=Object.keys(def),mn=P.mod.nursing||{};Object.keys(mn).forEach(function(l){if(labels.indexOf(l)<0)labels.push(l);});
  var rows=labels.slice(0,10).map(function(l){return {l:l,v:cols.map(function(c,ci){var pi=H.phaseIdx(P,H.days(P.admit,c)),st=pi===0?0:pi>=np-1?2:1,r=H.R(P.id+'n'+l+c.getTime()).f,cn=P.comp&&c>=P.comp.recog&&H.days(P.comp.recog,c)<3&&P.comp.def.nursing&&P.comp.def.nursing[l];
    if(cn)return H.cap(txt(P,cn,ctx,r));var b=mn[l]!=null?phaseBank(P,mn[l],c):def[l]?def[l][st]:'';var c2={};for(var k in ctx)c2[k]=ctx[k];var v=H.vitalsAt(P,c);c2.o2=o2Phrase(v.o2);c2.spo2=v.spo2;c2.hr=v.hr;c2.pain=v.pain;c2.rhythm=rhythmAt(P,c,v);c2.pulse=/fibrillation/.test(c2.rhythm)?'irregular':'regular';c2.Pulse=H.cap(c2.pulse);c2.Rhythm=H.cap(c2.rhythm);return txt(P,b,c2,r);})};});
  return {name:'Nursing assessment',cols:cols.map(function(c){return H.dt(c);}),rows:rows,_t:cols};}
function buildIO(P,end,meds){var shifts=[],s=H.at(end,end.getHours()>=19?19:7);if(end.getHours()<7)s=H.at(H.addD(end,-1),19);
  for(var i=0;i<3;i++){var a=H.addH(s,-12*i),b=H.addH(a,12);if(b<=P.admit)break;shifts.unshift([a<P.admit?P.admit:a,b>end?end:b,a]);}
  if(!shifts.length)shifts=[[P.admit,end,s]];
  var a1=P.person.ageY,scale=a1<1?P.person.wtKg/70*1.6:a1<14?Math.max(.25,P.person.wtKg/70):1,io=P.mod.io||{},np=(P.mod.phases||[1]).length;
  function hours(x){return Math.max(0,H.days(x[0],x[1])*24);}
  var iv=[],oral=[],ur=[],extra=(io.out||[]).map(function(){return [];}),tin=[],tout=[],net=[];
  shifts.forEach(function(x,si){var hh=hours(x),ivv=0;meds.forEach(function(o){var fk=o.item.f||o.def.freq,ov=Math.max(0,H.days(o.start>x[0]?o.start:x[0],(o.stop&&o.stop<x[1]?o.stop:x[1]))*24);if(o.held&&o.held.t<x[1])ov=Math.max(0,H.days(o.start>x[0]?o.start:x[0],o.held.t)*24);if(ov<=0)return;
      if(fk==='inf'){var m=/([\d.]+) mL\/h/.exec(o.item.rate||o.def.extra);ivv+=m?+m[1]*ov:o.def.cls==='fluid'?(a1<18?4*Math.min(10,P.person.wtKg)+2*Math.max(0,Math.min(10,P.person.wtKg-10))+Math.max(0,P.person.wtKg-20):80)*ov:8*ov;}
      else if(o.def.route==='IV'&&!/^prn|once/.test(fk))ivv+=(a1<14?10:50)*Math.round(ov/24*T.freq[fk][1].length);});
    ivv=Math.round(ivv/5)*5;var pi=H.phaseIdx(P,H.days(P.admit,x[1])),frac=np>1?pi/(np-1):1,night=x[2].getHours()===19;
    var wk=P.person.wtKg,maint=a1<.25?wk*(30+45*Math.min(1,H.days(P.person.dobDate,x[1])/5)):a1<18?(Math.min(wk,10)*100+Math.max(0,Math.min(wk-10,10))*50+Math.max(0,wk-20)*20)/2:1000;
    var o=Math.round((io.oral?H.byPhase(io.oral,P.mod.phases,pi)*scale:maint*(a1<.25?(.5+.5*frac):(.3+.7*frac)))*(night?.65:1.25)*hh/12*(1+.2*H.noise(P.id+'or'+x[2].getTime()))/(a1<1?5:10))*(a1<1?5:10);if(io.npo&&pi===0)o=0;if(a1<.25)o=Math.max(0,o-ivv);
    var u=0;for(var t=new Date(x[0].getTime());t<x[1];t=H.addH(t,1))u+=urineHour(P,t)*Math.min(1,H.days(t,x[1])*24);u=Math.round(u/5)*5;ivv=Math.round(ivv/5)*5;
    var ex=0;(io.out||[]).forEach(function(e,ei){var v=Math.round(Math.max(0,H.interp(P.course[e.k]||[[0,0]],H.days(P.admit,x[1])/P.f))*hh/12*(1+.25*H.noise(P.id+e.k+x[2].getTime()))/5)*5;extra[ei].push(v);ex+=v;});
    iv.push(ivv);oral.push(o);ur.push(u);tin.push(ivv+o);tout.push(u+ex);net.push(H.signed(ivv+o-u-ex));});
  var rows=[{l:'Intravenous',v:iv},{l:P.unit.pop==='neonate'?'Feeds':'Oral',v:oral},{l:'Total in',sum:1,v:tin},{l:'Urine',v:ur}];(io.out||[]).forEach(function(e,ei){rows.push({l:e.l,v:extra[ei]});});
  rows.push({l:'Total out',sum:1,v:tout},{l:'Net balance',sum:1,v:net});
  return {name:'Intake and output',cols:shifts.map(function(x){var night=x[2].getHours()===19;return H.dm(x[2])+(night?' night':' day')+' ('+(x[0]>x[2]?H.hm(x[0]):night?'19':'07')+'–'+(H.days(x[2],x[1])<0.499?H.hm(x[1]):night?'07':'19')+')';}),unit:'mL',rows:rows};}

/* ---------- reports ---------- */
var BY={rad:'Radiology',micro:'Microbiology Laboratory',path:'Pathology',team:null,card:'Cardiology'};
function buildReports(P,end,ctx){var out={micro:[],imaging:[],path:[]},list=(P.mod.reports||[]).concat(P.variant.reports||[]),r=H.R(P.id+'|rep');
  if(P.comp&&P.comp.def.report)list=list.concat([{_comp:1,k:P.comp.def.report.k,t:P.comp.def.report.t,by:P.comp.def.report.by,body:P.comp.def.report.body}]);
  list.forEach(function(rp,i){if(!H.forVariant(rp,P))return;var t;
    if(rp._comp)t=H.addMin(P.comp.recog,40+r.int(0,80));else{var d=rp.d||0;t=d<=0?(P.via==='elective'?H.addH(P.admit,-24*(6+i))&&H.addMin(H.at(H.addD(P.admit,-6-(i%3)),10,0),i*25):H.addMin(P.arrive,Math.max(8,Math.round((1+d)*H.days(P.arrive,P.admit)*1440*.8))+i*7)):H.addMin(snap(P,d),-60+i*35+r.int(0,40));
      if(rp.h!=null)t=H.addH(P.admit,rp.h);if(P.via!=='elective'&&d<=0&&t>=P.admit)t=H.addMin(P.admit,-5-i*3);}
    if(t>end)return;var by=rp.by||'rad',who=BY[by]===null?H.teamOf(P,t).attending.name:'Dr. '+H.staffName((by==='micro'?'micro':by==='path'?'path':'rad')+(H.hash(P.id+i)%14),'full')+', '+(BY[by]||M.serviceByKey[by]&&M.serviceByKey[by].name||'Radiology');
    var status='Final',body=rp.body;if(rp.final&&H.days(t,end)<rp.final){status='Preliminary';body=rp.pre||body;}
    var c2={};for(var k in ctx)c2[k]=ctx[k];var cc=ctxAt(P,t,drawTimes(P,end));c2.hr=cc.hr;c2.lab=cc.lab;c2.rhythm=cc.rhythm;c2.Rhythm=cc.Rhythm;c2.bp=cc.bp;c2.spo2=cc.spo2;
    out[rp.k==='micro'?'micro':rp.k==='path'?'path':'imaging'].push({title:txt(P,rp.t,c2,r.f),t:t,status:status,by:who,body:txt(P,body,c2,H.R(P.id+'rb'+i).f)});});
  ['micro','imaging','path'].forEach(function(k){out[k].sort(function(a,b){return b.t-a.t;});});
  if(out.micro.length+out.imaging.length+out.path.length<2){var pop=P.unit.pop,t0=H.addMin(P.arrive,-3),who2='Dr. '+H.staffName('rad'+(H.hash(P.id)%14),'full')+', Radiology';
    if(P.via==='elective')t0=H.at(H.addD(P.admit,-6),11,0);
    if(pop==='adult'||pop==='psych'||pop==='ob')out.imaging.push({title:'12-lead ECG',t:H.addMin(t0,pop==='adult'&&P.via!=='elective'?-2:0),status:'Final',by:H.teamOf(P,P.admit).attending.name,body:ctxAt(P,P.arrive,drawTimes(P,end)).Rhythm+', rate '+ctxAt(P,P.arrive,drawTimes(P,end)).hr+'. Normal axis and intervals. No acute ST or T-wave changes.\n\nImpression: No acute abnormality.'});
    if(out.micro.length+out.imaging.length+out.path.length<2)out.micro.push({title:pop==='neonate'?'Newborn blood spot screen':'Nasal screen for resistant Staphylococcus',t:H.addMin(t0,-4),status:'Final',by:'Microbiology Laboratory',body:pop==='neonate'?'Sample received and adequate. Results will be reported to the newborn screening programme.\n\nInterpretation: specimen satisfactory.':'Methicillin-resistant Staphylococcus aureus not detected by nucleic acid test.\n\nInterpretation: negative screen.'});
    if(out.micro.length+out.imaging.length+out.path.length<2)out.imaging.push({title:'Chest X-ray, 1 view',t:H.addMin(t0,-6),status:'Final',by:who2,body:'Heart size normal. Lungs clear. No effusion or pneumothorax.\n\nImpression: No acute abnormality.'});}
  return out;}

/* ---------- orders, lines, alerts ---------- */
function buildOrders(P,end,meds,cons,ctx){var out=[],r=rnd(P,'ord'),pop=P.unit.pop==='adult'&&P.unit.acuity==='icu'?'icu':P.unit.pop,c2=H.dxCtx(P);c2.unit=P.unit.name;c2.code=P.code;
  var skipDiet=(P.mod.orders||[]).some(function(o){return o[0]==='Diet';})||P.flags.diabetic;
  (T.defaults.orders[pop]||T.defaults.orders.adult).forEach(function(o){if(o[0]==='Diet'&&skipDiet)return;out.push([o[0],H.fill(o[1],c2),'Active',H.addMin(P.admit,2)]);});
  if(P.flags.diabetic&&!(P.mod.orders||[]).some(function(o){return o[0]==='Diet';}))out.push(['Diet','Consistent-carbohydrate diet','Active',H.addMin(P.admit,2)]);
  (P.mod.orders||[]).concat(P.variant.orders||[]).forEach(function(o){if(o[4]&&!H.forVariant(o[4],P))return;var d=o[2]||0,t=d<=0?H.addMin(P.admit,3):snap(P,d);if(t>end)return;var to=o[3]!=null?snap(P,o[3]):null;out.push([o[0],H.fill(o[1],c2,r),to&&to<=end?'Completed':'Active',t]);});
  P.comorbs.forEach(function(ck){(H.comorbidities[ck].orders||[]).forEach(function(o){out.push([o[0],H.fill(o[1],c2,r),'Active',H.addMin(P.admit,4)]);});});
  if(P.comp&&P.comp.recog<=end)(P.comp.def.orders||[]).forEach(function(o){out.push([o[0],H.fill(o[1],c2,r),(o[0]==='Imaging'||(o[0]==='Laboratory'&&!/daily|every|until|twice|before meals/.test(o[1])))&&H.days(P.comp.recog,end)>.5?'Completed':'Active',H.addMin(P.comp.recog,15)]);});
  cons.forEach(function(c){if(c.t>end||c.svc==='cm')return;out.push(['Consult',M.serviceByKey[c.svc].name+(c.reason?': '+H.fill(c.reason,c2,r):''),c.seen<=end?'Completed':'Pending',c.t]);});
  meds.forEach(function(o){if(o.held&&o.held.t<=end)out.push(['Medication',o.name+' '+(T.routes[o.def.route]||'').toLowerCase()+' — HOLD ('+o.held.why.replace(/^held:? ?/,'')+')','On hold',o.held.t]);
    else if(o.stop&&o.stop<=end&&o.src!=='std')out.push(['Medication',o.name+' — completed','Completed',o.stop]);});
  return out;}
function buildLines(P,end,V,meds){var out=[],r=H.R(P.id+'|lines'),t0=P.arrive<P.admit?H.addMin(P.arrive,20):H.addMin(P.admit,30),neo=P.unit.pop==='neonate',ivNeeded=meds.some(function(o){return o.def.route==='IV'&&o.start<=end;});
  if((!neo&&P.unit.pop!=='psych')||ivNeeded)out.push(['Peripheral IV, '+(P.person.ageY<2?'24':P.person.ageY<12?'22':r.pick(['20','20','18','22']))+' gauge',r.pick(['Left forearm','Right forearm','Left hand','Right hand','Left inner elbow']),H.dt(t0),'Patent'+(ivNeeded?'':', saline lock')]);
  (P.mod.lines||[]).concat(P.variant.lines||[]).forEach(function(l){if(l[4]&&!H.forVariant(l[4],P))return;var d=l[2]||[0],a=d[0]<=0?H.addMin(P.admit,d[0]<0?d[0]*1440:40):snap(P,d[0]),b=d.length>1?snap(P,d[1]):null;if(a>end)return;var c2=H.dxCtx(P);out.push([H.fill(l[0],c2),H.fill(l[1]||'',c2),H.dt(a),b&&b<=end?'Removed '+H.dt(b):(l[3]||'In place')]);});
  var last=V[V.length-1];if(last.o2>0)out.push([last.o2>=90?'Breathing tube and ventilator':last.o2>15?'High-flow nasal oxygen':last.o2>6?'Oxygen mask':'Nasal oxygen',last.o2>=90?'Oral':'Nasal prongs',H.dt(t0),last.o2text]);
  if(P.unit.acuity!=='ward'&&P.unit.pop!=='psych'&&!out.some(function(l){return /monitor/i.test(l[0]);}))out.push(['Cardiac monitor'+(neo?' and saturation probe':''),neo?'3 leads':'5 leads',H.dt(H.addMin(P.admit,15)),H.cap(rhythmAt(P,end,last))]);
  if(out.length<3)out.push(['Identification band',neo?'Both ankles':'Left wrist',H.dt(t0),'Checked each shift']);
  if(out.length<3&&(neo||P.unit.pop==='adult'))out.push([neo?'Security tag':'Sequential compression sleeves',neo?'Ankle':'Both calves',H.dt(H.addMin(P.admit,45)),neo?'Active':'In use']);
  if(out.length<3&&P._alg&&P._alg[0][0]!=='No known allergies')out.push(['Allergy band','Wrist',H.dt(t0),'In place']);
  return out.slice(0,6);}
function buildAlerts(P,ctx,meds,alg){var a={},lab=ctx._lab,pen=alg.filter(function(x){return /Penicillin/.test(x[0]);})[0];
  if(pen)a.pip='Penicillin allergy recorded ('+pen[1]+'). Piperacillin-tazobactam is a penicillin; choose another agent or clarify the reaction first.';
  if(lab.cr!=null&&(lab.cr>=1.5||P.flags.renal))a.ct='Creatinine '+ctx.lab.cr+' mg/dL'+(P.flags.renal?' with chronic kidney disease':'')+'. Intravenous contrast carries added risk; discuss with the team first.';
  if(lab.k!=null&&lab.k>=5)a.kcl='Potassium is '+ctx.lab.k+' mmol/L. Do not give more potassium.';else if(P.flags.renal)a.kcl='Chronic kidney disease: potassium is cleared slowly. Use a reduced dose and recheck the level.';
  var ac=meds.filter(function(o){return o.def.cls==='anticoagulant'&&!o.held&&(!o.stop);})[0];if(ac)a.hep='Already on '+ac.name+'. Adding heparin would duplicate anticoagulation.';
  else if(lab.plt!=null&&lab.plt<100)a.hep='Platelets '+ctx.lab.plt+' ×10⁹/L. Check for bleeding risk before giving heparin.';
  if(P.comorbs.indexOf('cirrhosis')>=0||(lab.alt!=null&&lab.alt>150))a.apap='Liver disease or raised liver enzymes: keep total acetaminophen at or below 2 g a day.';
  if(ctx._v.sbp<100)a.furo='Systolic blood pressure is '+ctx._v.sbp+' mmHg. Furosemide may lower it further.';
  if(P.flags.renal&&!a.mag)a.mag='Chronic kidney disease: magnesium accumulates. Check the level before giving more.';
  var ks=Object.keys(a);if(ks.length<2){if(!a.ct&&P.person.ageY>=70)a.ct='Age '+P.person.age+': check kidney function from today before intravenous contrast.';if(!a.apap)a.apap='Scheduled or as-needed acetaminophen may already be ordered; check the 24-hour total before adding more.';}
  ks=Object.keys(a);while(ks.length>4){delete a[ks.pop()];}
  return a;}

/* ---------- notes ---------- */
var LABN={wbc:'white cells',hgb:'haemoglobin',plt:'platelets',cr:'creatinine',k:'potassium',na:'sodium',bun:'urea nitrogen',glu:'glucose',crp:'C-reactive protein',procal:'procalcitonin',lactate:'lactate',trop:'troponin',bnp:'BNP',hco3:'bicarbonate',
  lipase:'lipase',tbil:'bilirubin',alt:'ALT',ast:'AST',inr:'INR',mg:'magnesium',nbili:'bilirubin',ph:'pH',bhb:'ketones',alb:'albumin',alp:'alkaline phosphatase',lithium:'lithium',neut:'neutrophils',ca:'calcium',phos:'phosphate',ck:'creatine kinase',ddimer:'D-dimer',egfr:'eGFR',a1c:'HbA1c',amm:'ammonia',fib:'fibrinogen'};
function labLine(P,ctx,keys,withPrev){var parts=[];keys.forEach(function(k){if(ctx.lab[k]==null||ctx.lab[k]==='')return;var s=(LABN[k]||T.labs[k].name.toLowerCase())+' '+ctx.lab[k];if(withPrev&&ctx._i>0&&ctx.prev[k]!==''&&ctx.prev[k]!=null)s+=' ('+ctx.prev[k]+')';parts.push(s);});return parts.length?H.cap(parts.join(', '))+'.':'';}
function vitLine(c){return 'Temperature '+c.temp+' °C, heart rate '+c.hr+', blood pressure '+c.bp+', respiratory rate '+c.rr+', saturation '+c.spo2+'% on '+c.o2+'.';}
function trackKeys(P){return P.mod.track||['wbc','hgb','cr','k'];}
function homeList(P){var h=H.opdOf(P).home;return h.length?h.map(function(x){return x.text;}):['No regular medicines'];}
function pmhList(P){var o=H.opdOf(P);return o.pmh.length?o.pmh:[P.unit.pop==='neonate'?'Newborn':'No significant past medical history'];}
function changesBetween(P,meds,a,b,draws){var out=[];meds.forEach(function(o){if(o.src==='std'||o.src==='home'||o.src==='comorb')if(!(o.held&&o.held.t>a&&o.held.t<=b))return;
    if(o.start>a&&o.start<=b&&!o.heldFromStart&&o.start>H.addH(P.admit,2))out.push('started '+o.name+' '+o.sig.split(' · ').join(' ').toLowerCase());
    if(o.stop&&o.stop>a&&o.stop<=b)out.push('stopped '+o.name);if(o.held&&o.held.t>a&&o.held.t<=b&&!o.heldFromStart)out.push(o.name+' put on hold');});
  var oa=H.valueAt(P,'o2',a),ob=H.valueAt(P,'o2',b);if(oa!==ob&&a>=P.admit)out.push('oxygen '+(ob<oa?'weaned':'increased')+' from '+o2Phrase(oa)+' to '+o2Phrase(ob));
  return out;}
function buildNotes(P,end,dis,X){var notes=[],ctx0=X.ctx0,draws=X.draws,meds=X.meds,cons=X.cons,mn=P.mod.notes||{},team=H.teamOf(P,end),u=P.unit,pop=u.pop,pr=P.person,viaEd=P.via==='ed',elect=P.via==='elective';
  var entry=P.mod.entry||(u.acuity==='ed'||viaEd?'emergency department':pop==='neonate'?'delivery room':pop==='ob'?'labour and birth triage':'admissions office'),isED=/emergency/.test(entry);
  var svcName=M.serviceByKey[P.service].name,intern=(team.interns&&team.interns[0])||team.senior||team.attending,senior=team.senior||team.attending,opd=H.opdOf(P);
  function who(p){return p.name+(p.grade?', '+p.grade:'');}
  function N(type,title,by,t,body){if(t>end)return;notes.push({type:type,title:title,by:by,t:t,body:body.replace(/\n{3,}/g,'\n\n').replace(/ +\n/g,'\n').trim()});}
  function C(t){return ctxAt(P,t,draws);}
  function F(tpl,c,tag){return H.fill(tpl,c,H.R(P.id+'|nt|'+tag).f);}
  function ph(bank,t){return phaseBank(P,bank,t);}
  var algTxt=X.alg[0][0]==='No known allergies'?'No known allergies':X.alg.map(function(a){return a[0]+' ('+a[1]+')';}).join('; ');
  var pmh=pmhList(P),home=homeList(P),soc=X.hx.soc,cA=C(P.arrive),tk=trackKeys(P);
  var cc=F(mn.cc||'{dx}',cA,'cc'),hpi=F(mn.hpi||'{age} {sex} admitted with {dx}.',cA,'hpi');
  var arrNurse=P.mod.entryNurse||(isED?'ED nurse':H.nurseFor(u.key,P.bedIdx,P.arrive,H.shiftOf(P.arrive)).name),emDoc=isED?H.serviceTeams('em',P.arrive)[H.hash(P.id+'em')%4].attending.name:team.attending.name;
  var W=Math.max(20,Math.round(H.days(P.arrive,P.admit)*1440));var preT=elect?X.preop:null,firstPlan=ph(mn.plan,P.admit)||[],assess0=F(ph(mn.assess,P.admit)||'{dx}.',cA,'as0');
  function planLines(t,c,tag,short){var lines=[].concat(ph(mn.plan,t)||[]).map(function(l,i){return F(l,c,tag+'p'+i);});
    if(!short)P.comorbs.forEach(function(ck){var cm=H.comorbidities[ck];if(cm.plan)lines.push(F(cm.plan,c,tag+ck));});else if(P.comorbs.length)lines.push('Long-term conditions ('+P.comorbs.map(function(ck){return H.comorbidities[ck].name.toLowerCase();}).join(', ')+'): no change; home medicines as charted');
    if(P.comp&&t>=P.comp.recog&&H.days(P.comp.recog,t)<5&&P.comp.def.plan)lines.unshift(F(P.comp.def.plan,c,tag+'cp'));
    return lines;}
  function numbered(lines){return lines.map(function(l,i){return (i+1)+'. '+sent(l);}).join('\n');}
  /* --- before admission --- */
  if(!elect){
    N('Nursing note',H.cap(entry)+(isED?' triage note':' arrival note'),arrNurse,H.addMin(P.arrive,6),
      (pop==='neonate'?'Baby received from the delivery team.':'Arrived '+F('[by ambulance|by private car|by private car with family|by ambulance from home|walking, with a relative]',cA,'arr')+'.')+' Presenting problem: '+cc.charAt(0).toLowerCase()+cc.slice(1)+'.\n'+
      'First observations: '+vitLine(cA)+(pop==='neonate'||pr.ageY<4?'':' Pain '+cA.pain+' of 10.')+'\nWeight '+wtAt(P,P.arrive)+'. Allergies: '+algTxt+'.\n'+
      (pop==='neonate'?'Identification bands checked with parent. Vitamin K and eye ointment given with consent.':'Identity band applied. '+F('[Placed in a monitored bay|Placed in a bay near the desk|Roomed straight away]',cA,'bay')+'; '+(isED?'emergency physician':'team')+' informed.'));
    N(isED?'Emergency note':'Progress note',H.cap(entry)+(isED?' physician note':' assessment'),emDoc,H.addMin(P.arrive,Math.min(35+H.hash(P.id+'emn')%40,Math.round(W*.3))),
      'Presenting problem: '+cc+'.\n\n'+hpi+'\n\nPast history: '+pmh.join('; ')+'.\nAllergies: '+algTxt+'.\n\nExamination: '+vitLine(cA)+' '+sent(F(ph(mn.exam,P.arrive)||'',cA,'ex0'))+'\n\nInitial results: '+(labLine(P,cA,tk,false)||'pending.')+'\n\nImpression: '+assess0+'\n\nPlan: '+
      (u.acuity==='ed'?'treat and reassess in this department; decide on admission after results.':'initial treatment started here; referred to '+svcName+' for admission.'));
    N('Pharmacy note','Medication history',H.unitStaff(isED?'ed':u.key,P.arrive).pharmacist.name,H.addMin(P.arrive,Math.min(80+H.hash(P.id+'ph')%50,Math.round(W*.55))),
      'Source: '+(pop==='peds'||pop==='neonate'?'parent':'patient'+F('[ and pharmacy fill record| and medicine bottles| and family member|]',cA,'src'))+'.\n\nMedicines before admission:\n'+home.map(function(x){return '- '+x;}).join('\n')+'\n\nAllergies confirmed: '+algTxt+'.\n'+
      (P.flags.renal?'Kidney function reduced (creatinine '+cA.lab.cr+' mg/dL): doses of kidney-cleared medicines to be adjusted.\n':'')+(opd.home.some(function(h){return h.inpt==='hold';})?'Suggested to hold on admission: '+opd.home.filter(function(h){return h.inpt==='hold';}).map(function(h){return h.name;}).join(', ')+'.\n':'')+
      'Adherence: '+F('[takes medicines as prescribed|misses doses about once a week|uses a weekly pill organiser filled by family|unsure of some names, list checked against fill record]',cA,'adh')+'. List entered in the chart for the admitting team.');
    var preEnd=H.addMin(P.admit,-12),cP=C(preEnd);
    N('Progress note',H.cap(entry)+' reassessment',emDoc,preEnd,'Reassessed after initial treatment.\n'+vitLine(cP)+'\n'+sent(F(ph(mn.subj,P.arrive)||'Symptoms as on arrival',cP,'sj0'))+'\nResults reviewed: '+(labLine(P,cP,tk,false)||'pending.')+'\n'+
      (u.acuity==='ed'?'Plan: continue treatment in bay '+P.bed+' and reassess when results are back.':'Accepted by '+svcName+' ('+team.attending.name+'). Bed assigned: '+P.bed+'. Handover given to the admitting team.')+' '+(P.code!=='Full code'?'Resuscitation status discussed: '+P.code+'.':'Resuscitation status: full code.'));
    N('Consult',u.acuity==='ed'?'Emergency department senior review':svcName+' admission consult',u.acuity==='ed'?team.attending.name:who(senior),H.addMin(P.admit,-Math.min(45+H.hash(P.id+'ac')%30,Math.round(W*.4))),'Asked by '+(u.acuity==='ed'?'the triage clinician to review':(isED?'emergency medicine':'the '+entry+' team')+' to assess for admission')+': '+cc.charAt(0).toLowerCase()+cc.slice(1)+'.\n\n'+
      'Seen and examined. '+vitLine(C(H.addMin(P.admit,-45)))+' '+(labLine(P,cA,tk,false))+'\n\nImpression: '+assess0+'\n\nRecommendations:\n'+numbered([u.acuity==='ed'?'Move to a treatment bay ('+P.bed+') for monitoring and treatment':'Admit to '+u.name+' under '+svcName+' ('+team.attending.name+')'].concat(firstPlan.slice(0,3).map(function(l,i){return F(l,cA,'acp'+i);})).concat(['Full history and physical to follow'])));
    N('Nursing note',u.acuity==='ed'?'Handover from triage to treatment bay':'Handover to '+u.name,arrNurse,H.addMin(P.admit,-3),'Situation: '+cA.age+' '+cA.sex+' with '+P.dx.charAt(0).toLowerCase()+P.dx.slice(1)+', going to bed '+P.bed+'.\nBackground: '+pmh.slice(0,4).join('; ')+'. Allergies: '+algTxt+'. '+P.code+'.\n'+
      'Assessment: latest observations '+vitLine(cP)+' '+(pop==='neonate'?'':'Pain '+cP.pain+' of 10. ')+'Intravenous access '+(X.lines[0]?'in '+X.lines[0][1].toLowerCase():'not needed')+'.\nGiven before transfer: '+(meds.filter(function(o){return o.start<P.admit&&o.src==='mod';}).map(function(o){return o.name;}).join(', ')||'no medicines')+'.\n'+
      'Recommendation: '+(X.o2max>0?'continue oxygen and saturation checks; ':'')+'next observations due on arrival. Family '+F('[aware of the move|at the bedside|to be telephoned by the ward]',cA,'fam')+'.');
  }else{
    N('Consult','Pre-operative assessment clinic','Dr. '+H.staffName('preop'+H.hash(P.id)%9,'full')+', Anaesthesiology',preT,'Reason: assessment before '+F(mn.cc||'{dx}',cA,'cc')+'.\n\n'+hpi+'\n\nPast history: '+pmh.join('; ')+'.\nMedicines: '+home.join('; ')+'.\nAllergies: '+algTxt+'.\n\n'+
      'Examination: '+vitLine(C(preT))+' Airway unremarkable, mouth opening good. Heart sounds normal, chest clear.\nResults: '+labLine(P,C(H.addH(preT,3)),tk.concat(['glu']),false)+'\n\nAssessment: fit to proceed. '+(P.comorbs.length?'Long-term conditions stable: '+P.comorbs.map(function(k){return H.comorbidities[k].name.toLowerCase();}).join(', ')+'.':'No long-term conditions.')+
      '\n\nRecommendations:\n'+numbered(['Take usual morning medicines with a sip of water'+(opd.home.some(function(h){return h.inpt==='hold';})?', except '+opd.home.filter(function(h){return h.inpt==='hold';}).map(function(h){return h.name;}).join(', '):''),'Nothing to eat after midnight; clear fluids until 2 hours before arrival','Blood group and antibody screen on arrival']));
    N('Anaesthesia note','Pre-anaesthetic assessment','Dr. '+H.staffName('preop'+H.hash(P.id)%9,'full')+', Anaesthesiology',H.addMin(preT,20),'Planned procedure: '+F(mn.cc||'{dx}',cA,'cc')+'.\nPrevious anaesthetics: '+F('[none|uneventful general anaesthetic|uneventful; nausea afterwards|spinal anaesthetic without problems]',cA,'pa')+'. No family history of anaesthetic problems.\n'+
      'Airway: mouth opening above 3 finger-breadths, full neck movement, own teeth'+F('[| with an upper partial plate|]',cA,'teeth')+'.\nWeight '+wtAt(P,preT)+'. Risk class '+(P.comorbs.length>2?'3':P.comorbs.length?'2':'1')+'.\nPlan: '+F(P.mod.anaes||'[general anaesthetic|general anaesthetic with nerve block|spinal anaesthetic with light sedation]',cA,'an')+'; nausea prevention; multimodal pain relief. Risks explained and questions answered.');
    N('History and physical','Surgical history and physical',team.attending.name,H.addMin(preT,70),'Reason for surgery: '+cc+'.\n\n'+hpi+'\n\nPast history: '+pmh.join('; ')+'.\nPrevious operations: '+X.hx.psh.join('; ')+'.\nMedicines: '+home.join('; ')+'.\nAllergies: '+algTxt+'.\nSocial: '+soc.filter(Boolean).join('. ')+'.\n\n'+
      'Examination: '+vitLine(C(preT))+' '+sent(F(ph(mn.exam,P.arrive)||'',cA,'ex0'))+'\n\nAssessment: '+assess0+'\n\nPlan:\n'+numbered(firstPlan.map(function(l,i){return F(l,cA,'hp'+i);})));
    N('Progress note','Surgical plan and consent',team.attending.name,H.addMin(preT,95),'Discussed the operation, the expected course in hospital (about '+Math.round(P.los)+' days) and the alternatives.\nRisks explained in plain words: bleeding, infection, blood clots, anaesthetic risks and those specific to this operation. '+cA.title+' asked about '+F('[pain control|time off work|when driving is allowed|going home with help]',cA,'q')+'; answered.\n'+
      'Consent form signed. Side and site confirmed: '+(/left|right/.test(P.dx+cc)?pr.side:'not applicable')+'. Blood tests from today reviewed: '+labLine(P,C(H.addH(preT,3)),['hgb','cr'],false)+' Date of surgery confirmed for '+H.dm(P.admit)+'.');
    N('Pharmacy note','Pre-admission medication history',H.unitStaff(u.key,preT).pharmacist.name,H.addMin(preT,130),'Source: patient and pharmacy fill record.\n\nMedicines before admission:\n'+home.map(function(x){return '- '+x;}).join('\n')+'\n\nAllergies confirmed: '+algTxt+'.\n'+(P.flags.renal?'Kidney function reduced: doses of kidney-cleared medicines to be adjusted after surgery.\n':'')+'Advice given on which medicines to take on the morning of surgery.');
    N('Case management','Pre-admission discharge planning call',H.unitStaff(u.key,preT).caseManager.name,H.at(H.addD(P.admit,-3),14,10+H.hash(P.id)%40),'Telephone call before admission.\nHome: '+soc[1]+'. '+soc[4]+'.\nHelp after discharge: '+F('[spouse will be at home for two weeks|daughter will stay for the first week|friend will drive and shop; alone at night|son lives upstairs]',cA,'help')+'.\nEquipment: '+F('[none needed yet|has a walking frame from a previous injury|raised toilet seat arranged|shower chair to be delivered]',cA,'eq')+'.\nExpected stay about '+Math.round(P.los)+' days. Transport home arranged by family.');
    N('Nursing note','Day-of-surgery admission checklist',H.nurseFor(u.key,P.bedIdx,P.admit,H.shiftOf(P.admit)).name,P.admit,'Arrived '+H.hm(P.admit)+'. Identity, procedure and side confirmed with the patient and the consent form.\nLast food '+F('[20:00|21:30|22:00]',cA,'lf')+' yesterday; clear fluids until '+F('[04:00|04:30]',cA,'cf')+'.\nObservations: '+vitLine(C(P.admit))+'\nWeight '+wtAt(P,P.admit)+'. Allergies: '+algTxt+'. Allergy band '+(algTxt==='No known allergies'?'not needed':'applied')+'.\nMorning medicines taken as advised. Jewellery removed, dentures '+F('[none|left with family]',cA,'dent')+'. Skin intact. Belongings with '+F('[spouse|daughter|son|friend]',cA,'bel')+'.');
  }
  /* --- admission history and physical (non-elective) and admission nursing assessment --- */
  if(!elect)N('History and physical',u.acuity==='ed'?'Emergency department history and physical':'Admission history and physical',who(intern),H.addMin(P.admit,-8-H.hash(P.id+'hp')%20),'Chief complaint: '+cc+'.\n\nHistory: '+hpi+'\n\nPast history: '+pmh.join('; ')+'.\n'+(X.hx.psh.length?'Previous operations: '+X.hx.psh.join('; ')+'.\n':'')+'Medications at home: '+home.join('; ')+'.\nAllergies: '+algTxt+'.\n'+
    'Social: '+soc.filter(Boolean).join('. ')+'.\nFamily: '+X.hx.fam.join('. ')+'.\n\nExamination: '+vitLine(cA)+' Weight '+wtAt(P,P.arrive)+'. '+sent(F(ph(mn.exam,P.arrive)||'No abnormal findings',cA,'ex0'))+'\n\nResults: '+labLine(P,cA,tk.concat(['na','glu']).filter(function(k,i,a){return a.indexOf(k)===i;}),false)+' '+
    X.reports.filter(function(r){return r.t<P.admit;}).map(function(r){var m=/Impression: ([^\n]+)/.exec(r.body);return r.title+': '+(m?m[1]:'see report');}).join(' ')+'\n\nAssessment: '+assess0+'\n\nPlan:\n'+numbered(planLines(P.admit,cA,'hp',false).concat(['Resuscitation status confirmed with '+(pop==='peds'||pop==='neonate'?'the family':'the patient')+': '+P.code.toLowerCase()]))+'\n\nDiscussed with '+team.attending.name+'.');
  var tAN=H.addMin(P.admit,elect?240+H.hash(P.id)%120:25+H.hash(P.id+'an')%30),cAN=C(tAN);
  N('Nursing note',elect?'Return to ward after surgery':'Admission nursing assessment',H.nurseFor(u.key,P.bedIdx,tAN,H.shiftOf(tAN)).name,tAN,(elect?'Returned from the recovery area to bed '+P.bed+'.':'Arrived on '+u.name+', bed '+P.bed+', from the '+entry+'.')+'\nObservations: '+vitLine(cAN)+(pop==='neonate'||pr.ageY<4?'':' Pain '+cAN.pain+' of 10.')+'\n'+
    X.nursing.rows.slice(0,6).map(function(r){return r.l+': '+r.v[0]+'.';}).join('\n')+'\n'+(pop==='neonate'?'Parents shown the unit and hand hygiene.':'Call bell in reach, bed low, '+(pr.ageY>=65?'non-slip socks on, ':'')+'oriented to the room.')+' Lines: '+X.lines.map(function(l){return l[0].toLowerCase();}).join('; ')+'.');
  /* --- operations and procedures --- */
  (P.mod.procs||[]).concat(P.variant.procs||[]).forEach(function(pc,i){if(!H.forVariant(pc,P))return;var t=pc.h!=null?H.addH(P.admit,pc.h):snap(P,pc.d||0),c=C(t);if(pc.d>0&&pc.h==null)t=H.addMin(t,120);
    var by=pc.by&&M.serviceByKey[pc.by]?H.serviceTeams(pc.by,t)[0].attending.name:team.attending.name;
    N(pc.type||'Procedure note',F(pc.title,c,'pt'+i),by,t,F(pc.body,c,'pb'+i));
    if((pc.type||'')==='Operative note')N('Anaesthesia note','Anaesthesia record summary','Dr. '+H.staffName('anaes'+H.hash(P.id+i)%30,'full')+', Anaesthesiology',H.addMin(t,12),F(pc.anaes||'[General anaesthetic with breathing tube|General anaesthetic with laryngeal mask]. Induction uneventful. Antibiotic given before incision. Blood pressure and heart rate stable throughout; no vasopressor infusion needed. Estimated blood loss as recorded in the operative note. Nausea prevention given. Breathing tube removed awake in theatre. To the recovery area with oxygen by mask, comfortable, observations stable. Handover given to the recovery nurse.',c,'pa'+i));});
  /* --- consults --- */
  cons.forEach(function(c,i){if(c.seen>end)return;var svc=M.serviceByKey[c.svc],cx=C(c.seen),tm=H.serviceTeams(c.svc,c.seen),ct=tm[H.hash(P.id+c.svc)%tm.length],by=svc.allied?H.staffName(c.svc+'|'+u.key+'|'+(H.hash(P.id)%3),'x')+', '+svc.name.toLowerCase():(ct.fellow||ct.attending).name+', '+svc.name;
    var a=T.anc[c.svc],body;
    if(svc.allied&&a){body=F((P.mod.anc&&P.mod.anc[c.svc])||a.body,cx,'anc'+c.svc);N(a.type,a.title,by,c.seen,body);return;}
    body='Reason for consult: '+F(c.reason||'review',cx,'cr'+i)+'.\n\nSummary: '+cx.age+' '+cx.sex+', hospital day '+cx.day+', admitted with '+P.dx.charAt(0).toLowerCase()+P.dx.slice(1)+'. '+(pmh[0]&&!/^No /.test(pmh[0])?'Background: '+pmh.slice(0,4).join('; ')+'. ':'')+
      '\n\nToday: '+vitLine(cx)+' '+labLine(P,cx,tk,true)+'\n\nAssessment and recommendations: '+F(c.recs||'Agree with the current plan. We will follow.',cx,'cc'+i)+'\n\nThank you for involving us. '+(svc.allied?'':'Discussed with '+ct.attending.name+'.');
    N('Consult',svc.name+' consult',by,c.seen,body);});
  /* --- daily notes --- */
  var nd=H.calDays(P.admit,end),lastEvent=P.admit;
  for(var d=0;d<=nd;d++){var day=H.addD(H.day0(P.admit),d),tP=H.at(day,7,40+H.hash(P.id+'pn'+d)%170);
    if(d>0&&tP<=end&&u.acuity!=='ed'){var c=C(tP),prevT=H.addD(tP,-1),ch=changesBetween(P,meds,prevT<P.admit?P.admit:prevT,tP,draws),compNew=P.comp&&P.comp.recog>prevT&&P.comp.recog<=tP,compOn=P.comp&&P.comp.recog<=tP&&H.days(P.comp.recog,tP)<5;
      var lastDay=H.calDays(tP,P.discharge)===0,body='Hospital day '+(d+1)+(c.pod!=null&&c.pod>=0?', post-operative day '+c.pod:'')+'.\n\n'+
        'Overnight: '+(compNew?F(P.comp.def.event,c,'ce')+' ('+H.dt(P.comp.recog)+').':F('[No events overnight|Quiet night|No new concerns from the night team]',c,'on'+d)+'.')+'\n'+
        'Subjective: '+sent(F(ph(mn.subj,tP)||'No new complaints',c,'sj'+d))+'\n\nObjective: '+vitLine(c)+(P.course.wt?' Weight '+c.wt+'.':'')+(pop==='neonate'||pr.ageY<4?'':' Pain '+c.pain+' of 10.')+'\nExamination: '+sent(F(ph(mn.exam,tP)||'Unchanged',c,'ex'+d))+'\n'+
        'Results: '+(labLine(P,c,tk,true)||'no new results.')+'\nChanges in the last 24 hours: '+(ch.length?ch.join('; ')+'.':'none.')+'\n\nAssessment: '+sent(F(ph(mn.assess,tP)||'{dx}',c,'as'+d))+(compOn?' '+F(P.comp.def.assess,c,'ca'+d):'')+'\n\nPlan:\n'+
        numbered(planLines(tP,c,'d'+d,d>1&&!lastDay).concat([lastDay?'Discharge today: '+X.dispo.toLowerCase()+'; follow-up as arranged':H.calDays(tP,P.discharge)===1?'Likely discharge tomorrow; medicines and transport being arranged':'Expected discharge '+H.dm(P.discharge)+' if progress continues']))+'\n\n'+(u.acuity==='icu'?'Seen on rounds with ':'Discussed with ')+H.teamOf(P,tP).attending.name+'.';
      var tt=H.teamOf(P,tP),author=u.acuity==='icu'?(tt.senior||tt.attending):((tt.interns&&tt.interns[H.hash(P.id)%Math.max(1,tt.interns.length)])||tt.senior||tt.attending);
      N('Progress note',svcName+' progress note, day '+(d+1),who(author),tP,body);}
    /* nursing shift notes: keep the last 5 days */
    if(nd-d<5&&u.acuity!=='ed'){[[6,45,'Night shift summary','night'],[18,40,'Day shift summary','day']].forEach(function(sh){var t=H.at(day,sh[0],sh[1]+H.hash(P.id+sh[2]+d)%15);if(t<H.addH(P.admit,4)||t>end)return;var c=C(t),from=H.addH(t,-12),given=[],r2=H.R(P.id+'sn'+d+sh[3]).f;
        meds.forEach(function(o){if(/^prn/.test(o.item.f||o.def.freq)&&o.start<=t&&!o.heldFromStart)prnDoses(P,o,from,t).forEach(function(a){given.push(o.name+' at '+H.hm(a.t));});});
        var ev=P.comp&&P.comp.recog>from&&P.comp.recog<=t?F(P.comp.def.event,c,'ne')+' at '+H.hm(P.comp.recog)+'; team informed and reviewed. ':'';
        var bank=ph(mn.nursing,t),o2a=H.valueAt(P,'o2',from<P.admit?P.admit:from),o2b=H.valueAt(P,'o2',t);
        N('Nursing note',sh[2],H.nurseFor(u.key,P.bedIdx,H.addH(t,-2),sh[3]).name,t,ev+sent(F(bank||(sh[3]==='night'?'[Settled night|Slept in short spells|Slept well after 23:00]':'[Comfortable day|Steady day|Up for meals]'),c,'nb'+d+sh[3]))+'\n'+
          'Observations at '+H.hm(H.obsTimes(P,t).slice(-1)[0])+': '+vitLine(c)+(pop==='neonate'||pr.ageY<4?'':' Pain '+c.pain+' of 10.')+'\n'+(o2a!==o2b?'Oxygen '+(o2b<o2a?'weaned':'increased')+' from '+o2Phrase(o2a)+' to '+o2Phrase(o2b)+' this shift.\n':'')+
          'As-needed medicines this shift: '+(given.length?given.join(', '):'none')+'.\n'+(sh[3]==='night'?(draws.some(function(x){return x>from&&x<=t;})?'Morning blood tests sent. ':''):'')+F('[Skin checked and position changed|Pressure areas intact|Call bell in reach, bed low]',c,'sk'+d+sh[3])+'. '+
          (pop==='neonate'||pop==='peds'?F('[Mother|Father|Parents] [at the bedside|visited and updated|stayed overnight]',c,'fa'+d+sh[3])+'.':F('[Family telephoned for an update|No visitors this shift|Family visited|Plan for the day explained]',c,'fa'+d+sh[3])+'.'));});}}
  /* --- complication event note --- */
  if(P.comp&&P.comp.recog<=end){var cr=C(P.comp.recog),cov=H.teamOf(P,P.comp.recog);N('Progress note','Clinical event note: '+P.comp.def.name.toLowerCase(),who(cov.senior||cov.attending),H.addMin(P.comp.recog,25),'Called by the nurse: '+F(P.comp.def.event,cr,'ev').toLowerCase()+'.\n\nSeen at the bedside. '+vitLine(cr)+'\n'+labLine(P,cr,Object.keys(P.comp.def.course||{}).filter(function(k){return T.labs[k];}),true)+'\n\nAssessment: '+F(P.comp.def.assess,cr,'eva')+'\n\nPlan: '+F(P.comp.def.plan,cr,'evp')+'\n'+(P.comp.def.consult?M.serviceByKey[P.comp.def.consult.svc].name+' asked to see. ':'')+'Family updated. Will review again within 4 hours.');}
  /* --- ancillary documentation --- */
  var anc=X.anc;anc.forEach(function(a,i){var def=T.anc[a.k];if(!def||a.t>end)return;var c=C(a.t);N(def.type,def.title+(a.n?' ('+a.n+')':''),a.by,a.t,F((P.mod.anc&&P.mod.anc[a.k])||def.body,c,'an'+a.k+i));});
  /* --- discharge --- */
  var tDP=H.at(H.addD(P.discharge,-1),13,20+H.hash(P.id+'dp')%60);
  if(u.acuity!=='ed'&&P.los>1.6)N('Discharge planning','Discharge planning note',H.unitStaff(u.key,tDP).caseManager.name,tDP,'Expected discharge '+H.dm(P.discharge)+' to: '+X.dispo.toLowerCase()+'.\nHome situation: '+soc[1]+'.'+(soc[4]?' '+soc[4]+'.':'')+'\nNeeds identified: '+F('[none beyond prescriptions|transport home by family|walking frame delivered to the ward|home nursing visit for the first week|new medicines to be collected before leaving]',C(tDP),'need')+'.\n'+
    'Follow-up: '+(X.follow.length?X.follow.map(function(f){return f.clinic+' on '+H.dm(f.t);}).join('; '):'with the usual doctor within 2 weeks')+'.\nPatient'+(pop==='peds'||pop==='neonate'?'’s family':'')+' agrees with the plan. Barriers: '+F('[none|needs a morning discharge for transport|awaiting equipment delivery|pharmacy to deliver medicines to the bedside]',C(tDP),'bar')+'.');
  if(dis&&u.acuity!=='ed'){var tD=H.addMin(P.discharge,-50),cD=C(tD),dc=P.mod.dc||{},cont=meds.filter(function(o){return (o.src==='mod'||o.src==='comp')&&!o.stop&&!o.held&&!/^inf|^once/.test(o.item.f||o.def.freq)&&o.def.route!=='IV'&&o.start<=end;});
    N('Discharge planning','Discharge summary',who(intern),tD,'Admitted '+H.dt(P.admit)+'; discharged '+H.dt(P.discharge)+' ('+Math.max(1,Math.round(P.los))+' days). Disposition: '+X.dispo+'.\n\nPrincipal diagnosis: '+P.dx+'.\nOther problems: '+(X.realProblems.slice(1).join('; ')||'none')+'.\n\n'+
      'Hospital course: '+hpi+' '+F(dc.text||'Treated as planned and improved steadily.',cD,'dct')+(P.comp&&P.comp.recog<=end?' The stay was complicated by '+P.comp.def.name.toLowerCase()+', recognised on '+H.dm(P.comp.recog)+' and treated.':'')+'\n\n'+
      'At discharge: '+vitLine(cD)+' '+labLine(P,cD,tk,false)+' Admission values: '+tk.filter(function(k){return cD.lab0[k]!=null;}).map(function(k){return (LABN[k]||k)+' '+cD.lab0[k];}).join(', ')+'.\n\n'+
      'New or changed medicines: '+(cont.length?cont.map(function(o){return o.name+' '+o.sig.split(' · ')[1];}).join('; '):'none')+'.\nUsual medicines: '+(opd.home.length?'continue, except those held ('+(meds.filter(function(o){return o.src==='home'&&o.held;}).map(function(o){return o.name;}).join(', ')||'none')+')':'none')+'.\n\n'+
      'Instructions: '+F(dc.teach||'Return if symptoms come back or worsen. Take medicines as listed.',cD,'dci')+'\nFollow-up: '+(X.follow.length?X.follow.map(function(f){return f.clinic+' on '+H.dm(f.t);}).join('; '):'usual doctor within 2 weeks')+'.');
    N('Nursing note','Discharge nursing note',H.nurseFor(u.key,P.bedIdx,P.discharge,'day').name,H.addMin(P.discharge,-10),'Discharged at '+H.hm(P.discharge)+' to '+X.dispo.toLowerCase()+' with '+F('[spouse|daughter|son|friend|family]',cD,'dcw')+'.\nFinal observations: '+vitLine(cD)+'\nIntravenous line removed, site clean. Written instructions and medicine list given and explained; '+(pop==='peds'||pop==='neonate'?'parent':'patient')+' repeated back the warning signs and the follow-up date. Belongings returned.');}
  notes.sort(function(a,b){return b.t-a.t;});return notes;}

/* ---------- ancillary schedule ---------- */
function buildAnc(P,end,V,o2max){var out=[],u=P.unit,pop=u.pop,want={},r=H.R(P.id+'|anc'),S=function(t){return H.unitStaff(u.key,t);};if(u.acuity==='ed')return out;
  ((P.mod.ancillary||[]).concat(P.variant.ancillary||[])).forEach(function(k){want[k]=1;});
  if(o2max>=2||P.comorbs.indexOf('copd')>=0&&o2max>0)want.rt=1;if(P.los>5||P.comorbs.indexOf('dm2')>=0&&P.los>3)want.nutr=1;if(pop==='adult'&&(P.person.ageY>=75))want.ot=1;if(pop==='adult'&&P.los>2.2)want.cm=1;
  if(pop==='peds'||pop==='neonate'||pop==='psych'||P.person.ageY>=82)want.sw=1;if(pop==='ob'||pop==='neonate')want.lact=1;if(P.comp&&P.comp.key==='ssi')want.wound=1;if(P.flags.renal||P.flags.anticoag||P.los>3)want.pharm2=1;
  function dayT(d,h){var t=H.at(H.addD(H.day0(P.admit),d),h,r.int(0,50));return t<H.addH(P.admit,3)?H.addH(P.admit,3+r.f()*3):t;}
  var have=H.consultsOf(P).map(function(c){return c.svc;});
  if(want.rt){var n=0;for(var d=0;d<=H.calDays(P.admit,end)&&n<4;d++){var t=dayT(d,10);if(t>end||H.calDays(t,end)>2)continue;if(H.valueAt(P,'o2',t)<=0&&n>0)continue;n++;out.push({k:'rt',t:t,by:(S(t).rt||{name:H.staffName('rt'+u.key,'x')+' RRT'}).name,n:H.dm(t)});}}
  if(want.ot&&have.indexOf('ot')<0)out.push({k:'ot',t:dayT(1,14),by:S(end).ot.name});
  if(want.slp&&have.indexOf('slp')<0)out.push({k:'slp',t:dayT(1,11),by:H.staffName('slp'+u.key,'x')+', speech therapist'});
  if(want.nutr&&have.indexOf('nutr')<0)out.push({k:'nutr',t:dayT(1,13),by:S(end).dietitian.name});
  if(want.sw&&have.indexOf('sw')<0)out.push({k:'sw',t:dayT(1,15),by:S(end).socialWorker.name});
  if(want.cm)out.push({k:'cm',t:dayT(1,11),by:S(end).caseManager.name});
  if(want.wound&&have.indexOf('wound')<0)out.push({k:'wound',t:P.comp&&P.comp.key==='ssi'?H.addH(P.comp.recog,5):dayT(1,12),by:H.staffName('wound'+u.building,'x')+' RN, wound and ostomy nurse'});
  if(want.lact&&have.indexOf('lact')<0)out.push({k:'lact',t:dayT(0,15),by:H.staffName('lact'+u.key,'x')+' RN, lactation consultant'});
  if(want.pharm2)out.push({k:'pharm2',t:dayT(1,12),by:S(end).pharmacist.name});
  if(want.pt&&have.indexOf('pt')<0)out.push({k:'pt',t:dayT(1,10),by:S(end).pt.name});
  return out;}

/* ---------- the chart ---------- */
H.buildChart=function(P,now){now=now||H.cfg.now;var dis=now>=P.discharge,end=dis?P.discharge:now,pr=P.person,u=P.unit,team=H.teamOf(P,end),r=H.R(P.id+'|chart');
  var alg=allergiesOf(P),opd=H.opdOf(P),meds=buildMeds(P,end),draws=drawTimes(P,end),times=H.obsTimes(P,end),ctx0=ctxAt(P,end,draws),vit=buildVitals(P,times);
  var o2max=0;for(var d=0;d<=H.days(P.admit,end);d+=.25)o2max=Math.max(o2max,H.valueAt(P,'o2',H.addH(P.admit,d*24)));
  var cons=H.consultsOf(P),pop=u.pop,X={ctx0:ctx0,draws:draws,meds:meds,cons:cons,alg:alg,o2max:o2max};
  X.preop=P.via==='elective'?H.at(draws[0],draws[0].getHours()-1,10):null;
  /* history */
  var D=T.defaults,hr=H.R(P.id+'|hx').f,socB=D.soc[pop==='adult'?'adult':pop]||D.soc.adult;
  X.hx={pmh:pmhList(P),psh:pop==='neonate'||pr.ageY<12?['No previous operations']:[H.fill(D.psh[H.hash(P.id+'psh')%D.psh.length],{},hr)].concat(pr.ageY>55&&H.hash(P.id+'ps2')%3===0?[H.fill(D.psh[H.hash(P.id+'psh2')%(D.psh.length-1)],{},hr)]:[]).filter(function(x,i,a){return a.indexOf(x)===i;}),
    fam:pop==='neonate'?['No family history of early jaundice or hearing loss']:D.fam.map(function(x){return H.fill(x,{},hr);}),soc:socB.map(function(x){return H.fill(x,{},hr);}),
    imm:(D.imm[pop==='peds'?'peds':pop==='neonate'?'neonate':'adult']).concat(pr.ageY>=65?D.imm.old:[]).map(function(x){return H.fill(x,{},hr);}),home:homeList(P)};
  if(pr.ageY>=67&&pop==='adult')X.hx.soc[0]=X.hx.soc[0].replace(/^Works.*|^Bookkeeper|^Shop assistant|^Taxi driver|^Librarian|^Chef|^Farm worker/,'Retired');

  /* disposition and follow-up */
  var dsp=(P.mod.dc&&P.mod.dc.dispo)||D.dispo,keys=Object.keys(dsp),tot=0,acc=0;keys.forEach(function(k){tot+=dsp[k]*(k!=='Home'&&pr.ageY>=80?2:1);});X.dispo=keys[0];
  for(var i=0;i<keys.length;i++){acc+=dsp[keys[i]]*(keys[i]!=='Home'&&pr.ageY>=80?2:1);if(P.dispoRoll*tot<acc){X.dispo=keys[i];break;}}
  X.follow=H.followUps?H.followUps(P):[];
  var nursing=buildNursing(P,end,ctx0);X.nursing=nursing;
  var lines=buildLines(P,end,vit.V,meds);X.lines=lines;
  var reps=buildReports(P,end,ctx0);X.reports=reps.imaging.concat(reps.micro,reps.path);
  /* problems */
  var problems=[P.dx];(P.mod.problems||[]).concat(P.variant.problems||[]).forEach(function(p){problems.push(H.fill(p,ctx0,r.f));});
  if(P.comp&&P.comp.recog<=end)problems.push(H.fill(P.comp.def.problem||P.comp.def.name,ctx0,r.f));
  var L0=ctx0._lab,B=function(k){return H.baseline(P,k);};
  if(L0.cr!=null&&L0.cr>=B('cr')*1.5&&L0.cr-B('cr')>=.3&&!(P.comp&&P.comp.key==='aki'&&P.comp.recog<=end)&&pop!=='neonate')problems.push('Acute kidney injury (creatinine '+ctx0.lab.cr+' mg/dL)');
  if(ctx0._v.o2>0)problems.push('Oxygen requirement: '+ctx0.o2);
  if(L0.hgb!=null&&L0.hgb<9&&pop!=='neonate')problems.push('Anaemia (haemoglobin '+ctx0.lab.hgb+' g/dL)');
  if(L0.plt!=null&&L0.plt<100)problems.push('Low platelets ('+ctx0.lab.plt+' \u00d710\u2079/L)');
  if(L0.na!=null&&L0.na<130)problems.push('Low sodium ('+ctx0.lab.na+' mmol/L)');if(L0.k!=null&&L0.k<3.3)problems.push('Low potassium ('+ctx0.lab.k+' mmol/L)');if(L0.k!=null&&L0.k>5.5)problems.push('High potassium ('+ctx0.lab.k+' mmol/L)');
  if(L0.lactate!=null&&L0.lactate>2.2)problems.push('Raised lactate ('+ctx0.lab.lactate+' mmol/L)');
  opd.problems.forEach(function(p){problems.push(p);});X.realProblems=problems.slice(0,8);if(alg[0][0]!=='No known allergies'&&problems.length<5)problems.push('Allergy: '+alg.map(function(a){return a[0];}).join(', '));
  if(problems.length<5&&pr.ageY>=75)problems.push('Frailty: fall and delirium precautions');if(problems.length<5&&pop==='adult')problems.push('Venous clot prevention while in hospital');
  if(problems.length<5)problems.push('Discharge planning: '+X.dispo.toLowerCase()+' expected '+H.dm(P.discharge));
  [pop==='neonate'||pop==='peds'?'Family support and teaching':'Pain and comfort',pop==='neonate'?'Feeding and growth':'Nutrition and hydration',pop==='psych'?'Safety: observation level reviewed daily':pop==='ob'?'Feeding support and newborn care teaching':pop==='neonate'?'Temperature control and safe sleep':pop==='peds'?'Play, schooling and comfort while in hospital':'Mobility and prevention of deconditioning',pop==='neonate'?'Newborn screening tests before discharge':'Medicine reconciliation at admission and discharge','Follow-up arrangements after discharge'].forEach(function(x){if(problems.length<5)problems.push(x);});
  X.problems=problems=problems.slice(0,8);
  X.anc=buildAnc(P,end,vit.V,o2max);
  X.adm={};var medOut=[];
  meds.forEach(function(o){if(o.start>end||o.heldFromStart)return;if(o.stop&&o.stop<=H.addH(end,-24))return;var fk=o.item.f||o.def.freq,m={name:o.name,sig:o.sig,ordered:o.start};
    if(fk==='inf'){if(o.stop&&o.stop<=end||o.held&&o.held.t<=end)return;m.type='inf';m.rate=o.item.rate||o.def.extra||'per protocol';m.note=o.item.note||('Started '+H.dt(o.start)+'; checked each shift');}
    else{if(/^prn/.test(fk))m.type='prn';m.a=medAdmin(P,o,end,dis);X.adm[o.key]=m.a;if(o.stop&&o.stop<=end)m.sig+=' · stopped '+H.dm(o.stop);}
    medOut.push(m);});
  var guard=0,pad=(T.defaults.meds[pop]||[]).concat(['flush','apap650','senna','ondansetron4','melatonin3','peg','multivit','tears','sucrose']);
  while(medOut.length<7&&guard<pad.length){var pk=pad[guard++],pd=T.meds[pk];if(medOut.some(function(m){return m.name.split(' ')[0]===pd.name.replace('{d}','').split(' ')[0];})||(pd.cls==='anticoagulant')||(pk==='ibukg'&&P.person.ageY<.5)||(P.person.ageY<12&&/apap650|senna|ondansetron4|melatonin3|peg|^ibu600|lorazepam|nicpatch/.test(pk))||(P.person.ageY>=1&&pk==='sucrose'))continue;
    var po={key:pk,def:pd,item:{},src:'std',start:H.addMin(P.admit,15),stop:null,name:medName(pd,P),held:null};po.sig=sigOf(pd,po.item);var pm={name:po.name,sig:po.sig,ordered:po.start};if(/^prn/.test(pd.freq))pm.type='prn';pm.a=medAdmin(P,po,end,dis);medOut.push(pm);}
  var orders=buildOrders(P,end,meds,cons,ctx0);
  var notes=buildNotes(P,end,dis,X);
  /* events */
  var ev=[];if(P.arrive<P.admit)ev.push([P.arrive,/delivery room/.test(P.mod.entry||'')?'Born; cared for by the delivery room team':'Arrived at '+(P.mod.entry||'the emergency department')]);
  ev.push([P.admit,P.via==='elective'?'Arrived for planned admission':'Admitted to '+u.name+', bed '+P.bed]);
  (P.mod.events||[]).concat(P.variant.events||[]).forEach(function(e){var t=e[0]<=0?H.addMin(P.arrive,Math.round((1+Math.max(-1,e[0]))*H.days(P.arrive,P.admit)*1440)+30):snap(P,e[0]);if(e[2]!=null)t=H.addH(P.admit,e[2]);if(t<=end)ev.push([t,H.fill(e[1],ctxAt(P,t,draws),r.f)]);});
  (P.mod.procs||[]).concat(P.variant.procs||[]).forEach(function(pc){if(!H.forVariant(pc,P))return;var t=pc.h!=null?H.addH(P.admit,pc.h):snap(P,pc.d||0);if(t<=end&&pc.event)ev.push([t,H.fill(pc.event,ctx0,r.f)]);});
  meds.forEach(function(o){if(o.src==='mod'&&o.start>H.addH(P.admit,6)&&o.start<=end&&!/^prn/.test(o.def.freq))ev.push([o.start,'Started '+o.name]);if(o.item.ed&&o.start<P.admit)ev.push([H.addMin(o.start,10),'First dose of '+o.name]);});
  if(P.comp&&P.comp.recog<=end)ev.push([P.comp.recog,H.fill(P.comp.def.event,ctxAt(P,P.comp.recog,draws),r.f)]);
  cons.forEach(function(c){if(c.seen<=end&&!M.serviceByKey[c.svc].allied)ev.push([c.seen,'Seen by '+M.serviceByKey[c.svc].name.toLowerCase()]);});
  if(dis)ev.push([P.discharge,'Discharged: '+X.dispo.toLowerCase()]);
  ev.sort(function(a,b){return a[0]-b[0];});if(ev.length>8)ev=[ev[0],ev[1]].concat(ev.slice(-6));
  /* team */
  var US=H.unitStaff(u.key,end),tm=[['Attending',team.attending.name]];if(team.fellow)tm.push(['Fellow',team.fellow.name]);if(team.senior)tm.push(['Resident',team.senior.name+' ('+team.senior.grade+')']);
  if(team.interns&&team.interns[0]&&tm.length<3)tm.push(['Intern',team.interns[0].name+' (PGY-1)']);tm.push(['Nurse ('+H.shiftOf(end)+')',H.nurseFor(u.key,P.bedIdx,end,H.shiftOf(end)).name]);tm.push(['Pharmacist',US.pharmacist.name]);
  if(o2max>=2&&US.rt)tm.push(['Respiratory therapist',US.rt.name]);else tm.push(['Case manager',US.caseManager.name]);
  cons.filter(function(c){return c.seen<=end&&!M.serviceByKey[c.svc].allied;}).slice(0,1).forEach(function(c){var t2=H.serviceTeams(c.svc,c.seen);tm.splice(tm.length-1,0,[M.serviceByKey[c.svc].name,t2[H.hash(P.id+c.svc)%t2.length].attending.name]);});
  var agN=H.ageAt(pr,end);var chart={id:P.id,name:pr.name,age:agN.age,sex:pr.sex,dob:pr.dob,mrn:pr.mrn,unit:u.name,bed:P.bed,unitKey:u.key,service:M.serviceByKey[P.service].name,attending:team.attending.name,admit:P.admit,code:P.code,
    wt:wtAt(P,end),ht:pr.htCm+' cm',allergies:alg,iso:H.isoOf(P,end),dx:P.dx,problems:problems,team:tm.slice(0,6),events:ev,
    flows:[vit.group,buildSpecialty(P,times,ctx0),{name:nursing.name,cols:nursing.cols,rows:nursing.rows},buildIO(P,end,meds)],
    lines:lines,labs:buildLabs(P,draws),micro:reps.micro,imaging:reps.imaging,path:reps.path,meds:medOut,orders:orders,alerts:buildAlerts(P,ctx0,meds,alg),notes:notes,hx:X.hx,
    encounters:H.pastEncounters?H.pastEncounters(P):[],key:[],generated:true,asOf:end};
  if(agN.text)chart.ageText=agN.text;if(dis)chart.discharged=P.discharge;
  chart.truth={condition:P.mod.key,conditionName:P.mod.name,icd10cm:P.variant.icd||P.mod.icd||null,variant:P.variant.key,severity:H.round(P.sev,2),comorbidities:P.comorbs.slice(),
    complication:P.comp?{key:P.comp.key,name:P.comp.def.name,trueOnset:P.comp.onset,recognised:P.comp.recog,note:P.comp.def.truth||''}:null,arrival:P.arrive,admit:P.admit,plannedDischarge:P.discharge,lengthOfStayDays:H.round(P.los,2),
    disposition:X.dispo,followUp:X.follow.map(function(f){return {clinicKey:f.key,clinic:f.clinic,t:f.t};}),personId:P.id,seed:H.cfg.seed};
  if(H.cfg.truthInKey){chart.key.push(['time','Simulated ground truth: condition and course','Condition module "'+P.mod.key+'", variant "'+P.variant.key+'", severity factor '+H.round(P.sev,2)+'. Planned length of stay '+H.round(P.los,1)+' days; planned discharge '+H.dt(P.discharge)+'.','Generated truth labels']);
    if(P.comp)chart.key.push(['time','True onset of '+P.comp.def.name.toLowerCase(),'True onset '+H.dt(P.comp.onset)+'; recognised by the team '+H.dt(P.comp.recog)+'. '+(P.comp.def.truth||''),'Vitals and results around the onset time']);}
  return chart;};
})(HOSP);
