#!/usr/bin/env node
/* tools/validate-module.js — check one module file (condition, generic, comorbidity or clinic).
   Usage: node tools/validate-module.js modules/conditions/cap.js [more files...]      or   --all
   Prints "OK <key>" or a numbered list of problems. Exit code 1 if any file has errors.
   Two stages: (1) static checks of the fields against the shared tables; (2) a dry run that builds real charts from the
   module (every variant, several points in the stay, with and without each complication) and runs the chart checks. */
const fs=require('fs'),path=require('path');const root=path.join(__dirname,'..');
const {structural,BANNED,NT}=require('./lib-checks.js');
const args=process.argv.slice(2);let files=args.filter(a=>!a.startsWith('--'));
if(args.includes('--all'))['modules/conditions','modules/generic','modules/comorbidities','modules/clinics'].forEach(d=>fs.readdirSync(path.join(root,d)).filter(f=>f.endsWith('.js')).sort().forEach(f=>files.push(path.join(d,f))));
if(!files.length){console.log('Usage: node tools/validate-module.js <module file> [...] | --all');process.exit(2);}
const H=require(path.join(root,'engine'))({handwritten:false});const T=H.T,M=H.model;
const SLOTS=('age ageN sex he He his His him name given surname title side Side otherside Otherside day unit service dx hospital code temp hr rr bp sbp spo2 o2 pain wt fever rhythm Rhythm pulse Pulse attending admitdate weightkg pod rx crx').split(' ');
const US=['edema','anemia','hemoglobin','diarrhea','pediatric','hemorrhage','leukemia','anesthe','esophag','orthopedic','gynecolog','cesarean','hematoma','ischemi','tumor','color','labor','center','liter','fiber'];
const kinds={};M.units.forEach(u=>u.kinds.forEach(k=>kinds[k]=u.pop));
function strings(o,out,pathS){if(typeof o==='string')out.push([pathS,o]);else if(Array.isArray(o))o.forEach((x,i)=>strings(x,out,pathS+'['+i+']'));else if(o&&typeof o==='object')for(const k in o)strings(o[k],out,pathS+'.'+k);return out;}
function sortedPts(a){return Array.isArray(a)&&a.length&&a.every((p,i)=>Array.isArray(p)&&p.length===2&&typeof p[0]==='number'&&typeof p[1]==='number'&&(!i||p[0]>=a[i-1][0]));}

function checkCondition(m,file,E,W){const err=x=>E.push(x),warn=x=>W.push(x);
  const base=path.basename(file,'.js');if(!m.generic&&m.key!==base)err('key "'+m.key+'" must equal the file name "'+base+'"');
  ['key','name','units'].forEach(k=>{if(m[k]==null)err('missing field: '+k);});if(E.length)return;
  const pop=m.pop||'adult';if(!['adult','peds','neonate','ob','psych'].includes(pop))err('pop must be adult, peds, neonate, ob or psych');
  for(const k in m.units){if(!kinds[k])err('units: no unit has kind "'+k+'" (kinds: '+Object.keys(kinds).join(' ')+')');else if(kinds[k]!==pop&&!M.units.some(u=>u.kinds.includes(k)&&u.pop===pop))err('units: kind "'+k+'" belongs to '+kinds[k]+' units but pop is '+pop);}
  if(!m.age&&!m.ageDays&&!(m.variants||[]).every(v=>v.age||v.ageDays))err('give age:[min,max,most common] (years) or ageDays:[min,max]');
  if(m.age&&(m.age.length!==3||m.age[0]>m.age[2]||m.age[2]>m.age[1]))err('age must be [min, max, most common] with min <= most common <= max');
  const isEd=Object.keys(m.units).every(k=>k==='ed');if(isEd){if(!m.losH)err('emergency modules need losH:[min,max] hours');}else if(!m.los||m.los.length!==2||m.los[0]>m.los[1])err('los must be [min,max] days');
  const vs=m.variants||[];if(!vs.length)warn('no variants: add at least a mild and a typical variant');const vk={};vs.forEach(v=>{if(!v.key)err('variant without key');if(vk[v.key])err('duplicate variant key '+v.key);vk[v.key]=1;if(v.sev!=null&&(v.sev<.3||v.sev>1.8))err('variant '+v.key+': sev should be between 0.3 and 1.8');
    (v.units||[]).forEach(k=>{if(!kinds[k])err('variant '+v.key+' units: unknown kind '+k);});});
  const phaseSets=[m.phases].concat(vs.map(v=>v.phases)).filter(Boolean);if(!m.phases)err('missing phases: [[name, first day], ...]');
  phaseSets.forEach(ph=>{if(!Array.isArray(ph)||!ph.length||ph[0][1]!==0)err('phases must start at day 0');ph.forEach((p,i)=>{if(i&&p[1]<=ph[i-1][1])err('phases must be in increasing day order');});});
  const phaseNames={};phaseSets.forEach(ph=>(ph||[]).forEach(p=>phaseNames[p[0]]=1));
  const custom=Object.assign({},m.custom);vs.forEach(v=>Object.assign(custom,v.custom||{}));
  const courses=[['course',m.course||{}]].concat(vs.map(v=>['variant '+v.key+' course',v.course||{}]));
  courses.forEach(([nm,c])=>{for(const k in c){if(!T.vitals[k]&&!T.labs[k]&&!custom[k]&&k!=='wt'&&k!=='uo')err(nm+': unknown key "'+k+'" (use a vital sign key, a lab key, wt, uo, or define it in custom)');if(!sortedPts(c[k]))err(nm+'.'+k+': must be [[day,value],...] sorted by day');
      else{const tab=T.vitals[k]||T.labs[k];if(tab&&k!=='o2')c[k].forEach(p=>{if(p[1]<tab.min||p[1]>tab.max)err(nm+'.'+k+': value '+p[1]+' is outside the possible range '+tab.min+' to '+tab.max);});}}});
  if(!m.course||!Object.keys(m.course).length)err('course is empty: give day-by-day targets for at least the vital signs and labs that matter');
  const medKeys={},labK={};T.corePanels.Chemistry.concat(T.corePanels['Blood count'],T.thirdPanel).forEach(k=>labK[k]=1);
  const medLists=[['meds',m.meds||[]]].concat(vs.map(v=>['variant '+v.key+' meds',v.meds||[]]));(m.comps||[]).concat(...vs.map(v=>v.comps||[])).forEach(c=>{if(!c.use)medLists.push(['complication '+c.key+' meds',c.meds||[]]);});
  medLists.forEach(([nm,l])=>l.forEach(it=>{const k=it.m||it;if(!T.meds[k])err(nm+': unknown medicine key "'+k+'" (add it to modules/shared/meds.js or pick an existing key)');else{medKeys[k]=1;if(it.f&&!T.freq[it.f])err(nm+': unknown frequency "'+it.f+'"');if(it.d&&(!Array.isArray(it.d)||it.d.length>2||(it.d.length===2&&it.d[1]<=it.d[0])))err(nm+' '+k+': d must be [start] or [start, stop] with stop after start');}}));
  (m.std||[]).concat(m.nostd||[]).forEach(k=>{if(!T.meds[k]&&k!=='vte')err('std/nostd: unknown medicine key '+k);});
  [['labs',m.labs||[]]].concat(vs.map(v=>['variant '+v.key+' labs',v.labs||[]])).forEach(([nm,l])=>l.forEach(x=>{const k=String(x).split('@')[0];if(!T.labs[k])err(nm+': unknown lab key "'+k+'"');labK[k]=1;}));
  courses.forEach(([nm,c])=>{for(const k in c)if(T.labs[k])labK[k]=1;});
  (m.track||[]).forEach(k=>{if(!T.labs[k])err('track: unknown lab key '+k);else if(!labK[k])err('track: "'+k+'" is not drawn; add it to labs');});
  for(const k in (m.ranges||{}))if(!T.labs[k])err('ranges: unknown lab key '+k);
  const ords=[['orders',m.orders||[]]].concat(vs.map(v=>['variant '+v.key+' orders',v.orders||[]]));ords.forEach(([nm,l])=>l.forEach(o=>{if(!Array.isArray(o)||['Nursing','Diet','Laboratory','Imaging','Consult','Medication'].indexOf(o[0])<0||typeof o[1]!=='string')err(nm+': each order is [category, text, start day?, end day?]; bad: '+JSON.stringify(o).slice(0,60));}));
  const reps=(m.reports||[]).concat(...vs.map(v=>v.reports||[]));reps.forEach(r=>{if(['imaging','micro','path'].indexOf(r.k)<0)err('report "'+r.t+'": k must be imaging, micro or path');if(!r.t||!r.body)err('report needs t (title) and body');if(r.by&&!['rad','micro','path','team'].includes(r.by)&&!M.serviceByKey[r.by])err('report "'+r.t+'": by must be rad, micro, path, team or a service key');
    if(r.k==='imaging'&&!/Impression:/.test(r.body))warn('report "'+r.t+'": imaging bodies normally end with "Impression: ..."');});
  (m.procs||[]).concat(...vs.map(v=>v.procs||[])).forEach(p=>{if(!p.title||!p.body)err('procedure needs title and body');if(p.type&&NT.indexOf(p.type)<0)err('procedure type must be a note type, e.g. "Operative note" or "Procedure note"');if(p.d==null&&p.h==null)err('procedure "'+p.title+'" needs d (day) or h (hours after admission)');if(p.by&&!M.serviceByKey[p.by])err('procedure by: unknown service '+p.by);});
  (m.consults||[]).concat(...vs.map(v=>v.consults||[])).forEach(c=>{if(!M.serviceByKey[c.svc]||!M.serviceByKey[c.svc].consult)err('consult: "'+c.svc+'" is not a consult service key');if(!c.reason)err('consult '+c.svc+' needs a reason');if(!M.serviceByKey[c.svc]||(!M.serviceByKey[c.svc].allied&&!c.recs))warn('consult '+c.svc+': add recs (what the consultant advises)');});
  (m.comps||[]).concat(...vs.map(v=>v.comps||[])).forEach(c=>{if(c.use){if(!H.complications[c.use])err('complication use: "'+c.use+'" is not in modules/shared/complications.js');if(c.p==null)err('complication '+c.use+' needs p (probability)');}
    else{['key','name','p','d','event','assess','plan'].forEach(k=>{if(c[k]==null)err('complication '+(c.key||'?')+' is missing '+k);});for(const k in (c.course||{})){if(!T.vitals[k]&&!T.labs[k])err('complication '+c.key+' course: unknown key '+k);if(!sortedPts(c.course[k])||c.course[k][0][1]!==0)err('complication '+c.key+' course.'+k+': must start [[0,0],...] (changes since onset)');}}
    if(c.p>0.6)warn('complication probability above 0.6 is unusual');});
  if(m.service&&(!M.serviceByKey[m.service]||!M.serviceByKey[m.service].primary))err('service "'+m.service+'" is not a primary service key');
  ((m.dc&&m.dc.follow)||[]).forEach(f=>{if(f[0]!=='pcp'&&!M.clinicByKey[f[0]])err('dc.follow: unknown clinic key "'+f[0]+'"');if(typeof f[1]!=='number')err('dc.follow: second item is days after discharge');});
  (m.ancillary||[]).forEach(k=>{if(!T.anc[k])err('ancillary: unknown key "'+k+'" (known: '+Object.keys(T.anc).join(' ')+')');});
  const n=m.notes||{};['cc','hpi','exam','subj','assess','plan'].forEach(k=>{if(n[k]==null)err('notes.'+k+' is missing');});
  ['exam','subj','assess','plan','nursing'].forEach(k=>{const b=n[k];if(b&&typeof b==='object'&&!Array.isArray(b)){for(const ph in b)if(!phaseNames[ph])err('notes.'+k+': "'+ph+'" is not a phase name ('+Object.keys(phaseNames).join(', ')+')');
      const first=(m.phases||[[null]])[0][0];if(first&&b[first]==null)err('notes.'+k+' needs an entry for the first phase "'+first+'"');if(k==='plan')for(const ph in b)if(!Array.isArray(b[ph]))err('notes.plan.'+ph+' must be a list of plan lines');}});
  (m.flow&&m.flow.rows||[]).forEach(r=>{if(!r.l)err('flow row without l (label)');if(r.k){if(!T.vitals[r.k]&&!T.labs[r.k]&&!custom[r.k]&&r.k!=='wt'&&r.k!=='uo')err('flow row "'+r.l+'": unknown key '+r.k);}else if(!r.p&&!r.t)err('flow row "'+r.l+'" needs k (a number key) or p (text by phase)');else if(r.p&&typeof r.p==='object')for(const ph in r.p)if(!phaseNames[ph])err('flow row "'+r.l+'": "'+ph+'" is not a phase name');});
  if(m.flow&&m.flow.rows&&(m.flow.rows.length>8))err('flow: at most 8 rows');
  /* text checks */
  const vars={};Object.assign(vars,m.vars||{});vs.forEach(v=>Object.assign(vars,v.vars||{}));
  strings(m,[],m.key).forEach(([p,s])=>{(s.match(/\{[^{}]*\}/g)||[]).forEach(sl=>{const k=sl.slice(1,-1);if(/^(lab|prev|lab0|peak)\./.test(k)){const lk=k.split('.')[1];if(!T.labs[lk])err(p+': '+sl+' is not a lab key');else if(!labK[lk])err(p+': '+sl+' is used but "'+lk+'" is not drawn by this module (add it to labs)');}
      else if(/^med\./.test(k)){if(!medKeys[k.slice(4)])err(p+': '+sl+' refers to a medicine that is not in this module’s meds');}
      else if(SLOTS.indexOf(k)<0&&!vars[k]&&!custom[k])err(p+': unknown slot '+sl+' (define it in vars or use a standard slot)');});
    BANNED.forEach(w=>{if(new RegExp('\\b'+w+'\\b').test(s))err(p+': forbidden term "'+w+'"');});if(/<[a-z]+[ >]/i.test(s))err(p+': looks like HTML');
    US.forEach(w=>{if(new RegExp('\\b'+w+(w.length<7?'s?\\b':''),'i').test(s))warn(p+': American spelling "'+w+'"? Use British spelling');});
    const o=(s.match(/\[/g)||[]).length,c=(s.match(/\]/g)||[]).length;if(o!==c)err(p+': unbalanced [ ] in "'+s.slice(0,50)+'"');});
  /* medicine names written out in note text go stale when the engine substitutes a medicine (allergy, kidney dosing) */
  const noteStr=strings({n:m.notes,dc:m.dc,cons:(m.consults||[]).map(c=>c.recs),vn:vs.map(v=>[v.notes,(v.consults||[]).map(c=>c.recs)])},[],'');const stems={};Object.keys(medKeys).forEach(k=>{const w=T.meds[k].name.split(/[ -]/)[0].toLowerCase();const d=T.meds[k];if(w.length>5&&(d.renal||T.allergySwap[d.cls]&&T.allergySwap[d.cls][k]))stems[w]=k;});
  noteStr.forEach(([p,s])=>{s=s.replace(/\{[^{}]*\}/g,'');for(const w in stems)if(s.toLowerCase().indexOf(w)>=0)warn('notes'+p+': names "'+w+'" directly; write {med.'+stems[w]+'} or {rx} so the note follows substitutions');});}

function dryRunCondition(m,E,W){const pop=m.pop||'adult',vs=m.variants||[{key:null}];let n=0,built=0;const errs={};
  vs.forEach(v=>{const u=M.units.find(u=>u.pop===pop&&u.kinds.some(k=>(v.units?v.units.includes(k):m.units[k])))||M.units.find(u=>u.pop===pop&&u.kinds.some(k=>m.units[k]));if(!u){E.push('dry run: no unit of population '+pop+' matches variant '+v.key);return;}
    for(let i=0;i<14;i++){const admit=H.addH(H.BASE_NOW,-24*30+i*7.3);let P;try{P=H._forcePlan(u.key,m.key,v.key,n++,admit);}catch(e){E.push('dry run (plan) variant '+v.key+': '+e.message);return;}
      [0.01,0.3,0.99,1.7,P.los*0.5,P.los*0.85,P.los+0.5].forEach(d=>{const now=H.addH(P.admit,d*24);let c;try{c=H.buildChart(P,now);built++;}catch(e){const k='dry run (chart) variant '+v.key+': '+(e.stack||e).split('\n').slice(0,2).join(' ');errs[k]=(errs[k]||0)+1;return;}
        structural(c,now,[]).forEach(x=>{const k='dry run, variant '+v.key+', day '+d.toFixed(1)+': '+x.replace(/\d+ notes|\(\d+\)/g,'');errs[k.replace(/day [\d.]+/,'day N')]=(errs[k.replace(/day [\d.]+/,'day N')]||0)+1;});});}});
  Object.keys(errs).forEach(k=>E.push(k+' ('+errs[k]+'×)'));const miss=Object.keys(H.fill.missing);if(miss.length){E.push('dry run: slots with no value: '+miss.map(k=>'{'+k+'}').join(' '));H.fill.missing={};}
  return built;}

function checkComorbidity(m,file,E,W){const err=x=>E.push(x);if(m.key!==path.basename(file,'.js'))err('key must equal the file name');['key','name','prior','problem','pmh','plan'].forEach(k=>{if(m[k]==null)err('missing field: '+k);});
  if(m.prior&&(!Array.isArray(m.prior)||m.prior.length!==3||m.prior.some(p=>p<0||p>1)))err('prior must be [probability at 40, at 60, at 80]');
  (m.home||[]).concat((m.meds||[]).map(x=>x.m||x)).forEach(k=>{if(!T.meds[k.m||k])err('unknown medicine key '+(k.m||k));});const classes={};Object.keys(T.meds).forEach(k=>classes[T.meds[k].cls]=1);
  (m.hold||[]).concat(m.avoid||[]).forEach(c=>{if(!classes[c])err('hold/avoid: "'+c+'" is not a medicine class in meds.js');});
  for(const k in (m.labs||{}))if(!T.labs[k])err('labs: unknown key '+k);for(const k in (m.vitals||{}))if(!T.vitals[k])err('vitals: unknown key '+k);(m.showLabs||[]).forEach(x=>{if(!T.labs[String(x).split('@')[0]])err('showLabs: unknown key '+x);});
  for(const k in (m.interact||{}))if(!H.complications[k]&&k!=='pph'&&k!=='effusion')W.push('interact: "'+k+'" is not a shared complication key');
  const o=m.opd;if(!o)W.push('no opd block: this condition will have no clinic follow-up pattern');else{if(o.clinic&&!M.clinicByKey[o.clinic.key])err('opd.clinic.key: unknown clinic '+o.clinic.key);for(const k in (o.tracks||{})){const t=o.tracks[k];if(!T.labs[k]&&!['sbp','hr','wt'].includes(k))err('opd.tracks: unknown key '+k);if(!t.start||t.start.length!==2)err('opd.tracks.'+k+' needs start:[low,high]');}
    if(o.ladder){(o.ladder.steps||[]).forEach(s=>{if(!T.meds[s.replace(/^\+/,'')])err('opd.ladder: unknown medicine key '+s);});if(o.ladder.on&&!(o.tracks||{})[o.ladder.on])err('opd.ladder.on must be one of the tracks');if(o.ladder.on&&(o.ladder.above==null||o.ladder.effect==null))err('opd.ladder needs above and effect');}
    if(!o.sx||!o.plan)err('opd needs sx (symptom phrases) and plan (plan phrases)');}
  if(m.consult&&!M.serviceByKey[m.consult.svc])err('consult.svc unknown');}
function checkClinic(m,file,E,W){const err=x=>E.push(x);if(m.key!==path.basename(file,'.js'))err('key must equal the file name');['key','name','every','notes'].forEach(k=>{if(m[k]==null)err('missing field: '+k);});
  (m.problems||[]).forEach(p=>{if(p.c){if(!H.comorbidities[p.c])err('problems: unknown comorbidity key '+p.c);}else{if(!p.key||!p.name)err('inline problem needs key and name');(p.home||[]).forEach(k=>{if(!T.meds[k])err('problem '+p.key+': unknown medicine key '+k);});for(const k in (p.tracks||{}))if(!T.labs[k]&&!['sbp','hr','wt'].includes(k))err('problem '+p.key+' tracks: unknown key '+k);if(!p.sx||!p.plan)err('problem '+p.key+' needs sx and plan phrase lists');
      if(p.ladder)(p.ladder.steps||[]).forEach(s=>{if(!T.meds[s.replace(/^\+/,'')])err('problem '+p.key+' ladder: unknown medicine key '+s);});}});
  (m.hm||[]).forEach(h=>{if(typeof h[0]!=='string'||typeof h[1]!=='number')err('hm rows are [item, every N weeks, min age, max age, sex?]');});
  ['new','ret'].forEach(k=>{if(m.notes&&!m.notes[k])err('notes.'+k+' is missing');});
  const cl=M.clinics.filter(c=>c.module===m.key);if(!cl.length){W.push('no clinic in hospital/clinics.js uses module "'+m.key+'" yet');return;}
  let seen=0;try{cl.slice(0,2).forEach(c=>{for(let d=-10;d<=3;d++){H.clinicSchedule(c.key,H.addD(H.BASE_NOW,d)).slice(0,6).forEach(a=>{const o=H.outpatient(a.patientId);if(!o)err('dry run: outpatient chart missing for '+a.patientId);else{o.visits.forEach(v=>{if(v.status==='Seen'){seen++;const s=JSON.stringify(v);if(/\{[a-zA-Z0-9_.]+\}|undefined|NaN/.test(s))err('dry run: unfilled slot or NaN in a visit of '+a.patientId+': '+(/.{20}(\{[a-zA-Z0-9_.]+\}|undefined|NaN).{20}/.exec(s)||[''])[0]);}});}});}});}catch(e){err('dry run threw: '+(e.stack||e).split('\n').slice(0,2).join(' '));}
  if(!seen)err('dry run: no seen visits were produced');const miss=Object.keys(H.fill.missing);if(miss.length){err('dry run: slots with no value: '+miss.join(' '));H.fill.missing={};}return seen;}

let bad=0;
files.forEach(f=>{const abs=path.isAbsolute(f)?f:path.join(process.cwd(),f);const rel=path.relative(root,abs);const src=fs.readFileSync(abs,'utf8');const E=[],W=[];let info='';
  const calls=[...src.matchAll(/HOSP\.(condition|comorbidity|clinic)\(\s*\{\s*key:'([^']+)'/g)];if(!calls.length)E.push('file must call HOSP.condition({...}), HOSP.comorbidity({...}) or HOSP.clinic({...}) with key first');
  if(/\b(function|=>|require|window|document)\b/.test(src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/'(?:[^'\\]|\\.)*'/g,"''")))E.push('modules are data only: no functions, require or browser objects');
  if(src.length>16000&&calls.length===1)W.push('file is '+src.length+' bytes; aim for under 12,000');
  calls.forEach(c=>{const kind=c[1],key=c[2];if(kind==='condition'){const m=H.conditions[key];if(!m){E.push('module '+key+' did not load');return;}const e0=E.length;checkCondition(m,calls.length>1?key+'.js':abs,E,W);if(E.length===e0){const n=dryRunCondition(m,E,W);info+=' ['+key+': '+n+' charts built]';}}
    else if(kind==='comorbidity'){const m=H.comorbidities[key];if(!m)E.push('module did not load');else checkComorbidity(m,abs,E,W);}else{const m=H.clinicModules[key];if(!m)E.push('module did not load');else{const n=checkClinic(m,abs,E,W);info+=' ['+(n||0)+' visits checked]';}}});
  if(E.length){bad++;console.log('FAIL '+rel);E.slice(0,40).forEach((e,i)=>console.log('  '+(i+1)+'. '+e));}else console.log('OK   '+rel+info);
  W.slice(0,12).forEach(w=>console.log('  note: '+w));});
process.exit(bad?1:0);
