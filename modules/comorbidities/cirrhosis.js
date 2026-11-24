HOSP.comorbidity({key:'cirrhosis',name:'Cirrhosis',icd:'K74.60',prior:[.006,.02,.02],minAge:35,
 problem:'Compensated cirrhosis ([alcohol-related|fatty liver disease])',pmh:'Cirrhosis, compensated; last endoscopy [2025|2024]: [no varices|small varices]',
 opd:{clinic:{key:'hepc',p:.6},every:[26],tracks:{plt:{start:[80,150],drift:-1,noise:9,floor:55},tbil:{start:[.9,2.2],drift:.02,noise:.2,floor:.6},alb:{start:[3.0,3.9],drift:-.02,noise:.12,floor:2.5},inr:{start:[1.1,1.4],drift:.005,noise:.05,floor:1}},
  sx:['no swelling of the abdomen, confusion or black stools','[not drinking alcohol for {yrs} months|drinking less]','appetite fair; one late-evening snack as advised'],
  plan:['Liver ultrasound every 6 months','Endoscopy for varices as scheduled','Vaccines for hepatitis A and B checked','Avoid anti-inflammatory drugs; acetaminophen up to 2 g a day is safe']},
 flags:['hepatic'],avoid:['nsaid'],plan:'Cirrhosis: avoid sedatives and anti-inflammatory drugs, limit acetaminophen to 2 g a day, watch for confusion.',interact:{aki:1.8,bleed:1.8,delirium:1.5},los:.5});
