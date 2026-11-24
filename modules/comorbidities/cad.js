HOSP.comorbidity({key:'cad',name:'Coronary artery disease',icd:'I25.10',prior:[.01,.09,.2],minAge:40,
 problem:'Coronary artery disease, [stent in {year}|bypass surgery in {year}|treated with medicines]',pmh:'Coronary artery disease ([stent {year}|heart attack {year}])',home:['aspirin81'],
 opd:{clinic:{key:'cardc',p:.4},every:[26,52],tracks:{ldl:{start:[78,140],drift:1,noise:9,floor:42}},
  ladder:{on:'ldl',above:70,effect:22,startMax:1,steps:['atorva40','atorva80','+ezetimibe10']},
  sx:['no chest pain; walks [1|2|3] km without stopping','used nitroglycerin spray [not at all|once] since the last visit','mild muscle aches, tolerable'],
  plan:['LDL target below 70 mg/dL','Cardiac rehabilitation exercises to continue at home','Blood pressure and diabetes control reviewed as part of risk reduction']},
 plan:'Coronary disease: continue aspirin and statin.',interact:{afrvr:1.3},los:.1,excludes:[]});
