var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var NOW=new Date(2026,10,17,14,30);
function T(d,s,mo){var p=s.split(':');return new Date(2026,mo==null?10:mo,d,+p[0],+p[1]);}
function p2(n){return String(n).padStart(2,'0');}
function hm(d){return p2(d.getHours())+':'+p2(d.getMinutes());}
function dm(d){return d.getDate()+' '+MONTHS[d.getMonth()];}
function dt(d){return dm(d)+' '+hm(d);}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function grid(a,b,stepH){var o=[],t=a.getTime();while(t<=b.getTime()){o.push(new Date(t));t+=stepH*3600000;}return o;}
function gen(times,pts,noise,dec,rnd){return times.map(function(t){var x=t.getTime(),v=pts[0][1];
  if(x>=pts[pts.length-1][0].getTime())v=pts[pts.length-1][1];
  else for(var i=0;i<pts.length-1;i++){var a=pts[i][0].getTime(),b=pts[i+1][0].getTime();if(x>=a&&x<=b){v=pts[i][1]+(pts[i+1][1]-pts[i][1])*(x-a)/(b-a);break;}}
  v+=(rnd()-0.5)*2*noise;var m=Math.pow(10,dec);return Math.round(v*m)/m;});}
function G(t,st,by,note){return {t:t,st:st,by:by||'',note:note||''};}

/* ---------- synthetic patients ---------- */
function seed(){
var P=[];

/* ===== Patient 1: ICU, septic shock ===== */
(function(){
var r=rng(11),tt=grid(T(16,'14:00'),T(17,'14:00'),1);
var sb=gen(tt,[[T(16,'14:00'),92],[T(16,'22:00'),98],[T(17,'06:00'),106],[T(17,'14:00'),114]],4,0,r);
var db=gen(tt,[[T(16,'14:00'),50],[T(17,'06:00'),58],[T(17,'14:00'),63]],3,0,r);
var ne=gen(tt,[[T(16,'14:00'),0.12],[T(16,'20:00'),0.10],[T(17,'02:00'),0.08],[T(17,'06:00'),0.06],[T(17,'08:00'),0.05],[T(17,'10:00'),0.05],[T(17,'11:00'),0.04],[T(17,'14:00'),0.04]],0,2,r);
var RN='C. Adeyemi-Frost RN', RNn='M. Tanaka-Oduya RN';
P.push({id:'p1',name:'Okonkwo-Reyes, Harlan',age:68,sex:'M',dob:'03 Feb 1958',mrn:'LX-204471',unit:'Medical ICU',bed:'MICU-12',
 service:'Medical ICU',attending:'Dr. Imogen Varga',admit:T(15,'22:40'),code:'Full code',wt:'86 kg',ht:'178 cm',
 allergies:[['Penicillin','rash in childhood']],iso:'Standard precautions',
 dx:'Septic shock from pneumococcal pneumonia',
 problems:['Septic shock, weaning vasopressor','Right lower lobe pneumonia with Streptococcus pneumoniae bacteraemia','Acute hypoxaemic respiratory failure on high-flow nasal oxygen','Acute kidney injury (baseline creatinine 1.1 mg/dL)','Type 2 diabetes mellitus','COPD, former smoker (40 pack-years)','Hypertension (home lisinopril held)'],
 team:[['Attending','Dr. Imogen Varga'],['Resident','Dr. Tae-yang Brandt (PGY-2)'],['Nurse (day)',RN],['Pharmacist','Priya Lindqvist, PharmD'],['Respiratory therapist','J. Abernathy-Cole RRT']],
 events:[[T(15,'21:55'),'Arrived in emergency department by ambulance'],[T(15,'23:10'),'Blood cultures drawn; antibiotics started 23:50'],[T(16,'00:35'),'Mean arterial pressure below 65 after fluid; norepinephrine started'],[T(16,'01:45'),'Right internal jugular central line placed'],[T(16,'10:30'),'Blood cultures positive, 2 of 2 sets'],[T(17,'11:00'),'Norepinephrine down to 0.04 mcg/kg/min']],
 flows:[
  {name:'Vitals',chart:true,times:tt,rows:[
   {k:'temp',l:'Temperature',u:'°C',lo:36,hi:38,v:gen(tt,[[T(16,'14:00'),38.6],[T(16,'22:00'),38.1],[T(17,'06:00'),37.6],[T(17,'14:00'),37.3]],0.15,1,r)},
   {k:'hr',l:'Heart rate',u:'/min',lo:50,hi:100,v:gen(tt,[[T(16,'14:00'),114],[T(17,'02:00'),100],[T(17,'14:00'),88]],3,0,r)},
   {k:'rr',l:'Respiratory rate',u:'/min',lo:10,hi:22,v:gen(tt,[[T(16,'14:00'),27],[T(17,'02:00'),23],[T(17,'14:00'),19]],1.2,0,r)},
   {k:'bp',l:'Blood pressure',u:'mmHg',type:'bp',s:sb,d:db},
   {k:'map',l:'Mean arterial pressure',u:'mmHg',type:'map',lo:65,hi:110},
   {k:'spo2',l:'Oxygen saturation',u:'%',lo:92,hi:101,v:gen(tt,[[T(16,'14:00'),91],[T(16,'20:00'),93],[T(17,'14:00'),95.5]],0.8,0,r)},
   {k:'o2',l:'Oxygen delivery',v:tt.map(function(){return 'High-flow';})},
   {k:'pain',l:'Pain',u:'0–10',lo:-1,hi:6,v:gen(tt,[[T(16,'14:00'),3],[T(17,'14:00'),2]],0.9,0,r)}]},
  {name:'Haemodynamic and respiratory',times:tt,rows:[
   {l:'Norepinephrine',u:'mcg/kg/min',v:ne,dec:2},
   {l:'High-flow oxygen fraction',u:'FiO2',v:gen(tt,[[T(16,'14:00'),0.6],[T(16,'19:00'),0.6],[T(16,'20:00'),0.5],[T(17,'03:00'),0.5],[T(17,'04:00'),0.45],[T(17,'11:00'),0.45],[T(17,'12:00'),0.4],[T(17,'14:00'),0.4]],0,2,r),dec:2},
   {l:'High-flow rate',u:'L/min',v:gen(tt,[[T(16,'14:00'),50],[T(17,'09:00'),50],[T(17,'10:00'),40],[T(17,'14:00'),40]],0,0,r)},
   {l:'Urine output',u:'mL/h',lo:43,hi:999,v:gen(tt,[[T(16,'14:00'),22],[T(16,'22:00'),38],[T(17,'06:00'),58],[T(17,'14:00'),72]],6,0,r)},
   {l:'Glasgow Coma Scale',u:'3–15',lo:15,hi:16,v:tt.map(function(t){return t<T(16,'20:00')?14:15;})},
   {l:'Capillary refill',u:'s',lo:0,hi:3,v:gen(tt,[[T(16,'14:00'),4],[T(17,'00:00'),3],[T(17,'14:00'),2]],0,0,r)},
   {l:'Blood glucose (bedside)',u:'mg/dL',lo:70,hi:180,v:tt.map(function(t,i){return i%6===4?[196,171,158,162][Math.floor(i/6)]:'';})}]},
  {name:'Nursing assessment',cols:['16 Nov 08:00','16 Nov 20:00','17 Nov 08:00'],rows:[
   {l:'Neurological',v:['Drowsy, rouses to voice, oriented to person and place','Alert, oriented to person, place and time','Alert and oriented, follows commands, moves all limbs']},
   {l:'Respiratory',v:['Laboured, accessory muscle use, coarse crackles right base','Mildly laboured, crackles right base, productive rusty sputum','Unlaboured at rest, crackles right base, speaks full sentences']},
   {l:'Cardiovascular',v:['Sinus tachycardia, cool mottled knees, weak pedal pulses','Sinus tachycardia, warm, pulses 2+','Sinus rhythm, warm, pulses 2+, no oedema']},
   {l:'Gastrointestinal',v:['Nothing by mouth except sips with medicines, abdomen soft, bowel sounds hypoactive','Sips with meds, no nausea','Clear liquids tolerated, bowel sounds present']},
   {l:'Urinary',v:['Urinary catheter, dark amber, low volume','Catheter, amber, volume improving','Catheter, clear yellow, adequate volume']},
   {l:'Skin',v:['Intact; sacrum blanching redness','Intact; sacrum blanching redness, foam dressing on','Intact; sacrum unchanged, turned every 2 h']},
   {l:'Mobility',v:['Bed rest','Bed rest, turns with 2 assist','Dangled at bedside 10 min with 2 assist']},
   {l:'Fall risk',v:['High','High','High']},
   {l:'Delirium screen',v:['Unable to complete','Negative','Negative']}]},
  {name:'Intake and output',cols:['16 Nov day (07–19)','16 Nov night (19–07)','17 Nov day (07–14:30)'],unit:'mL',rows:[
   {l:'Intravenous fluids and infusions',v:[1420,980,610]},{l:'Intravenous antibiotics',v:[0,350,0]},{l:'Oral',v:[60,120,480]},
   {l:'Total in',sum:1,v:[1480,1450,1090]},{l:'Urine',v:[310,540,495]},{l:'Total out',sum:1,v:[310,540,495]},{l:'Net balance',sum:1,v:['+1,170','+910','+595']}]}],
 lines:[['Central venous catheter, triple lumen','Right internal jugular','16 Nov 01:45','Dressing dry and intact, day 2'],['Arterial line','Left radial','16 Nov 02:20','Good waveform'],['Peripheral IV, 18 gauge','Left forearm','15 Nov 22:05','Patent, no redness'],['Urinary catheter, 16 Fr','Urethral','15 Nov 23:30','Review need daily']],
 labs:[
  {panel:'Chemistry',times:[T(15,'23:05'),T(16,'04:30'),T(16,'16:20'),T(17,'04:40')],rows:[
   ['Sodium','mmol/L',135,145,[133,134,136,138]],['Potassium','mmol/L',3.5,5.1,[4.9,4.6,4.1,3.9]],['Chloride','mmol/L',98,107,[99,102,104,105]],['Bicarbonate','mmol/L',22,29,[17,18,21,23]],
   ['Urea nitrogen','mg/dL',7,20,[38,44,41,34]],['Creatinine','mg/dL',0.7,1.3,[2.3,2.4,2.0,1.7]],['Glucose','mg/dL',70,140,[248,196,172,154]],['Calcium','mg/dL',8.6,10.2,[8.1,7.9,8.0,8.2]],
   ['Magnesium','mg/dL',1.7,2.4,[1.6,1.9,2.0,2.1]],['Phosphate','mg/dL',2.5,4.5,[2.4,2.2,2.6,2.9]]]},
  {panel:'Blood count',times:[T(15,'23:05'),T(16,'04:30'),T(16,'16:20'),T(17,'04:40')],rows:[
   ['White cells','×10⁹/L',4,11,[19.4,21.1,16.2,12.8]],['Haemoglobin','g/dL',13.5,17.5,[13.1,11.9,11.4,11.2]],['Platelets','×10⁹/L',150,400,[168,141,132,139]]]},
  {panel:'Blood gas and sepsis markers',times:[T(15,'23:05'),T(16,'02:10'),T(16,'08:15'),T(16,'16:20'),T(17,'04:40')],rows:[
   ['Lactate','mmol/L',0.5,2,[4.6,3.9,3.1,2.2,1.4]],['Arterial pH','',7.35,7.45,[null,7.31,null,null,7.38]],['Arterial pCO2','mmHg',35,45,[null,34,null,null,38]],['Arterial pO2','mmHg',80,100,[null,62,null,null,78]],
   ['Procalcitonin','ng/mL',0,0.5,[18.4,null,null,null,9.7]]]}],
 micro:[
  {title:'Blood culture, 2 sets',t:T(15,'23:10'),status:'Final',by:'Microbiology',body:'Gram stain (16 Nov 10:30): gram-positive cocci in pairs, aerobic and anaerobic bottles, 2 of 2 sets.\n\nOrganism: Streptococcus pneumoniae.\n\nSusceptibility: penicillin susceptible (MIC 0.03 mcg/mL); ceftriaxone susceptible; levofloxacin susceptible; vancomycin susceptible.'},
  {title:'Sputum culture',t:T(16,'03:00'),status:'Final',by:'Microbiology',body:'Acceptable specimen (more than 25 neutrophils, fewer than 10 epithelial cells per low-power field).\nModerate growth Streptococcus pneumoniae. Normal respiratory flora also present.'},
  {title:'Urine antigens and respiratory viral panel',t:T(16,'00:15'),status:'Final',by:'Microbiology',body:'Pneumococcal urinary antigen: POSITIVE.\nLegionella urinary antigen: negative.\nRespiratory viral panel (influenza A/B, RSV, SARS-CoV-2): not detected.\nMRSA nasal screen: negative.'}],
 imaging:[
  {title:'Chest X-ray, portable',t:T(17,'05:10'),status:'Final',by:'Dr. Wren Halloran, Radiology',body:'Comparison: 16 Nov 02:05.\n\nFindings: Right internal jugular catheter tip at the cavoatrial junction. Dense right lower lobe consolidation, unchanged. Small right pleural effusion, unchanged. Left lung clear. No pneumothorax. Heart size normal.\n\nImpression: Stable right lower lobe pneumonia with small parapneumonic effusion. Line in good position.'},
  {title:'Chest X-ray, portable',t:T(16,'02:05'),status:'Final',by:'Dr. Wren Halloran, Radiology',body:'Indication: position of new central venous catheter.\n\nComparison: 15 Nov 23:20.\n\nFindings: Right internal jugular catheter with its tip at the cavoatrial junction. No pneumothorax. Right lower lobe consolidation and small right pleural effusion, unchanged. Left lung clear.\n\nImpression: Central line in good position, no pneumothorax. Unchanged right lower lobe pneumonia.'},
  {title:'Bedside echocardiogram (focused)',t:T(16,'02:40'),status:'Final',by:'Dr. Tae-yang Brandt',body:'Hyperdynamic left ventricle, estimated ejection fraction 65 to 70%. Right ventricle normal size. No pericardial effusion. Inferior vena cava small and collapsing more than 50% with inspiration.\n\nImpression: Findings fit distributive shock. No evidence of cardiogenic cause.'},
  {title:'Chest X-ray, portable',t:T(15,'23:20'),status:'Final',by:'Dr. Wren Halloran, Radiology',body:'Findings: Consolidation in the right lower lobe with air bronchograms. Small right pleural effusion. Hyperinflated lungs. Heart size normal.\n\nImpression: Right lower lobe pneumonia with small effusion.'}],
 path:[],
 meds:[
  {name:'Norepinephrine infusion',sig:'16 mg in 250 mL · titrate to mean arterial pressure 65 or above · central line',type:'inf',rate:'0.04 mcg/kg/min (3.2 mL/h)',note:'Last change 17 Nov 11:00, down from 0.05',ordered:T(16,'00:40')},
  {name:'Ceftriaxone 2 g',sig:'Intravenous · every 24 hours',a:[G(T(15,'23:50'),'given','ED nurse'),G(T(16,'23:45'),'given',RNn),G(T(17,'23:45'),'due')],ordered:T(15,'23:30')},
  {name:'Azithromycin 500 mg',sig:'Intravenous · every 24 hours',a:[G(T(16,'00:20'),'given','ED nurse'),G(T(17,'00:15'),'given',RNn),G(T(18,'00:15'),'due')],ordered:T(15,'23:30')},
  {name:'Heparin 5,000 units',sig:'Subcutaneous · every 8 hours',a:[G(T(16,'22:04'),'given',RNn),G(T(17,'06:01'),'given',RNn),G(T(17,'14:00'),'due'),G(T(17,'22:00'),'due')],ordered:T(16,'01:20')},
  {name:'Ipratropium-albuterol nebuliser',sig:'Inhaled · every 6 hours',a:[G(T(17,'02:08'),'given','Resp. therapy'),G(T(17,'08:03'),'given','Resp. therapy'),G(T(17,'14:00'),'due'),G(T(17,'20:00'),'due')],ordered:T(16,'01:20')},
  {name:'Insulin regular, correction scale',sig:'Subcutaneous · every 6 hours with bedside glucose',a:[G(T(17,'00:10'),'given',RNn,'2 units for glucose 171'),G(T(17,'06:05'),'given',RNn,'2 units for glucose 158'),G(T(17,'12:08'),'given',RN,'2 units for glucose 162'),G(T(17,'18:00'),'due')],ordered:T(16,'01:20')},
  {name:'Pantoprazole 40 mg',sig:'Intravenous · daily',a:[G(T(16,'09:10'),'given',RN),G(T(17,'09:04'),'given',RN),G(T(18,'09:00'),'due')],ordered:T(16,'01:20')},
  {name:'Metformin 1,000 mg',sig:'Oral · twice daily · continued from home list',a:[G(T(16,'08:12'),'given',RN),G(T(16,'18:00'),'held',RN,'On vasopressor, lactate raised. Doctor told.'),G(T(17,'08:00'),'held',RN,'Kidney function still reduced. Doctor told.'),G(T(17,'18:00'),'due')],ordered:T(16,'01:20')},
  {name:'Acetaminophen 650 mg',sig:'Oral · every 6 hours as needed for fever or pain',type:'prn',a:[G(T(16,'15:10'),'given',RN,'Temp 38.6'),G(T(16,'22:30'),'given',RNn,'Temp 38.2'),G(T(17,'05:40'),'given',RNn,'Pain 4')],ordered:T(16,'01:20')}],
 orders:[['Nursing','Admit to Medical ICU, continuous monitoring','Active',T(16,'00:50')],['Nursing','High-flow nasal oxygen, titrate to saturation 92% or above','Active',T(16,'00:50')],['Medication','Lactated Ringer’s 30 mL/kg (2,580 mL) intravenous bolus','Completed',T(15,'22:20')],['Medication','Lisinopril 10 mg oral daily — HOLD','On hold',T(16,'01:20')],
  ['Laboratory','Blood cultures, 2 sets','Completed',T(15,'23:00')],['Laboratory','Lactate every 6 hours until below 2','Completed',T(15,'23:00')],['Laboratory','Chemistry and blood count, every morning','Active',T(16,'01:20')],['Imaging','Chest X-ray portable, morning','Completed',T(16,'20:00')],
  ['Nursing','Strict intake and output, hourly urine','Active',T(16,'00:50')],['Diet','Clear liquids, advance as tolerated','Active',T(17,'07:40')],['Consult','Physical therapy evaluation','Pending',T(17,'08:45')],['Medication','Lactated Ringer’s 75 mL/h intravenous maintenance','Active',T(16,'01:20')]],
 alerts:{pip:'Allergy on file: penicillin (rash in childhood). Piperacillin is a penicillin.',ct:'Creatinine 1.7 mg/dL and recent kidney injury. Confirm the need for contrast.',kcl:'Latest potassium is 3.9 mmol/L (in range).'},
 notes:[
  {type:'Progress note',title:'ICU progress note, day 2',by:'Dr. Tae-yang Brandt, PGY-2',t:T(17,'08:30'),body:'Overnight: No acute events. Vasopressor requirement falling. Temperature below 38 since 03:00.\n\nSubjective: Feels less short of breath. Cough productive of rust-coloured sputum. Mild right-sided pleuritic pain, controlled.\n\nObjective: Temp 37.6, heart rate 92, blood pressure 108/60 (MAP 76) on norepinephrine 0.10 mcg/kg/min, respiratory rate 20, saturation 95% on high-flow 45% at 50 L/min.\nAlert and oriented. Crackles and bronchial breathing right base. Warm peripheries, capillary refill 2 seconds. Abdomen soft. Urine 55 to 65 mL/h.\nLabs: white cells 12.8 (from 16.2), creatinine 1.7 (from 2.0), lactate 1.4, procalcitonin 9.7 (from 18.4). Blood cultures: S. pneumoniae, penicillin susceptible.\n\nAssessment and plan: 68-year-old man with septic shock from pneumococcal pneumonia and bacteraemia, improving.\n1. Shock: wean norepinephrine to off today, MAP goal 65. No further boluses; net positive 2.1 L over the last 24 hours on top of the 2.6 L given in the emergency department. Stop maintenance fluid once drinking well.\n2. Pneumonia and bacteraemia: continue ceftriaxone, plan 7 days from first negative culture. Stop azithromycin after dose 3 (Legionella antigen negative). Repeat blood cultures today.\n3. Respiratory failure: wean high-flow as tolerated, nebulisers, incentive spirometer.\n4. Kidney injury: improving with perfusion. Avoid nephrotoxins, renally dose medications.\n5. Diabetes: correction insulin, glucose 150 to 180.\n6. Prophylaxis: heparin, pantoprazole while on vasopressor.\n7. Lines: review central line and urinary catheter daily. Aim to remove arterial line once off vasopressor.\nDisposition: ICU today. Family (wife, Adaeze) updated at bedside.\n\nSeen and discussed with Dr. Varga.'},
  {type:'Nursing note',title:'Night shift summary',by:'M. Tanaka-Oduya RN',t:T(17,'07:10'),body:'Slept in short intervals. Oriented throughout, delirium screen negative. Norepinephrine weaned from 0.10 to 0.06 overnight, MAP 64 to 76. High-flow oxygen 50 L/min, FiO2 down to 0.45 at 04:00. Coughing well with encouragement, sputum rust-coloured, sent yesterday.\nUrine 540 mL for the shift, clearing. Bedside glucose 171 and 158, 2 units given each time.\nMetformin not given yesterday evening, see medication record. Asked the resident whether the order should stay active.\nSacrum: blanching redness, foam dressing in place, turned every 2 hours. Wife phoned at 21:30 and was updated.\nAcetaminophen at 05:40 for pleuritic pain 4/10, down to 2/10 at 06:30.'},
  {type:'Pharmacy note',title:'Antibiotic and allergy review',by:'Priya Lindqvist, PharmD',t:T(16,'09:20'),body:'Allergy history taken from patient’s wife: penicillin as a child, flat itchy rash on the trunk, no swelling, breathing difficulty or hospital visit. He has taken cephalexin as an adult without a reaction.\n\nAssessment: low-risk, non-severe penicillin history. Third-generation cephalosporins have a different side chain and very low cross-reactivity. Ceftriaxone is appropriate; the first dose was tolerated without a reaction.\n\nRenal dosing: creatinine 2.4 mg/dL. Ceftriaxone and azithromycin need no adjustment. Heparin preferred over enoxaparin for now.\n\nRecommendations: continue ceftriaxone. Review home medication list for drugs to hold in kidney injury.'},
  {type:'Procedure note',title:'Central venous catheter placement',by:'Dr. Tae-yang Brandt, PGY-2',t:T(16,'01:45'),body:'Indication: vasopressor requirement.\nConsent: emergency, discussed with wife by phone.\nSite: right internal jugular vein, ultrasound guided.\nTechnique: full barrier precautions, chlorhexidine skin preparation, 1% lidocaine. Single pass, wire confirmed in vein on ultrasound in two views. Triple-lumen 7 Fr catheter placed to 15 cm, all ports aspirate and flush. Sutured, chlorhexidine dressing applied.\nComplications: none. Estimated blood loss under 5 mL.\nChest X-ray ordered for position.\nSupervised by Dr. Varga, present for the procedure.'},
  {type:'History and physical',title:'ICU admission history and physical',by:'Dr. Tae-yang Brandt, PGY-2',t:T(16,'01:10'),body:'Chief complaint: fever, cough and breathlessness for 3 days.\n\nHistory: 68-year-old man with type 2 diabetes, COPD and hypertension. Three days of productive cough with rust-coloured sputum, rigors and right-sided chest pain on breathing. Today confused and too weak to stand, wife called an ambulance. In the emergency department: temp 39.4, heart rate 128, blood pressure 84/46, respiratory rate 32, saturation 84% on room air. Lactate 4.6. Received 2,580 mL lactated Ringer’s and antibiotics. Blood pressure fell again after fluid; norepinephrine started at 00:40.\n\nPast history: type 2 diabetes (HbA1c 7.9% in August), COPD, hypertension. No previous ICU stays.\nMedications at home: metformin 1,000 mg twice daily, lisinopril 10 mg daily, tiotropium inhaler daily, albuterol as needed.\nAllergies: penicillin (childhood rash).\nSocial: retired bus mechanic, lives with wife. Stopped smoking 2019. Rare alcohol.\n\nExamination: drowsy but rousable, oriented to person and place. Laboured breathing. Bronchial breath sounds and crackles right base. Tachycardic, no murmurs. Cool knees with mottling. Abdomen soft.\n\nResults: white cells 19.4, creatinine 2.3 (baseline 1.1), bicarbonate 17, glucose 248. Chest X-ray: right lower lobe consolidation.\n\nAssessment: septic shock from community-acquired pneumonia, with acute hypoxaemic respiratory failure and acute kidney injury.\n\nPlan: norepinephrine for MAP 65 or above, central and arterial lines. Ceftriaxone and azithromycin. High-flow oxygen; low threshold to intubate. Lactate every 6 hours. Hold lisinopril. Correction insulin. Heparin prophylaxis. Full code, confirmed with wife.'},
  {type:'Emergency note',title:'Emergency department provider note',by:'Dr. Leocadia Mwangi-Stone',t:T(16,'00:10'),body:'68-year-old man brought by ambulance with fever, cough and confusion. Triage 21:55: temp 39.4, heart rate 128, blood pressure 84/46, respiratory rate 32, saturation 84% on room air, improved to 91% on 15 L non-rebreather.\n\nSepsis pathway started 22:05. Two large-bore IVs. Lactate 4.6. Cultures drawn 23:10 before antibiotics. Fluid bolus 30 mL/kg running. Ceftriaxone given 23:50; azithromycin to follow.\n\nChest X-ray: right lower lobe pneumonia. ECG: sinus tachycardia, no ischaemic change.\n\nBlood pressure 96/52 after 1.5 L. ICU consulted and accepted. Wife at bedside and aware of plan.'}],
 key:[
  ['time','Shock onset time','True onset of shock: 16 Nov 00:35, the first mean arterial pressure below 65 after the fluid bolus had finished. The diagnosis first appears in a note at 01:10. An early-warning model can be scored against the 00:35 timestamp.','Summary timeline; admission history'],
  ['err','Metformin left active in kidney injury and shock','The home metformin order was carried over at admission. One dose was given on 16 Nov 08:12 with creatinine 2.4 and lactate 3.1. Nurses have held it since, but the order is still active and due again at 18:00.','Medications; Orders; night nursing note'],
  ['doc','Progress note carries forward an old vasopressor rate','The 17 Nov 08:30 progress note records norepinephrine at 0.10 mcg/kg/min. The flowsheet shows 0.05 at 08:00 (0.10 was the rate at 20:00 the evening before).','Notes; Flowsheets, haemodynamic group'],
  ['dis','Distractor: cephalosporin with a penicillin allergy','Ceftriaxone given despite a listed penicillin allergy is deliberate and correct. The pharmacy note documents a low-risk history and prior cephalexin tolerance. A tool that flags this as an error is over-alerting.','Pharmacy note']]
});})();

/* ===== Patient 2: surgical ward, post-op colectomy ===== */
(function(){
var r=rng(23),tt=grid(T(15,'12:00'),T(17,'12:00'),4);
var RN='D. Halvorsen RN', RNn='S. Okpara-Lindgren RN';
P.push({id:'p2',name:'Vandekamp, Marisol',age:57,sex:'F',dob:'22 Aug 1969',mrn:'LX-311905',unit:'6 West Surgery',bed:'6W-21',
 service:'Colorectal Surgery',attending:'Dr. Anselm Okafor-Lindh',admit:T(15,'05:45'),code:'Full code',wt:'71 kg',ht:'165 cm',
 allergies:[['Latex','contact rash'],['Codeine','nausea and vomiting']],iso:'Standard precautions',
 dx:'Colon cancer, day 2 after laparoscopic right hemicolectomy',
 problems:['Adenocarcinoma of ascending colon, pT3 N1a, after right hemicolectomy 15 Nov','Postoperative ileus','Postoperative anaemia (haemoglobin 9.1 from 11.8 g/dL)','Low urine output overnight, improved after fluid bolus','Hypothyroidism','Hyperlipidaemia'],
 team:[['Attending surgeon','Dr. Anselm Okafor-Lindh'],['Resident','Dr. Brigid Castellanos (PGY-3)'],['Nurse (day)',RN],['Oncology','Dr. Yusra Feldkamp'],['Case manager','T. Rasmussen-Ibe']],
 events:[[T(15,'07:52'),'Incision: laparoscopic right hemicolectomy'],[T(15,'10:41'),'Out of operating room to recovery'],[T(15,'13:20'),'Arrived on 6 West'],[T(16,'08:10'),'Urinary catheter removed'],[T(16,'19:40'),'Vomited 150 mL; diet back to sips'],[T(17,'03:30'),'Low urine output, 500 mL fluid bolus given'],[T(17,'11:05'),'Final pathology signed out']],
 flows:[
  {name:'Vitals',chart:true,times:tt,rows:[
   {k:'temp',l:'Temperature',u:'°C',lo:36,hi:38,v:gen(tt,[[T(15,'12:00'),36.4],[T(16,'08:00'),37.2],[T(16,'20:00'),38.1],[T(17,'12:00'),37.5]],0.1,1,r)},
   {k:'hr',l:'Heart rate',u:'/min',lo:50,hi:100,v:gen(tt,[[T(15,'12:00'),76],[T(16,'08:00'),88],[T(16,'20:00'),105],[T(17,'04:00'),106],[T(17,'12:00'),95]],2,0,r)},
   {k:'rr',l:'Respiratory rate',u:'/min',lo:10,hi:22,v:gen(tt,[[T(15,'12:00'),14],[T(17,'12:00'),18]],1,0,r)},
   {k:'bp',l:'Blood pressure',u:'mmHg',type:'bp',s:gen(tt,[[T(15,'12:00'),126],[T(16,'20:00'),112],[T(17,'04:00'),102],[T(17,'12:00'),114]],3,0,r),d:gen(tt,[[T(15,'12:00'),74],[T(17,'04:00'),60],[T(17,'12:00'),68]],2,0,r)},
   {k:'map',l:'Mean arterial pressure',u:'mmHg',type:'map',lo:65,hi:110},
   {k:'spo2',l:'Oxygen saturation',u:'%',lo:92,hi:101,v:gen(tt,[[T(15,'12:00'),97],[T(17,'12:00'),96]],0.8,0,r)},
   {k:'o2',l:'Oxygen delivery',v:tt.map(function(t){return t<T(16,'00:00')?'2 L nasal':'Room air';})},
   {k:'pain',l:'Pain',u:'0–10',lo:-1,hi:6,v:gen(tt,[[T(15,'12:00'),7],[T(15,'20:00'),5],[T(16,'12:00'),4],[T(17,'12:00'),3]],0.6,0,r)}]},
  {name:'Surgical recovery',times:tt,rows:[
   {l:'Urine output (previous 4 h)',u:'mL',lo:140,hi:9999,v:[340,250,250,190,150,160,170,150,130,70,60,160,220]},
   {l:'Nausea',u:'0–10',lo:-1,hi:5,v:[2,1,1,0,1,2,3,5,6,5,4,4,2]},
   {l:'Bowel sounds',v:['Absent','Absent','Hypoactive','Hypoactive','Hypoactive','Hypoactive','Hypoactive','Hypoactive','Absent','Hypoactive','Hypoactive','Hypoactive','Hypoactive']},
   {l:'Passing gas',v:['No','No','No','No','No','No','No','No','No','No','No','No','No']},
   {l:'Abdomen',v:['Soft','Soft','Soft','Soft','Soft','Soft','Soft','Mildly distended','Distended','Distended','Distended','Distended','Mildly distended']},
   {l:'Incisions',v:['Dry, intact','Dry, intact','Dry, intact','','Dry, intact','','Dry, intact','','Dry, intact','','','Dry, intact','Dry, intact']},
   {l:'Walking',v:['','Chair 20 min','','','','Hall 30 m','Hall 60 m','Chair only','','','','Hall 40 m','Hall 80 m']},
   {l:'Pain pump demands / doses',v:['','9 / 6','7 / 5','5 / 4','6 / 5','6 / 5','5 / 4','8 / 5','6 / 4','4 / 3','3 / 3','4 / 3','3 / 2']}]},
  {name:'Nursing assessment',cols:['15 Nov 20:00','16 Nov 08:00','16 Nov 20:00','17 Nov 08:00'],rows:[
   {l:'Neurological',v:['Sleepy, easily roused, oriented','Alert and oriented','Alert and oriented, tired','Alert and oriented']},
   {l:'Respiratory',v:['Shallow, clear, 2 L oxygen','Clear, room air, spirometer 1,000 mL','Diminished bases, spirometer 900 mL','Diminished bases, spirometer 1,250 mL']},
   {l:'Cardiovascular',v:['Regular, pulses 2+','Regular, no oedema','Tachycardic 105, regular','Tachycardic 96 to 106, regular']},
   {l:'Gastrointestinal',v:['No bowel sounds, sips of water','Hypoactive, clear liquids','Vomited 150 mL at 19:40, distended','Distended, nausea 4/10, no gas passed, sips only']},
   {l:'Urinary',v:['Catheter, clear yellow','Catheter out 08:10','Voiding, small amounts','Voiding better since bolus']},
   {l:'Skin and wounds',v:['4 port sites and 6 cm extraction site, glue, dry','Unchanged, no redness','Unchanged','Unchanged, mild bruising at extraction site']},
   {l:'Mobility',v:['Chair with 1 assist','Hall with walker and 1 assist','Chair only, nauseated','Hall with standby assist']},
   {l:'Fall risk',v:['High','Moderate','Moderate','Moderate']}]},
  {name:'Intake and output',cols:['15 Nov day (theatre to 19)','15 Nov night','16 Nov day','16 Nov night','17 Nov day (to 14:30)'],unit:'mL',rows:[
   {l:'Intravenous fluids',v:[2650,900,900,1400,860]},{l:'Oral',v:[0,60,350,200,150]},{l:'Total in',sum:1,v:[2650,960,1250,1600,1010]},
   {l:'Urine',v:[780,520,460,280,410]},{l:'Vomit',v:[0,0,0,350,0]},{l:'Blood loss in theatre',v:[150,0,0,0,0]},{l:'Total out',sum:1,v:[930,520,460,630,410]},{l:'Net balance',sum:1,v:['+1,720','+440','+790','+970','+600']}]}],
 lines:[['Peripheral IV, 20 gauge','Right forearm','15 Nov 06:30','Patent'],['Peripheral IV, 18 gauge','Left hand','15 Nov 07:40','Patent, pain pump attached'],['Urinary catheter','Urethral','15 Nov 07:45','Removed 16 Nov 08:10'],['Surgical incisions','4 laparoscopic ports, 6 cm periumbilical extraction site','15 Nov','Skin glue, dry and intact']],
 labs:[
  {panel:'Blood count',times:[T(10,'09:15'),T(15,'12:30'),T(16,'05:10'),T(17,'05:20')],rows:[
   ['Haemoglobin','g/dL',12,16,[11.8,10.9,9.6,9.1]],['White cells','×10⁹/L',4,11,[6.9,11.8,13.4,12.1]],['Platelets','×10⁹/L',150,400,[312,288,265,271]]]},
  {panel:'Chemistry',times:[T(10,'09:15'),T(15,'12:30'),T(16,'05:10'),T(17,'05:20')],rows:[
   ['Sodium','mmol/L',135,145,[139,138,136,135]],['Potassium','mmol/L',3.5,5.1,[4.2,4.0,3.7,3.4]],['Chloride','mmol/L',98,107,[103,104,103,101]],['Bicarbonate','mmol/L',22,29,[25,23,24,26]],
   ['Urea nitrogen','mg/dL',7,20,[14,13,17,21]],['Creatinine','mg/dL',0.5,1.1,[0.78,0.81,0.94,1.08]],['Glucose','mg/dL',70,140,[96,142,128,109]],['Magnesium','mg/dL',1.7,2.4,[2.0,null,1.7,1.6]],['Phosphate','mg/dL',2.5,4.5,[null,null,2.9,2.3]]]},
  {panel:'Tumour marker',times:[T(10,'09:15')],rows:[['Carcinoembryonic antigen','ng/mL',0,3,[6.8]]]}],
 micro:[],
 imaging:[
  {title:'Abdominal X-ray, 2 views',t:T(17,'09:40'),status:'Final',by:'Dr. Wren Halloran, Radiology',body:'Indication: distension and vomiting, day 2 after right hemicolectomy.\n\nFindings: Several mildly dilated small bowel loops up to 3.4 cm with air-fluid levels. Gas present in the transverse and descending colon and in the rectum. No free air beyond that expected after laparoscopy. Staple line in the right mid-abdomen.\n\nImpression: Pattern fits postoperative ileus. No evidence of obstruction or perforation.'},
  {title:'CT chest, abdomen and pelvis with contrast (staging)',t:T(30,'14:20',9),status:'Final',by:'Dr. Casimir Adeleke, Radiology',body:'Findings: 4.2 cm circumferential mass in the ascending colon with mild pericolic fat stranding. Three pericolic lymph nodes up to 8 mm. Liver: no focal lesion. Lungs clear. No ascites or peritoneal nodules.\n\nImpression: Ascending colon primary with small regional nodes. No distant metastasis.'}],
 path:[
  {title:'Surgical pathology S26-48817: right hemicolectomy',t:T(17,'11:05'),status:'Final',by:'Dr. Oluwaseun Brathwaite, Pathology',body:'FINAL DIAGNOSIS\nRight colon and terminal ileum, hemicolectomy:\n- Invasive adenocarcinoma, moderately differentiated, 4.5 cm, ascending colon.\n- Tumour invades through the muscularis propria into pericolonic tissue (pT3).\n- Proximal, distal and radial margins negative. Closest margin: radial, 2.2 cm.\n- Lymphovascular invasion: present. Perineural invasion: not identified.\n- Lymph nodes: 1 of 22 involved (pN1a). Tumour deposits: absent.\n- Appendix: no tumour.\n\nPathological stage: pT3 pN1a (stage IIIB).\n\nMismatch repair proteins by immunohistochemistry: MLH1, PMS2, MSH2 and MSH6 all show intact nuclear expression.\n\nGROSS DESCRIPTION\nReceived fresh, labelled with the patient’s name and "right colon": 24 cm of right colon with 6 cm of terminal ileum and attached appendix. A 4.5 × 3.8 cm ulcerated mass with raised edges lies 7 cm from the ileocaecal valve and involves about 70% of the circumference. On section the tumour extends into pericolic fat to a depth of 0.4 cm. Twenty-two lymph nodes found, up to 1.1 cm.\n\nMICROSCOPIC DESCRIPTION\nGlands of irregular shape lined by crowded columnar cells with enlarged nuclei, infiltrating beyond the muscle wall with a fibrous reaction. One node is largely replaced by tumour.'}],
 meds:[
  {name:'Hydromorphone pain pump',sig:'0.2 mg per demand · 6-minute lockout · no background rate',type:'inf',rate:'1.8 mg used in last 12 h',note:'Plan: change to oral pain relief when tolerating liquids',ordered:T(15,'11:00')},
  {name:'Lactated Ringer’s',sig:'Intravenous · continuous',type:'inf',rate:'75 mL/h',note:'500 mL bolus given 17 Nov 03:30',ordered:T(15,'11:00')},
  {name:'Enoxaparin 40 mg',sig:'Subcutaneous · daily at 21:00',a:[G(T(15,'21:10'),'given',RNn),G(T(16,'21:05'),'given',RNn),G(T(17,'21:00'),'due')],ordered:T(15,'11:00')},
  {name:'Heparin 5,000 units',sig:'Subcutaneous · every 8 hours',a:[G(T(16,'06:12'),'given',RNn),G(T(16,'14:10'),'given',RN),G(T(16,'22:02'),'given',RNn),G(T(17,'06:08'),'given',RNn),G(T(17,'14:00'),'due'),G(T(17,'22:00'),'due')],ordered:T(16,'05:50')},
  {name:'Acetaminophen 1,000 mg',sig:'Oral · every 6 hours',a:[G(T(17,'00:05'),'given',RNn),G(T(17,'06:08'),'given',RNn),G(T(17,'12:04'),'given',RN),G(T(17,'18:00'),'due')],ordered:T(15,'11:00')},
  {name:'Ketorolac 15 mg',sig:'Intravenous · every 6 hours · 8 doses',a:[G(T(17,'00:05'),'given',RNn),G(T(17,'06:10'),'given',RNn,'Dose 8 of 8, course complete')],ordered:T(15,'11:00')},
  {name:'Levothyroxine 88 mcg',sig:'Oral · daily at 06:00',a:[G(T(16,'06:02'),'given',RNn),G(T(17,'06:08'),'given',RNn),G(T(18,'06:00'),'due')],ordered:T(15,'11:00')},
  {name:'Atorvastatin 20 mg',sig:'Oral · nightly',a:[G(T(16,'21:05'),'held',RNn,'Vomiting, sips only'),G(T(17,'21:00'),'due')],ordered:T(15,'11:00')},
  {name:'Ondansetron 4 mg',sig:'Intravenous · every 6 hours as needed for nausea',type:'prn',a:[G(T(16,'19:45'),'given',RNn,'Vomited 150 mL'),G(T(17,'01:50'),'given',RNn,'Vomited 200 mL at 01:15, nausea 6/10'),G(T(17,'07:55'),'given',RN,'Nausea 5/10')],ordered:T(15,'11:00')}],
 orders:[['Nursing','Admit to 6 West after recovery, vitals every 4 hours','Active',T(15,'11:00')],['Diet','Sips of clear liquid only','Active',T(16,'20:10')],['Nursing','Walk in hall at least 3 times a day','Active',T(15,'11:00')],['Nursing','Incentive spirometer 10 breaths every hour while awake','Active',T(15,'11:00')],
  ['Nursing','Remove urinary catheter morning of day 1','Completed',T(15,'11:00')],['Medication','Lactated Ringer’s 500 mL intravenous bolus','Completed',T(17,'03:25')],['Laboratory','Blood count and chemistry, every morning','Active',T(15,'11:00')],['Imaging','Abdominal X-ray, 2 views','Completed',T(17,'07:00')],
  ['Consult','Medical oncology','Completed',T(16,'09:00')],['Laboratory','Magnesium and phosphate, add to morning bloods','Active',T(15,'17:30')],['Medication','Potassium chloride 20 mEq in 250 mL and magnesium sulfate 2 g in 50 mL, intravenous, once each','Completed',T(17,'07:10')]],
 alerts:{pip:'No infection is documented. Check the indication before starting a broad-spectrum antibiotic.',ct:'Creatinine has risen from 0.78 to 1.08 mg/dL. Confirm the need for contrast.',hep:'Enoxaparin and subcutaneous heparin are already both active.'},
 notes:[
  {type:'Consult',title:'Medical oncology consult',by:'Dr. Yusra Feldkamp',t:T(17,'13:10'),body:'Reason: newly resected colon cancer, adjuvant treatment planning.\n\nHistory: 57-year-old woman found to have iron-deficiency anaemia in September. Colonoscopy 21 Oct: ulcerated mass in the ascending colon, biopsy adenocarcinoma. Staging CT 30 Oct: no distant disease. CEA 6.8 before surgery. Laparoscopic right hemicolectomy 15 Nov.\n\nPathology (final today): moderately differentiated adenocarcinoma, 4.5 cm, pT3, 1 of 22 nodes positive (pN1a), margins clear, lymphovascular invasion present, mismatch repair proteins intact.\n\nFamily history: father had colon cancer at 71. No other cancers known.\n\nAssessment: stage IIIB colon cancer, mismatch-repair proficient. Low-risk stage III group (T3 N1).\n\nRecommendations:\n1. Adjuvant chemotherapy is advised. I discussed 3 months of capecitabine with oxaliplatin as the preferred option, starting 4 to 8 weeks after surgery once she is eating and wounds have healed. She would like to proceed.\n2. Repeat CEA at the first clinic visit.\n3. Genetics referral given her age and father’s history, although intact mismatch repair makes Lynch syndrome unlikely.\n4. Clinic appointment in 3 weeks; my office will arrange.\n5. No oncology barriers to discharge when surgically ready.\n\nThank you for involving me in her care.'},
  {type:'Nursing note',title:'Night shift summary',by:'S. Okpara-Lindgren RN',t:T(17,'07:05'),body:'Uncomfortable night. Abdomen more distended, nausea 4 to 6 out of 10. Vomited 150 mL at 19:40 at the start of the shift and 200 mL green fluid at 01:15; ondansetron given both times. No gas passed. Sips only.\nUrine 70 mL from 20:00 to midnight and 60 mL from midnight to 04:00, heart rate 106, blood pressure 102/60. Resident called 03:20: 500 mL bolus given, urine picked up afterwards.\nPain 3 to 4 with the pump. Walked to the door and back once, limited by nausea.\nQuestion for the day team: enoxaparin was given at 21:05 and the medication record also has heparin three times a day. I gave the 06:08 heparin as ordered. Please confirm both are intended.'},
  {type:'Progress note',title:'Surgery progress note, day 2',by:'Dr. Brigid Castellanos, PGY-3',t:T(17,'06:45'),body:'Overnight: nausea, vomited twice (150 mL at 19:40, 200 mL at 01:15). Low urine output around 03:00, responded to 500 mL bolus.\n\nSubjective: Bloated. Pain controlled with the pump. Passing flatus. Walking in the hall.\n\nObjective: Temp 37.8 (peak 38.2 yesterday evening), heart rate 102, blood pressure 106/62, saturation 96% on room air.\nAbdomen distended, mildly tender around incisions as expected, no guarding. Incisions clean and dry. Calves soft.\nLabs: haemoglobin 9.1 (9.6 yesterday, 11.8 before surgery), white cells 12.1, creatinine 1.08 (0.94), potassium 3.4, magnesium 1.6.\n\nAssessment: day 2 after laparoscopic right hemicolectomy, with postoperative ileus.\n\nPlan:\n1. Ileus: sips only, abdominal X-ray this morning, keep walking, chew gum. Nasogastric tube if vomiting continues.\n2. Haemoglobin: slow drift, no sign of bleeding, likely dilution. Recheck tomorrow.\n3. Kidney function: creatinine creeping up. Ketorolac course finished this morning, do not extend. Continue fluids.\n4. Replace potassium and magnesium intravenously.\n5. Low-grade temperature yesterday: spirometer, walking. Reassess if it recurs.\n6. Clot prevention: continue.\n7. Pathology pending. Oncology to see today.\n\nDiscussed with Dr. Okafor-Lindh.'},
  {type:'Operative note',title:'Operative report',by:'Dr. Anselm Okafor-Lindh',t:T(15,'11:20'),body:'Procedure: laparoscopic right hemicolectomy with stapled side-to-side ileocolic anastomosis.\nPreoperative and postoperative diagnosis: adenocarcinoma of the ascending colon.\nSurgeon: Dr. Okafor-Lindh. Assistant: Dr. Castellanos. Anaesthesia: general, Dr. Henrike Olawale.\nIncision 07:52, closure 10:28.\n\nFindings: firm mass in the mid ascending colon, not fixed. No liver or peritoneal deposits. A few firm nodes along the ileocolic pedicle.\n\nDescription: Four ports placed. Medial-to-lateral dissection. Ileocolic vessels divided at their origin with a vascular stapler. Duodenum identified and protected. Hepatic flexure taken down. Specimen delivered through a 6 cm periumbilical incision with a wound protector. Ileum and transverse colon divided, side-to-side stapled anastomosis fashioned and the common opening closed with a further staple firing. Bowel ends pink and bleeding. Mesenteric defect left open. Fascia closed with a running suture, skin with absorbable suture and glue.\n\nEstimated blood loss 150 mL. Fluids 1,800 mL crystalloid. Urine 310 mL. No drains. No complications. Counts correct. Specimen: right colon and terminal ileum, sent fresh to pathology.\n\nPlan: enhanced recovery pathway. Clear liquids tonight, catheter out tomorrow morning, walk today, clot prevention from this evening.'},
  {type:'Anaesthesia note',title:'Anaesthesia record summary',by:'Dr. Henrike Olawale',t:T(15,'10:50'),body:'General anaesthesia with tracheal tube. Induction 07:21: propofol, fentanyl, rocuronium. Easy mask ventilation, grade 1 view, 7.0 tube. Maintenance sevoflurane. Bilateral abdominal wall nerve blocks with ropivacaine before incision.\nAntibiotic prophylaxis: cefazolin 2 g and metronidazole 500 mg at 07:30.\nLatex-free set-up used throughout.\nHaemodynamics stable; two small doses of phenylephrine after induction. Lowest temperature 35.9, warmed to 36.4 by the end.\nNausea prevention: dexamethasone 4 mg, ondansetron 4 mg.\nReversal with sugammadex, extubated awake in theatre 10:38. To recovery 10:41, pain 6/10, treated with hydromorphone.'},
  {type:'History and physical',title:'Preoperative history and physical',by:'Dr. Brigid Castellanos, PGY-3',t:T(15,'06:20'),body:'57-year-old woman for elective laparoscopic right hemicolectomy.\n\nHistory: tiredness and iron-deficiency anaemia found in September (haemoglobin 10.4). Colonoscopy 21 Oct: ulcerated ascending colon mass, biopsy adenocarcinoma; rest of colon normal. CT: no spread. Received two iron infusions; haemoglobin 11.8 last week.\n\nPast history: hypothyroidism, high cholesterol. Surgery: caesarean section 1998.\nMedications: levothyroxine 88 mcg, atorvastatin 20 mg.\nAllergies: latex (rash), codeine (vomiting).\nSocial: primary school teacher, lives with husband, never smoked.\n\nExamination: well. Heart and lungs normal. Abdomen soft, low transverse scar, no mass felt.\n\nPlan: proceed as consented. Bowel preparation and oral antibiotics completed yesterday. Carbohydrate drink taken at 04:30. Latex-free theatre requested.'}],
 key:[
  ['err','Two blood-thinning prophylaxis drugs active together','Enoxaparin 40 mg daily came from the recovery order set on 15 Nov. Heparin 5,000 units three times daily was added on 16 Nov 05:50 without stopping it. Four heparin doses have been given alongside enoxaparin, and another is due now.','Medications; Orders; night nursing note'],
  ['doc','Progress note contradicts the flowsheet on passing gas','The 17 Nov 06:45 progress note says "Passing flatus." Every nursing entry in the surgical recovery flowsheet, and the night nursing note, records that no gas has passed.','Notes; Flowsheets, surgical recovery'],
  ['time','Ileus onset','True onset of ileus: about 16 Nov 16:00 (first distension charted). First vomit 19:40. First mention by a doctor: 17 Nov 06:45.','Flowsheets, surgical recovery'],
  ['dis','Distractor: falling haemoglobin','Haemoglobin 11.8 to 9.1 with a fast heart rate looks like bleeding, but in this simulated case there is none. The cause is 150 mL blood loss in theatre plus 3.9 L positive fluid balance. A tool that calls a haemorrhage here is wrong.','Results; Intake and output']]
});})();

/* ===== Patient 3: cardiology ward, heart failure ===== */
(function(){
var r=rng(37),tt=grid(T(16,'04:00'),T(17,'12:00'),4);
var RN='F. Ostrowski RN', RNn='B. Nakamura-Reid RN';
P.push({id:'p3',name:'Achterberg, Eleanor',age:74,sex:'F',dob:'11 May 1952',mrn:'LX-118260',unit:'4 East Cardiology',bed:'4E-08',
 service:'Cardiology',attending:'Dr. Rohan Peverell',admit:T(16,'03:15'),code:'No CPR (intubation acceptable)',wt:'81.0 kg',ht:'160 cm',
 allergies:[['Sulfonamide antibiotics','hives']],iso:'Standard precautions',
 dx:'Acute decompensated heart failure',
 problems:['Acute decompensated heart failure, ejection fraction 25 to 30%','Acute kidney injury on stage 3b chronic kidney disease (baseline creatinine 1.6)','Low potassium (3.2 mmol/L) on diuretic','Permanent atrial fibrillation on apixaban','Hypertension','Lives alone; dietary salt excess before admission'],
 team:[['Attending','Dr. Rohan Peverell'],['Resident','Dr. Signe Mbeki (PGY-1)'],['Nurse (day)',RN],['Kidney specialist','Dr. Ines Halvard-Otieno'],['Case manager','T. Rasmussen-Ibe']],
 events:[[T(16,'02:10'),'Arrived in emergency department, breathless at rest'],[T(16,'04:10'),'First dose intravenous furosemide'],[T(16,'11:30'),'Echocardiogram: ejection fraction 25 to 30%'],[T(17,'05:05'),'Potassium 3.2, creatinine 2.4'],[T(17,'10:20'),'Seen by kidney specialist']],
 flows:[
  {name:'Vitals',chart:true,times:tt,rows:[
   {k:'temp',l:'Temperature',u:'°C',lo:36,hi:38,v:gen(tt,[[T(16,'04:00'),36.5],[T(17,'12:00'),36.7]],0.15,1,r)},
   {k:'hr',l:'Heart rate',u:'/min',lo:50,hi:100,v:gen(tt,[[T(16,'04:00'),108],[T(16,'16:00'),94],[T(17,'12:00'),84]],3,0,r)},
   {k:'rr',l:'Respiratory rate',u:'/min',lo:10,hi:22,v:gen(tt,[[T(16,'04:00'),26],[T(16,'16:00'),21],[T(17,'12:00'),18]],1,0,r)},
   {k:'bp',l:'Blood pressure',u:'mmHg',type:'bp',s:gen(tt,[[T(16,'04:00'),150],[T(16,'16:00'),134],[T(17,'12:00'),122]],3,0,r),d:gen(tt,[[T(16,'04:00'),90],[T(17,'12:00'),70]],2,0,r)},
   {k:'map',l:'Mean arterial pressure',u:'mmHg',type:'map',lo:65,hi:110},
   {k:'spo2',l:'Oxygen saturation',u:'%',lo:92,hi:101,v:gen(tt,[[T(16,'04:00'),90],[T(16,'12:00'),94],[T(17,'12:00'),95]],0.6,0,r)},
   {k:'o2',l:'Oxygen delivery',v:['4 L nasal','4 L nasal','3 L nasal','3 L nasal','2 L nasal','2 L nasal','2 L nasal','2 L nasal','2 L nasal']},
   {k:'pain',l:'Pain',u:'0–10',lo:-1,hi:6,v:[0,0,0,0,0,0,0,0,0]}]},
  {name:'Heart failure',times:tt,rows:[
   {l:'Weight',u:'kg',v:['82.4','','','','','','81.0','','']},
   {l:'Urine output (previous 4 h)',u:'mL',lo:140,hi:9999,v:['',680,480,300,520,380,300,290,480]},
   {l:'Heart rhythm (monitor)',v:['Atrial fibrillation','Atrial fibrillation','Atrial fibrillation','Atrial fibrillation','Atrial fibrillation','Atrial fibrillation, 4 beats wide-complex 22:14','Atrial fibrillation','Atrial fibrillation','Atrial fibrillation']},
   {l:'Leg swelling',v:['3+ to knees','','3+ to knees','','2+ to knees','','2+ to mid-shin','','2+ to mid-shin']},
   {l:'Neck veins',v:['To jaw at 45°','','Raised','','Raised','','Raised, lower','','Raised, lower']},
   {l:'Breathless lying flat',v:['Yes, 3 pillows','Yes','Yes','Yes, 2 pillows','','','Yes, 2 pillows','','1 pillow']},
   {l:'Fluid allowance used',u:'of 1,500 mL/day',v:['',220,440,600,820,1020,'',260,450]}]},
  {name:'Nursing assessment',cols:['16 Nov 08:00','16 Nov 20:00','17 Nov 08:00'],rows:[
   {l:'Neurological',v:['Alert and oriented, anxious','Alert and oriented','Alert and oriented, hard of hearing (aids in)']},
   {l:'Respiratory',v:['Crackles to mid-zones both sides, 4 L oxygen','Crackles at bases, 2 L oxygen','Crackles at bases, 2 L oxygen, talks in full sentences']},
   {l:'Cardiovascular',v:['Irregular, 3+ leg swelling, neck veins raised','Irregular, 2+ swelling','Irregular, 2+ swelling to mid-shin']},
   {l:'Gastrointestinal',v:['Poor appetite, last bowel movement 14 Nov','Ate half of supper','Ate breakfast, bowels opened']},
   {l:'Urinary',v:['Using commode, large volumes after furosemide','Commode, urgency','Commode, volumes smaller than yesterday']},
   {l:'Skin',v:['Shins shiny and tight, small weeping blister left shin','Blister dressed, heels offloaded','Dressing dry, heels intact']},
   {l:'Mobility',v:['Commode with 1 assist, breathless','Walks to bathroom with frame and 1 assist','Walked 20 m with frame, rested once']},
   {l:'Fall risk',v:['High (urgency, diuretic, frame)','High','High']},
   {l:'Teaching',v:['Daily weights explained','Fluid allowance explained, daughter present','Low-salt diet leaflet given, wants daughter to hear it']}]},
  {name:'Intake and output',cols:['16 Nov day (03:15–19)','16 Nov night (19–07)','17 Nov day (07–14:30)'],unit:'mL',rows:[
   {l:'Intravenous',v:[60,40,40]},{l:'Oral',v:[720,380,450]},{l:'Total in',sum:1,v:[780,420,490]},{l:'Urine',v:[1850,1040,790]},{l:'Total out',sum:1,v:[1850,1040,790]},{l:'Net balance',sum:1,v:['−1,070','−620','−300']}]}],
 lines:[['Peripheral IV, 20 gauge','Left forearm','16 Nov 02:25','Patent'],['Cardiac monitor (telemetry)','5 leads','16 Nov 03:30','Atrial fibrillation'],['Wound dressing','Left shin blister, 1.5 cm','16 Nov 08:40','Dry, change every 3 days']],
 labs:[
  {panel:'Chemistry',times:[T(16,'03:40'),T(16,'14:10'),T(17,'05:05')],rows:[
   ['Sodium','mmol/L',135,145,[131,132,134]],['Potassium','mmol/L',3.5,5.1,[4.8,3.9,3.2]],['Chloride','mmol/L',98,107,[96,95,94]],['Bicarbonate','mmol/L',22,29,[22,25,28]],
   ['Urea nitrogen','mg/dL',7,20,[52,54,57]],['Creatinine','mg/dL',0.5,1.1,[2.1,2.2,2.4]],['Glucose','mg/dL',70,140,[118,131,104]],['Magnesium','mg/dL',1.7,2.4,[1.9,1.7,1.6]]]},
  {panel:'Cardiac markers',times:[T(16,'03:40'),T(16,'06:40'),T(17,'05:05')],rows:[
   ['B-type natriuretic peptide','pg/mL',0,100,[2840,null,1910]],['Troponin T, high sensitivity','ng/L',0,14,[38,41,null]]]},
  {panel:'Blood count',times:[T(16,'03:40'),T(17,'05:05')],rows:[
   ['Haemoglobin','g/dL',12,16,[10.9,11.3]],['White cells','×10⁹/L',4,11,[7.2,6.8]],['Platelets','×10⁹/L',150,400,[198,204]]]}],
 micro:[],
 imaging:[
  {title:'Echocardiogram, transthoracic',t:T(16,'11:30'),status:'Final',by:'Dr. Marguerite Sandoval-Achebe, Cardiology',body:'Left ventricle moderately dilated with severe global reduction in contraction. Ejection fraction 25 to 30% (32% in March 2025). Left atrium severely enlarged. Moderate mitral regurgitation, central jet. Right ventricle mildly reduced function. Estimated pulmonary artery systolic pressure 52 mmHg. Inferior vena cava 2.4 cm with little collapse.\n\nImpression: Severe left ventricular dysfunction, slightly worse than last year. Raised filling pressures.'},
  {title:'Chest X-ray, 2 views',t:T(16,'03:50'),status:'Final',by:'Dr. Casimir Adeleke, Radiology',body:'Enlarged heart. Upper-lobe vessel prominence and interstitial lines at both bases. Small pleural effusions on both sides. No consolidation.\n\nImpression: Pulmonary oedema with small effusions.'},
  {title:'12-lead ECG',t:T(16,'03:25'),status:'Final',by:'Dr. Rohan Peverell',body:'Atrial fibrillation, ventricular rate 108. QRS duration 104 ms. Voltage criteria for left ventricular hypertrophy with lateral T-wave inversion, unchanged from March 2025. No new ST changes.'}],
 path:[],
 meds:[
  {name:'Furosemide 80 mg',sig:'Intravenous · twice daily',a:[G(T(16,'04:10'),'given','ED nurse'),G(T(16,'16:05'),'given',RN),G(T(17,'08:10'),'given',RN),G(T(17,'16:00'),'due')],ordered:T(16,'03:50')},
  {name:'Potassium chloride 40 mEq',sig:'Oral · 2 doses, 4 hours apart',a:[G(T(17,'08:15'),'given',RN),G(T(17,'12:15'),'due')],ordered:T(17,'07:30')},
  {name:'Apixaban 2.5 mg',sig:'Oral · twice daily',a:[G(T(16,'09:05'),'given',RN),G(T(16,'21:10'),'given',RNn),G(T(17,'09:02'),'given',RN),G(T(17,'21:00'),'due')],ordered:T(16,'05:30')},
  {name:'Metoprolol succinate 50 mg',sig:'Oral · daily',a:[G(T(16,'09:05'),'given',RN),G(T(17,'09:02'),'given',RN),G(T(18,'09:00'),'due')],ordered:T(16,'05:30')},
  {name:'Atorvastatin 40 mg',sig:'Oral · nightly',a:[G(T(16,'21:10'),'given',RNn),G(T(17,'21:00'),'due')],ordered:T(16,'05:30')},
  {name:'Acetaminophen 650 mg',sig:'Oral · every 6 hours as needed for pain',type:'prn',a:[],ordered:T(16,'05:30')},
  {name:'Magnesium oxide 400 mg',sig:'Oral · twice daily · 4 doses',a:[G(T(17,'09:02'),'given',RN),G(T(17,'21:00'),'due')],ordered:T(17,'07:30')}],
 orders:[['Nursing','Admit to 4 East with cardiac monitoring','Active',T(16,'03:50')],['Nursing','Daily weight at 05:30, same scale','Active',T(16,'05:30')],['Nursing','Strict intake and output','Active',T(16,'05:30')],['Diet','2 g sodium, 1,500 mL fluid allowance','Active',T(16,'05:30')],
  ['Medication','Lisinopril 10 mg oral daily — HOLD (kidney injury)','On hold',T(16,'05:30')],['Medication','Spironolactone 25 mg oral daily — HOLD (kidney injury)','On hold',T(16,'05:30')],['Laboratory','Chemistry twice daily while on intravenous diuretic','Active',T(16,'05:30')],
  ['Imaging','Echocardiogram','Completed',T(16,'05:30')],['Consult','Kidney medicine','Completed',T(17,'07:40')],['Consult','Case management: home services','Active',T(16,'09:00')]],
 alerts:{pip:'Sulfonamide antibiotic allergy does not cross-react with penicillins. No infection is documented; check the indication.',ct:'Creatinine 2.4 mg/dL and rising. Intravenous contrast carries a high risk; discuss with the kidney team first.',kcl:'A second potassium dose from this morning’s order is already overdue. Give that before ordering more.',furo:'Kidney team advised reducing to furosemide 80 mg once daily from tomorrow.'},
 notes:[
  {type:'Case management',title:'Discharge planning assessment',by:'T. Rasmussen-Ibe, case manager',t:T(17,'11:30'),body:'Met with Mrs Achterberg; daughter Katrien joined by phone.\n\nHome: second-floor flat with a lift, lives alone since 2023. Daughter 15 minutes away, visits twice a week and does the shopping. Uses a walking frame outdoors. Manages her own tablets from the original boxes and admits she "sometimes skips the water tablet" on days she goes out.\n\nBefore admission: ate tinned soup most evenings for two weeks while daughter was away. No bathroom scale at home.\n\nNeeds identified: scale, weekly pill organiser, low-salt meal delivery, home nursing visits for weights and blood tests, heart failure clinic within 7 days.\n\nPatient agrees to home nursing. Does not want a care home. Confirmed again that she does not want chest compressions; form on the chart.\n\nExpected discharge: 2 to 3 days, depending on kidney function.'},
  {type:'Consult',title:'Kidney medicine consult',by:'Dr. Ines Halvard-Otieno',t:T(17,'10:20'),body:'Reason: creatinine rising during diuresis.\n\nSummary: 74-year-old woman with heart failure (ejection fraction 25 to 30%) and stage 3b chronic kidney disease, baseline creatinine 1.6. Admitted fluid overloaded with creatinine 2.1, now 2.4 after three doses of intravenous furosemide and about 2 L net negative. Urine output remains good. Blood pressure 120s systolic. No contrast, no anti-inflammatory drugs. Lisinopril and spironolactone held since admission.\n\nUrine: bland sediment, sodium 68 mmol/L on diuretic, protein-to-creatinine ratio 0.4.\n\nAssessment: acute kidney injury on chronic kidney disease, most consistent with congestion (cardiorenal). She still has raised neck veins and leg swelling, so she is not over-diuresed. A small creatinine rise during effective decongestion is acceptable and usually settles.\n\nRecommendations:\n1. Continue diuresis. Aim for 1 to 1.5 L net negative per day. Reduce furosemide to 80 mg once daily from tomorrow if weight keeps falling.\n2. Potassium 3.2: replace today and recheck at 16:00. Keep potassium above 4 and magnesium above 2.\n3. Keep lisinopril and spironolactone on hold until creatinine is falling.\n4. Dose medicines for kidney function. Note that apixaban dose reduction needs two of: age 80 or over, weight 60 kg or under, creatinine 1.5 or over. She meets one. Please review the current dose.\n5. Avoid contrast and anti-inflammatory drugs.\nWe will follow.'},
  {type:'Progress note',title:'Cardiology progress note, day 2',by:'Dr. Signe Mbeki, PGY-1',t:T(17,'09:15'),body:'Overnight: four-beat run of wide-complex rhythm at 22:14, no symptoms. Slept on two pillows.\n\nSubjective: Breathing easier. Legs feel less tight. No chest pain or palpitations.\n\nObjective: Heart rate 86 irregular, blood pressure 124/72, respiratory rate 18, saturation 95% on 2 L.\nWeight down 2.1 kg since admission. Net negative 1.7 L.\nNeck veins still raised. Crackles at both bases. Leg swelling 2+ to mid-shin.\nLabs: sodium 134, potassium 3.2, creatinine 2.4 (2.2), magnesium 1.6, BNP 1,910 (2,840).\n\nAssessment: acute decompensated heart failure, responding to diuretic, still fluid overloaded. Kidney function a little worse.\n\nPlan:\n1. Continue furosemide 80 mg intravenous twice daily. Daily weight, strict intake and output.\n2. Potassium chloride 40 mEq by mouth, two doses. Magnesium by mouth. Recheck at 16:00.\n3. Kidney function: ask kidney team to see. Keep lisinopril and spironolactone on hold.\n4. Atrial fibrillation: rate controlled on metoprolol. Continue apixaban.\n5. Wide-complex run: keep potassium and magnesium replaced, continue monitor.\n6. Wean oxygen to room air.\n7. Teaching on salt, fluid and daily weights. Case management for home services.\n\nDiscussed with Dr. Peverell.'},
  {type:'Nursing note',title:'Night shift summary',by:'B. Nakamura-Reid RN',t:T(17,'07:00'),body:'Settled night. Four wide-complex beats on the monitor at 22:14, patient asleep, blood pressure 128/74 afterwards, resident informed and strip saved.\nUp to the commode five times with one assist, urine 1,040 mL for the shift. Stayed within fluid allowance.\nWeight at 05:30 on the bed scale: 81.0 kg (82.4 kg on admission).\nOxygen 2 L, saturation 93 to 95%. Slept on two pillows.\nLeft shin dressing dry. Heels offloaded.\nDaughter phoned at 20:30 and would like to be present for diet teaching.'},
  {type:'Consult',title:'Cardiology attending note',by:'Dr. Rohan Peverell',t:T(16,'13:40'),body:'Seen with the team. Echo reviewed: ejection fraction 25 to 30%, a little lower than last year, moderate mitral regurgitation, high filling pressures.\n\nTrigger for this admission appears to be salt load and missed diuretic doses. Troponin flat at 38 and 41, consistent with strain, not a heart attack. No need for a coronary study now.\n\nPlan: intravenous diuresis to a target weight near 77 kg. Restart lisinopril and spironolactone when kidney function allows; consider changing to sacubitril-valsartan and adding an SGLT2 inhibitor in clinic. She has declined a defibrillator in the past and confirms that today. Her wishes about resuscitation are documented: no chest compressions, would accept a short trial of a breathing tube.'},
  {type:'History and physical',title:'Admission history and physical',by:'Dr. Signe Mbeki, PGY-1',t:T(16,'05:20'),body:'Chief complaint: worsening breathlessness for one week.\n\nHistory: 74-year-old woman with heart failure, permanent atrial fibrillation and chronic kidney disease. One week of increasing breathlessness, now at rest; sleeping upright in a chair for three nights. Legs swollen to the knees. Shoes no longer fit. No chest pain, fever or cough. Has been eating tinned soup and admits missing some furosemide doses.\n\nPast history: heart failure with reduced ejection fraction (non-ischaemic, 32% in 2025), atrial fibrillation, chronic kidney disease stage 3b (creatinine 1.6 in September), hypertension.\nMedications at home: furosemide 40 mg daily, lisinopril 10 mg daily, spironolactone 25 mg daily, metoprolol succinate 50 mg daily, apixaban 5 mg twice daily, atorvastatin 40 mg nightly.\nAllergies: sulfonamide antibiotics (hives). Has taken furosemide for years without reaction.\nSocial: retired librarian, widowed, lives alone, daughter nearby. Never smoked.\n\nExamination: breathless speaking, sitting upright. Heart rate 108 irregular, blood pressure 150/90, saturation 90% on 4 L. Neck veins raised to the jaw. Crackles to mid-zones. Third heart sound. Swelling 3+ to knees.\n\nResults: BNP 2,840, creatinine 2.1, potassium 4.8, troponin 38. Chest X-ray: pulmonary oedema.\n\nAssessment: acute decompensated heart failure with fluid overload; acute kidney injury on chronic kidney disease, likely from congestion.\n\nPlan: furosemide 80 mg intravenous twice daily. Hold lisinopril and spironolactone. Continue metoprolol and apixaban. Repeat troponin, echo today. Low-salt diet, fluid allowance 1,500 mL. Resuscitation wishes confirmed with patient: no chest compressions.'}],
 key:[
  ['err','Apixaban ordered at half her home dose','She takes apixaban 5 mg twice daily at home (admission history). The inpatient order is 2.5 mg twice daily. The lower dose needs two of three criteria; she meets only one (creatinine). Three reduced doses have been given. The kidney consult hints at this without naming the error.','Medications; admission history; kidney consult'],
  ['err','Second potassium dose is overdue','Potassium 3.2 mmol/L with a run of wide-complex beats overnight. The second 40 mEq dose was due at 12:15 and has not been given by 14:30.','Medications; Summary'],
  ['doc','Progress note overstates the weight loss','The 17 Nov 09:15 progress note says "Weight down 2.1 kg" and "net negative 1.7 L". The flowsheet shows 82.4 to 81.0 kg, a fall of 1.4 kg, and the intake and output record shows 1.69 L negative to 07:00, so only the weight figure is overstated; the fluid balance agrees.','Notes; Flowsheets, heart failure group'],
  ['time','True cause of the kidney injury','In this simulated case the creatinine rise is from congestion. It peaks at 2.4 and falls with continued diuresis. Stopping the diuretic is the wrong response.','Kidney consult; Results'],
  ['dis','Distractor: furosemide with a "sulfa" allergy','Her allergy is to sulfonamide antibiotics. Furosemide is a different class and she has taken it for years. A tool that blocks it is over-alerting.','Admission history']]
});})();

P.forEach(function(p){
  p.meds.forEach(function(m,i){m.id=p.id+'m'+i;m.a=m.a||[];});
  var mo=p.meds.map(function(m){return ['Medication',m.name+' · '+m.sig,'Active',m.ordered];});
  p.orders=mo.concat(p.orders).map(function(o,i){return {id:p.id+'o'+i,cat:o[0],text:o[1],st:o[2],t:o[3],by:'Care team'};});
  p.notes.forEach(function(n,i){n.id=p.id+'n'+i;});
  p.pending=[];
});
return P;
}

var CATALOG=[
 {k:'kcl',cat:'Medication',text:'Potassium chloride 40 mEq',sig:'Oral · once',med:1},
 {k:'apap',cat:'Medication',text:'Acetaminophen 650 mg',sig:'Oral · once',med:1},
 {k:'furo',cat:'Medication',text:'Furosemide 40 mg',sig:'Intravenous · once',med:1},
 {k:'mag',cat:'Medication',text:'Magnesium sulfate 2 g',sig:'Intravenous · once',med:1},
 {k:'pip',cat:'Medication',text:'Piperacillin-tazobactam 4.5 g',sig:'Intravenous · every 8 hours',med:1},
 {k:'hep',cat:'Medication',text:'Heparin 5,000 units',sig:'Subcutaneous · every 8 hours',med:1},
 {k:'bmp',cat:'Laboratory',text:'Chemistry panel',lab:1},
 {k:'cbc',cat:'Laboratory',text:'Blood count',lab:1},
 {k:'lac',cat:'Laboratory',text:'Lactate',lab:1},
 {k:'bcx',cat:'Laboratory',text:'Blood cultures, 2 sets',lab:1},
 {k:'cxr',cat:'Imaging',text:'Chest X-ray, portable',lab:1},
 {k:'ct',cat:'Imaging',text:'CT abdomen and pelvis with intravenous contrast',lab:1},
 {k:'io',cat:'Nursing',text:'Strict intake and output'},
 {k:'wt',cat:'Nursing',text:'Daily weight'},
 {k:'pt',cat:'Consult',text:'Physical therapy evaluation'},
 {k:'nut',cat:'Consult',text:'Dietitian consult'},
 {k:'pal',cat:'Consult',text:'Palliative care consult'}];


var EXTRA=[];
