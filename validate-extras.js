const fs=require('fs'),vm=require('vm');const f=process.argv[2];const E=[];const bad=m=>E.push(m);
let x;try{x=JSON.parse(fs.readFileSync(f,'utf8'));}catch(e){console.log('FAIL invalid JSON: '+e.message);process.exit(1);}
vm.runInThisContext(fs.readFileSync(__dirname+'/data.js','utf8'));
let P=seed();try{fs.readdirSync(__dirname+'/patients').forEach(n=>{vm.runInThisContext(fs.readFileSync(__dirname+'/patients/'+n,'utf8'));});}catch(e){}
EXTRA.forEach(b=>{try{P.push(b());}catch(e){}});
const p=P.filter(q=>q.id===x.id)[0];if(!p){console.log('FAIL unknown patient id '+x.id);process.exit(1);}
const r=x.reference||{};
['one_line','handoff','brief_hospital_course','problem_list','reconciled_medications','pending_items'].forEach(k=>{if(r[k]==null)bad('reference.'+k+' missing');});
if(r.handoff&&['Stable','Watch closely','Unstable'].indexOf(r.handoff.severity)<0)bad('handoff.severity');
const wc=s=>(s||'').split(/\s+/).filter(Boolean).length;
if(wc(r.brief_hospital_course)<130)bad('brief_hospital_course too short');
if(!Array.isArray(r.problem_list)||r.problem_list.length<4)bad('problem_list');
if(!Array.isArray(r.reconciled_medications)||r.reconciled_medications.length<5)bad('reconciled_medications');
if(!Array.isArray(x.qa)||x.qa.length<12)bad('need 12+ qa');else{const ty=new Set(x.qa.map(q=>q.type));['lookup','trend','temporal','reasoning','absence'].forEach(t=>{if(!ty.has(t))bad('qa missing type '+t);});if(x.qa.filter(q=>q.type==='absence').length<2)bad('need 2 absence qa');x.qa.forEach(q=>{if(!q.q||!q.a||!Array.isArray(q.evidence))bad('qa item shape');});}
if(!Array.isArray(x.tasks)||x.tasks.length!==p.key.length)bad('tasks must have exactly '+p.key.length+' entries');else x.tasks.forEach((t,i)=>{if(t.key_index!==i)bad('task key_index order');if(t.kind!==p.key[i][0])bad('task '+i+' kind should be '+p.key[i][0]);['prompt','expected_findings','acceptable_actions','must_not','evidence'].forEach(k=>{if(t[k]==null)bad('task '+i+' missing '+k);});});
const e=x.epilogue||{};if(wc(e.course)<90)bad('epilogue.course too short');if(!Array.isArray(e.events)||e.events.length<3)bad('epilogue.events');if(!e.discharge||!e.discharge.disposition)bad('epilogue.discharge');if(!e.outcomes_30_day||typeof e.outcomes_30_day.readmitted!=='boolean')bad('outcomes_30_day');
(e.events||[]).forEach(v=>{if(!(new Date(v.t)>NOW))bad('epilogue event not after now: '+v.t);});
if(!Array.isArray(x.portal_messages)||x.portal_messages.length<4)bad('need 4+ portal_messages');else x.portal_messages.forEach(m=>{if(!m.t||!m.from||!m.body||['routine','same day','urgent'].indexOf(m.urgency_truth)<0)bad('portal message shape');});
const c=x.conversation||{};if(!Array.isArray(c.turns)||c.turns.length<25)bad('conversation needs 25+ turns');
const all=JSON.stringify(x);['Braden','Morse','NANDA','CPT','APACHE','CAM-ICU','RASS','PHQ','Epic','Cerner'].forEach(w=>{if(new RegExp('\\b'+w+'\\b').test(all))bad('forbidden term '+w);});
const sz=fs.statSync(f).size;if(sz<11000)bad('file thin: '+sz+' bytes');
console.log(E.length?'FAIL\n'+E.join('\n'):'OK '+x.id+' '+sz+' bytes');process.exit(E.length?1:0);
