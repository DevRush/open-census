HOSP.comorbidity({key:'hf',name:'Chronic heart failure',icd:'I50.22',prior:[.008,.05,.14],minAge:40,
 problem:'Chronic heart failure with reduced ejection fraction',pmh:'Heart failure, ejection fraction [30|35|40]% on last echocardiogram',home:['furo40','atorva40'],
 opd:{clinic:{key:'hfc',p:.5},every:[8,13],tracks:{sbp:{start:[112,138],drift:0,noise:6,floor:96},bnp:{start:[380,1400],drift:10,noise:90,floor:120}},
  ladder:{on:'bnp',above:400,effect:170,startMax:2,steps:['metosucc25','+lisinopril5','metosucc50','+spiro25','+empa10','metosucc100']},
  sx:['weight steady on the home scale; sleeps on [one pillow|two pillows]','breathless walking uphill, fine on the flat','ankles swell by evening, down by morning','no dizziness on standing'],
  plan:['Daily weights; call if up 1.5 kg in 2 days','Fluid 1.5 to 2 L a day and low-salt diet reinforced','Chemistry 1 week after any dose change','Echocardiogram yearly; device discussion if ejection fraction stays at or below 35%']},
 labs:{bnp:310},flags:['hf'],plan:'Heart failure: daily weight, avoid excess fluid, continue home regimen as blood pressure and kidney function allow.',interact:{aki:1.6,afrvr:1.5},los:.4});
