/* modules/shared/tables.js — laboratory tests, vital signs, dose frequencies, routes. Shared by every module.
   Modules refer to these by KEY; never repeat names, units or reference ranges inside a module. */
(function(H){
var T=H.T;
/* Lab tests. key:[name, unit, low, high, typical normal value, person-to-person spread, draw-to-draw noise, decimals, panel, floor, ceiling]
   A condition's `course` gives typical VALUES; the engine adds (value - typical normal) to the patient's own baseline. */
var L={
 na:['Sodium','mmol/L',135,145,139,1.8,1,0,'Chemistry',105,175], k:['Potassium','mmol/L',3.5,5.1,4.1,.25,.15,1,'Chemistry',2,8.5],
 cl:['Chloride','mmol/L',98,107,103,1.6,1,0,'Chemistry',75,130], hco3:['Bicarbonate','mmol/L',22,29,25,1.4,1,0,'Chemistry',4,45],
 bun:['Urea nitrogen','mg/dL',7,20,14,3,1.2,0,'Chemistry',2,180], cr:['Creatinine','mg/dL',0.5,1.1,0.85,.12,.04,2,'Chemistry',0.15,14],
 glu:['Glucose','mg/dL',70,140,98,8,9,0,'Chemistry',30,900], ca:['Calcium','mg/dL',8.6,10.2,9.3,.25,.15,1,'Chemistry',5,15],
 mg:['Magnesium','mg/dL',1.7,2.4,2.0,.12,.08,1,'Chemistry',0.8,5], phos:['Phosphate','mg/dL',2.5,4.5,3.5,.35,.25,1,'Chemistry',0.8,10],
 hgb:['Haemoglobin','g/dL',12,16,13.6,.9,.25,1,'Blood count',4,20], wbc:['White cells','×10⁹/L',4,11,7.2,1.3,.6,1,'Blood count',0.1,60],
 plt:['Platelets','×10⁹/L',150,400,245,45,14,0,'Blood count',3,900], neut:['Neutrophils','×10⁹/L',1.8,7.5,4.3,.9,.4,1,'Blood count',0,50],
 alt:['Alanine aminotransferase','U/L',7,45,24,7,3,0,'Liver panel',4,5000], ast:['Aspartate aminotransferase','U/L',8,40,23,6,3,0,'Liver panel',5,5000],
 alp:['Alkaline phosphatase','U/L',40,130,78,18,5,0,'Liver panel',20,1500], tbil:['Bilirubin, total','mg/dL',0.2,1.2,0.6,.18,.08,1,'Liver panel',0.1,30],
 alb:['Albumin','g/dL',3.5,5.0,4.1,.25,.1,1,'Liver panel',1.2,5.5], lipase:['Lipase','U/L',10,60,32,9,4,0,'Liver panel',5,9000],
 inr:['INR','ratio',0.8,1.2,1.0,.05,.04,1,'Clotting',0.8,9], ptt:['Activated partial thromboplastin time','seconds',25,36,30,2,1.5,0,'Clotting',20,150],
 fib:['Fibrinogen','mg/dL',200,400,300,40,15,0,'Clotting',40,900], ddimer:['D-dimer','mg/L FEU',0,0.5,0.3,.1,.05,2,'Clotting',0.1,30],
 trop:['Troponin T, high sensitivity','ng/L',0,14,7,3,1,0,'Cardiac markers',3,20000], bnp:['B-type natriuretic peptide','pg/mL',0,100,45,22,8,0,'Cardiac markers',5,9000],
 ck:['Creatine kinase','U/L',30,200,110,35,12,0,'Cardiac markers',15,90000],
 crp:['C-reactive protein','mg/L',0,5,2.5,1.2,.6,0,'Inflammatory markers',0.5,480], procal:['Procalcitonin','ng/mL',0,0.25,0.06,.02,.02,2,'Inflammatory markers',0.02,120],
 lactate:['Lactate','mmol/L',0.5,2.0,1.1,.2,.15,1,'Inflammatory markers',0.4,18], esr:['Sedimentation rate','mm/h',0,20,10,5,2,0,'Inflammatory markers',1,140],
 ph:['pH (venous)','',7.32,7.42,7.37,.01,.01,2,'Blood gas',6.8,7.7], pco2:['Carbon dioxide (venous)','mmHg',40,52,46,2,2,0,'Blood gas',15,120],
 bhb:['Beta-hydroxybutyrate','mmol/L',0,0.4,0.15,.05,.04,1,'Blood gas',0,12],
 a1c:['Haemoglobin A1c','%',4,5.6,5.3,.2,.1,1,'Diabetes and lipids',4,16], ldl:['LDL cholesterol','mg/dL',0,100,112,24,8,0,'Diabetes and lipids',20,300],
 hdl:['HDL cholesterol','mg/dL',40,90,52,10,3,0,'Diabetes and lipids',15,110], tg:['Triglycerides','mg/dL',0,150,128,40,18,0,'Diabetes and lipids',30,2000],
 tsh:['Thyroid stimulating hormone','mIU/L',0.4,4.5,1.9,.7,.3,2,'Endocrine',0.01,120], vitd:['Vitamin D, 25-hydroxy','ng/mL',30,80,31,8,3,0,'Endocrine',5,120],
 egfr:['Estimated glomerular filtration rate','mL/min/1.73 m²',60,130,88,10,4,0,'Kidney',3,130], uacr:['Urine albumin-to-creatinine ratio','mg/g',0,30,12,6,5,0,'Kidney',2,6000],
 pth:['Parathyroid hormone','pg/mL',15,65,42,10,6,0,'Kidney',5,1500], ferritin:['Ferritin','ng/mL',30,300,110,50,10,0,'Iron studies',3,5000],
 uric:['Uric acid','mg/dL',2.5,7,5.2,.9,.3,1,'Chemistry',1,16], amm:['Ammonia','µmol/L',11,35,22,5,4,0,'Liver panel',8,300],
 cea:['Carcinoembryonic antigen','ng/mL',0,5,2,.8,.4,1,'Tumour markers',0.5,2000], ca153:['CA 15-3','U/mL',0,30,16,5,2,0,'Tumour markers',4,2000],
 psa:['Prostate-specific antigen','ng/mL',0,4,1.4,.7,.2,1,'Tumour markers',0.1,900], nbili:['Bilirubin, newborn total','mg/dL',0,12,5,1.5,.5,1,'Newborn',0.5,28],
 lithium:['Lithium level','mmol/L',0.6,1.2,0.8,.1,.06,2,'Drug levels',0,3.5], antixa:['Anti-Xa (heparin)','IU/mL',0.3,0.7,0.5,.08,.08,2,'Clotting',0,1.6],
 vanc:['Vancomycin trough','mg/L',10,20,14,2,1.5,1,'Drug levels',2,45], uosm:['Urine specific gravity','',1.005,1.03,1.015,.004,.003,3,'Urine',1.001,1.04]};
T.labs={};for(var k in L){var a=L[k];T.labs[k]={key:k,name:a[0],unit:a[1],lo:a[2],hi:a[3],mean:a[4],sd:a[5],noise:a[6],dec:a[7],panel:a[8],min:a[9],max:a[10]};}
T.labs.hgb.soft=[7.6,19];T.labs.k.soft=[2.9,6.3];T.labs.na.soft=[121,153];T.labs.plt.soft=[9,800];T.labs.glu.soft=[38,620];T.labs.hco3.soft=[7,40];
T.labs.hgb.sex={M:{lo:13.5,hi:17.5,mean:14.8},F:{lo:12,hi:16,mean:13.2}};
T.labs.cr.sex={M:{lo:0.6,hi:1.3,mean:0.95},F:{lo:0.5,hi:1.1,mean:0.78}};
T.panelOrder=['Chemistry','Blood count','Cardiac markers','Inflammatory markers','Liver panel','Clotting','Blood gas','Kidney','Diabetes and lipids','Endocrine','Iron studies','Tumour markers','Drug levels','Newborn','Urine'];
T.corePanels={Chemistry:['na','k','cl','hco3','bun','cr','glu'],'Blood count':['hgb','wbc','plt']};
T.thirdPanel=['alt','ast','alp','tbil','alb'];     // added when a module supplies fewer than three panels

/* Vital signs. key:{label, unit, lo, hi, typical normal, person spread, reading noise, decimals, floor, ceiling} */
T.vitals={
 temp:{l:'Temperature',u:'°C',lo:36,hi:38,mean:36.8,sd:.15,noise:.15,dec:1,min:33,max:41.5},
 hr:{l:'Heart rate',u:'/min',lo:50,hi:100,mean:76,sd:7,noise:3,dec:0,min:30,max:200},
 rr:{l:'Respiratory rate',u:'/min',lo:10,hi:22,mean:16,sd:1,noise:1,dec:0,min:6,max:60},
 sbp:{l:'Blood pressure',u:'mmHg',lo:90,hi:160,mean:124,sd:9,noise:4,dec:0,min:55,max:240},
 dbp:{l:'Diastolic',u:'mmHg',lo:50,hi:95,mean:74,sd:6,noise:3,dec:0,min:30,max:130},
 spo2:{l:'Oxygen saturation',u:'%',lo:92,hi:101,mean:97,sd:.8,noise:.7,dec:0,min:70,max:100},
 o2:{l:'Oxygen delivery',u:'L/min',lo:-1,hi:999,mean:0,sd:0,noise:0,dec:0,min:0,max:100},
 pain:{l:'Pain',u:'0–10',lo:-1,hi:6,mean:0.6,sd:.5,noise:.8,dec:0,min:0,max:10}};
/* Normal vital signs by age for children: [max age in years, heart rate, respiratory rate, systolic, diastolic] */
T.pedsVitals=[[0.1,140,45,70,42],[1,125,36,88,52],[3,110,28,94,56],[6,98,24,98,60],[12,86,20,104,64],[18,76,17,114,68]];

/* Dose frequencies. key:[words used in the sig, clock hours when doses fall] */
T.freq={daily:['daily',[9]],am:['every morning',[6.5]],nightly:['nightly',[21]],bid:['twice daily',[9,21]],tid:['three times daily',[9,14,21]],qid:['four times daily',[9,13,17,21]],
 ac:['three times daily with meals',[8,12,18]],q4h:['every 4 hours',[2,6,10,14,18,22]],q6h:['every 6 hours',[0,6,12,18]],q8h:['every 8 hours',[6,14,22]],q12h:['every 12 hours',[9,21]],
 q24h:['every 24 hours',[14]],q48h:['every 48 hours',[10]],weekly:['once weekly',[9]],once:['once',[]],mwf:['Monday, Wednesday and Friday',[9]],
 'prn-q4h':['every 4 hours as needed',[]],'prn-q6h':['every 6 hours as needed',[]],'prn-q8h':['every 8 hours as needed',[]],'prn-daily':['daily as needed',[]],'prn-nightly':['nightly as needed',[]],
 'prn-q2h':['every 2 hours as needed',[]],inf:['continuous infusion',[]]};
T.routes={PO:'Oral',IV:'Intravenous',SC:'Subcutaneous',IM:'Intramuscular',INH:'Inhaled',NEB:'Nebulised',TOP:'Topical',PR:'Rectal',SL:'Under the tongue',TD:'Skin patch',EYE:'Eye drops',NG:'By feeding tube',PV:'Vaginal',EPI:'Epidural',NAS:'Nasal'};
})(HOSP);
