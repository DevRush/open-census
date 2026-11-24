HOSP.comorbidity({key:'cahx',name:'History of cancer',icd:'Z85.9',prior:[.02,.07,.14],minAge:30,
 problem:'History of [breast|colon|prostate|bladder|kidney] cancer, in remission',pmh:'[Breast|Colon|Prostate|Bladder|Kidney] cancer treated in {year}, no recurrence',
 opd:{clinic:{key:'oncm',p:.3},every:[26,52],tracks:{cea:{start:[1,3.5],drift:0,noise:.4,floor:.6}},
  sx:['no new lumps, weight loss or bone pain','energy back to normal','anxious before scans; reassured by results'],
  plan:['Surveillance imaging and tumour marker as scheduled','Survivorship plan reviewed','Report new pain, weight loss or bleeding early']},
 plan:'Cancer history: no active treatment; inform the oncology team of this admission.',interact:{dvt:1.6},los:0});
