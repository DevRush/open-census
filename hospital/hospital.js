/* hospital/hospital.js — the hospital model: buildings, inpatient units, services, operating rooms.
   Pure data. To add a unit, add one row to UNITS (see docs/ARCHITECTURE.md). */
(function(H){
var M=H.model;
M.name='Northfield Medical Center';   // the ONLY place the hospital name is written; change it here
M.buildings=[
 {key:'MT',name:'Main Tower',floors:9},
 {key:'HP',name:'Hartwell Heart, Neuroscience and Trauma Pavilion',floors:5},
 {key:'WC',name:'Women and Children’s Building',floors:4},
 {key:'BR',name:'Brightwater Behavioural Health and Rehabilitation Centre',floors:3},
 {key:'OP',name:'Marlowe Outpatient Pavilion',floors:6},
 {key:'CC',name:'Cancer Centre',floors:3}];

/* Inpatient units.
   [key, name, bed prefix, beds, building, floor, kinds, acuity, population, services]
   kinds    : unit kinds used to match condition modules (first = most specific). A module lists kinds in `units`.
   acuity   : 'icu' (hourly observations, twice-daily labs) | 'step' | 'ward' | 'ed'
   population: 'adult' | 'peds' | 'neonate' | 'ob' | 'psych'
   services : default primary services for this unit ("svc" or "svc:weight"); ICUs always use their first service.
   The first 14 rows are the original units; their keys, names and prefixes must not change. */
var UNITS=[
 ['icu','Medical ICU','MICU',24,'MT',2,'micu icu','icu','adult','ccm'],
 ['neuro','Neuro ICU','NICU',18,'HP',3,'neuroicu icu','icu','adult','neurocc'],
 ['trauma','Trauma ICU','TICU',18,'HP',2,'ticu sicu icu','icu','adult','trauma'],
 ['cvicu','Cardiac Surgery ICU','CVICU',16,'HP',2,'cvicu icu','icu','adult','cardsurg'],
 ['sx','6 West Surgery','6W',32,'MT',6,'surg','ward','adult','gensurg:4 colorectal:2 urol:2 hpb:1'],
 ['ortho','5 North Orthopaedics','5N',30,'MT',5,'ortho','ward','adult','ortho'],
 ['card','4 East Cardiology','4E',30,'MT',4,'card','ward','adult','card'],
 ['med','3 West Medicine','3W',32,'MT',3,'med','ward','adult','hospmed:5 geri:1 hep:1'],
 ['haem','7 South Haematology','7S',24,'MT',7,'haem onc','ward','adult','haem:3 onc:2'],
 ['tx','Transplant Unit','TX',20,'MT',9,'tx','ward','adult','txneph:2 txsurg:2 hep:1'],
 ['ob','Labour and Postnatal','LP',32,'WC',2,'ob','ward','ob','obst'],
 ['peds','Paediatrics','PD',30,'WC',4,'peds','ward','peds','peds'],
 ['psych','Behavioural Health','BH',28,'BR',2,'psych','ward','psych','psych'],
 ['ed','Emergency Department','ED',48,'MT',1,'ed','ed','adult','em'],
 ['obs','Clinical Observation Unit','OBS',20,'MT',1,'obs med','ward','adult','hospmed:3 card:1'],
 ['msd','Medical Step-down','MSD',20,'MT',2,'stepdown med','step','adult','hospmed:3 pulm:1'],
 ['med3e','3 East Medicine','3E',32,'MT',3,'med','ward','adult','hospmed'],
 ['csd','4 West Cardiac Step-down','4W',24,'MT',4,'cardsd card','step','adult','card'],
 ['ccu','Coronary Care Unit','CCU',16,'MT',4,'ccu card icu','icu','adult','card'],
 ['ortho5s','5 South Spine and Joint','5S',28,'MT',5,'ortho','ward','adult','ortho:4 spine:1'],
 ['sx6e','6 East Surgery','6E',32,'MT',6,'surg','ward','adult','gensurg:3 surgonc:2 ent:1 plast:1'],
 ['ssd','Surgical Step-down','SSD',18,'MT',6,'stepdown surg','step','adult','gensurg:2 vasc:1 thor:1'],
 ['onc','7 North Medical Oncology','7N',30,'MT',7,'onc','ward','adult','onc'],
 ['bmt','Stem Cell Transplant Unit','BMT',16,'MT',7,'bmt haem onc','step','adult','bmt'],
 ['med8w','8 West Medicine','8W',32,'MT',8,'med','ward','adult','hospmed'],
 ['resp','8 East Respiratory Medicine','8E',28,'MT',8,'resp med','ward','adult','pulm:2 hospmed:2'],
 ['hep','8 North Digestive and Liver','8N',24,'MT',8,'gi med','ward','adult','gi:2 hep:2'],
 ['geri','9 West Acute Care for Older Adults','9W',28,'MT',9,'geri med','ward','adult','geri'],
 ['renal','9 East Kidney and Medicine','9E',26,'MT',9,'renal med','ward','adult','neph:2 hospmed:2'],
 ['idm','9 North Infectious Diseases and Medicine','9N',24,'MT',9,'id med','ward','adult','hospmed:3 idsvc:1'],
 ['sicu','Surgical ICU','SICU',20,'HP',2,'sicu icu','icu','adult','sicc'],
 ['burn','Burn Centre','BRN',12,'HP',2,'burn','step','adult','burn'],
 ['cts','Cardiothoracic Step-down','CTS',22,'HP',2,'cts cardsd card','step','adult','cardsurg:3 thor:1'],
 ['nsd','Neuroscience Step-down','NSD',16,'HP',3,'neurosd neurow','step','adult','stroke:2 nsgy:2'],
 ['neurow','4 Pavilion Neurology and Stroke','4P',30,'HP',4,'neurow','ward','adult','neurol:2 stroke:3'],
 ['nsgy','4 Pavilion Neurosurgery','4Q',26,'HP',4,'nsgy neurow surg','ward','adult','nsgy'],
 ['tacs','5 Pavilion Trauma and Acute Care Surgery','5P',28,'HP',5,'traumaw surg','ward','adult','trauma:3 gensurg:1'],
 ['vasc','5 Pavilion Vascular and Thoracic','5Q',26,'HP',5,'vasc surg','ward','adult','vasc:3 thor:2'],
 ['ante','Antepartum Unit','AP',14,'WC',2,'ante ob','ward','ob','mfm'],
 ['gyn','Gynaecology and Gynaecologic Oncology','GY',18,'WC',2,'gyn surg','ward','adult','gyn:2 gynonc:2'],
 ['neo','Neonatal Intensive Care','NN',40,'WC',3,'neonatal','icu','neonate','neonat'],
 ['nursery','Newborn Nursery','NB',28,'WC',2,'nursery','ward','neonate','newborn'],
 ['med2e','2 East Medicine','2E',30,'MT',2,'med','ward','adult','hospmed'],
 ['geri2','9 South Older Adult Medicine','9S',24,'MT',9,'geri med','ward','adult','geri:2 hospmed:1'],
 ['picu','Paediatric ICU','PICU',14,'WC',4,'picu','icu','peds','pedcc'],
 ['pho','Paediatric Haematology and Oncology','PHO',14,'WC',4,'pedonc peds','ward','peds','pedhaem'],
 ['psurg','Paediatric Surgery and Adolescent','PS',16,'WC',4,'pedsurg peds','ward','peds','pedsurg:2 peds:2'],
 ['gpsych','Older Adult Behavioural Health','OA',14,'BR',2,'gpsych psych','ward','psych','gpsych'],
 ['rehab','Inpatient Rehabilitation','RH',28,'BR',1,'rehab','ward','adult','pmr'],
 ['pall','Palliative Care Unit','PCU',12,'BR',3,'pall','ward','adult','pallsvc'],
 ['ss','Short-stay Surgical Unit','SS',16,'MT',2,'shortstay surg','ward','adult','gensurg:2 urol:1 ortho:1 ent:1']];
M.units=UNITS.map(function(u,i){return {key:u[0],name:u[1],prefix:u[2],beds:u[3],building:u[4],floor:u[5],kinds:u[6].split(' '),acuity:u[7],pop:u[8],
  services:u[9].split(' ').map(function(s){var p=s.split(':');return [p[0],+(p[1]||1)];}),index:i};});
M.unitByKey={};M.units.forEach(function(u){M.unitByKey[u.key]=u;});

/* Services. [key, name, group, attendings, fellows, inpatient teams, resident programme, flags]
   flags: p = primary (admitting) service, c = consult service. Note title for consults = name + ' consult'. */
var SV=[
 ['hospmed','Hospital Medicine','Medicine',38,0,10,'Internal Medicine','p'],
 ['geri','Geriatric Medicine','Medicine',8,3,2,'Internal Medicine','pc'],
 ['card','Cardiology','Medicine',22,9,4,'Internal Medicine','pc'],
 ['hf','Advanced Heart Failure','Medicine',6,3,0,'Internal Medicine','c'],
 ['ep','Cardiac Electrophysiology','Medicine',5,3,0,'Internal Medicine','c'],
 ['ccm','Medical ICU','Critical Care',12,6,3,'Internal Medicine','p'],
 ['pulm','Pulmonary Medicine','Medicine',12,6,2,'Internal Medicine','pc'],
 ['gi','Gastroenterology','Medicine',12,6,1,'Internal Medicine','pc'],
 ['hep','Hepatology','Medicine',7,3,1,'Internal Medicine','pc'],
 ['neph','Kidney Medicine','Medicine',11,5,1,'Internal Medicine','pc'],
 ['idsvc','Infectious Diseases','Medicine',10,4,1,'Internal Medicine','pc'],
 ['endo','Endocrinology and Diabetes','Medicine',9,3,0,'Internal Medicine','c'],
 ['rheum','Rheumatology','Medicine',7,2,0,'Internal Medicine','c'],
 ['derm','Dermatology','Medicine',8,0,0,'Dermatology','c'],
 ['allergy','Allergy and Immunology','Medicine',4,2,0,'Internal Medicine','c'],
 ['haem','Haematology','Cancer',10,5,2,'Internal Medicine','pc'],
 ['onc','Medical Oncology','Cancer',18,7,2,'Internal Medicine','pc'],
 ['bmt','Stem Cell Transplant and Cellular Therapy','Cancer',7,3,1,'Internal Medicine','p'],
 ['radonc','Radiation Oncology','Cancer',7,0,0,'Radiation Oncology','c'],
 ['pallsvc','Palliative Care','Medicine',7,3,1,'Internal Medicine','pc'],
 ['neurol','Neurology','Neuroscience',14,5,2,'Neurology','pc'],
 ['stroke','Stroke Neurology','Neuroscience',6,3,2,'Neurology','pc'],
 ['neurocc','Neurocritical Care','Neuroscience',6,3,2,'Neurology','p'],
 ['nsgy','Neurosurgery','Neuroscience',10,2,2,'Neurosurgery','pc'],
 ['gensurg','General Surgery','Surgery',12,0,3,'General Surgery','pc'],
 ['colorectal','Colorectal Surgery','Surgery',5,2,1,'General Surgery','p'],
 ['hpb','Liver, Pancreas and Biliary Surgery','Surgery',4,2,1,'General Surgery','p'],
 ['surgonc','Surgical Oncology','Surgery',5,2,1,'General Surgery','p'],
 ['trauma','Trauma Surgery','Surgery',9,3,2,'General Surgery','pc'],
 ['sicc','Surgical Critical Care','Critical Care',7,3,2,'General Surgery','p'],
 ['burn','Burn Surgery','Surgery',4,1,1,'General Surgery','p'],
 ['vasc','Vascular Surgery','Surgery',6,2,1,'Vascular Surgery','pc'],
 ['thor','Thoracic Surgery','Surgery',5,2,1,'General Surgery','pc'],
 ['cardsurg','Cardiac Surgery','Surgery',7,3,2,'General Surgery','pc'],
 ['txsurg','Transplant Surgery','Transplant',6,3,1,'General Surgery','pc'],
 ['txneph','Transplant Nephrology','Transplant',5,2,1,'Internal Medicine','pc'],
 ['ortho','Orthopaedic Surgery','Surgery',16,4,3,'Orthopaedic Surgery','pc'],
 ['spine','Spine Surgery','Surgery',5,2,1,'Orthopaedic Surgery','p'],
 ['urol','Urology','Surgery',9,2,1,'Urology','pc'],
 ['ent','Otolaryngology','Surgery',8,2,1,'Otolaryngology','pc'],
 ['plast','Plastic Surgery','Surgery',6,1,1,'Plastic Surgery','pc'],
 ['ophth','Ophthalmology','Surgery',9,2,0,'Ophthalmology','c'],
 ['obst','Obstetrics','Women',14,0,2,'Obstetrics and Gynaecology','p'],
 ['mfm','Maternal-Fetal Medicine','Women',6,3,1,'Obstetrics and Gynaecology','pc'],
 ['gyn','Gynaecology','Women',9,0,1,'Obstetrics and Gynaecology','pc'],
 ['gynonc','Gynaecologic Oncology','Women',4,2,1,'Obstetrics and Gynaecology','p'],
 ['peds','Paediatrics','Children',18,0,3,'Paediatrics','p'],
 ['pedcc','Paediatric Critical Care','Children',7,3,1,'Paediatrics','p'],
 ['neonat','Neonatology','Children',10,4,3,'Paediatrics','p'],
 ['newborn','Newborn Medicine','Children',6,0,2,'Paediatrics','p'],
 ['pedhaem','Paediatric Haematology-Oncology','Children',6,3,1,'Paediatrics','pc'],
 ['pedsurg','Paediatric Surgery','Children',5,2,1,'General Surgery','pc'],
 ['psych','Psychiatry','Behavioural Health',14,3,3,'Psychiatry','pc'],
 ['gpsych','Geriatric Psychiatry','Behavioural Health',4,1,1,'Psychiatry','p'],
 ['addict','Addiction Medicine','Behavioural Health',4,2,0,'Psychiatry','c'],
 ['pmr','Rehabilitation Medicine','Rehabilitation',7,0,2,'Rehabilitation Medicine','pc'],
 ['em','Emergency Medicine','Emergency',34,0,4,'Emergency Medicine','p'],
 ['anaes','Anaesthesiology','Perioperative',40,6,0,'Anaesthesiology','c'],
 ['pain','Acute Pain Service','Perioperative',5,2,0,'Anaesthesiology','c'],
 ['ir','Interventional Radiology','Imaging',8,2,0,'Radiology','c'],
 ['rad','Radiology','Imaging',30,6,0,'Radiology',''],
 ['pathsvc','Pathology','Laboratory',14,2,0,'Pathology',''],
 ['fm','Family and Primary Care Medicine','Primary Care',24,0,0,'Family Medicine',''],
 /* non-physician consult services */
 ['pt','Physical Therapy','Allied',0,0,0,'','ca'],['ot','Occupational Therapy','Allied',0,0,0,'','ca'],['slp','Speech and Swallowing Therapy','Allied',0,0,0,'','ca'],
 ['nutr','Clinical Nutrition','Allied',0,0,0,'','ca'],['wound','Wound and Ostomy Nursing','Allied',0,0,0,'','ca'],['sw','Social Work','Allied',0,0,0,'','ca'],
 ['cm','Case Management','Allied',0,0,0,'','ca'],['rt','Respiratory Therapy','Allied',0,0,0,'','ca'],['lact','Lactation Support','Allied',0,0,0,'','ca'],['childlife','Child Life','Allied',0,0,0,'','ca'],['pharm','Clinical Pharmacy','Allied',0,0,0,'','ca'],['diabed','Diabetes Education','Allied',0,0,0,'','ca']];
M.services=SV.map(function(s){return {key:s[0],name:s[1],group:s[2],attendings:s[3],fellows:s[4],teams:s[5],programme:s[6],
  primary:s[7].indexOf('p')>=0,consult:s[7].indexOf('c')>=0,allied:s[7].indexOf('a')>=0};});
M.serviceByKey={};M.services.forEach(function(s){M.serviceByKey[s.key]=s;});

/* Operating rooms and procedure areas: [key, name, building, floor, rooms, services] */
M.ors=[['mor','Main Operating Rooms','MT',2,22,'gensurg colorectal hpb surgonc urol ent plast ortho spine gyn txsurg'],
 ['hor','Pavilion Operating Rooms','HP',1,12,'cardsurg thor vasc nsgy trauma burn'],
 ['wor','Women and Children’s Operating Rooms','WC',2,6,'obst gyn gynonc pedsurg'],
 ['asc','Ambulatory Surgery Centre','OP',1,8,'ortho ophth ent urol plast gensurg'],
 ['cath','Cardiac Catheterisation and Electrophysiology Laboratories','HP',1,6,'card ep'],
 ['endo','Endoscopy Unit','MT',2,6,'gi hep pulm'],
 ['irs','Interventional Radiology Suites','MT',2,4,'ir']].map(function(o){
  var rooms=[];for(var i=1;i<=o[4];i++)rooms.push(o[0].toUpperCase()+'-'+H.p2(i));
  return {key:o[0],name:o[1],building:o[2],floor:o[3],rooms:rooms,services:o[5].split(' ')};});
})(HOSP);
