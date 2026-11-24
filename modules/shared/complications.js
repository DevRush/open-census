/* modules/shared/complications.js — reusable complications. A condition module includes one with {use:'aki', p:0.1}.
   Times in `course` and `meds` are DAYS SINCE TRUE ONSET; values in `course` are CHANGES added to the patient's numbers.
   The team recognises the complication `lag` hours after true onset; the true onset is kept as a hidden truth label. */
(function(H){
var C=H.complication;
C({key:'aki',name:'Acute kidney injury',problem:'Acute kidney injury (creatinine peak {peak.cr} mg/dL)',d:[1,3],lag:[10,26],los:1.5,
 course:{cr:[[0,0],[1,.7],[2,1.1],[4,.5],[6,.15]],bun:[[0,0],[2,22],[5,8]],k:[[0,0],[1.5,.6],[4,.1]],hco3:[[0,0],[2,-3],[5,0]]},
 holds:['nsaid','acei','metformin','sglt2','mra'],meds:[{m:'lr100',d:[0,1.5]}],
 orders:[['Laboratory','Chemistry twice daily until creatinine falls'],['Nursing','Strict intake and output; daily weight'],['Laboratory','Urine sodium, creatinine and microscopy']],
 consult:{svc:'neph',reason:'creatinine rising during admission',recs:'Likely reduced blood flow to the kidneys with a contribution from medicines. Hold kidney-harming medicines, give fluid with care, dose all medicines for kidney function, avoid contrast. No need for dialysis now. We will follow the daily chemistry.'},
 event:'Creatinine rise noted; kidney-harming medicines held',assess:'Acute kidney injury: creatinine {lab.cr} mg/dL ({prev.cr}). Likely reduced kidney blood flow plus medicines.',plan:'Kidney injury: hold kidney-harming medicines, cautious fluid, repeat chemistry, dose medicines for kidney function.',
 truth:'Creatinine began to rise at the true onset time; the first value above baseline was already present in the draw before the team acted.'});
C({key:'delirium',name:'Delirium',problem:'Delirium (hospital-acquired), fluctuating',d:[1,3],lag:[6,20],los:1.5,minAge:65,
 course:{hr:[[0,0],[.5,8],[3,0]],pain:[[0,0],[1,1],[3,0]]},holds:['benzodiazepine','sleep'],meds:[{m:'quetiapine125',d:[0]}],
 orders:[['Nursing','Delirium care: glasses and hearing aids on, lights on by day, family presence, avoid night-time disturbance'],['Nursing','Bed alarm; hourly rounding'],['Laboratory','Urinalysis and review of medicine list for causes of confusion']],
 consult:{svc:'geri',reason:'new confusion and agitation overnight',recs:'Hyperactive delirium on a background of acute illness. Treat the cause, stop sedating medicines, correct sleep and hydration, mobilise three times a day. Use medicine for agitation only if there is danger to self or staff.'},
 event:'Night nurse reports new confusion and pulling at lines',assess:'Delirium: inattentive, disoriented to time, worse in the evening. No focal deficit.',plan:'Delirium: non-drug measures first, review medicines, involve family, avoid restraints.',
 nursing:{Neurological:'Disoriented to time and place, inattentive, calmer with family present',Mobility:'Up with 2 assist, impulsive','Fall risk':'High (confusion); bed alarm on'},
 truth:'Inattention began at the true onset time, hours before the first documented agitation.'});
C({key:'hap',name:'Hospital-acquired pneumonia',problem:'Hospital-acquired pneumonia',d:[2.5,5],lag:[6,16],los:3,
 course:{temp:[[0,0],[.5,1.5],[2,.8],[4,0]],wbc:[[0,0],[1,5.5],[4,1]],spo2:[[0,0],[.5,-4],[3,-1],[5,0]],o2:[[0,0],[.5,2],[3,1],[5,0]],rr:[[0,0],[.5,5],[3,1]],hr:[[0,0],[.5,14],[3,2]],crp:[[0,0],[1,90],[5,15]]},
 meds:[{m:'cefepime2g',d:[0,7]},{m:'vanc1250',d:[0,2]}],orders:[['Laboratory','Blood cultures, 2 sets'],['Laboratory','Sputum culture'],['Laboratory','Nasal screen for resistant Staphylococcus']],
 report:{k:'imaging',t:'Chest X-ray, portable',by:'rad',body:'New patchy opacity at the {side} base compared with the admission film. No effusion or pneumothorax. Lines and tubes unchanged.\n\nImpression: New {side} lower zone consolidation, in keeping with pneumonia in the clinical setting.'},
 event:'New fever and oxygen need; chest X-ray shows new consolidation',assess:'Hospital-acquired pneumonia: new fever, oxygen need and {side} base consolidation.',plan:'Pneumonia: started {crx}; narrow when the nasal screen and cultures result; chest physiotherapy, sit out of bed.',
 nursing:{Respiratory:'New wet cough, coarse crackles {side} base, oxygen as charted'},truth:'Temperature and respiratory rate began to climb at the true onset time, before the first fever above 38 was charted.'});
C({key:'cdiff',name:'Clostridioides difficile colitis',problem:'Clostridioides difficile infection',d:[2,5],lag:[8,24],los:2,
 course:{wbc:[[0,0],[1,6],[4,1]],temp:[[0,0],[1,.7],[3,0]],k:[[0,0],[1,-.5],[3,0]],cr:[[0,0],[1,.25],[3,0]]},meds:[{m:'vancpo125',d:[0,10]}],
 orders:[['Nursing','Contact precautions with soap-and-water hand washing'],['Laboratory','Stool test for Clostridioides difficile toxin'],['Nursing','Stool chart']],
 report:{k:'micro',t:'Stool Clostridioides difficile test',by:'micro',body:'Toxin gene detected by nucleic acid test. Toxin enzyme immunoassay: positive.\n\nInterpretation: consistent with Clostridioides difficile infection in a patient with diarrhoea.'},
 event:'Three or more loose stools in 24 hours; stool test sent',assess:'Clostridioides difficile infection: watery stools after antibiotics, toxin positive.',plan:'C. difficile: {crx} for 10 days, contact precautions, stop acid suppression if possible, replace potassium.',
 nursing:{Gastrointestinal:'Watery stools, 4 to 6 this shift; abdomen soft, mild cramping',Skin:'Barrier cream to perianal skin'},iso:'Contact precautions (soap and water)',truth:'Loose stools started at the true onset time; the first two were not charted as diarrhoea.'});
C({key:'afrvr',name:'Atrial fibrillation with fast rate',problem:'New atrial fibrillation with fast ventricular rate',d:[0.8,3],lag:[0.5,3],los:1,minAge:50,
 course:{hr:[[0,0],[.05,52],[.5,30],[1,8],[2,0]],sbp:[[0,0],[.05,-14],[1,-4],[2,0]]},meds:[{m:'metotart25',d:[0]},{m:'mgso4',d:[0,.1]}],
 orders:[['Nursing','Continuous cardiac monitoring'],['Laboratory','Thyroid stimulating hormone, magnesium'],['Imaging','Echocardiogram']],
 report:{k:'imaging',t:'12-lead ECG',by:'team',body:'Atrial fibrillation with ventricular rate {hr}. Normal axis. No acute ST changes. QT interval normal for rate.\n\nImpression: New atrial fibrillation with fast ventricular response.'},
 consult:{svc:'card',reason:'new atrial fibrillation with fast rate',recs:'New atrial fibrillation in the setting of acute illness. Rate control as started, keep potassium above 4 and magnesium above 2. Stroke risk score reviewed: discuss anticoagulation before discharge. Echocardiogram.'},
 event:'Monitor alarm: irregular rhythm, heart rate {hr}',assess:'New atrial fibrillation, rate now {hr}. Blood pressure holding.',plan:'Atrial fibrillation: rate control ({crx}), replace electrolytes, echocardiogram, decide on anticoagulation with cardiology.',
 nursing:{Cardiovascular:'Irregular pulse on monitor, no chest pain, hands warm'},truth:'The rhythm changed at the true onset time shown on the monitor record.'});
C({key:'dvt',name:'Deep vein thrombosis',problem:'Deep vein thrombosis, {side} leg',d:[2,6],lag:[8,30],los:1,
 course:{pain:[[0,0],[1,2],[4,0]],ddimer:[[0,0],[1,3.2]]},holdsKeys:['enox40','hep5000'],meds:[{m:'apixaban5',d:[0]}],orders:[['Imaging','Leg vein ultrasound, {side} leg'],['Nursing','Measure calf circumference daily']],
 report:{k:'imaging',t:'Leg vein ultrasound, {side} leg',by:'rad',body:'The {side} popliteal vein does not compress fully and contains echo-poor material with reduced flow. Femoral and common femoral veins compress normally.\n\nImpression: Acute deep vein thrombosis of the {side} popliteal vein.'},
 event:'Swollen, tender {side} calf noted; ultrasound confirms clot',assess:'Deep vein thrombosis, {side} popliteal vein, despite preventive dosing.',plan:'Leg clot: full-dose anticoagulation ({crx}), stop preventive injections, teach bleeding precautions.',
 nursing:{Cardiovascular:'{side} calf swollen 2 cm more than the other, warm and tender'},truth:'Calf swelling was first measurable at the true onset time.'});
C({key:'hypogly',name:'Hypoglycaemia',problem:'Hypoglycaemic episode on insulin',d:[0.8,3],lag:[0.2,1],los:0,needs:['dm2','dm1'],
 course:{glu:[[0,0],[.02,-55],[.2,10],[1,0]]},orders:[['Nursing','Hypoglycaemia protocol: 15 g fast-acting carbohydrate, recheck in 15 minutes'],['Laboratory','Bedside glucose before meals, at bedtime and at 03:00']],
 event:'Bedside glucose 52 mg/dL with sweating; treated with juice, 96 mg/dL after 15 minutes',assess:'Hypoglycaemia overnight (52 mg/dL), treated by mouth. Eating less than usual.',plan:'Low glucose: reduce long-acting insulin by 20% if in use; correction scale only while intake is poor.',
 nursing:{Neurological:'Sweaty and shaky at 03:00 with glucose 52; settled after juice'},truth:'The glucose fell below 70 mg/dL at the true onset time.'});
C({key:'ileus',name:'Post-operative ileus',problem:'Post-operative ileus',d:[1.5,3],lag:[6,14],los:2.5,
 course:{hr:[[0,0],[.5,10],[3,0]],k:[[0,0],[1,-.5],[3,0]],pain:[[0,0],[.5,2],[3,0]]},holds:['laxative'],meds:[{m:'lr100',d:[0,2.5]},{m:'panto40iv',d:[0,3]}],
 orders:[['Diet','Nothing by mouth except sips with medicines'],['Nursing','Nasogastric tube to low suction if vomiting continues'],['Imaging','Abdominal X-ray']],
 report:{k:'imaging',t:'Abdominal X-ray, supine and upright',by:'rad',body:'Gas-filled loops of small and large bowel throughout the abdomen with gas in the rectum. No transition point. No free air under the diaphragm beyond that expected after surgery.\n\nImpression: Ileus pattern. No evidence of mechanical obstruction.'},
 event:'Vomiting and abdominal distension; diet stopped',assess:'Post-operative ileus: distended, quiet abdomen, no flatus. No sign of a leak.',plan:'Ileus: bowel rest, intravenous fluid, replace potassium and magnesium, walk four times a day, limit opioids.',
 nursing:{Gastrointestinal:'Distended, bowel sounds absent, vomited twice, no flatus'},truth:'Flatus stopped and distension began at the true onset time.'});
C({key:'ssi',name:'Surgical site infection',problem:'Superficial surgical site infection',d:[3,6],lag:[6,18],los:2,
 course:{temp:[[0,0],[.5,1.1],[2,.3],[3,0]],wbc:[[0,0],[1,4.5],[4,.5]],crp:[[0,0],[1,70],[4,15]],pain:[[0,0],[.5,2],[3,0]]},meds:[{m:'cefazolin2g',d:[0,2]},{m:'cephalexin500',d:[2,7]}],
 orders:[['Laboratory','Wound swab for culture'],['Nursing','Wound care: open the lower 2 cm, pack loosely, daily dressing'],['Consult','Wound and ostomy nursing']],
 report:{k:'micro',t:'Wound swab culture',by:'micro',body:'Gram stain: moderate white cells, Gram-positive cocci in clusters.\nCulture: moderate growth of Staphylococcus aureus, methicillin-susceptible; susceptible to first-line agents tested.'},
 event:'Wound red and draining cloudy fluid; two staples removed',assess:'Superficial wound infection: 3 cm of redness, cloudy drainage, no deep collection suspected.',plan:'Wound infection: {crx}, then an oral agent to complete 7 days; daily packing, mark the edge of redness.',
 nursing:{Skin:'Wound edges red for 3 cm, cloudy drainage on dressing, edge marked with pen'},truth:'Wound pain and warmth increased from the true onset time, before redness was documented.'});
C({key:'bleed',name:'Post-operative bleeding with anaemia',problem:'Acute blood-loss anaemia after surgery',d:[0.3,1.5],lag:[3,10],los:1,
 course:{hgb:[[0,0],[.4,-2.6],[1.5,-1.6],[4,-1.2]],hr:[[0,0],[.3,16],[1.5,4],[3,0]],sbp:[[0,0],[.3,-16],[1.5,-3]]},holds:['anticoagulant','nsaid'],meds:[{m:'ferrous325',d:[1]}],
 orders:[['Laboratory','Blood count every 6 hours for 3 checks'],['Laboratory','Type and crossmatch 2 units'],['Nursing','Transfuse 1 unit of red cells for haemoglobin below 7 g/dL or symptoms']],
 event:'Haemoglobin fall noted; preventive blood thinner held',assess:'Blood-loss anaemia: haemoglobin {lab.hgb} g/dL ({prev.hgb}), dressing and drain output increased.',plan:'Bleeding: hold blood thinners and anti-inflammatory drugs, serial blood counts, transfuse if below 7 or symptomatic.',
 nursing:{Cardiovascular:'Pale, dizzy on standing, pulse faster than yesterday',Skin:'Dressing reinforced twice for bloody ooze'},truth:'Bleeding began at the true onset time; heart rate rose before the haemoglobin was rechecked.'});
C({key:'cauti',name:'Catheter-associated urinary infection',problem:'Catheter-associated urinary tract infection',d:[3,6],lag:[6,16],los:1.5,
 course:{temp:[[0,0],[.5,1.2],[2,0]],wbc:[[0,0],[1,4],[3,.5]],hr:[[0,0],[.5,10],[2,0]]},meds:[{m:'ceftriaxone1g',d:[0,3]}],
 orders:[['Nursing','Remove urinary catheter; bladder scan if no urine in 6 hours'],['Laboratory','Urinalysis and urine culture']],
 report:{k:'micro',t:'Urine culture',by:'micro',body:'More than 100,000 colony-forming units per mL of Escherichia coli. Susceptible to third-generation cephalosporins, quinolones are resistant; full panel in the laboratory system.'},
 event:'Fever with cloudy urine; catheter removed and cultures sent',assess:'Catheter-associated urinary infection: fever, cloudy urine, catheter in place for several days.',plan:'Urinary infection: catheter out, {crx}, narrow when the culture results.',
 nursing:{Urinary:'Catheter removed; urine cloudy with sediment; voiding since'},truth:'The catheter had no documented reason to stay after the first two days; the infection began at the true onset time.'});
C({key:'fall',name:'Fall in hospital',problem:'Fall in hospital without serious injury',d:[1,4],lag:[0.1,0.3],los:0.5,minAge:60,
 course:{pain:[[0,0],[.05,2],[2,0]]},orders:[['Nursing','Post-fall checks: neurological observations every 4 hours for 24 hours'],['Nursing','Bed and chair alarm; non-slip socks; toileting rounds every 2 hours'],['Consult','Physical therapy: gait and balance review']],
 event:'Found on the floor beside the bed after trying to reach the bathroom alone; no head strike',assess:'Unwitnessed fall overnight, no head strike, no new pain on hip or wrist movement.',plan:'Fall: neurological checks, review sedating medicines, bed alarm, therapy review.',
 nursing:{'Fall risk':'High; fell this admission; bed alarm on',Mobility:'Up only with 1 assist and frame'},truth:'The fall happened at the true onset time; the call bell was out of reach.'});
})(HOSP);
