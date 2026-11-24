HOSP.comorbidity({key:'copd',name:'Chronic obstructive pulmonary disease',icd:'J44.9',prior:[.02,.1,.17],minAge:40,
 problem:'COPD, [former smoker|current smoker] ([20|30|40] pack-years)',pmh:'COPD diagnosed {year}',home:['albmdi'],
 opd:{clinic:{key:'pulmc',p:.35},every:[26,52],tracks:{},ladder:{steps:['tiotropium','+budform']},
  sx:['breathless on one flight of stairs','[one|two] flare-ups in the past year needing steroid tablets','morning cough with white sputum','using the reliever inhaler [daily|a few times a week]'],
  plan:['Inhaler technique checked and corrected','Pulmonary rehabilitation referral offered','Vaccines reviewed; action plan for flare-ups updated','Smoking: [not smoking|ready to cut down; support offered]']},
 vitals:{spo2:-2,rr:1},plan:'COPD: continue inhalers, target saturation 88 to 92%.',interact:{hap:1.6},los:.3});
