HOSP.comorbidity({key:'af',name:'Atrial fibrillation',icd:'I48.91',prior:[.005,.05,.17],minAge:45,
 problem:'Atrial fibrillation on apixaban',pmh:'Atrial fibrillation since {year}, on anticoagulation',home:['apixaban5'],
 opd:{clinic:{key:'epc',p:.3},every:[26,52],tracks:{hr:{start:[78,104],drift:0,noise:6,floor:58}},
  ladder:{on:'hr',above:95,effect:12,steps:['metosucc25','metosucc50','metosucc100','+diltcd180']},
  sx:['occasional palpitations, no fainting','no bleeding; takes the blood thinner twice daily','breathless on hills only','no awareness of the rhythm'],
  plan:['Stroke and bleeding risks reviewed; continue anticoagulation','Rate control adequate; smart-watch tracings reviewed','Limit alcohol; sleep study if snoring persists']},
 vitals:{hr:7},flags:['anticoag'],plan:'Atrial fibrillation: continue rate control and anticoagulation unless bleeding or a procedure is planned.',interact:{afrvr:0,bleed:1.7},los:.2});
