HOSP.comorbidity({key:'htn',name:'Hypertension',icd:'I10',prior:[.18,.45,.68],minAge:25,ob:false,
 problem:'Hypertension',pmh:'Hypertension since {year}',
 opd:{clinic:{key:'cardc',p:.06},every:[13,26],
  tracks:{sbp:{start:[138,166],drift:1.2,noise:6,floor:112}},
  ladder:{on:'sbp',above:138,effect:9,steps:['amlodipine5','amlodipine10','+lisinopril10','lisinopril20','+chlorthal25']},
  sx:['no headaches, chest pain or dizziness','home readings mostly [130s|140s] systolic','occasional ankle swelling in the evening','missed a few doses while travelling'],
  plan:['Home blood pressure diary for 2 weeks before the next visit','Salt reduction and 30 minutes of walking most days discussed','Continue treatment; kidney function and potassium checked yearly']},
 vitals:{sbp:10,dbp:5},plan:'Hypertension: continue home medicines unless blood pressure is low; hold for systolic below 100.',los:0});
