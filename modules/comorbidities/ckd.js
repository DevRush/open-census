HOSP.comorbidity({key:'ckd',name:'Chronic kidney disease',icd:'N18.30',prior:[.02,.09,.24],minAge:35,
 problem:'Chronic kidney disease stage {stage} (baseline creatinine {cr} mg/dL, eGFR {egfr})',pmh:'Chronic kidney disease stage {stage}, baseline creatinine {cr} mg/dL',home:['vitd2000'],
 opd:{clinic:{key:'nephc',p:.45},every:[13,26],
  tracks:{cr:{start:[1.2,1.75],drift:.03,noise:.06,floor:1.1,ceil:3.2},k:{start:[4.2,5.0],drift:0,noise:.25,floor:3.6,ceil:5.6},hco3:{start:[20,25],drift:-.1,noise:1.2,floor:17,ceil:27},uacr:{start:[40,900],drift:8,noise:40,floor:15},hgb:{start:[10.8,13.2],drift:-.05,noise:.3,floor:9.2}},
  ladder:{on:'uacr',above:300,effect:140,startMax:1,steps:['losartan50','losartan100','+dapa10']},
  sx:['no swelling, breathlessness or change in urine','avoiding anti-inflammatory painkillers as advised','appetite good; no itching or cramps','mild ankle swelling by evening'],
  plan:['Avoid anti-inflammatory drugs and contrast where possible; sick-day rules reviewed','Blood pressure target below 130/80','Low-salt diet; protein in moderation','Kidney function, potassium and urine albumin before each visit']},
 labs:{bun:13,phos:.4},flags:['renal'],avoid:['nsaid'],
 plan:'Chronic kidney disease: dose medicines for kidney function, avoid anti-inflammatory drugs and contrast, daily chemistry.',interact:{aki:2.4},los:.3});
