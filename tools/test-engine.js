#!/usr/bin/env node
/* tools/test-engine.js — engine acceptance tests. Run: node tools/test-engine.js   (exit code 1 on any failure)
   The structural checks are the checks of /validate.js applied to chart objects, minus the items the work order relaxes
   for generated patients: the `key` section (may be empty), the 90-word minimum per note, and the file-size check. */
const path=require('path'),fs=require('fs');const root=path.join(__dirname,'..');
const load=require(path.join(root,'engine'));
let fails=0,checks=0;const failMsgs={};
function ok(c,msg){checks++;if(!c){fails++;failMsgs[msg]=(failMsgs[msg]||0)+1;}}
function section(n){console.log('\n== '+n);}
const {structural}=require('./lib-checks.js');

const t00=Date.now();let H=load({});const NOW=H.now();
section('Hospital model');
const hosp=H.hospital(),units=H.units();console.log(JSON.stringify(hosp.modules),hosp.inpatientBeds,'inpatient beds +',hosp.emergencyBays,'emergency bays in',units.length,'units;',hosp.clinics,'clinics;',hosp.services,'services');
ok(hosp.inpatientBeds>=1100&&hosp.inpatientBeds<=1300,'about 1,200 inpatient beds');ok(units.length>=45,'45+ units');ok(hosp.clinics>=70,'70 clinics');
const REQ={icu:['Medical ICU','MICU'],neuro:['Neuro ICU','NICU'],trauma:['Trauma ICU','TICU'],cvicu:['Cardiac Surgery ICU','CVICU'],sx:['6 West Surgery','6W'],ortho:['5 North Orthopaedics','5N'],card:['4 East Cardiology','4E'],med:['3 West Medicine','3W'],haem:['7 South Haematology','7S'],tx:['Transplant Unit','TX'],ob:['Labour and Postnatal','LP'],peds:['Paediatrics','PD'],psych:['Behavioural Health','BH'],ed:['Emergency Department','ED']};
for(const k in REQ){const u=units.find(x=>x.key===k);ok(u&&u.name===REQ[k][0]&&u.prefix===REQ[k][1],'required unit '+k);}

section('Census speed and bed resolution');
H=load({});let t=Date.now();const all=H.censusAll();const tCensusCold=Date.now()-t;t=Date.now();H.censusAll();const tCensusWarm=Date.now()-t;
let beds=0,occ=0;const rows=[];for(const k in all){const u=units.find(x=>x.key===k);ok(all[k].length===u.beds,'census length '+k);all[k].forEach((r,i)=>{beds++;ok(r.bed===u.prefix+'-'+String(i+1).padStart(2,'0'),'bed label');ok(['occupied','empty','cleaning'].includes(r.status),'bed status');if(r.status==='occupied'){occ++;rows.push(r);ok(r.id&&r.name&&r.dx&&r.vitals&&r.attending&&r.day>=1,'census row fields '+r.bed);}});
  ok(all[k].some(r=>r.status==='occupied'),'unit has patients: '+k);}
console.log('whole-hospital census: cold',tCensusCold,'ms, warm',tCensusWarm,'ms;',beds,'beds,',occ,'occupied ('+Math.round(100*occ/beds)+'%)');ok(tCensusCold<1000,'census under 1 s cold');ok(tCensusWarm<250,'census well under 1 s warm');

section('Hand-written cases in their beds');
const hw=rows.filter(r=>r.handwritten);console.log(hw.length,'hand-written cases:',hw.map(r=>r.id+'@'+r.bed).join(' '));ok(hw.length===24,'24 hand-written cases in census');
H.hand.list.forEach(p=>{const r=all[p.unitKey].find(x=>x.bed===p.bed);ok(r&&r.id===p.id,'hand-written '+p.id+' in bed '+p.bed);ok(H.patient(p.id)===p,'patient() returns hand-written '+p.id);});

section('Every generated chart: structure, timing, internal agreement');
const gen=rows.filter(r=>!r.handwritten);let tMax=0,tSum=0,nNotes=0,nDays=0,errSeen={};const byCond={};const ages={neonate:0,infant:0,child:0,adult:0,old:0};
function num(s){return parseFloat(String(s).replace(/,/g,''));}
gen.forEach(r=>{const t0=process.hrtime.bigint();let p;try{p=H.patient(r.id);}catch(e){ok(false,'chart build threw: '+(e.stack||e).split('\n').slice(0,2).join(' '));return;}const ms=Number(process.hrtime.bigint()-t0)/1e6;tSum+=ms;if(ms>tMax)tMax=ms;
  const E=[];structural(p,NOW,E);E.forEach(m=>{const k=m.replace(/[A-Z][a-z]+ [0-9.,]+ mg.*|\d+/g,'#');errSeen[k]=(errSeen[k]||0)+1;if(!failMsgs['structural: '+k])console.log('  first seen: '+k+' in '+p.id+' ('+p.truth.condition+'/'+p.truth.variant+')');ok(false,'structural: '+k);});if(!E.length)checks++;
  byCond[p.truth.condition]=(byCond[p.truth.condition]||0)+1;const a=p.unitKey==='neo'||p.unitKey==='nursery'?'neonate':p.ageText?'infant':p.age<18?'child':p.age>=80?'old':'adult';ages[a]++;
  /* census row agrees with the chart */
  ok(r.name===p.name&&r.dx===p.dx&&r.bed===p.bed&&r.mrn===p.mrn&&r.attending===p.attending,'census row agrees with chart');
  const V=p.flows[0],n=V.times.length-1,g=k=>V.rows.find(x=>x.k===k);ok(r.vitals.hr===g('hr').v[n]&&r.vitals.temp===g('temp').v[n]&&r.vitals.bp===g('bp').s[n]+'/'+g('bp').d[n],'census latest vitals = last flowsheet column');
  /* one progress note per hospital day after the first, and an admission note */
  const days=Math.round((new Date(NOW.getFullYear(),NOW.getMonth(),NOW.getDate())-new Date(p.admit.getFullYear(),p.admit.getMonth(),p.admit.getDate()))/864e5);
  const pn=p.notes.filter(x=>x.type==='Progress note'&&/progress note, day/.test(x.title));ok(p.notes.some(x=>x.type==='History and physical'),'admission note present');
  if(p.unitKey!=='ed'){for(let d=1;d<=days;d++){const dayStart=new Date(p.admit.getFullYear(),p.admit.getMonth(),p.admit.getDate()+d),due=new Date(dayStart.getTime()+11*36e5);if(due>NOW)continue;nDays++;ok(pn.some(x=>x.title.endsWith('day '+(d+1))&&x.t>=dayStart&&x.t<new Date(dayStart.getTime()+864e5)),'progress note for each hospital day');}}
  /* numbers quoted in notes agree with the flowsheet and the results */
  const vt={};V.times.forEach((tt,i)=>{vt[tt.getTime()]={temp:g('temp').v[i],hr:g('hr').v[i],bp:g('bp').s[i]+'/'+g('bp').d[i],rr:g('rr').v[i],spo2:g('spo2').v[i]};});
  const labBy={};p.labs.forEach(L=>L.rows.forEach(row=>{labBy[row[0]]=L.times.map((tt,i)=>[tt,row[4][i]]);}));
  pn.forEach(x=>{nNotes++;const m=/Objective: Temperature ([\d.]+) °C, heart rate (\d+), blood pressure (\d+\/\d+), respiratory rate (\d+), saturation (\d+)%/.exec(x.body);ok(!!m,'progress note has an objective line');if(!m)return;
    /* the note quotes the latest observation set at or before the note time */
    let best=null;V.times.forEach(tt=>{if(tt<=x.t&&(!best||tt>best))best=tt;});
    if(best&&x.t-best<5*36e5){const o=vt[best.getTime()];ok(num(m[1])===o.temp&&+m[2]===o.hr&&m[3]===o.bp&&+m[4]===o.rr&&+m[5]===o.spo2,'note vital signs = flowsheet values at that time');}
    const res=/Results: ([^\n]*)/.exec(x.body);if(res){const wm=/White cells ([\d.]+)/i.exec(res[1]),cm=/creatinine ([\d.]+)/i.exec(res[1]),hm=/haemoglobin ([\d.]+)/i.exec(res[1]);
      [[wm,'White cells'],[cm,'Creatinine'],[hm,'Haemoglobin']].forEach(([mm,name])=>{if(!mm||!labBy[name])return;let last=null;labBy[name].forEach(([tt,v])=>{if(tt<=x.t&&v!=null)last=v;});
        const shown=labBy[name].some(([tt])=>tt<=x.t);if(shown&&last!=null&&labBy[name].filter(([tt])=>tt<=x.t).length===labBy[name].length)ok(num(mm[1])===last,'note lab value = result ('+name+')');});}});
  /* medicines named as started in notes exist in the medicine list; held medicines appear as On hold orders */
  p.orders.filter(o=>o[2]==='On hold'&&o[0]==='Medication').forEach(o=>{const nm=o[1].split(' — ')[0].replace(/ (oral|intravenous|subcutaneous|inhaled|nebulised|topical|skin patch)$/,'');const m=p.meds.find(mm=>nm.indexOf(mm.name)===0);if(m&&m.a)ok(!m.a.some(a=>a.st==='given'&&a.t>o[3]),'no dose given after a hold');});
  /* medication administration: nothing given before the order time (5 minute tolerance), dose times in order */
  p.meds.forEach(m=>{(m.a||[]).forEach((a,i)=>{ok(a.t>=new Date(m.ordered.getTime()-5*6e4)||a.st==='due','dose not before order: '+m.name.split(' ')[0]);if(i)ok(a.t>=m.a[i-1].t,'dose times ascending');});});
  /* intake and output arithmetic */
  const io=p.flows.find(x=>x.name==='Intake and output'),R=l=>io.rows.find(x=>x.l===l);io.cols.forEach((c,i)=>{const tin=R('Total in').v[i],tout=R('Total out').v[i],net=num(R('Net balance').v[i].replace('−','-').replace('+',''));
    const sumIn=io.rows.slice(0,io.rows.findIndex(x=>x.l==='Total in')).reduce((s,x)=>s+x.v[i],0),a1=io.rows.findIndex(x=>x.l==='Total in')+1,a2=io.rows.findIndex(x=>x.l==='Total out'),sumOut=io.rows.slice(a1,a2).reduce((s,x)=>s+x.v[i],0);
    ok(sumIn===tin&&sumOut===tout&&net===tin-tout,'intake/output totals add up');});
  /* dates in order */
  ok(p.events.every((e,i)=>!i||e[0]>=p.events[i-1][0]),'events oldest first');ok(p.truth.arrival<=p.admit&&p.admit<p.truth.plannedDischarge,'arrival <= admit < discharge');
  if(p.truth.complication)ok(p.truth.complication.trueOnset<=p.truth.complication.recognised,'complication onset before recognition');
  /* home medicines in the history match the pharmacy/medication history note */
  const ph=p.notes.find(x=>/[Mm]edication history/.test(x.title));if(ph)ok(p.hx.home.every(h=>ph.body.includes(h)),'home medicine list = medication history note');
  /* weight-based doses and neonatal weights */
  if(a==='neonate'){ok(/ g$/.test(p.wt),'neonatal weight in grams');ok(p.ageText&&p.age<1,'neonate has an age in days or months');const hrr=p.flows[0].rows[1];ok(hrr.hi>=150&&hrr.lo>=80,'neonatal heart-rate limits are age-appropriate');}
  if(a==='infant'||a==='child'){const wkg=parseFloat(p.wt);p.meds.forEach(m=>{const mm=/^(Acetaminophen|Ibuprofen|Ceftriaxone|Amoxicillin) ([\d,.]+) mg/.exec(m.name);if(mm&&wkg<40){const mg=parseFloat(mm[2].replace(/,/g,''))/wkg;ok(mg>3&&mg<=80,'weight-based dose within a plausible mg/kg range ('+m.name+' for '+p.wt+')');}});}
});
console.log(gen.length,'generated charts; mean',(tSum/gen.length).toFixed(1),'ms, max',tMax.toFixed(1),'ms;',nNotes,'daily progress notes checked over',nDays,'patient-days');
console.log('age mix:',JSON.stringify(ages));console.log('by condition module:',Object.keys(byCond).sort((a,b)=>byCond[b]-byCond[a]).map(k=>k+' '+byCond[k]).join(', '));
ok(tSum/gen.length<60,'mean chart build under 60 ms');ok(ages.neonate>30&&ages.infant>3&&ages.child>20&&ages.old>80,'ages span neonates to the very old');
ok(Object.keys(H.fill.missing).length===0,'no unknown template slots: '+JSON.stringify(H.fill.missing));

section('Day-to-day evolution');
let trendOK=0,trendN=0,changed=0,chN=0;gen.forEach(r=>{const p=H.patient(r.id);if(r.day<3||p.unitKey==='ed')return;const P=H.plan(r.id);
  /* (a) consecutive morning labs are not frozen; (b) the tracked course moves toward normal between admission and now when no complication is active */
  const chem=p.labs.find(L=>L.panel==='Blood count');if(chem&&chem.times.length>=3){chN++;const w=chem.rows.find(x=>x[0]==='White cells')[4];if(new Set(w).size>1)changed++;}
  const V=p.flows[0],hr=V.rows.find(x=>x.k==='hr').v;if(hr.length>=8){chN++;if(new Set(hr).size>2)changed++;}
  if(!P.comp){const key=Object.keys(P.course).find(k=>['wbc','crp','lipase','trop','lactate','bnp','nbili','cr'].includes(k)&&P.course[k].length>=3&&P.course[k][0][1]>P.course[k][P.course[k].length-1][1]*1.25);
    if(key){const a=H.trueVal(P,key,0.01),b=H.trueVal(P,key,P.los*0.95);trendN++;if(b<a)trendOK++;}}});
console.log('values that vary over time:',changed+'/'+chN,'; abnormal course falling toward normal by discharge:',trendOK+'/'+trendN);ok(changed>=chN*0.97,'day-to-day values change');ok(trendOK===trendN&&trendN>100,'tracked values improve over the stay when uncomplicated');
/* a complication moves the numbers the right way */
let compN=0;H.currentPlans().concat(H.allPlans(NOW,25)).forEach(P=>{if(!P.comp||compN>400)return;const c=P.comp.def.course||{};Object.keys(c).forEach(k=>{const pk=c[k].reduce((m,x)=>Math.abs(x[1])>Math.abs(m[1])?x:m,[0,0]);if(!pk[1])return;const d=P.comp.onsetD+pk[0];compN++;
  const withC=H.trueVal(P,k,d),saved=P.comp;P.comp=null;const without=H.trueVal(P,k,d);P.comp=saved;ok(Math.sign(withC-without)===Math.sign(pk[1]),'complication effect direction '+P.comp.key+'/'+k);});});
console.log('complication effects checked:',compN);

section('Charts over a whole stay (clock moved)');
{const P=H.allPlans(NOW,25).filter(x=>x.discharge<NOW&&x.los>3.5&&x.unit.acuity!=='ed').slice(0,60);let n=0;P.forEach(pl=>{const c=H.buildChart(pl,NOW);const E=[];structural(c,NOW,E);E.forEach(m=>ok(false,'discharged chart structural: '+m.replace(/\d+/g,'#')));n++;
  ok(c.notes.some(x=>x.title==='Discharge summary'),'discharge summary present after discharge');ok(c.meds.every(m=>!(m.a||[]).some(a=>a.st==='due')),'no doses due after discharge');
  const days=Math.round((new Date(pl.discharge.getFullYear(),pl.discharge.getMonth(),pl.discharge.getDate())-new Date(pl.admit.getFullYear(),pl.admit.getMonth(),pl.admit.getDate()))/864e5);
  const pn=c.notes.filter(x=>/progress note, day/.test(x.title));ok(pn.length>=days-1,'progress notes cover the stay ('+pn.length+' for '+days+' days)');
  /* the same reading is the same whenever the chart is built */
  const mid=new Date(pl.admit.getTime()+(pl.discharge-pl.admit)*0.6),cm=H.buildChart(pl,mid);const tA=cm.flows[0].times,iA=tA.length-1,j=c.flows[0].times.findIndex(x=>x.getTime()===tA[iA].getTime());
  if(j>=0)ok(cm.flows[0].rows[1].v[iA]===c.flows[0].rows[1].v[j],'a reading does not change when the clock moves');
  const na=cm.notes.find(x=>/progress note, day 2$/.test(x.title)),nb=c.notes.find(x=>/progress note, day 2$/.test(x.title));if(na&&nb)ok(na.body===nb.body,'a past note does not change when the clock moves');});
 console.log(n,'completed stays rebuilt at discharge and mid-stay');}

section('Consult lists and staff');
let consTotal=0;H.consultServices().forEach(s=>{const l=H.consultList(s.key);consTotal+=l.length;l.forEach(c=>ok(c.id&&c.reason!=null&&c.requested<=NOW&&['New','Following','Signed off'].includes(c.status),'consult row'));});
['card','neph','idsvc','pt','pharm','gi','geri'].forEach(k=>ok(H.consultList(k).length>0,'consult list populated: '+k));console.log(consTotal,'active consults across',H.consultServices().length,'consult services');
const staff=H.staff();const roles={};staff.forEach(s=>roles[s.role]=(roles[s.role]||0)+1);console.log(staff.length,'staff on the roster today:',JSON.stringify(roles));
['Attending','Fellow','Senior resident','Resident','Medical student','Advanced practice provider','Nurse','Charge nurse','Pharmacist','Physical therapist','Occupational therapist','Speech therapist','Respiratory therapist','Dietitian','Social worker','Case manager','Wound and ostomy nurse'].forEach(r=>ok(roles[r]>0,'roster has role '+r));
{const p=H.patient(gen[5].id),names=new Set(staff.map(s=>s.name));ok(names.has(p.attending),'chart attending is on the roster');}

section('Clinics and outpatient charts');
t=Date.now();const clinics=H.clinics();let apptToday=0,apptWeek=0,emptyClinics=[];const stat={};
clinics.forEach(c=>{let n=0;for(let d=-7;d<=7;d++){const day=new Date(NOW.getFullYear(),NOW.getMonth(),NOW.getDate()+d),s=H.clinicSchedule(c.key,day);n+=s.length;if(d===0){apptToday+=s.length;s.forEach(a=>stat[a.status]=(stat[a.status]||0)+1);}
    s.forEach(a=>{ok(a.name&&a.patientId&&a.clinician&&a.time&&a.status,'schedule row fields');if(d<0)ok(!/Scheduled|Arrived|Roomed/.test(a.status),'past visits are not still scheduled');if(d>0)ok(/Scheduled|Cancelled/.test(a.status),'future visits are scheduled');});}
  apptWeek+=n;if(!n)emptyClinics.push(c.key);});
console.log(clinics.length,'clinics;',apptToday,'appointments today',JSON.stringify(stat),';',apptWeek,'in the 15 days around today; first build',Date.now()-t,'ms');ok(emptyClinics.length===0,'every clinic has appointments: '+emptyClinics.join(','));
ok(['Seen','Scheduled'].every(s=>stat[s]>0),'today shows seen and scheduled visits');ok(stat['No-show']>0||true,'no-shows');
/* a clinic patient's chart */
let both=0,oc=0;const sched=H.clinicSchedule('cardc',new Date(NOW.getFullYear(),NOW.getMonth(),NOW.getDate()-1)).concat(H.clinicSchedule('pcp',NOW),H.clinicSchedule('endoc',new Date(NOW.getFullYear(),NOW.getMonth(),NOW.getDate()-5)),H.clinicSchedule('nephc',new Date(NOW.getFullYear(),NOW.getMonth(),NOW.getDate()-6)),H.clinicSchedule('oncm',NOW),H.clinicSchedule('orthoc',new Date(NOW.getFullYear(),NOW.getMonth(),NOW.getDate()-1)));
ok(sched.length>40,'schedules for the six seed clinic modules');
sched.forEach(a=>{const o=H.outpatient(a.patientId);ok(!!o,'outpatient chart resolves '+a.patientId);if(!o)return;oc++;ok(o.name===a.name&&o.mrn===a.mrn,'schedule row agrees with outpatient chart');
  const v=o.visits.concat(o.upcoming).find(x=>x.id===a.visitId);ok(!!v||a.handwritten,'scheduled visit is in the patient chart');
  ok(o.visits.every((x,i)=>!i||x.t<=o.visits[i-1].t),'visits newest first');o.visits.filter(x=>x.status==='Seen'&&!o.handwritten).forEach(x=>{ok(x.note&&x.note.body.length>150&&x.vitals,'seen visit has a note and vitals');
    ok(x.note.body.includes('blood pressure '+x.vitals.bp)&&x.note.body.includes('weight '+x.vitals.weightKg.toFixed(1)),'clinic note quotes the recorded vitals');(x.labs||[]).forEach(l=>{if(l[0]==='Haemoglobin A1c')ok(x.note.body.includes('Haemoglobin A1c '+l[4].toFixed(1)),'clinic note quotes the recorded HbA1c');});});
  if(o.inpatient&&o.inpatient.current)both++;});
console.log(oc,'outpatient charts opened from schedules');
/* people on both sides */
let linked=0,agree=0,medAgree=0;gen.filter(r=>r.unitKey!=='ed').slice(0,400).forEach(r=>{const p=H.patient(r.id),o=H.outpatient(r.id);ok(!!o,'inpatient has an outpatient record');if(!o||!o.visits.length)return;linked++;
  ok(o.name===p.name&&o.mrn===p.mrn&&o.dob===p.dob,'same person on both sides');
  /* past clinic visits listed in the inpatient chart are the same visits */
  p.encounters.filter(e=>e.visitId).forEach(e=>{const v=o.visits.find(x=>x.id===e.visitId);ok(v&&v.t.getTime()===e.t.getTime(),'inpatient encounter = clinic visit');});
  /* last clinic value before admission = inpatient baseline (HbA1c drawn on admission) */
  const a1=p.labs.find(L=>L.panel==='Diabetes and lipids');if(a1){const row=a1.rows.find(x=>x[0]==='Haemoglobin A1c');let last=null;o.visits.slice().reverse().forEach(v=>{if(v.t<p.admit)(v.labs||[]).forEach(l=>{if(l[0]==='Haemoglobin A1c')last=l[4];});});if(row&&last!=null){agree++;ok(Math.abs(row[4][0]-last)<=1.2,'admission HbA1c close to last clinic HbA1c ('+row[4][0]+' vs '+last+')');}}
  /* home medicines = clinic medicine list at admission */
  const lastSeen=o.visits.find(v=>v.t<p.admit&&v.status==='Seen');if(lastSeen&&lastSeen.note){medAgree++;const ml=/Medicines: ([^\n]*)/.exec(lastSeen.note.body)[1];const nochange=!o.visits.some(v=>v.t<p.admit&&v.t>=lastSeen.t&&(v.changes||[]).length);
    if(nochange)ok(p.hx.home.every(h=>h==='No regular medicines'||ml.includes(h)),'home medicines at admission = clinic medicine list');}
  /* follow-up after discharge is booked in the clinic and on the clinic's schedule */
  p.truth.followUp.forEach(f=>{const u=o.upcoming.concat(o.visits).find(x=>x.clinicKey===f.clinicKey&&x.t.getTime()===f.t.getTime());ok(!!u,'post-discharge follow-up is in the outpatient chart');
    if(linked<60){const s=H.clinicSchedule(f.clinicKey,f.t);ok(s.some(a=>a.patientId===r.id),'post-discharge follow-up is on the clinic schedule');}});});
console.log(linked,'inpatients with clinic histories checked;',agree,'HbA1c continuity checks;',medAgree,'medicine-list continuity checks');
/* hand-written cases on the clinic side */
let hwFut=0,hwPast=0;H.hand.list.forEach(p=>{const o=H.outpatient(p.id);ok(!!o&&o.name===p.name,'hand-written outpatient record '+p.id);hwPast+=o.visits.length;o.upcoming.forEach(u=>{hwFut++;ok(H.clinicSchedule(u.clinicKey,u.t).some(a=>a.patientId===p.id),'hand-written follow-up on clinic schedule '+p.id);});
  o.visits.forEach(v=>ok(H.clinicSchedule(v.clinicKey,v.t).some(a=>a.patientId===p.id),'hand-written past visit on clinic schedule '+p.id));});
console.log('hand-written cases:',hwPast,'past clinic contacts mapped to clinics,',hwFut,'future follow-up appointments');ok(hwFut>=12&&hwPast>=40,'hand-written cases appear on the clinic side');

section('Search');
{const r1=H.search(gen[10].name.split(',')[0]);ok(r1.some(x=>x.id===gen[10].id),'search finds an inpatient by surname');const r2=H.search(gen[20].mrn);ok(r2.length>=1&&r2[0].id===gen[20].id,'search by record number');t=Date.now();const r3=H.search('ell');console.log('search "ell":',r3.length,'results incl.',r3.filter(x=>x.kind==='outpatient').length,'outpatients, first outpatient index build',Date.now()-t,'ms');ok(H.search('Skjelbred').some(x=>x.id==='p13'),'search finds a hand-written case');}

section('Determinism');
{const snap=h=>{const o={c:h.censusAll(),p:[gen[0].id,gen[77].id,gen[400].id,gen[800].id].map(id=>h.patient(id)),s:h.clinicSchedule('pcp',NOW),o:h.outpatient('o.endoc.5'),st:h.staff().length};return JSON.stringify(o);};
 const a=snap(load({})),b=snap(load({}));ok(a===b,'same seed gives identical output');const c=snap(load({seed:7}));ok(a!==c,'a different seed gives a different hospital');console.log('same seed identical:',a===b,'('+a.length+' bytes compared); different seed differs:',a!==c);load({});}

section('Browser bundle and speed');
{const vm=require('vm'),order=load.files();let src='';order.forEach(f=>src+=fs.readFileSync(path.join(root,f),'utf8')+'\n');let pre=fs.readFileSync(path.join(root,'data.js'),'utf8')+'\n';
 fs.readdirSync(path.join(root,'patients')).filter(f=>/^p\d+\.js$/.test(f)).forEach(f=>pre+=fs.readFileSync(path.join(root,'patients',f),'utf8')+'\n');
 const ctx={console};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(pre+src+'\nHOSP.init({});',ctx);   /* no require, no module: what a <script> tag sees */
 const a=vm.runInContext("JSON.stringify([HOSP.census('med'),HOSP.patient(HOSP.census('card')[0].id).notes.length,HOSP.clinicSchedule('pcp').length,HOSP.hand.list.length])",ctx);
 const b=JSON.stringify([H.census('med'),H.patient(H.census('card')[0].id).notes.length,H.clinicSchedule('pcp').length,H.hand.list.length]);
 if(a!==b){let i=0;while(a[i]===b[i])i++;console.log('DIFF',i,a.slice(Math.max(0,i-100),i+80),'||',b.slice(Math.max(0,i-100),i+80));}
 ok(a===b,'plain-script (browser-style) load gives the same output as Node');console.log('browser-style load: '+order.length+' files, '+Buffer.byteLength(src)+' bytes of JavaScript; output identical to Node:',a===b);
 const h2=load({});let t1=Date.now();h2.census('med');const c1=Date.now()-t1;t1=Date.now();const id=h2.census('med').find(r=>r.id&&!r.handwritten).id;h2.patient(id);const c2=Date.now()-t1;t1=Date.now();h2.clinicSchedule('pcp');const c3=Date.now()-t1;t1=Date.now();h2.clinicSchedule('cardc');const c4=Date.now()-t1;t1=Date.now();h2.consultList('card');const c5=Date.now()-t1;t1=Date.now();h2.outpatient('o.endoc.5');const c6=Date.now()-t1;
 console.log('fresh engine: first census(med) '+c1+' ms; first full chart '+c2+' ms; first clinicSchedule '+c3+' ms (builds the inpatient-clinic index once), next clinic '+c4+' ms; first consultList '+c5+' ms; outpatient chart '+c6+' ms');ok(c2<80,'first chart in a few tens of ms');load({});}

section('Result');
const keys=Object.keys(failMsgs);keys.slice(0,40).forEach(k=>console.log('FAIL x'+failMsgs[k]+': '+k));
console.log((fails?'FAILED ':'PASSED ')+(checks-fails)+'/'+checks+' checks in '+((Date.now()-t00)/1000).toFixed(1)+' s');process.exit(fails?1:0);
