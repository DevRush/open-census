/* Click-through test for app.html (Open Census).
   Run: node _test.js            (writes _preview.html beside the page, then drives it with Playwright)
   Prints one line per failed check and a final RESULT line. Exit code 1 if anything failed. */
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const D=__dirname+'/';
const SHOTS=process.env.SHOTS||'';          // set SHOTS=/some/dir to save screenshots
const OPTIONAL=/patients\/p\d+\.js|fhir-map\.js/;   // files other people supply; a missing one must not break the page
fs.writeFileSync(D+'_preview.html','<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>'+fs.readFileSync(D+'app.html','utf8')+'</body></html>');

let fails=0,checks=0,errs=0,pageErrs=0,overflows=0,missing=[];
const TABS=['summary','review','results','flows','meds','orders','notes','history','discharge','coding','key'];

(async()=>{
const browser=await chromium.launch();
for(const [w,h,name,scheme] of [[1440,880,'desktop','light'],[400,800,'phone','dark']]){
  const ctx=await browser.newContext({viewport:{width:w,height:h},colorScheme:scheme});
  const p=await ctx.newPage();p.setDefaultTimeout(8000);
  p.on('console',m=>{if(m.type()!=='error')return;const u=(m.location()||{}).url||'';if(/Failed to load resource/.test(m.text())&&OPTIONAL.test(u)){if(missing.indexOf(u.split('/').pop())<0)missing.push(u.split('/').pop());return;}errs++;console.log(name,'CONSOLE ERROR',m.text(),u);});
  p.on('pageerror',e=>{pageErrs++;console.log(name,'PAGE ERROR',e.message,((e.stack||'').split('\n')[1]||'').trim());});
  p.on('dialog',d=>{fails++;console.log(name,'FAIL native dialog used:',d.message());d.dismiss();});
  const ok=(c,l)=>{checks++;if(!c){fails++;console.log(name,'FAIL',l);}};
  const ov=async l=>{const o=await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);if(o){overflows++;console.log(name,'OVERFLOW',l);}};
  const shot=async n=>{if(SHOTS)await p.screenshot({path:path.join(SHOTS,name+'-'+n+'.png')});};
  const S=f=>p.evaluate(f);
  const tab=async t=>{await p.click(`.ctabs [data-a=act][data-v=${t}]`);};
  const open=async id=>{await p.evaluate(id=>{const s=LXSIM.state();s.view='home';s.list='my';},id);await p.click('#nav-home');await p.click(`tr.row[data-v=${id}]`);await p.click('.aside [data-a=open]');};
  const login=async(role,dept,first)=>{if(!first)await p.click('#btn-switch');await p.check(`input[name=lg-role][data-role="${role}"]`);await p.check(`input[name=lg-dept][data-dept="${dept||'Hospital medicine'}"]`);await p.click('[data-a=loginok]');ok(!(await p.$('.dlg.signin')),'signed in as '+role);};
  const side=async()=>{if(name==='phone'&&!(await p.$('.pside.open')))await p.click('[data-a=side]');};
  const adv=ms=>p.evaluate(ms=>LXSIM.advance(ms),ms);
  const order=async(q,opts={})=>{await p.fill('#ord-q',q);await p.click('#ord-res [data-a=pick]');
    if(opts.dose!==undefined)await p.fill('#oc-dose',opts.dose);
    if(opts.pri)await p.selectOption('#oc-pri',opts.pri);
    if(await p.$('#oc-ind'))if(opts.ind||await p.evaluate(()=>/exam/.test(document.querySelector('label[for=oc-ind]').textContent)))await p.fill('#oc-ind',opts.ind||'Test reason');
    if(opts.prn){await p.check('#oc-prn');await p.fill('#oc-prnr',opts.prn);}else if(await p.$('#oc-prn')&&await p.isChecked('#oc-prn'))await p.fill('#oc-prnr','nausea');
    if(await p.$('#oc-over'))await p.selectOption('#oc-over',{index:1});
    await p.click('[data-a=ordok]');ok(!(await p.$('.dlg')),'order dialog closed for '+q);};

  await p.goto('file://'+D+'_preview.html');await p.waitForSelector('input[name=lg-role]');
  ok(await p.$('.dlg.signin'),'sign-in dialog shown at start');ok(!(await p.$('#modal input[type=text], #modal select')),'sign-in does not ask for a name');await shot('login');
  ok((await p.$$('input[name=lg-role]')).length===11,'eleven roles offered');ok((await p.$$('input[name=lg-dept]')).length===1+(await S(()=>LXSIM.units().length)),'hospital medicine plus every unit offered');
  ok(await p.isDisabled('#lg-go'),'Sign in is disabled until both are chosen');
  /* keyboard only: Space picks the focused role, arrows move, Tab goes to departments, Enter signs in */
  await p.focus('input[name=lg-role][value="0"]');await p.keyboard.press('Space');await p.keyboard.press('ArrowDown');
  ok(await S(()=>document.querySelector('input[name=lg-role]:checked').dataset.role==='Resident physician'),'arrow key moves the role selection');ok(await p.isDisabled('#lg-go'),'still disabled with only a role');
  await p.keyboard.press('ArrowUp');await p.keyboard.press('Tab');await p.keyboard.press('Space');
  ok(/Adeyemi-Vance/.test(await p.textContent('#lg-as')),'dialog previews the generated name');ok(!(await p.isDisabled('#lg-go')),'Sign in enabled once role and department are chosen');
  await p.keyboard.press('Enter');ok(!(await p.$('.dlg.signin')),'keyboard sign-in works');
  ok(await S(()=>{const u=LXSIM.state().user;return u.role==='Attending physician'&&u.dept==='Hospital medicine'&&u.name==='Dr. H. Adeyemi-Vance (Attending)';}),'signed in with a generated name');
  ok(/Adeyemi-Vance/.test(await p.textContent('#top-user')),'system bar shows the signed-in name');
  ok(await S(()=>document.title)==='Open Census'&&/Open Census/.test(await p.textContent('.brand')),'product name is Open Census');ok((await p.textContent('#st-hosp'))==='Northfield Medical Center','status bar names the hospital');
  const pcount=await S(()=>LXSIM.state().P.length);console.log(name,pcount,'patients loaded');

  /* ---- item 2: the clock runs ---- */
  const c1=await p.textContent('#clock');await p.waitForTimeout(1300);const c2=await p.textContent('#clock');
  ok(/^Tue 17 Nov 14:3\d:\d\d$/.test(c1),'clock shows weekday and seconds: '+c1);ok(c1!==c2,'clock advances in real time');
  await p.click('#ck-run');const c3=await p.textContent('#clock');await p.waitForTimeout(700);ok(c3===await p.textContent('#clock'),'pause stops the clock');
  await p.click('#ck-speed');ok((await p.textContent('#ck-speed'))==='×60','speed toggles to x60');await p.click('#ck-run');await p.waitForTimeout(800);
  const jumped=await S(()=>(+LXSIM.now()-new Date(2026,10,17,14,30))/1000);ok(jumped>25,'x60 moves faster than real time ('+Math.round(jumped)+' s)');
  await p.click('#ck-speed');await p.click('#ck-run');ok((await p.textContent('#ck-run'))==='Resume','paused for the rest of the test');
  const v0=await S(()=>LXSIM.state().P[0].flows[0].times.length);await p.click('#ck-plus');
  const v1=await S(()=>LXSIM.state().P[0].flows[0].times.length);ok(v1===v0+1,'+1 h auto-charts one hourly vitals column on the ICU patient ('+v0+' to '+v1+')');
  ok(await S(()=>{const g=LXSIM.state().P[0].flows;return g.every(x=>!x.times||x.rows.every(r=>r.type==='map'||(r.type==='bp'?r.s.length===x.times.length:r.v.length===x.times.length)));}),'every flowsheet row keeps one value per time column');
  await p.click('#btn-reset');ok(/^Tue 17 Nov 14:30:00$/.test(await p.textContent('#clock')),'reset restores 17 Nov 14:30');ok(!(await p.$('#lg-name')),'still signed in after reset');

  /* ---- top-level screens, 24 patients ---- */
  for(const v of ['board','or','ed','inbox','chat','data','home']){await p.click('#nav-'+v);await ov('screen '+v);if(name==='desktop'||v==='home')await shot('screen-'+v);}
  await p.click('[data-a=hv][data-v=handoff]');ok((await p.$$('textarea[data-ho]')).length===pcount*2,'handoff lists every patient');await ov('handoff');await p.click('[data-a=hv][data-v=list]');
  const ids=await p.evaluate(()=>[...document.querySelectorAll('tr.row[data-a=sel]')].map(r=>r.dataset.v));ok(ids.length===pcount,'patient list shows all '+pcount);
  const lastName=await S(()=>{const P=LXSIM.state().P;return P[P.length-1].name;});await p.fill('#gsearch',lastName.slice(0,5));ok((await p.textContent('#gres')).includes(lastName),'search finds '+lastName);await p.fill('#gsearch','');
  await p.click('#nav-board');const bd=await p.textContent('#work');ok(/Cardiac Surgery ICU/.test(bd)&&/Behavioural Health/.test(bd),'unit board has the two new units');
  ok(await S(()=>LXSIM.state().P.every(q=>document.querySelector('.bt[data-v="'+q.id+'"]')||q.unitKey==='ed')),'unit board shows every practice patient');
  for(const u of ['cvicu','psych']){await p.click('#nav-home');await p.click(`[data-a=list][data-v=${u}]`);ok((await p.$$('tr.row')).length>=3,'unit list '+u+' has beds');await p.click('tr.row[data-a=fill]');}
  await p.click('[data-a=list][data-v=my]');

  /* ---- every patient, every chart tab ---- */
  for(const id of ids){await open(id);ok(await p.$('.pside .ps-nm'),'sidebar for '+id);ok((await p.$$('.ctabs .ctab')).length===11,'11 chart tabs for '+id);
    if(name==='phone'){await p.click('[data-a=side]');await ov(id+' sidebar open');await p.click('[data-a=side]');}
    for(const t of TABS){await tab(t);
      if(t==='results'){for(const k of ['micro','imaging','path','lab0','all']){await p.click(`[data-a=rsel][data-v=${k}]`);if(k==='imaging'){const n=(await p.$$('.pane .nrow[data-a=rep]')).length;for(let i=0;i<n;i++){await p.click(`.nrow[data-a=rep][data-v="${i}"]`);ok(await p.$('.imgbox canvas.simimg, p.muted'),'imaging '+id+' #'+i+' has an image or a plain no-image line');await ov(id+' imaging '+i);}}}}
      if(t==='flows'){await p.click('[data-a=fview][data-v=graph]');await ov(id+' vitals graph');await p.click('[data-a=fview][data-v=grid]');for(const i of [1,2,3,0])if(await p.$(`[data-a=fg][data-v="${i}"]`))await p.click(`[data-a=fg][data-v="${i}"]`);}
      if(t==='orders'){await p.click('[data-a=of][data-v=Home]');await p.click('[data-a=of][data-v=All]');await p.click('[data-a=of][data-v=Active]');}
      if(t==='key')await p.click('[data-a=reveal]');
      await ov(id+' '+t);
      if(id==='p1'&&(name==='desktop'||['summary','orders','discharge'].includes(t)))await shot('p1-'+t);}}
  await open('p1');await tab('summary');await side();await p.click('.pside [data-a=act][data-v=flows]');ok(await S(()=>LXSIM.state().c.p1.act==='flows'),'sidebar vitals link opens Flowsheets');

  /* ---- item 3: images ---- */
  const imgPt=await S(()=>{const P=LXSIM.state().P,o={};P.forEach(q=>q.imaging.forEach((r,i)=>{const k=SIMIMG.kind(r.title);if(k&&!o[k])o[k]=[q.id,i];if(!k&&!o.none)o.none=[q.id,i];}));return o;});
  for(const k of ['ecg','cxr']){ok(imgPt[k],'a patient has a '+k+' report');if(!imgPt[k])continue;await open(imgPt[k][0]);await tab('results');await p.click('[data-a=rsel][data-v=imaging]');await p.click(`.nrow[data-a=rep][data-v="${imgPt[k][1]}"]`);
    const ink=await p.evaluate(()=>{const c=document.querySelector('canvas.simimg'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const seen=new Set();for(let i=0;i<d.length;i+=4*97)seen.add(d[i]>>4);return seen.size;});
    ok(ink>4,k+' canvas is painted ('+ink+' tones)');ok(/not a real (tracing|radiograph)/.test(await p.textContent('.imgbox .cap')),k+' caption says it is simulated');await shot('img-'+k);await ov('image '+k);
    if(k==='cxr'){await p.click('[data-a=imginv]');ok(/invert\(1\)/.test(await p.getAttribute('canvas.cxr','style')),'invert button inverts');await p.fill('#img-br','150');ok(/brightness\(150%\)/.test(await p.getAttribute('canvas.cxr','style')),'brightness slider works');await p.click('[data-a=imginv]');}}
  if(imgPt.none){await open(imgPt.none[0]);await tab('results');await p.click('[data-a=rsel][data-v=imaging]');await p.click(`.nrow[data-a=rep][data-v="${imgPt.none[1]}"]`);ok(/No image is available/.test(await p.textContent('#work')),'other studies say no image is available');}
  const specs=await S(()=>({af:SIMIMG.ecgSpec('Atrial fibrillation, ventricular rate 108. No new ST changes.'),lb:SIMIMG.ecgSpec('Sinus rhythm, rate 72. Left bundle branch block, QRS 150 ms. ST elevation in V2 to V4. No ST depression.'),cx:SIMIMG.cxrSpec('Right internal jugular catheter. Dense right lower lobe consolidation. Small right pleural effusion. Left lung clear. No pneumothorax. Enlarged heart.'),neg:SIMIMG.cxrSpec('Lungs are clear. No consolidation, effusion or pneumothorax. Heart size normal.')}));
  ok(specs.af.af&&specs.af.rate===108,'ECG reads atrial fibrillation and rate');ok(specs.lb.lbbb&&!specs.lb.af&&specs.lb.qrs===150&&specs.lb.ste.join()==='V2,V3,V4'&&!specs.lb.std.length,'ECG reads bundle branch block and ST elevation leads');
  ok(specs.cx.cons.length===1&&specs.cx.cons[0].s==='R'&&specs.cx.cons[0].z==='l'&&specs.cx.eff[0].s==='R'&&!specs.cx.ptx.length&&specs.cx.big&&specs.cx.lines.cvc==='R','chest film reads side, zone, effusion, line, heart size');
  ok(!specs.neg.cons.length&&!specs.neg.eff.length&&!specs.neg.ptx.length&&!specs.neg.big,'negated findings are not drawn');

  /* ---- item 4: order entry ---- */
  const cat=await S(()=>{const C=LXSIM.catalog(),t={};C.forEach(c=>t[c.text]=1);return {n:C.length,sets:LXSIM.sets().length,miss:LXSIM.sets().map(s=>s.items.filter(i=>!t[i]).map(i=>s.name+': '+i)).flat(),ddi:LX.DDI.length,cats:[...new Set(C.map(c=>c.cat))]};});
  ok(cat.n>=400,'catalogue has '+cat.n+' orderables');ok(cat.sets>=20,cat.sets+' order sets');ok(!cat.miss.length,'every order-set item is in the catalogue '+cat.miss.join('; '));ok(cat.ddi>=40,cat.ddi+' interaction pairs');
  ok(['Blood products','Respiratory','Therapy','Isolation','Code status','Diet'].every(c=>cat.cats.includes(c)),'new order categories present');
  await open('p3');await tab('orders');await p.focus('#ord-q');ok(/Suggested for this patient/.test(await p.textContent('#ord-res')),'suggested order sets appear on empty focus');
  ok(/Heart failure/.test(await p.textContent('#ord-res .rh + button')),'heart failure set suggested first for the heart failure patient');
  await p.fill('#ord-q','warfarin');await p.keyboard.press('ArrowDown');await p.keyboard.press('ArrowDown');await p.keyboard.press('ArrowUp');ok(await p.$('#ord-res button.kb'),'arrow keys highlight a result');await p.keyboard.press('Enter');
  ok(/New order: medication/.test(await p.textContent('.dlg h2')),'Enter opens the highlighted order');const wtxt=await p.textContent('.dlg');
  const p3ac=await S(()=>LXSIM.state().P.find(q=>q.id==='p3').meds.map(m=>m.name).join(' | '));
  ok(/Interaction with/.test(wtxt),'warfarin shows an interaction against the active list ('+p3ac.slice(0,80)+')');await shot('order-dialog');
  await p.click('[data-a=ordok]');ok(/reason to continue/i.test(await p.textContent('#dlg-err')),'a warning needs an override reason');
  await p.selectOption('#oc-over',{index:1});await p.check('#oc-prn');await p.click('[data-a=ordok]');ok(/as-needed order needs a reason/.test(await p.textContent('#dlg-err')),'an as-needed order needs a reason');
  await p.uncheck('#oc-prn');await p.fill('#oc-dose','2.5 mg');await p.selectOption('#oc-freq','nightly');await p.fill('#oc-ind','Atrial fibrillation');await p.click('[data-a=ordok]');
  ok(/Warfarin 2\.5 mg · Oral · nightly · routine · Atrial fibrillation/.test(await p.textContent('#work')),'edited dose, frequency and indication are on the unsigned order');ok(/Warning accepted: Benefit outweighs risk/.test(await p.textContent('#work')),'override reason shown on the unsigned order');
  await p.click('[data-a=brem]');
  const kid=await S(()=>{const q=LXSIM.state().P.find(q=>q.age<16&&parseFloat(q.wt)>0);return q?[q.id,parseFloat(q.wt)]:null;});
  if(kid){await open(kid[0]);await tab('orders');await p.fill('#ord-q','ibuprofen susp');await p.click('#ord-res [data-a=pick]');ok(await p.isVisible('#oc-mgkg'),'dose-by-weight helper is open by default for a child');
    await p.fill('#oc-mgkg','10');const calc=await p.textContent('#oc-calc');ok(parseFloat(calc.replace(/,/g,''))===Math.round(kid[1]*10/(kid[1]*10>=100?5:1))*(kid[1]*10>=100?5:1),'helper multiplies by weight: '+calc);await p.click('[data-a=usewt]');ok((await p.inputValue('#oc-dose'))===calc,'helper fills the dose');await p.click('[data-a=dclose]');}
  await open('p2');await tab('orders');await p.fill('#ord-q','acetamin');await p.click('#ord-res [data-a=pick]');ok(!(await p.isVisible('#oc-mgkg')),'helper is closed by default for an adult');await p.click('[data-a=wtshow]');ok(await p.isVisible('#oc-mgkg'),'helper opens on request');await p.click('[data-a=dclose]');
  const nsets=cat.sets;for(let i=0;i<nsets;i++){await p.evaluate(i=>{const b=document.createElement('button');b.dataset.a='oset';b.dataset.v=i;b.id='tmp-oset';b.hidden=true;document.body.appendChild(b);b.click();b.remove();},i);ok((await p.$$('.dlg input[type=checkbox]')).length>=5,'order set '+i+' opens');if(i===1)await shot('order-set');await p.click(i%4?'[data-a=dclose]':'[data-a=osetok]');}
  ok((await p.$$('[data-a=brem]')).length>5,'order sets add to the unsigned list');await ov('orders with basket');
  while(await p.$('[data-a=brem]'))await p.click('[data-a=brem]');

  /* ---- item 2 again: results come back, pharmacy check, next dose ---- */
  await open('p1');await tab('orders');
  await order('Lactate',{pri:'Immediate'});await order('Chemistry panel',{pri:'Immediate'});await order('Blood cultures, 2 sets',{pri:'Immediate'});await order('Chest X-ray, portable',{pri:'Urgent',ind:'Line position'});await order('ECG, 12-lead',{pri:'Urgent',ind:'Palpitations'});await order('Uric acid',{pri:'Routine'});await order('Ondansetron 4 mg',{});
  const before=await S(()=>{const q=LXSIM.state().P[0];return {chem:q.labs.find(L=>/^Chemistry/.test(L.panel)).times.length,micro:q.micro.length,img:q.imaging.length,msgs:LXSIM.state().msgs.length};});
  await p.click('[data-a=bsign]');ok(/Awaiting pharmacy check/.test(await p.textContent('#work')),'a new medicine waits for the pharmacy check');ok(/Dr\. H\. Adeyemi-Vance \(Attending\)/.test(await p.textContent('#work')),'orders carry the signer’s name and role');
  ok(await S(()=>LXSIM.state().P[0].pending.length===6),'six tests pending');await adv(6*60000);ok(/Pharmacy checked/.test(await p.textContent('#work')),'pharmacy check completes after about 5 minutes');
  await adv(5*60000);let st=await S(()=>{const q=LXSIM.state().P[0];return {pend:q.pending.length,chem:q.labs.find(L=>/^Chemistry/.test(L.panel)).times.length,micro:q.micro.length,m0:q.micro[0].status,add:!!q.labs.find(L=>L.panel==='Additional tests')};});
  ok(st.pend===3&&st.chem===before.chem+1&&st.micro===before.micro+1&&st.m0==='Preliminary','immediate tests back after 10 minutes: chemistry column and preliminary culture ('+JSON.stringify(st)+')');
  await adv(10*60000);st=await S(()=>{const q=LXSIM.state().P[0];return {pend:q.pending.length,img:q.imaging.length,t0:q.imaging[0].title,t1:q.imaging[1].title,s:q.imaging[0].status,b:q.imaging[0].body.slice(0,30)};});
  ok(st.pend===1&&st.img===before.img+2&&st.s==='Preliminary'&&/PRELIMINARY/.test(st.b),'urgent imaging back after 20 minutes, labelled preliminary ('+JSON.stringify(st)+')');
  await adv(26*60000);st=await S(()=>{const q=LXSIM.state(),P=q.P[0],L=P.labs.find(L=>L.panel==='Additional tests');return {pend:P.pending.length,add:L&&L.rows[0][0],msgs:q.msgs.filter(m=>/^(Resulted|Abnormal result)/.test(m.subj)).length,done:P.orders.filter(o=>o.st==='Completed'&&/Adeyemi-Vance/.test(o.by)).length};});
  ok(st.pend===0&&st.add==='Uric acid'&&st.msgs===6&&st.done===6,'routine test back after 45 minutes; six inbox messages; orders completed ('+JSON.stringify(st)+')');
  await tab('results');await p.click('[data-a=rsel][data-v=imaging]');await p.click('.nrow[data-a=rep][data-v="0"]');ok(await p.$('canvas.simimg'),'the new preliminary study has a drawn image');await shot('prelim-image');await p.click('[data-a=rsel][data-v=all]');await ov('results after new columns');
  await tab('meds');await p.click('[data-a=mar][data-v="0"]');const dueSel='.mcell.due, .mcell.over';const nd0=await S(()=>LXSIM.state().P[0].meds.reduce((n,m)=>n+m.a.filter(a=>a.st==='due').length,0));
  await p.click(dueSel);await p.click('[data-a=admok]');ok(/Scan the wristband/.test(await p.textContent('#dlg-err')),'dose needs both scans');await p.check('#adm-w');await p.check('#adm-m');await p.click('[data-a=admok]');
  const nd1=await S(()=>LXSIM.state().P[0].meds.reduce((n,m)=>n+m.a.filter(a=>a.st==='due').length,0));ok(nd1>=nd0-1,'documenting a scheduled dose keeps a next due dose where the frequency repeats ('+nd0+' to '+nd1+')');
  ok(await S(()=>LXSIM.state().P[0].meds.some(m=>m.a.some(a=>a.by==='Dr. H. Adeyemi-Vance (Attending)'))),'dose carries the signer’s name');
  await p.click('#nav-inbox');ok(/Resulted: |Abnormal result: /.test(await p.textContent('#work')),'inbox lists the results');await ov('inbox with results');

  /* ---- item 5: roles ---- */
  await p.click('#btn-reset');await p.click('#ck-run').catch(()=>{});await S(()=>LXSIM.pause(true));
  await login('Medical student');await open('p2');await tab('orders');await order('Senna 17.2 mg');await order('Basic chemistry panel');
  const m0=await S(()=>LXSIM.state().P[1].meds.length);await p.click('[data-a=bsign]');
  ok(await S(()=>{const q=LXSIM.state().P[1];return q.orders.filter(o=>o.st==='Needs cosign').length===2&&!q.pending.length;})&&m0===await S(()=>LXSIM.state().P[1].meds.length),'student orders wait for cosign and are not active');
  ok(!(await p.$('[data-a=ocosign]')),'a student cannot cosign');
  await tab('notes');await p.click('[data-a=draft]');await p.fill('#nt-body','Student note for cosign.');await p.click('[data-a=signnote]');ok(/Cosign needed/.test(await p.textContent('.nhead')),'student note is flagged for cosign');ok(!(await p.$('[data-a=ncosign]')),'student cannot cosign a note');
  await tab('discharge');await p.click('[data-a=dcgo]');ok(!(await p.$('.dlg')),'a student cannot discharge');
  await login('Attending physician');await open('p2');await tab('orders');ok((await p.$$('[data-a=ocosign]')).length===2,'attending sees two orders to cosign');await p.click('[data-a=ocosign]');await p.click('[data-a=ocosign]');
  ok(await S(()=>{const q=LXSIM.state().P[1];return !q.orders.some(o=>o.st==='Needs cosign')&&q.pending.length===1&&q.meds.some(m=>/^Senna/.test(m.name)&&m.oid);}),'cosigned orders become active');ok(/Cosigned by Dr\. H\. Adeyemi-Vance/.test(await p.textContent('#work')),'cosigner is named on the order');
  await tab('notes');await p.click('.nrow');await p.click('[data-a=ncosign]');ok(/Cosigned by Dr\. H\. Adeyemi-Vance/.test(await p.textContent('.nhead')),'attending cosigns the note');
  await login('Nurse','3 West Medicine');ok(await S(()=>LXSIM.state().view==='work'),'nurse lands on the shift worklist');ok((await p.$$('#work table.g tbody tr')).length>20,'worklist has tasks');await shot('worklist');await ov('worklist');
  ok(/Dose/.test(await p.textContent('#work'))&&/Vitals/.test(await p.textContent('#work'))&&/Assessment/.test(await p.textContent('#work')),'worklist has doses, vitals and assessments');
  await p.click('[data-a=tdone]');ok(/Done \d\d:\d\d · J\. Ferreira-Holm RN/.test(await p.textContent('#work')),'task ticked off with the nurse’s name');
  await p.click('[data-a=wu][data-v=icu]');await p.click('[data-a=wu][data-v=all]');await p.click('button[data-a=wgo]');ok(await p.$('.pside'),'worklist opens the chart');
  await open('p2');await tab('orders');await order('Ondansetron 4 mg');ok(/for Dr\./.test(await p.textContent('#work')),'nurse order names the ordering doctor');await p.click('[data-a=bsign]');
  ok(/Verbal order from Dr\./.test(await p.textContent('#work'))&&/Needs doctor’s signature/.test(await p.textContent('#work')),'nurse orders are verbal orders needing a signature');ok(!(await p.$('[data-a=osig]')),'a nurse cannot sign for the doctor');
  await tab('notes');await p.click('[data-a=draft]');const nt=await p.$$eval('#nt-type option',o=>o.map(x=>x.textContent));ok(nt.includes('Nursing note')&&!nt.includes('Progress note'),'nurse cannot pick doctors’ note types: '+nt.join(', '));
  await p.fill('#nt-body','Nursing note.');await p.click('[data-a=signnote]');ok(/J\. Ferreira-Holm RN/.test(await p.textContent('.nhead')),'nursing note carries the nurse’s name');
  await tab('flows');await p.click('[data-a=newcol]');await p.fill('#fsi1','84');await p.fill('#fsi3','118/70');await p.click('[data-a=filecol]');ok(await S(()=>{const g=LXSIM.state().P[1].flows[0];return g.rows[1].v[g.times.length-1]===84&&g.rows[3].s.length===g.times.length;}),'nurse charts a flowsheet column');
  await tab('discharge');await p.click('[data-a=dcsum]');ok(await S(()=>LXSIM.state().c.p2.act==='discharge'),'nurse cannot start a discharge summary');
  await login('Attending physician');await open('p2');await tab('orders');await p.click('[data-a=osig]');ok(/Signed by Dr\. H\. Adeyemi-Vance/.test(await p.textContent('#work')),'doctor signs the verbal order');
  await login('Pharmacist');ok(await S(()=>LXSIM.state().view==='verify'),'pharmacist lands on the queue');const q0=(await p.$$('[data-a=vok]')).length;ok(q0>=pcount,'queue has orders across patients ('+q0+')');ok(/Warning/.test(await p.textContent('#work')),'queue shows warnings');await shot('pharmacy');await ov('pharmacy queue');
  await p.click('[data-a=vok]');ok((await p.$$('[data-a=vok]')).length===q0-1,'verify removes the order from the queue');
  await p.click('[data-a=vback]');await p.click('[data-a=vbackok]');ok(/Write a comment/.test(await p.textContent('#dlg-err')),'send back needs a comment');await p.fill('#pb-why','Dose looks high for kidney function.');await p.click('[data-a=vbackok]');
  ok((await p.$$('[data-a=vok]')).length===q0-2&&await S(()=>LXSIM.state().msgs.some(m=>/^Pharmacy sent back/.test(m.subj)&&/Sørlie/.test(m.from))),'sent-back order leaves the queue and messages the prescriber');
  ok(await S(()=>LXSIM.state().P.some(q=>q.orders.some(o=>o.ver==='ok'&&/Sørlie/.test(o.verBy||'')))),'verifier is named on the order');
  /* new roles */
  await login('Fellow');ok(await S(()=>LXSIM.state().user.name==='Dr. S. Marchetti-Rowe (Fellow)'),'fellow name generated');await open('p3');await tab('notes');
  ok(await S(()=>LXSIM.state().P[2].notes.some(n=>(n.cosign||/PGY-1|student/i.test(n.by))&&!n.cosigned)),'p3 has a note waiting for cosign');await p.click('.nrow[data-a=note]:has-text("cosign needed")');ok(await p.$('[data-a=ncosign]'),'a fellow can cosign notes');
  await tab('orders');ok(await p.$('#ord-q'),'a fellow can enter orders');
  await login('Respiratory therapist');ok(await S(()=>LXSIM.state().view==='work'),'respiratory therapist lands on the worklist');await open('p1');await tab('orders');
  ok(/no medicines/.test(await p.getAttribute('#ord-q','placeholder')),'therapist order search says no medicines');await p.fill('#ord-q','ondansetron');await p.click('#ord-res [data-a=pick]');ok(!(await p.$('.dlg')),'therapist cannot open a medicine order');
  await p.fill('#ord-q','Chest X-ray, portable');await p.click('#ord-res [data-a=pick]');ok(/New order: imaging/.test(await p.textContent('.dlg h2')),'therapist can enter a non-medicine order');await p.click('[data-a=dclose]');
  await tab('notes');await p.click('[data-a=draft]');ok((await p.$$eval('#nt-type option',o=>o.map(x=>x.textContent))).includes('Therapy note'),'therapist writes therapy notes');await p.click('[data-a=canceldraft]');
  await login('Case manager');ok(await S(()=>LXSIM.state().view==='home'),'case manager lands on patient lists');await open('p2');await tab('orders');ok(!(await p.$('#ord-q')),'case manager cannot enter orders');
  await tab('meds');const due=await p.$('.mcell.due, .mcell.over');if(due){await due.click();ok(!(await p.$('.dlg')),'case manager cannot document a dose');}
  await tab('flows');await p.click('[data-a=newcol]');ok(await S(()=>!LXSIM.state().c.p2.newcol),'case manager cannot chart flowsheets');
  await tab('discharge');await p.fill('#fu-who','Home health agency');await p.click('[data-a=fuadd]');ok(/Home health agency/.test(await p.textContent('#work')),'case manager uses the discharge tab');await p.click('[data-a=furem]');
  await p.click('#nav-chat');ok(await p.$('[data-a=chatnew]'),'case manager can use chat');
  await login('Unit clerk','Medical ICU');ok(await S(()=>LXSIM.state().view==='board'),'unit clerk lands on the unit board');ok(await S(()=>LXSIM.state().user.name==='B. Nakamura (Unit clerk)'),'clerk name generated');
  await open('p1');await tab('notes');ok(!(await p.$('[data-a=draft]')),'unit clerk cannot write notes');await tab('orders');ok(!(await p.$('#ord-q')),'unit clerk cannot order');
  await p.click('#btn-switch');ok(await p.$('input[name=lg-role][data-role="Unit clerk"]:checked'),'switch role reopens sign-in with the current role');await p.click('[data-a=dclose]');
  await login('Attending physician');ok(/Dr\. H\. Adeyemi-Vance \(Attending\) · Attending physician/.test(await p.textContent('#st-user')),'status bar shows the signed-in role');

  /* note formatting: labels bold, numbered plan items hang, text is escaped and unchanged */
  await open('p1');await tab('notes');await p.click('[data-a=draft]');const raw='Subjective: feels better <b>today</b>\nFINDINGS\nAssessment and plan:\n1. Pneumonia: continue ceftriaxone\n   - recheck culture\n2. Kidney injury: fluids\nAt 14:30 seen.';
  await p.fill('#nt-body',raw);await p.click('[data-a=signnote]');
  const fm=await S(()=>{const n=document.querySelector('.ntx');return {lb:[...n.querySelectorAll('.lb')].map(b=>b.textContent),li:n.querySelectorAll('.li').length,inj:!!n.querySelector('b:not(.lb)'),txt:n.textContent,stored:LXSIM.state().P[0].notes[0].body};});
  ok(fm.lb.join('|')==='Subjective:|FINDINGS|Assessment and plan:|Pneumonia:|Kidney injury:','labels and problem names are bold: '+fm.lb.join('|'));ok(fm.li>=3,'numbered items render as a hanging list');
  ok(!fm.inj&&/<b>today<\/b>/.test(fm.txt),'note text is escaped, not injected');ok(fm.stored===raw,'stored note text is unchanged');ok(!/At 14/.test(fm.lb.join()),'times are not mistaken for labels');
  await tab('results');await p.click('[data-a=rsel][data-v=imaging]');ok(await p.$('.ntx'),'report bodies use the same formatting');
  await p.click('#nav-inbox');await p.click('.nrow[data-a=msg]');ok(await p.$('.ntx'),'inbox reading pane uses the same formatting');

  /* ---- item 6: discharge and coding ---- */
  await p.click('#btn-reset');await S(()=>LXSIM.pause(true));
  await open('p2');await tab('discharge');await shot('discharge');await p.click('[data-a=dcgo]');const blk=await p.textContent('.dlg');ok(/Not ready for discharge/.test(blk)&&/without a discharge decision/.test(blk)&&/summary not written/.test(blk)&&/Not ticked/.test(blk),'discharge is blocked with a list of what is missing');await shot('discharge-blocked');await p.click('[data-a=dclose]');
  for(;;){const s=await p.$('select[data-dcrec]:has(option:checked[value=""])');if(!s)break;const v=await s.evaluate(e=>e.options[1+([...document.querySelectorAll('select[data-dcrec]')].indexOf(e)%4)].value);await s.selectOption(v);}
  ok(/of \d+ decided/.test(await p.textContent('#work'))&&!(await p.$('select[data-dcrec]:has(option:checked[value=""])')),'every medicine gets a discharge decision');
  if(await p.$('input[data-dcchg]')){await p.fill('input[data-dcchg]','Half the dose, once daily');await p.press('input[data-dcchg]','Tab');}
  for(;;){const left=await p.evaluate(()=>{const bs=[...document.querySelectorAll('[data-a=dcline]')],out=[];for(let i=0;i<bs.length;i+=2)if(bs[i].getAttribute('aria-pressed')==='false'&&bs[i+1].getAttribute('aria-pressed')==='false')out.push(bs[i].dataset.v);return out;});if(!left.length)break;await p.click(`[data-a=dcline][data-v="${left[0]}"]`);}
  for(const k of ['teach','ride','prop','equip'])await p.check('#dct-'+k);
  await p.fill('#fu-who','Colorectal surgery clinic');await p.fill('#fu-when','In 2 weeks');await p.click('[data-a=fuadd]');ok(/Colorectal surgery clinic/.test(await p.textContent('#work')),'follow-up added');await p.click('[data-a=furem]');
  await p.fill('#dc-instr','Keep the wound dry for 48 hours.\nWalk every day.');
  await p.click('[data-a=handout]');const ho=await p.textContent('.paper');ok(/Going home/.test(ho)&&/Keep the wound dry/.test(ho)&&/Colorectal surgery clinic/.test(ho)&&/Medicines to stop/.test(ho),'handout preview is assembled from the tab');await shot('handout');await ov('handout');await p.click('[data-a=dclose]');
  await p.click('[data-a=dcsum]');ok((await p.inputValue('#nt-type'))==='Discharge summary'&&/Medicines to continue/.test(await p.inputValue('#nt-body')),'discharge summary note opens pre-filled');await p.click('[data-a=signnote]');
  await tab('meds');for(;;){const c=await p.$('.mcell.over');if(!c)break;await c.click();await p.check('#adm-w');await p.check('#adm-m');await p.click('[data-a=admok]');}
  for(let g=0;g<4;g++){const od=await S(()=>{const q=LXSIM.state().P[1];let n=0;q.meds.forEach(m=>m.a.forEach(a=>{if(a.st==='due'&&a.t-LXSIM.now()<-3600000)n++;}));return n;});if(!od)break;await p.click('[data-a=mar][data-v="-8"]');for(;;){const c=await p.$('.mcell.over');if(!c)break;await c.click();await p.check('#adm-w');await p.check('#adm-m');await p.click('[data-a=admok]');}}
  await tab('discharge');await p.click('[data-a=dcgo]');const dlgT=await p.textContent('.dlg');ok(/Discharge patient/.test(dlgT)&&/checklist is complete/.test(dlgT),'checklist complete: '+dlgT.slice(0,160));
  if(await p.$('[data-a=dcdo]')){await p.click('[data-a=dcdo]');ok(/Discharged 17 Nov/.test(await p.textContent('.pside')),'sidebar shows Discharged');ok(await S(()=>{const q=LXSIM.state().P[1];return !!q.discharged&&!q.orders.some(o=>o.st==='Active'||o.st==='Pending')&&/Adeyemi-Vance/.test(q.dcBy);}),'discharge stamps the time and completes active orders');
    await shot('discharged');await p.click('#nav-board');ok(/Patient discharged \d\d:\d\d/.test(await p.textContent('#work'))&&!(await p.$('.bt[data-v=p2]')),'unit board shows the bed being cleaned');await p.click('#nav-home');ok(/Discharged/.test(await p.textContent('tr.row[data-v=p2]')),'patient list shows Discharged');}
  else await p.click('[data-a=dclose]');
  await open('p3');await tab('coding');await shot('coding');ok((await p.$$('[data-a=cdadd]')).length>=4,'coding suggests codes from the problem list');const sg=await p.textContent('#work');ok(/I50\.\d/.test(sg)&&/I48\./.test(sg),'heart failure and atrial fibrillation codes suggested');
  await p.click('[data-a=cdadd]');await p.click('[data-a=cdadd]');await p.fill('#icd-q','kidney stage 3b');ok(/N18\.32/.test(await p.textContent('#icd-res')),'code search finds N18.32');await p.click('#icd-res [data-a=cdadd]');
  ok(await S(()=>LXSIM.state().c.p3.cd.codes.length===3&&LXSIM.state().c.p3.cd.principal===LXSIM.state().c.p3.cd.codes[0]),'three codes; the first is the principal diagnosis');
  await p.check('input[data-cdprin$=",N18.32"]');ok(await S(()=>LXSIM.state().c.p3.cd.principal==='N18.32'),'principal diagnosis can be changed');await p.click('[data-a=cdrem]');ok(await S(()=>LXSIM.state().c.p3.cd.codes.length===2),'code removed');
  await p.selectOption('select[data-cdlev]',{index:3});ok(await S(()=>/^Moderate/.test(LXSIM.state().c.p3.cd.level)),'visit level chosen in plain words');ok(!/\b99\d{3}\b/.test(await p.textContent('#work')),'no procedure code numbers on the coding tab');
  ok(await S(()=>LX.ICD.split('|').length>=300),'at least 300 ICD-10-CM codes built in');
  if(await p.$('[data-a=cdq]'))await p.click('[data-a=cdq]');await p.fill('#cd-qtext','Anaemia: please specify type and cause.');await p.click('[data-a=cdqsend]');ok(await S(()=>LXSIM.state().msgs.filter(m=>m.f==='Coding queries').length>=1),'documentation query reaches the inbox');
  await p.click('#nav-inbox');await p.click('[data-a=mf][data-v="Coding queries"]');ok(/Documentation query/.test(await p.textContent('#work')),'inbox has a coding queries folder');await ov('coding inbox');

  /* ---- item 7: chat ---- */
  await p.click('#btn-reset');await S(()=>LXSIM.pause(true));
  ok(/Chat\s*4/.test(await p.textContent('#nav-chat')),'chat shows 4 unread');await p.click('#nav-chat');ok((await p.$$('.nrow[data-a=chat]')).length===4,'four seeded conversations');
  await p.click('.nrow[data-a=chat]');ok(/Chat\s*3/.test(await p.textContent('#nav-chat')),'opening a thread clears its unread count');
  await p.fill('#chat-in','Thanks. Can you confirm the plan?');await p.keyboard.press('Enter');ok((await p.$$('.bub.me')).length===1&&(await p.inputValue('#chat-in'))==='','message sent with Enter');
  const b0=(await p.$$('.bub')).length;await p.fill('#chat-in','still typing');await p.focus('#chat-in');await adv(61000);ok((await p.$$('.bub')).length===b0+1,'a reply arrives within 60 simulated seconds');ok((await p.inputValue('#chat-in'))==='still typing','text being typed survives the redraw');await shot('chat');await ov('chat');
  await p.fill('#chat-in','');await p.click('[data-a=chatnew]');await p.selectOption('#cn-p','p3');const tm=await p.$$eval('#cn-m option',o=>o.map(x=>x.textContent));ok(tm.length>=4&&/Dr\./.test(tm.join()),'team list follows the chosen patient: '+tm[0]);
  await p.selectOption('#cn-m',{index:2});await p.fill('#cn-t','Could you review her potassium?');await p.click('[data-a=chatnewok]');ok((await p.$$('.nrow[data-a=chat]')).length===5&&(await p.$$('.bub.me')).length===1,'new conversation started');
  await adv(61000);ok((await p.$$('.bub')).length===2,'new conversation gets a reply');await p.click('#nav-home');await adv(1000);
  await p.click('#nav-chat');await p.click('.chat .bar [data-a=wgo]');ok(await S(()=>LXSIM.state().view==='p3'),'thread links to the patient’s chart');
  await side();await p.click('.pside [data-a=chatwith]');ok(await S(()=>LXSIM.state().view==='chat')&&(await p.$('#chat-in')),'care team name in the sidebar starts a chat');

  /* ---- item 8: data explorer ---- */
  await p.click('#nav-data');const hasMap=await S(()=>!!(window.FHIRMAP&&FHIRMAP.toBundle));
  if(hasMap){ok((await p.$$('[data-a=dtype]')).length>3,'resource type chips with counts');ok(/GET \/Patient\/[^ ]+\/\$everything/.test(await p.textContent('.req')),'request shown for everything');
    for(const t of await p.$$eval('[data-a=dtype]',b=>b.map(x=>x.dataset.v))){await p.click(`[data-a=dtype][data-v="${t}"]`);const js=await p.textContent('#data-json');let good=true;try{JSON.parse(js);}catch(e){good=false;}ok(good,'JSON parses for '+t);
      if(t==='Patient')ok(/^GET \/Patient\/\S+$/.test((await p.textContent('.req')).trim()),'Patient request');
      if(t==='Observation'){ok(/GET \/Observation\?patient=/.test(await p.textContent('.req')),'Observation request');const sb=await p.$$eval('[data-a=dsub]',b=>b.map(x=>x.dataset.v).filter(Boolean));if(sb.length){await p.click(`[data-a=dsub][data-v="${sb[0]}"]`);ok(new RegExp('&category='+sb[0]).test(await p.textContent('.req')),'category filter in the request: '+sb[0]);}}
      await ov('data '+t);}
    await shot('data');await p.selectOption('#data-p','p3');ok(/Achterberg/.test(await p.textContent('#data-json')),'patient picker changes the bundle');
    await p.click('[data-a=dcopy]');await p.waitForTimeout(150);ok(/available separately/.test(await p.textContent('#work')),'data files line present');
    const n0=await S(()=>FHIRMAP.toBundle(LXSIM.state().P[2]).entry.length);await open('p3');await tab('orders');await order('Magnesium',{pri:'Immediate'});await p.click('[data-a=bsign]');await adv(11*60000);
    const n1=await S(()=>FHIRMAP.toBundle(LXSIM.state().P[2]).entry.length);ok(n1>n0,'bundle is built from the live chart: '+n0+' to '+n1+' entries after a new order and result');}
  else{ok(/data module is not loaded/.test(await p.textContent('#work')),'data screen degrades when the module is missing');console.log(name,'NOTE fhir-map.js not present; data explorer checked in its fallback state');}
  await ov('data');

  /* ---- clock keeps its hands off while typing; long run stays healthy ---- */
  await p.click('#btn-reset');await open('p1');await tab('notes');await p.click('[data-a=draft]');await p.fill('#nt-body','');await p.type('#nt-body','Seen on rounds. .vitals ');const tv=await p.inputValue('#nt-body');ok(/Vitals \(/.test(tv),'dot phrase still expands');
  await S(()=>LXSIM.pause(false));await p.click('#ck-speed');await p.waitForTimeout(2600);ok((await p.inputValue('#nt-body'))===tv,'note text survives while the clock runs at x60');await p.click('#ck-speed');await S(()=>LXSIM.pause(true));
  await p.click('[data-a=canceldraft]');await adv(26*3600000);ok(/^Wed 18 Nov/.test(await p.textContent('#clock')),'weekday follows the date after a day: '+await p.textContent('#clock'));
  for(const t of ['summary','flows','meds','results'])await tab(t),await ov('p1 '+t+' after 26 h');
  await tab('meds');ok(/18 Nov/.test(await p.textContent('.bar .muted')),'medication record follows the clock');
  for(const v of ['board','or','ed','work','home']){if(await p.isVisible('#nav-'+v)){await p.click('#nav-'+v);await ov(v+' after 26 h');}}
  await p.click('#btn-reset');
  await ctx.close();
}
/* ---- a missing optional file must not break the page ---- */
{const ctx=await browser.newContext({viewport:{width:1440,height:880}});const p=await ctx.newPage();p.setDefaultTimeout(8000);let pe=0;
  p.on('pageerror',e=>{pe++;pageErrs++;console.log('missing-file PAGE ERROR',e.message);});
  await p.route(/fhir-map\.js|patients\/p2[34]\.js/,r=>r.abort());
  await p.goto('file://'+D+'_preview.html');await p.waitForSelector('input[name=lg-role]');await p.check('input[name=lg-role][value="0"]');await p.check('input[name=lg-dept][value="Hospital medicine"]');await p.click('[data-a=loginok]');
  const n=await p.evaluate(()=>LXSIM.state().P.length);await p.click('#nav-data');const t=await p.textContent('#work');
  checks+=3;if(n<3){fails++;console.log('FAIL page did not load patients when optional files are missing');}
  if(!/data module is not loaded/.test(t)){fails++;console.log('FAIL data screen does not explain the missing module');}
  await p.click('#nav-home');await p.click('.aside [data-a=open]');if(!(await p.$('.pside'))||pe){fails++;console.log('FAIL chart does not open when optional files are missing');}
  console.log('missing-file pass:',n,'patients loaded without fhir-map.js, p23.js and p24.js');await ctx.close();}
await browser.close();
/* wording rules on the files that ship */
const src=['app.html','clinical-data.js','sim-images.js'].map(f=>fs.readFileSync(D+f,'utf8')).join('\n');
checks++;if(/Larkspur/.test(src.replace(/larkspur-practice-chart/g,''))){fails++;console.log('FAIL old product or hospital name still in shipped files');}
const banned=src.match(/\b(Epic|Cerner|Storyboard|In Basket|SmartPhrase|Hyperspace|Braden|Morse|NANDA|CPT|APACHE|CAM-ICU|RASS|PHQ|ESI|I-PASS)\b/g);
checks++;if(banned){fails++;console.log('FAIL banned words in shipped files:',[...new Set(banned)].join(', '));}
checks++;if(/\b(alert|confirm|prompt)\s*\(|window\.print|<iframe|download=/.test(src.replace(/class="alert"|\.alert\b|alertsFor|alerts\b/g,''))){fails++;console.log('FAIL native dialog, print, iframe or download found in source');}
if(missing.length)console.log('NOTE optional files not found (page still works):',missing.sort().join(', '));
console.log(`RESULT: ${checks} checks, ${fails} failed, ${errs} console errors, ${pageErrs} page errors, ${overflows} horizontal overflows`);
process.exit(fails||errs||pageErrs||overflows?1:0);
})().catch(e=>{console.log('TEST CRASHED',e.message.split('\n').slice(0,6).join(' | '));console.log(`RESULT: crashed after ${checks} checks, ${fails} failed, ${errs} console errors, ${pageErrs} page errors, ${overflows} horizontal overflows`);process.exit(2);});
