#!/usr/bin/env node
/* tools/generate.js — dump the whole hospital for analysts. Deterministic: same seed and clock give byte-identical files.
   Usage: node tools/generate.js [--out DIR] [--seed N] [--now 2026-11-17T14:30] [--days 7] [--discharged 7] [--no-charts] [--truth-in-key]
   Writes JSON, JSON Lines and CSV files to DIR (default tools/out) and prints counts.
     hospital.json        units, services, clinics, operating rooms, buildings
     staff.csv            the roster for the day
     census.csv           one row per bed
     inpatients.jsonl     one full chart per line (SCHEMA.md shape plus `truth`), current patients and recent discharges
     vitals.csv labs.csv med_orders.csv med_admin.csv orders.csv notes.csv problems.csv truth.csv   long tables from those charts
     consults.csv         active consults by service
     clinic_schedule.csv  every clinic, today +/- --days days
     outpatients.jsonl    longitudinal charts of every patient on those schedules;  clinic_visits.csv  one row per visit
     manifest.json        counts, seed, clock, module list */
const fs=require('fs'),path=require('path');const root=path.join(__dirname,'..');const a=process.argv.slice(2);
const opt=(k,d)=>{const i=a.indexOf('--'+k);return i>=0?a[i+1]:d;};const flag=k=>a.includes('--'+k);
const out=path.resolve(opt('out',path.join(__dirname,'out')));fs.mkdirSync(out,{recursive:true});
const H=require(path.join(root,'engine'))({seed:opt('seed')?+opt('seed'):undefined,now:opt('now'),truthInKey:flag('truth-in-key')});const NOW=H.now(),days=+opt('days',7),disDays=+opt('discharged',7);
const t0=Date.now(),counts={};
const iso=d=>d instanceof Date?H.iso(d):d;const J=o=>JSON.stringify(o,(k,v)=>k.charAt(0)==='_'?undefined:v);
/* Dates serialise as local ISO strings, independent of the machine's time zone */
Date.prototype.toJSON=function(){return H.iso(this);};
const csvCell=v=>{if(v==null)return '';v=v instanceof Date?H.iso(v):String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
function writer(name,cols){const fd=fs.openSync(path.join(out,name),'w');let n=0,buf=cols.join(',')+'\n';return {row(r){buf+=cols.map(c=>csvCell(r[c])).join(',')+'\n';n++;if(buf.length>1<<20){fs.writeSync(fd,buf);buf='';}},end(){fs.writeSync(fd,buf);fs.closeSync(fd);counts[name]=n;}};}
fs.writeFileSync(path.join(out,'hospital.json'),JSON.stringify({hospital:H.hospital(),buildings:H.buildings(),units:H.units({counts:true}),services:H.services(),clinics:H.clinics(),operatingRooms:H.operatingRooms()},null,1));
let w=writer('staff.csv',['id','name','role','grade','service','unit','team','shift','onService']);H.staff().forEach(s=>w.row(s));w.end();
w=writer('census.csv',['unitKey','unit','bed','status','id','name','age','ageText','sex','mrn','dx','admit','day','expectedDischarge','service','team','attending','nurse','code','iso','phase','condition','handwritten','flags','temp','hr','rr','bp','spo2','o2','pain']);
const ids=[];H.units().forEach(u=>H.census(u.key).forEach(r=>{const v=r.vitals||{};w.row(Object.assign({},r,{flags:(r.flags||[]).join('; '),temp:v.temp,hr:v.hr,rr:v.rr,bp:v.bp,spo2:v.spo2,o2:v.o2,pain:v.pain}));if(r.id)ids.push(r.id);}));w.end();
const dis=H.discharges(null,disDays).filter(d=>d.unitKey!=='ed').map(d=>d.id);counts.currentInpatients=ids.length;counts.recentDischarges=dis.length;
if(!flag('no-charts')){const fd=fs.openSync(path.join(out,'inpatients.jsonl'),'w');
  const V=writer('vitals.csv',['patientId','t','temp','hr','rr','sbp','dbp','spo2','o2','pain']),L=writer('labs.csv',['patientId','t','panel','test','unit','low','high','value']),MO=writer('med_orders.csv',['patientId','name','sig','type','rate','ordered']),MA=writer('med_admin.csv',['patientId','name','t','status','by','note']),
    O=writer('orders.csv',['patientId','category','text','status','t']),N=writer('notes.csv',['patientId','t','type','title','by','words','body']),PR=writer('problems.csv',['patientId','rank','problem']),TR=writer('truth.csv',['patientId','condition','variant','icd10cm','severity','comorbidities','complication','trueOnset','recognised','arrival','admit','plannedDischarge','lengthOfStayDays','disposition']);
  let bytes=0;ids.concat(dis).forEach(id=>{const p=H.patient(id);if(!p)return;const line=J(p)+'\n';bytes+=Buffer.byteLength(line);fs.writeSync(fd,line);
    const vt=p.flows[0],g=k=>vt.rows.find(r=>r.k===k);vt.times.forEach((t,i)=>V.row({patientId:id,t,temp:g('temp').v[i],hr:g('hr').v[i],rr:g('rr').v[i],sbp:g('bp').s[i],dbp:g('bp').d[i],spo2:g('spo2').v[i],o2:g('o2').v[i],pain:g('pain').v[i]}));
    p.labs.forEach(P=>P.rows.forEach(r=>P.times.forEach((t,i)=>{if(r[4][i]!=null)L.row({patientId:id,t,panel:P.panel,test:r[0],unit:r[1],low:r[2],high:r[3],value:r[4][i]});})));
    p.meds.forEach(m=>{MO.row({patientId:id,name:m.name,sig:m.sig,type:m.type||'scheduled',rate:m.rate,ordered:m.ordered});(m.a||[]).forEach(x=>MA.row({patientId:id,name:m.name,t:x.t,status:x.st,by:x.by,note:x.note}));});
    p.orders.forEach(o=>Array.isArray(o)?O.row({patientId:id,category:o[0],text:o[1],status:o[2],t:o[3]}):O.row({patientId:id,category:o.cat,text:o.text,status:o.st,t:o.t}));
    p.notes.forEach(n=>N.row({patientId:id,t:n.t,type:n.type,title:n.title,by:n.by,words:n.body.split(/\s+/).length,body:n.body}));p.problems.forEach((x,i)=>PR.row({patientId:id,rank:i+1,problem:x}));
    if(p.truth){const c=p.truth.complication;TR.row(Object.assign({},p.truth,{patientId:id,comorbidities:p.truth.comorbidities.join(' '),complication:c?c.key:'',trueOnset:c?c.trueOnset:'',recognised:c?c.recognised:''}));}});
  fs.closeSync(fd);[V,L,MO,MA,O,N,PR,TR].forEach(x=>x.end());counts['inpatients.jsonl']=ids.length+dis.length;counts.inpatientsBytes=bytes;}
w=writer('consults.csv',['service','status','id','unit','bed','name','age','sex','dx','reason','requested','seen','requestedBy','primaryService']);H.consultServices().forEach(s=>H.consultList(s.key).forEach(c=>w.row(Object.assign({service:s.key},c))));w.end();
w=writer('clinic_schedule.csv',['date','time','clinicKey','clinic','patientId','name','age','sex','mrn','type','reason','clinician','status','minutes','inpatientNow','handwritten']);const opIds={};
H.clinics().forEach(c=>{for(let d=-days;d<=days;d++){const day=H.addD(H.day0(NOW),d);H.clinicSchedule(c.key,day).forEach(r=>{w.row(Object.assign({date:H.isoDate(day),clinic:c.name},r));opIds[r.patientId]=1;});}});w.end();
if(!flag('no-charts')){const fd=fs.openSync(path.join(out,'outpatients.jsonl'),'w');const CV=writer('clinic_visits.csv',['patientId','visitId','t','clinicKey','clinic','type','status','clinician','reason','weightKg','bp','hr','changes','labs']);let n=0;
  Object.keys(opIds).sort().forEach(id=>{const o=H.outpatient(id);if(!o)return;n++;fs.writeSync(fd,J(o)+'\n');o.visits.concat(o.upcoming).forEach(v=>CV.row({patientId:id,visitId:v.id,t:v.t,clinicKey:v.clinicKey,clinic:v.clinic,type:v.type,status:v.status,clinician:v.clinician,reason:v.reason,weightKg:v.vitals&&v.vitals.weightKg,bp:v.vitals&&v.vitals.bp,hr:v.vitals&&v.vitals.hr,changes:(v.changes||[]).join('; '),labs:(v.labs||[]).map(l=>l[0]+' '+l[4]).join('; ')}));});
  fs.closeSync(fd);CV.end();counts['outpatients.jsonl']=n;}
const h=H.hospital();fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({hospital:h.name,seed:h.seed,now:H.iso(NOW),engineVersion:H.version,inpatientBeds:h.inpatientBeds,emergencyBays:h.emergencyBays,units:h.units,clinics:h.clinics,modules:{conditions:Object.keys(H.conditions).sort(),comorbidities:Object.keys(H.comorbidities).sort(),clinics:Object.keys(H.clinicModules).sort(),complications:Object.keys(H.complications).sort()},counts},null,1));
console.log(h.name+' — seed '+h.seed+', clock '+H.iso(NOW));Object.keys(counts).forEach(k=>console.log(String(counts[k]).padStart(10)+'  '+k));console.log('written to '+out+' in '+((Date.now()-t0)/1000).toFixed(1)+' s');
