/* hospital/clinics.js — outpatient clinics. Pure data. To add a clinic, add one row (see docs/ARCHITECTURE.md).
   [key, name, group, service, module, building, floor, sessions/week, clinicians/session, slots/clinician, extra]
   module : key of a clinic module in modules/clinics/ ('generic' = fallback driven by `reasons`)
   extra  : for module 'generic' -> 'reason; reason; ...' (problems seen here). For a real module -> optional 'pk:a,b' to keep only those problem keys.
   Half-day sessions (Mon–Fri, AM 08:30–12:00, PM 13:00–16:30) are placed deterministically from the clinic key. */
(function(H){
var C=[
 ['pcp','Primary Care Internal Medicine','Primary Care','fm','pcp','OP',1,10,5,9,''],
 ['fmc','Family Medicine','Primary Care','fm','pcp','OP',1,10,4,9,''],
 ['gerc','Geriatrics Clinic','Primary Care','geri','pcp','OP',1,5,2,7,'pk:htn,dm2,ckd,dementia,oa,hf,af'],
 ['urgent','Urgent Care','Primary Care','fm','generic','OP',1,10,3,12,'Upper respiratory infection; Urinary symptoms; Ankle sprain; Skin infection; Low back pain; Sore throat'],
 ['cardc','General Cardiology Clinic','Cardiology','card','cardiology','OP',3,8,3,8,''],
 ['hfc','Heart Failure Clinic','Cardiology','hf','cardiology','OP',3,5,2,8,'pk:hf'],
 ['epc','Arrhythmia and Device Clinic','Cardiology','ep','cardiology','OP',3,4,2,8,'pk:af'],
 ['lipidc','Preventive Cardiology and Lipid Clinic','Cardiology','card','cardiology','OP',3,2,1,8,'pk:cad,htn'],
 ['valvec','Valve and Structural Heart Clinic','Cardiology','card','generic','OP',3,2,1,7,'Aortic stenosis surveillance; Mitral regurgitation; Mechanical valve follow-up; After transcatheter valve replacement'],
 ['anticoag','Anticoagulation Clinic','Cardiology','pharm','generic','OP',3,5,2,14,'Warfarin monitoring for atrial fibrillation; Warfarin monitoring for mechanical valve; Warfarin after venous thrombosis'],
 ['endoc','Diabetes Clinic','Endocrinology','endo','endocrinology','OP',4,8,3,8,'pk:dm2,dm1'],
 ['endog','Endocrinology Clinic','Endocrinology','endo','endocrinology','OP',4,5,2,8,'pk:hypothyroid,osteoporosis,dm2'],
 ['diabedc','Diabetes Education','Endocrinology','diabed','generic','OP',4,5,2,6,'Insulin start teaching; Glucose sensor training; Carbohydrate counting; Insulin pump review'],
 ['nephc','Kidney Clinic','Nephrology','neph','nephrology','OP',4,6,2,8,''],
 ['txc','Transplant Clinic','Nephrology','txneph','generic','OP',4,5,2,8,'Kidney transplant follow-up; Liver transplant follow-up; Transplant evaluation; Waiting-list annual review'],
 ['hepc','Hepatology Clinic','Digestive','hep','generic','OP',4,4,2,8,'Cirrhosis surveillance; Fatty liver disease; Chronic hepatitis B; Hepatitis C treatment follow-up; Abnormal liver tests'],
 ['gic','Gastroenterology Clinic','Digestive','gi','generic','OP',4,6,2,9,'Gastro-oesophageal reflux; Irritable bowel syndrome; Iron-deficiency anaemia work-up; Coeliac disease; Colon polyp surveillance'],
 ['ibdc','Inflammatory Bowel Disease Clinic','Digestive','gi','generic','OP',4,2,1,8,'Crohn’s disease on biologic therapy; Ulcerative colitis; Flare review'],
 ['pulmc','Pulmonary Clinic','Pulmonary','pulm','generic','OP',5,6,2,8,'COPD review; Asthma; Interstitial lung disease; Lung nodule surveillance; Chronic cough; Bronchiectasis'],
 ['sleepc','Sleep Medicine Clinic','Pulmonary','pulm','generic','OP',5,3,1,8,'Obstructive sleep apnoea on positive airway pressure; Insomnia; Restless legs'],
 ['idc','Infectious Diseases Clinic','Infectious Diseases','idsvc','generic','OP',5,3,2,7,'Outpatient intravenous antibiotic follow-up; Bone and joint infection; Recurrent urinary infection; Travel advice'],
 ['hivc','HIV and Sexual Health Clinic','Infectious Diseases','idsvc','generic','OP',5,3,2,8,'HIV on antiretroviral therapy; Pre-exposure prophylaxis; Hepatitis co-infection'],
 ['rheumc','Rheumatology Clinic','Rheumatology','rheum','generic','OP',5,5,2,8,'Rheumatoid arthritis; Gout; Polymyalgia rheumatica; Lupus; Psoriatic arthritis'],
 ['dermc','Dermatology Clinic','Dermatology','derm','generic','OP',5,8,3,12,'Psoriasis; Skin cancer surveillance; Eczema; Acne; Suspicious mole'],
 ['allergyc','Allergy and Immunology Clinic','Allergy','allergy','generic','OP',5,3,1,8,'Allergic rhinitis; Drug allergy testing; Food allergy; Chronic hives'],
 ['haemc','Haematology Clinic','Cancer','haem','generic','CC',2,5,2,8,'Iron-deficiency anaemia; Immune thrombocytopenia; Myeloma on treatment; Lymphoma surveillance; Venous thrombosis follow-up'],
 ['haemuc','Haematology Urgent Clinic','Cancer','haem','generic','CC',2,5,1,5,'Abnormal blood count; Fever during chemotherapy; Transfusion review'],
 ['oncm','Medical Oncology Clinic','Cancer','onc','oncology','CC',1,10,4,8,''],
 ['breastc','Breast Oncology Clinic','Cancer','onc','oncology','CC',1,4,2,8,'pk:breast'],
 ['radoncc','Radiation Oncology Clinic','Cancer','radonc','generic','CC',1,5,2,8,'On-treatment review; Planning visit; Follow-up after radiotherapy'],
 ['gynoncc','Gynaecologic Oncology Clinic','Cancer','gynonc','generic','CC',3,3,1,8,'Ovarian cancer follow-up; Endometrial cancer follow-up; New pelvic mass'],
 ['pallc','Palliative Care Clinic','Cancer','pallsvc','generic','CC',3,3,1,6,'Cancer pain; Symptom review; Goals-of-care conversation'],
 ['neuroc','General Neurology Clinic','Neuroscience','neurol','generic','OP',6,6,2,7,'Peripheral neuropathy; Migraine review; Tremor; Multiple sclerosis; Dizziness'],
 ['strokec','Stroke Clinic','Neuroscience','stroke','generic','OP',6,3,1,7,'Follow-up after ischaemic stroke; Follow-up after transient ischaemic attack; Carotid stenosis'],
 ['epilc','Epilepsy Clinic','Neuroscience','neurol','generic','OP',6,3,1,7,'Focal epilepsy; First seizure; Medicine review before pregnancy'],
 ['movc','Movement Disorders Clinic','Neuroscience','neurol','generic','OP',6,2,1,7,'Parkinson’s disease review; Essential tremor; Dystonia'],
 ['memc','Memory Clinic','Neuroscience','geri','generic','OP',6,3,1,6,'Mild cognitive impairment; Alzheimer’s disease review; New memory concerns'],
 ['headc','Headache Clinic','Neuroscience','neurol','generic','OP',6,2,1,8,'Chronic migraine; Cluster headache; Medication-overuse headache'],
 ['nsc','Neurosurgery Clinic','Neuroscience','nsgy','generic','OP',6,3,2,7,'Post-operative check after craniotomy; Chronic subdural follow-up; Brain tumour surveillance; Shunt review'],
 ['spinec','Spine Clinic','Orthopaedics','spine','orthopaedics','OP',2,4,2,8,'pk:backpain'],
 ['orthoc','Orthopaedic Clinic','Orthopaedics','ortho','orthopaedics','OP',2,8,3,10,''],
 ['jointc','Hip and Knee Replacement Clinic','Orthopaedics','ortho','orthopaedics','OP',2,4,2,9,'pk:kneeoa,hipoa,postarthro'],
 ['fracc','Fracture Clinic','Orthopaedics','ortho','orthopaedics','OP',2,5,2,12,'pk:fracture'],
 ['sportsc','Sports Medicine Clinic','Orthopaedics','ortho','orthopaedics','OP',2,3,1,10,'pk:rotator,kneeoa'],
 ['handc','Hand Clinic','Orthopaedics','plast','generic','OP',2,3,1,10,'Carpal tunnel syndrome; Trigger finger; Wrist fracture follow-up; Tendon repair follow-up'],
 ['gsc','General Surgery Clinic','Surgery','gensurg','generic','OP',2,5,2,9,'Hernia assessment; Gallstones; Post-operative check; Breast lump; Skin lesion excision'],
 ['colc','Colorectal Surgery Clinic','Surgery','colorectal','generic','OP',2,3,1,8,'Colon cancer follow-up; Diverticular disease; Haemorrhoids; Stoma review'],
 ['hpbc','Liver and Pancreas Surgery Clinic','Surgery','hpb','generic','OP',2,2,1,7,'Pancreatic cyst surveillance; Post-operative check after liver resection; Gallbladder polyp'],
 ['bariatric','Weight Management and Bariatric Clinic','Surgery','gensurg','generic','OP',2,3,1,8,'Pre-operative assessment for weight-loss surgery; Follow-up after sleeve gastrectomy; Medical weight management'],
 ['vascc','Vascular Surgery Clinic','Surgery','vasc','generic','OP',2,3,1,8,'Aortic aneurysm surveillance; Peripheral arterial disease; Carotid surveillance; Leg ulcer'],
 ['thorc','Thoracic Surgery Clinic','Surgery','thor','generic','OP',2,2,1,7,'Lung nodule for resection; Post-operative check after lobectomy; Oesophageal disease'],
 ['csc','Cardiac Surgery Clinic','Surgery','cardsurg','generic','OP',3,2,1,7,'Post-operative check after bypass surgery; Valve surgery planning; Sternal wound check'],
 ['urolc','Urology Clinic','Surgery','urol','generic','OP',2,6,2,10,'Kidney stone surveillance; Enlarged prostate; Raised prostate marker; Blood in urine work-up; Bladder cancer surveillance'],
 ['entc','Ear, Nose and Throat Clinic','Surgery','ent','generic','OP',5,6,2,11,'Chronic sinusitis; Hearing loss; Hoarse voice; Thyroid nodule; Recurrent tonsillitis'],
 ['ophc','Eye Clinic','Surgery','ophth','generic','OP',5,10,3,14,'Cataract assessment; Glaucoma; Diabetic eye screening; Macular degeneration injections'],
 ['plastc','Plastic Surgery Clinic','Surgery','plast','generic','OP',2,3,1,9,'Skin cancer reconstruction; Breast reconstruction follow-up; Scar review'],
 ['burnc','Burn Clinic','Surgery','burn','generic','OP',2,2,1,8,'Burn dressing review; Scar management; Skin graft follow-up'],
 ['woundc','Wound Care Clinic','Surgery','wound','generic','OP',2,5,2,8,'Diabetic foot ulcer; Venous leg ulcer; Pressure injury; Surgical wound'],
 ['preop','Pre-operative Assessment Clinic','Perioperative','anaes','generic','OP',2,10,3,9,'Assessment before joint replacement; Assessment before abdominal surgery; Assessment before cardiac surgery'],
 ['painc','Pain Medicine Clinic','Perioperative','pain','generic','OP',2,4,2,8,'Chronic low back pain; Nerve pain; Injection review; Opioid taper'],
 ['obc','Antenatal Clinic','Women','obst','generic','WC',1,10,3,11,'Routine prenatal visit; Booking visit; Glucose tolerance test review; Postnatal check'],
 ['mfmc','Maternal-Fetal Medicine Clinic','Women','mfm','generic','WC',1,5,2,8,'Growth scan; Pre-existing diabetes in pregnancy; Hypertension in pregnancy; Twin pregnancy'],
 ['gync','Gynaecology Clinic','Women','gyn','generic','WC',1,6,2,10,'Heavy periods; Fibroids; Menopausal symptoms; Contraception; Abnormal cervical screening'],
 ['pedpc','Paediatric Primary Care','Children','peds','generic','WC',1,10,3,11,'Well-child check; Asthma review; Ear infection; Immunisation visit; Eczema; Growth concern'],
 ['pedcardc','Paediatric Cardiology Clinic','Children','peds','generic','WC',1,2,1,7,'Heart murmur; Repaired congenital heart disease; Fainting'],
 ['pedendoc','Paediatric Diabetes and Endocrine Clinic','Children','peds','generic','WC',1,3,1,7,'Type 1 diabetes; Short stature; Early puberty'],
 ['pedhaemc','Paediatric Haematology Clinic','Children','pedhaem','generic','WC',1,3,1,7,'Sickle cell disease review; Leukaemia maintenance; Iron deficiency'],
 ['pedneuroc','Paediatric Neurology Clinic','Children','peds','generic','WC',1,2,1,7,'Epilepsy; Headache; Developmental delay'],
 ['pedpulmc','Paediatric Asthma and Allergy Clinic','Children','peds','generic','WC',1,3,1,8,'Asthma; Food allergy; Cystic fibrosis review'],
 ['psyc','Outpatient Psychiatry','Behavioural Health','psych','generic','BR',1,10,4,7,'Depression; Bipolar disorder monitoring; Anxiety; Schizophrenia depot visit; Post-discharge review'],
 ['addc','Addiction Medicine Clinic','Behavioural Health','addict','generic','BR',1,5,2,8,'Buprenorphine maintenance; Alcohol use disorder; Harm reduction screening'],
 ['rehabc','Rehabilitation Medicine Clinic','Rehabilitation','pmr','generic','BR',1,4,2,7,'Stroke rehabilitation follow-up; Spasticity injections; Amputee clinic; Spinal cord injury review']];
var grp={};
H.model.clinics=C.map(function(c,i){var ex=c[10]||'',pk=null,reasons=null;
  if(/^pk:/.test(ex))pk=ex.slice(3).split(',');else if(ex)reasons=ex.split(/;\s*/);
  /* place sessions: spread n half-days over the 10 weekly half-day slots, starting at a clinic-specific offset */
  var n=c[7],off=H.hash('sess'+c[0])%10,ses=[],step=10/n;for(var j=0;j<n;j++){var s=(off+Math.floor(j*step))%10;ses.push({dow:1+Math.floor(s/2),half:s%2?'PM':'AM'});}
  ses.sort(function(a,b){return a.dow-b.dow||(a.half<b.half?-1:1);});
  grp[c[2]]=(grp[c[2]]||0)+1;
  return {key:c[0],name:c[1],group:c[2],service:c[3],module:c[4],building:c[5],floor:c[6],suite:'Suite '+c[6]+String.fromCharCode(65+(grp[c[2]]-1)%26),
    sessions:ses,clinicians:c[8],slots:c[9],pk:pk,reasons:reasons,index:i};});
H.model.clinicByKey={};H.model.clinics.forEach(function(c){H.model.clinicByKey[c.key]=c;});
/* Map free-text departments used by the hand-written cases' `encounters` to clinic keys (first match wins). */
H.model.deptMap=[[/paediatric primary/i,'pedpc'],[/paediatric haem/i,'pedhaemc'],[/urgent care/i,'urgent'],[/primary care|family/i,'pcp'],[/stroke/i,'strokec'],[/memory/i,'memc'],[/movement/i,'movc'],
 [/neurology/i,'neuroc'],[/maternal|mfm/i,'mfmc'],[/obstet|antenatal|prenatal/i,'obc'],[/gynaecologic onc/i,'gynoncc'],[/gynaec/i,'gync'],[/allergy/i,'allergyc'],[/urgent clinic/i,'haemuc'],[/haematology/i,'haemc'],
 [/hepatology/i,'hepc'],[/transplant/i,'txc'],[/diabetes education/i,'diabedc'],[/endocrin|diabetes/i,'endoc'],[/orthopaedic/i,'orthoc'],[/harm reduction|addiction/i,'addc'],[/psychiatry/i,'psyc'],
 [/kidney|nephrol|dialysis/i,'nephc'],[/anticoag/i,'anticoag'],[/cardiology/i,'cardc'],[/oncology/i,'oncm'],[/urology/i,'urolc'],[/geriatric/i,'gerc'],[/dentist/i,null]];
/* Future follow-up appointments for hand-written cases: [patient id, clinic, days after base now, visit label] */
H.model.handFollow=[['p3','hfc',7,'Hospital follow-up'],['p3','nephc',16,'Hospital follow-up'],['p2','colc',13,'Post-operative check'],['p2','oncm',20,'New patient'],['p1','pcp',10,'Hospital follow-up'],
 ['p4','strokec',21,'Hospital follow-up'],['p5','fracc',14,'Post-operative check'],['p6','obc',7,'Postnatal blood pressure check'],['p9','hepc',9,'Hospital follow-up'],['p12','endoc',3,'Hospital follow-up'],
 ['p13','anticoag',6,'New patient'],['p13','orthoc',15,'Return visit'],['p15','csc',17,'Post-operative check'],['p16','psyc',8,'Post-discharge review'],['p19','urolc',10,'Stent follow-up'],
 ['p22','obc',14,'Postnatal check'],['p24','nsc',20,'Hospital follow-up'],['p17','nephc',2,'Return visit'],['p11','txc',6,'Post-transplant check'],['p14','idc',15,'Hospital follow-up'],['p8','haemc',24,'Return visit']];
})(HOSP);
