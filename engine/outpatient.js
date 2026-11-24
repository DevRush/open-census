/* engine/outpatient.js — clinics, clinic schedules and longitudinal outpatient charts.
   A person's long-term conditions are simulated visit by visit (measures drift, treatment steps up when above target,
   the next measure responds). The state of that simulation at the admission date supplies the inpatient chart's
   home medicines and baseline laboratory values, so the two sides of a person's record agree. */
(function(H){
'use strict';
var M=H.model,T=H.T,BASEW=H.weekIndex(H.BASE_NOW),HORIZON_W=BASEW+40,memo={},sched={},linkIdx=null,persons={};
H._resetOutpatient=function(){memo={};sched={};linkIdx=null;persons={};};
function cmod(c){return H.clinicModules[c.module]||H.clinicModules.generic;}
function sessTime(c,si,w,slot){var s=c.sessions[si%c.sessions.length],d=H.addD(H.weekStart(w),s.dow-1),dur=Math.floor(210/c.slots);return H.addMin(H.at(d,s.half==='AM'?8:13,s.half==='AM'?30:0),(slot%c.slots)*dur);}
/* ---------- links: which clinics follow a person ---------- */
function mkLink(c,r,every,manages,firstBack){return {clinic:c.key,every:every,sess:r.int(0,c.sessions.length-1),phase:r.int(0,Math.max(0,every-1)),first:BASEW-(firstBack!=null?firstBack:r.int(10,230)),slot:r.int(0,c.slots-1),prov:r.int(0,97),manages:manages||[]};}
function linksFor(key,person,comorbs,pop){var r=H.R('links|'+key),out=[],rest=comorbs.slice(),a=person.ageY;
  if(pop==='neonate')return out;
  comorbs.forEach(function(ck){var o=H.comorbidities[ck].opd;if(o&&o.clinic&&M.clinicByKey[o.clinic.key]&&r.chance(o.clinic.p==null?.4:o.clinic.p)){var ex=out.filter(function(l){return l.clinic===o.clinic.key;})[0];
    if(ex)ex.manages.push(ck);else out.push(mkLink(M.clinicByKey[o.clinic.key],r,r.pick(o.every||[13,26]),[ck]));rest.splice(rest.indexOf(ck),1);}});
  var pk=pop==='peds'?'pedpc':a>=78&&r.chance(.45)?'gerc':r.chance(.55)?'pcp':'fmc';
  out.push(mkLink(M.clinicByKey[pk],r,pop==='peds'?(a<2?13:52):rest.length>1?13:rest.length?26:r.pick([26,52,52]),rest,pop==='peds'?Math.min(230,Math.max(2,Math.round(a*52)-1)):null));out[out.length-1].pcp=true;
  if(pop==='ob')out.push(mkLink(M.clinicByKey.obc,r,4,[],r.int(26,32)));
  if(pop==='psych')out.push(mkLink(M.clinicByKey.psyc,r,r.pick([4,8,13]),[]));
  return out;}
function visitWeeks(L,toW){var out=[];for(var w=L.first+((L.phase-L.first)%L.every+L.every)%L.every;w<=toW;w+=L.every)out.push(w);return out;}
/* ---------- the long-term simulation ---------- */
function ladderMeds(lad,pos){var base=null,adds=[];if(!lad)return [];for(var i=0;i<=pos&&i<lad.steps.length;i++){var s=lad.steps[i];if(s.charAt(0)==='+')adds.push(s.slice(1));else base=s;}return (base?[base]:[]).concat(adds);}
function fmt(k,v){var t=T.labs[k];return t?(t.dec?v.toFixed(t.dec):String(Math.round(v))):String(Math.round(v));}
function simulate(S){if(S.sim)return S.sim;var r=H.R('sim|'+S.key),sim={links:S.links,visits:[],state:{}},i;
  S.links.forEach(function(L){var c=M.clinicByKey[L.clinic],cm=cmod(c);L.visits=visitWeeks(L,HORIZON_W).map(function(w,n){var t=sessTime(c,L.sess,w,L.slot),st='ok';
      if(S.admit&&t>=H.addH(S.admit,-3)&&t<=S.discharge)st='Cancelled (in hospital)';else if(H.unit01(S.key+L.clinic+w)<(cm.noShow!=null?cm.noShow:.07))st='No-show';
      return {t:t,w:w,link:L,st:st,type:n===0?'New patient':'Return visit'};});
    if(L.extra)L.extra.forEach(function(e){L.visits.push({t:e.t,w:H.weekIndex(e.t),link:L,st:'ok',type:e.type,extra:true});});
    L.visits.sort(function(a,b){return a.t-b.t;});});
  S.problemsOpd.forEach(function(pb){var o=pb.opd||{},lad=o.ladder,st={key:pb.key,pb:pb,pos:lad?r.int(0,Math.min(lad.steps.length-1,lad.startMax==null?2:lad.startMax)):0,vals:{},series:[]},k;
    for(k in (o.tracks||{}))st.vals[k]=r.tri(o.tracks[k].start[0],o.tracks[k].start[1]);
    function evolve(stepped){for(var k in (o.tracks||{})){var tr=o.tracks[k];st.vals[k]+=(tr.drift||0)+(tr.noise||0)*(r.f()+r.f()-1)*.8-(stepped&&lad&&lad.on===k?(lad.effect||0)*r.tri(.6,1.3):0);
      if(tr.floor!=null&&st.vals[k]<tr.floor)st.vals[k]=tr.floor+r.f()*(tr.noise||0)*.5;if(tr.ceil!=null&&st.vals[k]>tr.ceil)st.vals[k]=tr.ceil;}}
    function snapV(){var o2={};for(var k in st.vals)o2[k]=H.round(st.vals[k],T.labs[k]?T.labs[k].dec:0);return o2;}
    var L=S.links.filter(function(l){return l.manages.indexOf(pb.key)>=0;})[0];st.link=L||null;
    if(!L){var n=r.int(2,5);for(i=0;i<n;i++){var up=lad&&lad.on&&st.vals[lad.on]>lad.above&&st.pos<lad.steps.length-1&&r.chance(.6);if(up)st.pos++;evolve(up);}st.series.push({t:new Date(2000,0,1),vals:snapV(),pos:st.pos,change:null,virtual:true});}
    else L.visits.forEach(function(v){if(v.st!=='ok')return;var vals=snapV(),change=null,up=lad&&lad.on&&st.vals[lad.on]>lad.above&&st.pos<lad.steps.length-1&&r.chance(.7);
      if(up){var before=ladderMeds(lad,st.pos);st.pos++;var after=ladderMeds(lad,st.pos),nw=after.filter(function(x){return before.indexOf(x)<0;}),gone=before.filter(function(x){return after.indexOf(x)<0;});
        change=(gone.length?'changed '+T.meds[gone[0]].name+' to '+T.meds[nw[0]].name:'started '+T.meds[nw[0]].name)+' ('+T.freq[T.meds[nw[0]].freq][0]+')';}
      st.series.push({t:v.t,vals:vals,pos:st.pos,posBefore:up?st.pos-1:st.pos,change:change,visit:v});evolve(up);});
    if(!st.series.length)st.series.push({t:new Date(2000,0,1),vals:snapV(),pos:st.pos,change:null,virtual:true});
    sim.state[pb.key]=st;});
  S.links.forEach(function(L){L.visits.forEach(function(v){sim.visits.push(v);});});sim.visits.sort(function(a,b){return a.t-b.t;});
  /* health maintenance: an item is done at the first attended visit after it falls due */
  S.links.forEach(function(L){var cm=cmod(M.clinicByKey[L.clinic]);if(!(L.pcp||cm.hmAll)||!(cm.hm||[]).length)return;var last={};
    L.visits.forEach(function(v){v.hm=[];if(v.st!=='ok')return;var ageV=S.person.ageY-H.days(v.t,S.admit||H.BASE_NOW)/365.25;cm.hm.forEach(function(h){if(ageV<(h[2]||0)||ageV>(h[3]||200)||(h[4]&&h[4]!==S.person.sex))return;
      if(last[h[0]]==null)last[h[0]]=v.w-(H.hash(S.key+h[0])%Math.max(1,h[1]))-1;if(v.w-last[h[0]]>=h[1]){v.hm.push(h[0]);last[h[0]]=v.w;}});});});
  return S.sim=sim;}
var ONE={acei:1,statin:1,betablocker:1,sglt2:1,anticoagulant:1,ssri:1,thyroid:1};
function stateAt(st,t){var e=st.series[0];for(var i=0;i<st.series.length;i++)if(st.series[i].t<=t)e=st.series[i];return e;}
/* snapshot of a person's long-term record at time t: home medicines, problem list, history lines, lab baselines */
function snapshot(S,t,strictBefore){var sim=simulate(S),home=[],seen={},pmh=[],problems=[],base={};
  function addMed(k,ck){var d=T.meds[k];if(!d||seen[k]||seen[d.name.split(' ')[0]])return;if(ONE[d.cls]){if(seen['c:'+d.cls])return;seen['c:'+d.cls]=1;}seen[k]=1;seen[d.name.split(' ')[0]]=1;var f=T.freq[d.freq];home.push({key:k,name:d.name,cls:d.cls,text:d.name+' '+(/^prn/.test(d.freq)?f[0]+' for '+(d.extra||'symptoms'):f[0]),from:ck});}
  S.problemsOpd.forEach(function(pb){var st=sim.state[pb.key],e=stateAt(st,strictBefore?H.addMin(t,-1):t),ctx={yrs:2+H.hash(S.key+pb.key)%14,year:2026-(2+H.hash(S.key+pb.key)%14),side:S.person.side},k;
    for(k in e.vals)ctx[k]=fmt(k,e.vals[k]);if(e.vals.cr!=null){ctx.egfr=H.egfr(e.vals.cr,Math.max(18,S.person.ageY),S.person.sex);ctx.stage=ctx.egfr>=45?'3a':ctx.egfr>=30?'3b':ctx.egfr>=15?'4':'5';}
    (pb.home||[]).forEach(function(h){addMed(h.m||h,pb.key);});ladderMeds((pb.opd||{}).ladder,e.pos).forEach(function(k){addMed(k,pb.key);});
    pmh.push(H.fill(pb.pmh||pb.name,ctx));problems.push(H.fill(pb.problem||pb.name,ctx));for(k in e.vals)if(T.labs[k]&&base[k]==null)base[k]=e.vals[k];});
  return {home:home,pmh:pmh,problems:problems,base:base};}
/* ---------- person records ---------- */
function problemsFrom(comorbs,extra){var out=comorbs.map(function(ck){var c=H.comorbidities[ck];return {key:ck,name:c.name,icd:c.icd,pmh:c.pmh,problem:c.problem,home:c.home,opd:c.opd,comorb:true};});return (extra||[]).concat(out);}
function planPerson(P){var k=P.id;if(persons[k])return persons[k];var pop=P.unit.pop,S={id:k,key:k,person:P.person,comorbs:P.comorbs,pop:pop,admit:P.admit,discharge:P.discharge,plan:P,problemsOpd:problemsFrom(P.comorbs)};
  S.links=P.unit.acuity==='ed'?[]:linksFor(k,P.person,P.comorbs,pop);
  /* hospital follow-up appointments after discharge */
  var fl=(P.mod.dc&&P.mod.dc.follow)||[],r=H.R('fu|'+k);if(P.unit.acuity!=='ed'&&P.unit.pop!=='neonate'||fl.length)fl.concat(fl.length?[]:[]).forEach(function(f){var ck=f[0]==='pcp'?(S.links.filter(function(l){return l.pcp;})[0]||{}).clinic||(pop==='peds'?'pedpc':'pcp'):f[0],c=M.clinicByKey[ck];if(!c)return;
    var L=S.links.filter(function(l){return l.clinic===ck;})[0];if(!L){L=mkLink(c,r,9999,[],0);L.first=HORIZON_W+1;L.oneOff=true;S.links.push(L);}
    var w=H.weekIndex(H.addD(P.discharge,f[1])),t=sessTime(c,L.sess,w,L.slot);if(t<H.addD(P.discharge,Math.max(1,f[1]-3)))t=sessTime(c,L.sess,w+1,L.slot);(L.extra=L.extra||[]).push({t:t,type:f[2]||'Hospital follow-up'});});
  return persons[k]=S;}
H.opdOf=function(P){if(P._opd)return P._opd;var S=planPerson(P),sn=snapshot(S,P.admit,true);sn.S=S;return P._opd=sn;};
H.followUps=function(P){var S=planPerson(P),out=[];S.links.forEach(function(L){(L.extra||[]).forEach(function(e){out.push({key:L.clinic,clinic:M.clinicByKey[L.clinic].name,t:e.t,type:e.type});});});return out.sort(function(a,b){return a.t-b.t;});};
/* ---------- visit records ---------- */
function clinicianFor(c,L,t){var svc=M.serviceByKey[c.service],n=Math.max(1,Math.min(svc.attendings||1,Math.ceil(c.clinicians*1.6))),i=(L.sess*c.clinicians+L.prov%c.clinicians)%n;
  if(svc.attendings)return H.staffName(svc.key+'att'+((H.hash('cl'+c.key)%svc.attendings+i)%svc.attendings),'dr');return H.staffName(c.key+'lead'+i,'full')+(svc.key==='pharm'?' PharmD':svc.key==='diabed'?' RN, diabetes educator':svc.key==='wound'?' RN':'');}
function vitalsAtVisit(S,t,sim){var p=S.person,yrs=H.days(t,S.admit||H.BASE_NOW)/365.25,dir=H.hash(S.key+'wd')%3-1,a=p.ageY-yrs,wt,ht=p.htCm;
  if(p.ageY<18){var f=function(ay){return ay<1?3.5+ay*12*0.55:ay<=10?2*ay+9:3.3*ay-3;};wt=p.wtKg*f(Math.max(0,a))/f(p.ageY);ht=Math.round(a<1?50+a*25:Math.min(172,77+6.2*a));}else wt=p.wtKg*(1+0.012*yrs*dir);
  wt=H.round(wt+0.5*H.noise(S.key+'w'+t.getTime()),1);var sbp=null;for(var k in sim.state){var e=stateAt(sim.state[k],t);if(e.vals.sbp!=null&&!e.virtual)sbp=e.vals.sbp;}
  var pn=p.ageY<18?H.pedsNorm(Math.max(.1,a)):null;if(sbp==null)sbp=Math.round((pn?pn[3]:116+Math.min(18,p.ageY/6))+7*H.noise(S.key+'s'+t.getTime()));
  return {wt:wt,ht:ht,bmi:p.ageY>=18?H.round(wt/(ht*ht/10000),1):null,sbp:Math.round(sbp),dbp:Math.round(sbp*.6+4*H.noise(S.key+'d'+t.getTime())),hr:Math.round((pn?pn[1]:72)+8*H.noise(S.key+'h'+t.getTime()))};}
function visitRecord(S,v,now){var sim=simulate(S),L=v.link,c=M.clinicByKey[L.clinic],cm=cmod(c),done=v.t<=now,r=H.R('vis|'+S.key+L.clinic+v.t.getTime()),p=S.person;
  var dur=Math.floor(210/c.slots),status=v.st!=='ok'?(v.t<=now||/Cancel/.test(v.st)?v.st:'Scheduled'):v.t>now?(H.calDays(now,v.t)===0&&H.days(now,v.t)*1440<25?'Arrived':'Scheduled'):H.days(v.t,now)*1440<8?'Roomed':H.days(v.t,now)*1440<dur+5?'In visit':'Seen';
  var rec={id:S.id+'@'+L.clinic+'@'+H.iso(v.t),t:v.t,clinicKey:c.key,clinic:c.name,type:v.type,status:status,clinician:clinicianFor(c,L,v.t),location:M.buildings.filter(function(b){return b.key===c.building;})[0].name+', floor '+c.floor+', '+c.suite,minutes:v.type==='New patient'?dur*2:dur};
  var managed=S.problemsOpd.filter(function(pb){return L.manages.indexOf(pb.key)>=0;}),lead=managed[0];
  rec.reason=v.extra?v.type+(S.plan?' after admission for '+S.plan.dx.charAt(0).toLowerCase()+S.plan.dx.slice(1):''):managed.length>1&&L.pcp?'Review of long-term conditions':lead?lead.name:(S.reason||(L.pcp?(p.ageY<18?'Well-child check':'Annual review and health maintenance'):c.key==='obc'?'Routine prenatal visit':c.key==='psyc'?'Medication review':'Review'));
  if(status!=='Seen')return rec;
  var vt=vitalsAtVisit(S,v.t,sim);rec.vitals={weightKg:vt.wt,heightCm:vt.ht,bmi:vt.bmi,bp:vt.sbp+'/'+vt.dbp,hr:vt.hr};rec.labs=[];rec.changes=[];rec.orders=[];
  var lines=[],ctx={age:H.ageAt(p,v.t).adj,sex:p.ageY<16?(p.sex==='M'?'boy':'girl'):(p.sex==='M'?'man':'woman'),he:p.sex==='M'?'he':'she',He:p.sex==='M'?'He':'She',his:p.sex==='M'?'his':'her',him:p.sex==='M'?'him':'her',yrs:2+H.hash(S.key+'yrs')%9,name:p.given+' '+p.sur,side:p.side,clinic:c.name,weeks:L.every<999?L.every:8};
  var sn=snapshot(S,v.t,false),n=0;
  managed.forEach(function(pb){var st=sim.state[pb.key],e=null,pe=null;st.series.forEach(function(x){if(x.visit===v)e=x;else if(x.t<v.t&&!x.virtual)pe=x;});if(!e)return;var o=pb.opd||{},parts=[],trend=0,k;
    for(k in e.vals){var tab=T.labs[k];if(tab){rec.labs.push([tab.name,tab.unit,tab.lo,tab.hi,e.vals[k]]);if(k==='cr'){var g=H.egfr(e.vals.cr,Math.max(18,p.ageY),p.sex),gt=T.labs.egfr;rec.labs.push([gt.name,gt.unit,gt.lo,gt.hi,g]);parts.push('eGFR '+g+(pe?' ('+H.egfr(pe.vals.cr,Math.max(18,p.ageY),p.sex)+')':''));}}
      parts.push((tab?tab.name:k==='sbp'?'Clinic systolic pressure':k==='hr'?'Resting heart rate':k)+' '+fmt(k,e.vals[k])+(tab&&tab.unit==='%'?'%':'')+(pe?' ('+fmt(k,pe.vals[k])+' last visit)':''));if(pe&&o.ladder&&o.ladder.on===k)trend=e.vals[k]-pe.vals[k];}
    var status2=!Object.keys(e.vals).length?'stable':!pe?'first measurements today':o.ladder&&o.ladder.on?(e.vals[o.ladder.on]<=o.ladder.above?'at target':trend<0?'improving, not yet at target':'above target'):'stable';
    var ph=H.fill((o.sx||['No new symptoms'])[(H.hash(S.key+pb.key+v.w))%(o.sx||[1]).length],ctx,r.f);
    var pl=(o.plan||['Continue current treatment'])[(H.hash(S.key+pb.key+'p'+v.w))%(o.plan||[1]).length];
    lines.push((++n)+'. '+pb.name+': '+status2+'. '+(parts.length?parts.join('; ')+'. ':'')+H.cap(ph)+'. '+(e.change?H.cap(e.change)+' today. ':'')+H.fill(pl,ctx,r.f)+'.');
    if(e.change)rec.changes.push(H.cap(e.change));(o.labs||[]).forEach(function(lk){if(e.vals[lk]==null&&T.labs[lk])rec.orders.push('Laboratory: '+T.labs[lk].name+' before next visit');});});
  S.problemsOpd.forEach(function(pb){if(L.manages.indexOf(pb.key)<0&&n<7)lines.push((++n)+'. '+pb.name+': followed '+(sim.state[pb.key].link?'in '+M.clinicByKey[sim.state[pb.key].link.clinic].name:'by the primary care team')+'; no change today.');});
  if(!managed.length&&S.reasonText)lines.push((++n)+'. '+S.reasonText);
  var hm=(v.hm||[]).slice(0,4);
  rec.healthMaintenance=hm;
  ctx.referral=H.fill((lead&&lead.opd&&lead.opd.referral)||cm.referral||'Referred by the primary care team',ctx,r.f);var bank=v.type==='New patient'?(cm.notes&&cm.notes.new):v.extra?(cm.notes&&cm.notes.hfu)||(cm.notes&&cm.notes.ret):(cm.notes&&cm.notes.ret);ctx.reason=rec.reason.charAt(0).toLowerCase()+rec.reason.slice(1);
  var intro=H.fill(bank||'{age} {sex} seen for {reason}.',ctx,r.f);
  if(v.extra&&S.plan)intro+=' In hospital '+H.dm(S.plan.admit)+' to '+H.dm(S.plan.discharge)+' for '+S.plan.dx.charAt(0).toLowerCase()+S.plan.dx.slice(1)+'; discharge summary reviewed.';
  var nextV=L.visits.filter(function(x){return x.t>v.t&&x.st!=='Cancelled (in hospital)';})[0];rec.next=nextV?nextV.t:null;
  rec.note={title:c.name+': '+v.type.toLowerCase(),by:rec.clinician,body:intro+'\n\nMedicines: '+(sn.home.length?sn.home.map(function(h){return h.text;}).join('; '):'none regular')+'.\n\n'+
    'Examination: weight '+vt.wt.toFixed(1)+' kg'+(vt.bmi?' (body mass index '+vt.bmi.toFixed(1)+')':', height '+vt.ht+' cm')+', blood pressure '+vt.sbp+'/'+vt.dbp+', heart rate '+vt.hr+'. '+H.fill(cm.exam||'[Looks well|Comfortable at rest]. Heart sounds normal, chest clear.',ctx,r.f)+'\n\n'+
    'Assessment and plan:\n'+(lines.length?lines.join('\n'):'1. '+H.cap(ctx.reason)+': '+H.fill(cm.planGeneric||'[stable; continue current management|doing well; no change|symptoms controlled; continue]',ctx,r.f)+'.')+(hm.length?'\n\nHealth maintenance today: '+hm.join('; ')+'.':'')+
    '\n\n'+(nextV?'Return '+(L.every<999&&!nextV.extra?'in '+L.every+' weeks':'as booked')+' ('+H.dm(nextV.t)+' '+nextV.t.getFullYear()+').':'Return as needed.')};
  return rec;}
/* ---------- encounters for the inpatient chart ---------- */
H.pastEncounters=function(P){var S=planPerson(P),sim=simulate(S),out=[],r=H.R('enc|'+P.id),pop=P.unit.pop,now=P.admit;
  sim.visits.filter(function(v){return v.t<P.admit&&v.st==='ok';}).slice(-6).forEach(function(v){var rec=visitRecord(S,v,H.addD(v.t,2)),c=M.clinicByKey[v.link.clinic];
    out.push({t:v.t,kind:'Clinic visit',dept:c.name,title:rec.reason.length>70?rec.type:rec.type+': '+rec.reason.charAt(0).toLowerCase()+rec.reason.slice(1),summary:'Weight '+rec.vitals.weightKg.toFixed(1)+' kg, blood pressure '+rec.vitals.bp+'. '+(rec.changes.length?rec.changes.join('. ')+'.':'No change to treatment.')+' Seen by '+rec.clinician+'.',visitId:rec.id});});
  var pads=pop==='neonate'?[[2,'Admission','Labour and Postnatal','Birth','Born at '+(P.vars.gest||'term')+'. Cared for by the newborn team from birth.'],[9,'Clinic visit','Antenatal Clinic','Mother’s prenatal visit','Maternal record: routine visit, blood pressure normal, baby moving well.'],[40,'Clinic visit','Antenatal Clinic','Mother’s prenatal visit','Maternal record: growth on track; group B streptococcus swab taken.'],
     [75,'Procedure','Maternal-Fetal Medicine ultrasound','Growth ultrasound','Maternal record: estimated weight and fluid as expected for dates.'],[140,'Procedure','Maternal-Fetal Medicine ultrasound','Anatomy ultrasound','Maternal record: normal anatomy survey.'],[200,'Clinic visit','Antenatal Clinic','Mother’s booking visit','Maternal record: first prenatal visit, routine blood tests sent.']]
   :pop==='peds'?[[30+r.int(0,90),'Telephone','Paediatric Primary Care','Parent advice call','Advice given about fever and fluids; no visit needed.'],[200+r.int(0,200),'Emergency visit','Emergency Department','[Minor head bump|Ear infection|Vomiting and diarrhoea|Wheeze with a cold]','Assessed and sent home the same day with advice.'],[500+r.int(0,300),'Clinic visit','Paediatric Primary Care','Immunisation visit','Routine vaccines given; growth on track.'],
     [900+r.int(0,300),'Clinic visit','Paediatric Primary Care','Well-child check','Growth and development as expected.'],[1300+r.int(0,300),'Emergency visit','Emergency Department','[Fall from a scooter|Croup|Rash]','Sent home with advice.']]
   :[[20+r.int(0,60),'Telephone',(S.links.filter(function(l){return l.pcp;})[0]?M.clinicByKey[S.links.filter(function(l){return l.pcp;})[0].clinic].name:'Primary Care Internal Medicine'),'[Medicine refill request|Call about test results|Appointment change]','Handled by the clinic nurse; no change in treatment.'],[150+r.int(0,250),'Emergency visit','Emergency Department','[Ankle sprain|Chest wall pain|Laceration to the hand|Dizziness|Back pain]','Assessed, treated and sent home the same day.'],
     [500+r.int(0,400),'Procedure','[Endoscopy Unit|Ambulatory Surgery Centre|Radiology]','[Screening colonoscopy|Skin lesion removal|Bone density scan|Cataract surgery]','Uncomplicated; routine follow-up advised.'],[1000+r.int(0,500),'Admission','[General medicine|General surgery|Orthopaedics]','[Pneumonia, 3 days|Gallbladder removal|Cellulitis, 2 days|Kidney stone|Wrist fracture fixation]','Recovered fully and returned home.'],
     [1700+r.int(0,600),'Clinic visit','[Community health centre|Previous family doctor]','Annual review','Routine review; screening up to date at the time.'],[2400+r.int(0,400),'Emergency visit','Emergency Department','[Minor road traffic collision|Allergic rash|Nosebleed]','Sent home with advice.']];
  if(pop==='peds'){var maxD=Math.max(3,Math.floor(P.person.ageY*365)-2);pads=pads.map(function(p,i){if(p[0]>maxD)p=[Math.max(1,Math.round(maxD*(i+1)/7)),p[1],p[2],i===pads.length-1?'Newborn check':p[3],p[4]];return p;});}
  for(var i=0;i<pads.length&&(out.length<5||i<2);i++){var p=pads[i],t=H.at(H.addD(P.admit,-p[0]),9+r.int(0,7),r.int(0,11)*5);if(pop==='neonate'&&i===0)t=H.addMin(P.arrive,-5);out.push({t:t,kind:p[1],dept:H.fill(p[2],{},r.f),title:H.fill(p[3],{},r.f),summary:p[4]});}
  return out.sort(function(a,b){return b.t-a.t;}).slice(0,8);};
/* ---------- clinic panels ---------- */
function panelSize(c){var cm=cmod(c),ev=cm.every||[13,26],mean=0;ev.forEach(function(e){mean+=1/e;});mean=ev.length/mean;return Math.round(.82*c.sessions.length*c.clinicians*c.slots*mean);}
function member(c,n){var id='o.'+c.key+'.'+n;if(persons[id])return persons[id];var cm=cmod(c),r=H.R('member|'+id),probs=(cm.problems||[]).filter(function(p){return !c.pk||c.pk.indexOf(p.key||p.c)>=0;}),S={id:id,key:id,clinicKey:c.key};
  var pb=null,spec={age:cm.age||[18,90,58],sex:cm.sex};
  if(c.group==='Children')spec={age:[0.2,17,7]};if(c.group==='Women'&&c.key!=='gync')spec={age:[19,42,31],sex:[0,1]};if(c.key==='gync')spec={age:[18,75,42],sex:[0,1]};if(c.key==='gerc'||c.key==='memc')spec={age:[70,96,81]};if(c.key==='gynoncc')spec.sex=[0,1];
  if(c.reasons){var rs=r.pick(c.reasons);S.reason=rs;}
  else if(probs.length){var ch=r.wpick(probs,function(p){return p.w||1;});pb=ch;if(ch.age)spec.age=ch.age;if(ch.sex)spec.sex=ch.sex;}
  S.person=H.makePerson(id,spec,H.BASE_NOW);var pop=S.person.ageY<18?'peds':'adult',forced={};if(pb&&pb.c){forced[pb.c]=1;var cd=H.comorbidities[pb.c];if(cd&&S.person.ageY<(cd.minAge||18)){S.person=H.makePerson(id,{age:[Math.max(cd.minAge||18,30),88,62],sex:spec.sex},H.BASE_NOW);pop='adult';}}
  S.comorbs=H.pickComorbs(r,S.person,forced,pop,4);S.pop=pop;
  var inline=pb&&!pb.c?[{key:pb.key,name:H.fill(pb.name,{side:S.person.side}),icd:pb.icd,pmh:pb.pmh,problem:pb.problem,home:pb.home,opd:pb}]:[];S.problemsOpd=problemsFrom(S.comorbs,inline);
  var ev=(pb&&pb.every)||(pb&&pb.c&&H.comorbidities[pb.c].opd&&H.comorbidities[pb.c].opd.every)||cm.every||[13,26],L=mkLink(c,r,r.pick(ev),[],null);
  L.sess=n%c.sessions.length;L.first=BASEW+14-Math.floor(r.tri(0,250,20));L.pcp=c.module==='pcp';
  L.manages=S.problemsOpd.filter(function(p){return !p.comorb||L.pcp||(pb&&pb.c===p.key)||(cm.manages||[]).indexOf(p.key)>=0;}).map(function(p){return p.key;});
  S.links=[L];S.reasonText=S.reason?S.reason+': '+H.fill(cm.planGeneric||'[stable; continue current management|doing well; no change|symptoms controlled; continue]',{},r.f)+'.':null;
  return persons[id]=S;}
/* linked inpatients: every generated stay in the window, indexed by clinic */
function buildLinkIdx(){if(linkIdx)return linkIdx;linkIdx={};var until=H.addD(H.BASE_NOW,21),now=H.cfg.now>until?H.cfg.now:until;
  H.allPlans(now,51).forEach(function(P){if(P.unit.acuity==='ed')return;var S=planPerson(P);S.id=P.id;S.links.forEach(function(L){(linkIdx[L.clinic]=linkIdx[L.clinic]||[]).push([S,L]);});});return linkIdx;}
function handVisits(){if(memo.hand)return memo.hand;var out=[];H.hand.list.forEach(function(p){(p.encounters||[]).forEach(function(e,i){if(e.kind!=='Clinic visit'&&e.kind!=='Telephone')return;var ck=null;for(var j=0;j<M.deptMap.length;j++)if(M.deptMap[j][0].test(e.dept)){ck=M.deptMap[j][1];break;}
      if(!ck)return;var c=M.clinicByKey[ck],t=e.t.getHours()?e.t:H.at(e.t,9+H.hash(p.id+i)%7,(H.hash(p.id+'m'+i)%4)*15);out.push({p:p,e:e,clinic:ck,t:t,type:e.kind==='Telephone'?'Telephone':'Return visit',past:true});});});
  M.handFollow.forEach(function(f){var p=H.hand.byId[f[0]],c=M.clinicByKey[f[1]];if(!p||!c)return;var w=H.weekIndex(H.addD(H.BASE_NOW,f[2])),si=H.hash(f[0]+f[1])%c.sessions.length,t=sessTime(c,si,w,H.hash(f[0]+f[1]+'s')%c.slots);if(t<H.addD(H.BASE_NOW,1))t=sessTime(c,si,w+1,H.hash(f[0]+f[1]+'s')%c.slots);
    out.push({p:p,clinic:f[1],t:t,type:f[3],past:false,L:{sess:si,prov:H.hash(f[0])%97}});});
  return memo.hand=out;}
/* HOSP.clinics() */
H.clinics=function(){return M.clinics.map(function(c){var b=M.buildings.filter(function(x){return x.key===c.building;})[0];return {key:c.key,name:c.name,group:c.group,service:M.serviceByKey[c.service].name,serviceKey:c.service,module:c.module,building:b.name,floor:c.floor,suite:c.suite,
  sessions:c.sessions.map(function(s){return {day:H.DOW[s.dow],half:s.half,start:s.half==='AM'?'08:30':'13:00',end:s.half==='AM'?'12:00':'16:30'};}),cliniciansPerSession:c.clinicians,slotsPerClinician:c.slots,panelSize:panelSize(c)};});};
/* HOSP.clinicSchedule(clinicKey, date) */
H.clinicSchedule=function(key,date,now){var c=M.clinicByKey[key];if(!c)return [];now=now||H.cfg.now;date=date?H.day0(H.parseDate(date)):H.day0(now);var ck=key+'|'+H.isoDate(date)+'|'+now.getTime();if(sched[ck])return sched[ck];
  var w=H.weekIndex(date),dow=date.getDay(),rows=[],N=panelSize(c),used={};
  function push(S,v,extra){var rec=visitRecord(S,v,now),p=S.person,o={t:rec.t,time:H.hm(rec.t),clinicKey:key,patientId:S.id,visitId:rec.id,name:p.name,age:H.ageAt(p,now).age,ageText:H.ageAt(p,now).text,sex:p.sex,mrn:p.mrn,type:rec.type,reason:rec.reason,clinician:rec.clinician,status:rec.status,minutes:rec.minutes,inpatientNow:false,handwritten:false};
    if(S.plan){o.inpatientId=S.plan.id;o.inpatientNow=S.plan.admit<=now&&S.plan.discharge>now;}if(extra)for(var k in extra)o[k]=extra[k];rows.push(o);}
  c.sessions.forEach(function(s,si){if(s.dow!==dow)return;for(var n=si;n<N;n+=c.sessions.length){var S=member(c,n),L=S.links[0];if(w<L.first||((w-L.phase)%L.every+L.every)%L.every)continue;var sim=simulate(S),v=null;for(var i=0;i<L.visits.length;i++)if(L.visits[i].w===w){v=L.visits[i];break;}if(v)push(S,v);}});
  (buildLinkIdx()[key]||[]).forEach(function(pair){var S=pair[0],L=pair[1];simulate(S);L.visits.forEach(function(v){if(H.calDays(date,v.t)===0)push(S,v);});});
  handVisits().forEach(function(h){if(h.clinic!==key||H.calDays(date,h.t)!==0)return;var p=h.p;rows.push({t:h.t,time:H.hm(h.t),clinicKey:key,patientId:p.id,visitId:p.id+'@'+key+'@'+H.iso(h.t),name:p.name,age:p.age,ageText:p.ageText||null,sex:p.sex,mrn:p.mrn,type:h.type,reason:h.e?h.e.title:h.type,
    clinician:h.e?'Clinic team':clinicianFor(c,h.L,h.t),status:h.past?(h.type==='Telephone'?'Completed (telephone)':'Seen'):h.t<=now?'Seen':'Scheduled',minutes:Math.floor(210/c.slots),inpatientNow:p.admit<=now,inpatientId:p.id,handwritten:true});});
  rows.sort(function(a,b){return a.t-b.t||(a.name<b.name?-1:1);});return sched[ck]=rows;};
/* ---------- the outpatient chart ---------- */
function handOut(p,now){var hv=handVisits().filter(function(h){return h.p===p;}),visits=[],up=[];
  hv.forEach(function(h){var c=M.clinicByKey[h.clinic],o={id:p.id+'@'+h.clinic+'@'+H.iso(h.t),t:h.t,clinicKey:h.clinic,clinic:c.name,type:h.type,status:h.past||h.t<=now?(h.type==='Telephone'?'Completed (telephone)':'Seen'):'Scheduled',clinician:h.e?'Clinic team':clinicianFor(c,h.L,h.t),reason:h.e?h.e.title:h.type+' after admission for '+p.dx.charAt(0).toLowerCase()+p.dx.slice(1)};
    if(h.e)o.note={title:h.e.title,by:h.e.dept,body:h.e.summary};(o.status==='Scheduled'?up:visits).push(o);});
  visits.sort(function(a,b){return b.t-a.t;});up.sort(function(a,b){return a.t-b.t;});
  return {id:p.id,personId:p.id,name:p.name,age:p.age,ageText:p.ageText||null,sex:p.sex,dob:p.dob,mrn:p.mrn,wt:p.wt,ht:p.ht,allergies:p.allergies,problems:(p.hx&&p.hx.pmh)||[],meds:((p.hx&&p.hx.home)||[]).map(function(x){return {text:x};}),
    clinics:visits.concat(up).map(function(v){return v.clinicKey;}).filter(function(x,i,a){return a.indexOf(x)===i;}).map(function(k){return {key:k,name:M.clinicByKey[k].name};}),visits:visits,upcoming:up,labs:[],healthMaintenance:[],
    otherEncounters:(p.encounters||[]).filter(function(e){return e.kind!=='Clinic visit'&&e.kind!=='Telephone';}),inpatient:{id:p.id,unit:p.unit,bed:p.bed,admit:p.admit,discharge:null,dx:p.dx,current:p.admit<=now},handwritten:true,generated:false,asOf:now};}
/* HOSP.outpatient(id) — id is an outpatient id ('o.cardc.12'), a generated stay id ('g.med.07.5') or a hand-written id ('p13') */
H.outpatient=function(id,now){now=now||H.cfg.now;if(H.hand.byId[id])return handOut(H.hand.byId[id],now);var S=null,m=/^o\.([a-z0-9]+)\.(\d+)$/.exec(id);
  if(m){var c=M.clinicByKey[m[1]];if(!c||+m[2]>=panelSize(c))return null;S=member(c,+m[2]);}else{var P=H.plan(id);if(!P)return null;S=planPerson(P);S.id=P.id;}
  var sim=simulate(S),p=S.person,visits=[],up=[],labsBy={},sn=snapshot(S,now,false);
  sim.visits.forEach(function(v){if(v.t<H.addD(now,-5*366))return;var rec=visitRecord(S,v,now);if(v.t>now&&H.days(now,v.t)>200)return;if(rec.status==='Scheduled'||rec.status==='Arrived'||(v.t>now&&/Cancel/.test(rec.status)))up.push(rec);else visits.push(rec);
    (rec.labs||[]).forEach(function(l){(labsBy[l[0]]=labsBy[l[0]]||{meta:l,pts:[]}).pts.push([v.t,l[4]]);});});
  visits.sort(function(a,b){return b.t-a.t;});
  var names=Object.keys(labsBy),times=[],seen={};names.forEach(function(n){labsBy[n].pts.forEach(function(x){if(!seen[x[0].getTime()]){seen[x[0].getTime()]=1;times.push(x[0]);}});});times.sort(function(a,b){return a-b;});times=times.slice(-8);
  var labs=names.length?[{panel:'Clinic results over time',times:times,rows:names.map(function(n){var L=labsBy[n];return [L.meta[0],L.meta[1],L.meta[2],L.meta[3],times.map(function(t){var f=L.pts.filter(function(x){return x[0].getTime()===t.getTime();})[0];return f?f[1]:null;})];})}]:[];
  var hm=[],hmSeen={};S.links.forEach(function(l){var cmL=cmod(M.clinicByKey[l.clinic]);if(!(l.pcp||cmL.hmAll))return;(cmL.hm||[]).forEach(function(h){if(hmSeen[h[0]]||p.ageY<(h[2]||0)||p.ageY>(h[3]||200)||(h[4]&&h[4]!==p.sex))return;hmSeen[h[0]]=1;var last=null;visits.forEach(function(v){if(!last&&(v.healthMaintenance||[]).indexOf(h[0])>=0)last=v.t;});var due=last?H.addD(last,h[1]*7):null;hm.push({item:h[0],everyWeeks:h[1],last:last,due:due,status:!last?'No record in this chart':due<now?'Due':'Up to date'});});});
  var out={id:S.id||id,personId:S.key,name:p.name,age:H.ageAt(p,now).age,ageText:H.ageAt(p,now).text,sex:p.sex,dob:p.dob,mrn:p.mrn,wt:p.wtKg.toFixed(1)+' kg',ht:p.htCm+' cm',allergies:S.plan?(H.buildMeds(S.plan,now),S.plan._alg):[['No known allergies','']],
    problems:sn.problems.concat(S.reason?[S.reason]:[]),meds:sn.home.map(function(h){return {name:h.name,text:h.text,forProblem:h.from};}),clinics:S.links.map(function(l){return {key:l.clinic,name:M.clinicByKey[l.clinic].name,everyWeeks:l.every<999?l.every:null};}),
    visits:visits,upcoming:up.sort(function(a,b){return a.t-b.t;}),labs:labs,healthMaintenance:hm,otherEncounters:[],inpatient:S.plan?{id:S.plan.id,unit:S.plan.unit.name,bed:S.plan.bed,admit:S.plan.admit,discharge:S.plan.discharge,dx:S.plan.dx,current:S.plan.admit<=now&&S.plan.discharge>now}:null,handwritten:false,generated:true,asOf:now,
    truth:{comorbidities:S.comorbs.slice(),ladderPositions:(function(){var o={};for(var k in sim.state)o[k]=stateAt(sim.state[k],now).pos;return o;})(),seed:H.cfg.seed}};
  if(S.plan&&S.plan.admit>now)out.inpatient=null;
  return out;};
H.searchOutpatients=function(q,limit){var out=[];if(!memo.names){memo.names=[];M.clinics.forEach(function(c){var N=panelSize(c);for(var n=0;n<N;n++){var S=member(c,n);memo.names.push([S,(S.person.name+' '+S.person.mrn).toLowerCase(),c]);}});}
  for(var i=0;i<memo.names.length&&out.length<limit;i++)if(memo.names[i][1].indexOf(q)>=0){var S=memo.names[i][0];out.push({kind:'outpatient',id:S.id,name:S.person.name,mrn:S.person.mrn,age:H.ageAt(S.person,H.cfg.now).age,sex:S.person.sex,where:memo.names[i][2].name,dx:(S.problemsOpd[0]||{}).name||S.reason||'',handwritten:false});}
  return out;};
H._member=member;H._panelSize=panelSize;
})(HOSP);
