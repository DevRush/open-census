/* tools/lib-checks.js — structural checks for an inpatient chart object. These are the checks of /validate.js, applied to an
   object instead of a file, minus the three items the work order relaxes for generated patients (the `key` section may be
   empty, notes may be shorter than 90 words, no file-size check) and plus a few stricter ones (unfilled slots, NaN). */
const isD=d=>d instanceof Date&&!isNaN(d);
const NT=['Progress note','History and physical','Emergency note','Operative note','Anaesthesia note','Procedure note','Consult','Nursing note','Pharmacy note','Case management','Therapy note','Social work','Discharge planning'];
const BANNED=['Braden','Morse','NANDA','CPT','APACHE','CAM-ICU','RASS','PHQ','ESI','Epic','Cerner'];
function structural(p,NOW,E){const bad=m=>E.push(m);
  for(const k of ['id','name','age','sex','dob','mrn','unit','bed','unitKey','service','attending','admit','code','wt','ht','allergies','iso','dx','problems','team','events','flows','lines','labs','micro','imaging','path','meds','orders','notes','hx','encounters','key'])if(p[k]==null)bad('missing '+k);
  if(E.length)return E;
  if(!isD(p.admit)||p.admit>NOW)bad('admit date');if(p.dx.length>60)bad('dx over 60 chars');if(!/^LX-\d{6}$/.test(p.mrn))bad('mrn format');
  p.allergies.forEach(a=>{if(!Array.isArray(a)||a.length!==2)bad('allergy pair');});p.events.forEach(e=>{if(!isD(e[0])||e[0]>NOW)bad('event date '+e[1]);});
  if(p.problems.length<5||p.problems.length>8)bad('problems count '+p.problems.length);if(p.team.length<4||p.team.length>6)bad('team count '+p.team.length);
  const fl=p.flows;if(fl.length<4)bad('need 4 flow groups');const v=fl[0];
  if(v.name!=='Vitals'||!v.chart||!v.times)bad('flows[0] must be Vitals');else{const ks=v.rows.map(r=>r.k).join(',');if(ks!=='temp,hr,rr,bp,map,spo2,o2,pain')bad('vitals row keys/order: '+ks);}
  fl.forEach(g=>{const n=g.times?g.times.length:(g.cols||[]).length;if(!n)bad('group '+g.name+' has no times/cols');if(g.times)g.times.forEach(t=>{if(!isD(t)||t>NOW)bad(g.name+' time after now or invalid');});
    g.rows.forEach(r=>{if(!r.l)bad(g.name+' row without label');if(r.type==='bp'){if(r.s.length!==n||r.d.length!==n)bad(g.name+'/'+r.l+' bp length');}else if(r.type!=='map'){if(!r.v||r.v.length!==n)bad(g.name+'/'+r.l+' length');}});});
  if(fl[1]&&(fl[1].rows.length<5||fl[1].rows.length>8))bad('specialty group rows '+fl[1].rows.length);
  const io=fl.filter(g=>g.name==='Intake and output')[0];if(!io||!io.cols)bad('need Intake and output group');else if(io.rows[io.rows.length-1].l!=='Net balance')bad('last I&O row must be Net balance');
  if(!fl.some(g=>g.name==='Nursing assessment'&&g.cols))bad('need Nursing assessment group');
  if(p.labs.length<3)bad('need 3+ lab panels');
  p.labs.forEach(L=>{L.times.forEach(t=>{if(!isD(t)||t>NOW)bad('lab time '+L.panel);});L.rows.forEach(r=>{if(r.length!==5||r[4].length!==L.times.length)bad('lab row '+L.panel+'/'+r[0]);r[4].forEach(x=>{if(x!==null&&typeof x!=='number')bad('lab non-number '+r[0]);});if(typeof r[2]!=='number'||typeof r[3]!=='number')bad('lab range '+r[0]);});});
  ['micro','imaging','path'].forEach(k=>p[k].forEach(x=>{if(!x.title||!isD(x.t)||x.t>NOW||!x.status||!x.by||!x.body)bad(k+' report fields '+x.title);}));
  if(p.imaging.length+p.micro.length+p.path.length<2)bad('need 2+ reports');
  if(p.meds.length<7)bad('need 7+ meds ('+p.meds.length+')');
  p.meds.forEach(m=>{if(!m.name||!m.sig||!isD(m.ordered))bad('med fields '+m.name);if(/\{/.test(m.name))bad('unfilled med name '+m.name);if(m.type==='inf'){if(!m.rate)bad('infusion rate '+m.name);}else{if(!Array.isArray(m.a))bad('med a[] '+m.name);else m.a.forEach(a=>{if(!isD(a.t))bad('dose time '+m.name);if(['given','held','due'].indexOf(a.st)<0)bad('dose status');if(a.st!=='due'&&a.t>NOW)bad('given/held dose in future '+m.name);});}});
  if(p.orders.length<8)bad('need 8+ orders');
  p.orders.forEach(o=>{if(o.length!==4||['Nursing','Diet','Laboratory','Imaging','Consult','Medication'].indexOf(o[0])<0||['Active','Pending','Completed','On hold'].indexOf(o[2])<0||!isD(o[3]))bad('order '+o[1]);});
  if(p.notes.length<7)bad('need 7+ notes ('+p.notes.length+')');
  p.notes.forEach(n=>{if(NT.indexOf(n.type)<0)bad('note type '+n.type);if(!n.title||!n.by||!isD(n.t)||n.t>NOW)bad('note fields '+n.title);if((n.body||'').split(/\s+/).length<25)bad('note under 25 words: '+n.title);});
  for(let i=1;i<p.notes.length;i++)if(p.notes[i].t>p.notes[i-1].t)bad('notes must be newest first');
  ['History and physical','Progress note','Nursing note','Consult'].forEach(t=>{if(!p.notes.some(n=>n.type===t))bad('missing note type '+t);});
  ['pmh','psh','fam','soc','imm','home'].forEach(k=>{if(!Array.isArray(p.hx[k]))bad('hx.'+k);});
  if(p.encounters.length<5)bad('need 5+ encounters ('+p.encounters.length+')');
  p.encounters.forEach(e=>{if(!isD(e.t)||e.t>p.admit||!e.kind||!e.dept||!e.title||!e.summary)bad('encounter '+e.title);});
  if(!Array.isArray(p.key))bad('key must be an array');p.key.forEach(k=>{if(k.length!==4)bad('key item shape');});
  const all=JSON.stringify(p);BANNED.forEach(w=>{if(new RegExp('\\b'+w+'\\b').test(all))bad('forbidden term: '+w);});
  if(/<[a-z]+[ >]/i.test(all))bad('looks like HTML in strings');const body=all.replace(/"truth":\{.*$/,'');
  if(/\{[a-zA-Z0-9_.]+\}/.test(body))bad('unfilled slot: '+(/\{[a-zA-Z0-9_.]+\}/.exec(body)||[''])[0]);if(/\[[^\[\]"]*\|[^\[\]"]*\]/.test(body))bad('unresolved alternatives: '+(/\[[^\[\]"]*\|[^\[\]"]*\]/.exec(body)||[''])[0]);
  if(/undefined|NaN|\[object/.test(all))bad('undefined/NaN in text: '+(/.{30}(undefined|NaN|\[object).{20}/.exec(all)||[''])[0]);
  if(/  |\.\.(?!\.)| ,| \./.test(p.notes.map(n=>n.body).join('\n').replace(/\n/g,'¶')))bad('double space or stray punctuation in a note: '+(/.{25}(  |\.\.(?!\.)| ,| \.).{15}/.exec(p.notes.map(n=>n.body).join('¶'))||[''])[0]);
  return E;}
module.exports={structural,isD,NT,BANNED};
