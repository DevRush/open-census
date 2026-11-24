/* modules/shared/meds.js — the medicine table. Modules refer to medicines by KEY.
   'Name and dose|route|frequency|class|extra|options'
     route      : key of HOSP.T.routes (PO, IV, SC, INH, NEB, TOP ...)
     frequency  : key of HOSP.T.freq (daily, bid, q8h, prn-q6h, inf, once ...)
     class      : used for allergy checks and for "avoid"/"hold" rules in comorbidity and complication modules
     extra      : as-needed reason (prn-*) or infusion rate (inf)
     options    : renal=<key> (medicine to use instead when the patient has the 'renal' flag)
                  kg=<mg per kg>,<max mg>,<round to> (weight-based; put {d} in the name where the dose goes)
   To add a medicine, add one line. Keep keys short: drug + strength. */
(function(H){
var M={
/* pain, nausea, bowels, stomach */
apap650:'Acetaminophen 650 mg|PO|prn-q6h|analgesic|pain or fever', apap1g:'Acetaminophen 1,000 mg|PO|q8h|analgesic', apap1giv:'Acetaminophen 1,000 mg|IV|q8h|analgesic',
oxy5:'Oxycodone 5 mg|PO|prn-q4h|opioid|moderate to severe pain', oxy10:'Oxycodone 10 mg|PO|prn-q4h|opioid|severe pain', morphine2:'Morphine 2 mg|IV|prn-q4h|opioid|severe pain',
hm05:'Hydromorphone 0.5 mg|IV|prn-q4h|opioid|severe pain', hmpca:'Hydromorphone patient-controlled analgesia|IV|inf|opioid|0.2 mg per demand, 10-minute lockout, no background rate',
tramadol50:'Tramadol 50 mg|PO|prn-q6h|opioid|moderate pain', ketorolac15:'Ketorolac 15 mg|IV|q6h|nsaid', ibu600:'Ibuprofen 600 mg|PO|q6h|nsaid', ibu400:'Ibuprofen 400 mg|PO|prn-q8h|nsaid|pain',
celecoxib200:'Celecoxib 200 mg|PO|bid|nsaid', naproxen500:'Naproxen 500 mg|PO|bid|nsaid', gabapentin300:'Gabapentin 300 mg|PO|tid|gabapentinoid||renal=gabapentin100', gabapentin100:'Gabapentin 100 mg|PO|bid|gabapentinoid',
lidopatch:'Lidocaine 5% patch|TD|daily|local', ondansetron4:'Ondansetron 4 mg|IV|prn-q8h|antiemetic|nausea', metoclop10:'Metoclopramide 10 mg|IV|prn-q8h|antiemetic|nausea',
prochlor10:'Prochlorperazine 10 mg|PO|prn-q6h|antiemetic|nausea', senna:'Senna 8.6 mg|PO|nightly|laxative', peg:'Polyethylene glycol 17 g|PO|daily|laxative', docusate100:'Docusate 100 mg|PO|bid|laxative',
bisacodylpr:'Bisacodyl 10 mg|PR|prn-daily|laxative|no bowel movement in 48 hours', lactulose20:'Lactulose 20 g|PO|tid|laxative', panto40:'Pantoprazole 40 mg|PO|daily|ppi', panto40iv:'Pantoprazole 40 mg|IV|q12h|ppi',
famotidine20:'Famotidine 20 mg|PO|bid|h2||renal=famotidine20d', famotidine20d:'Famotidine 20 mg|PO|daily|h2', simeth:'Simethicone 80 mg|PO|prn-q6h|gi|bloating',
/* fluids and electrolytes */
ns75:'Sodium chloride 0.9%|IV|inf|fluid|75 mL/h', ns125:'Sodium chloride 0.9%|IV|inf|fluid|125 mL/h', lr100:'Lactated Ringer’s solution|IV|inf|fluid|100 mL/h', lr150:'Lactated Ringer’s solution|IV|inf|fluid|150 mL/h',
lr250:'Lactated Ringer’s solution|IV|inf|fluid|250 mL/h', d5half75:'Dextrose 5% in sodium chloride 0.45%|IV|inf|fluid|75 mL/h', d5nsm:'Dextrose 5% in sodium chloride 0.9%|IV|inf|fluid|maintenance rate for weight',
d10m:'Dextrose 10% in water|IV|inf|fluid|80 mL/kg/day', kcl40:'Potassium chloride 40 mEq|PO|once|potassium', kcl20:'Potassium chloride 20 mEq|PO|daily|potassium', mgox400:'Magnesium oxide 400 mg|PO|bid|magnesium',
mgso4:'Magnesium sulfate 2 g|IV|once|magnesium', flush:'Sodium chloride 0.9% flush 10 mL|IV|q8h|flush', nabicarb650:'Sodium bicarbonate 650 mg|PO|bid|alkali', calcvitd:'Calcium carbonate 600 mg with vitamin D 400 units|PO|bid|supplement',
vitd2000:'Cholecalciferol 2,000 units|PO|daily|supplement', thiamine100:'Thiamine 100 mg|PO|daily|supplement', folate1:'Folic acid 1 mg|PO|daily|supplement', multivit:'Multivitamin|PO|daily|supplement', ferrous325:'Ferrous sulfate 325 mg|PO|daily|supplement',
/* blood thinners and antiplatelets */
enox40:'Enoxaparin 40 mg|SC|daily|anticoagulant||renal=hep5000', hep5000:'Heparin 5,000 units|SC|q8h|anticoagulant', enoxtx:'Enoxaparin {d} mg|SC|q12h|anticoagulant||kg=1,150,10', hepinf:'Heparin infusion|IV|inf|anticoagulant|weight-based protocol, anti-Xa target 0.30 to 0.70',
apixaban5:'Apixaban 5 mg|PO|bid|anticoagulant', apixaban25:'Apixaban 2.5 mg|PO|bid|anticoagulant', rivaroxaban20:'Rivaroxaban 20 mg|PO|daily|anticoagulant', warfarin5:'Warfarin 5 mg|PO|nightly|anticoagulant',
aspirin81:'Aspirin 81 mg|PO|daily|antiplatelet', aspirin325:'Aspirin 325 mg|PO|once|antiplatelet', clopidogrel75:'Clopidogrel 75 mg|PO|daily|antiplatelet', ticagrelor90:'Ticagrelor 90 mg|PO|bid|antiplatelet', txa1g:'Tranexamic acid 1 g|IV|once|antifibrinolytic',
/* antimicrobials */
ceftriaxone1g:'Ceftriaxone 1 g|IV|q24h|cephalosporin', ceftriaxone2g:'Ceftriaxone 2 g|IV|q24h|cephalosporin', azithro500:'Azithromycin 500 mg|PO|daily|macrolide', doxy100:'Doxycycline 100 mg|PO|bid|tetracycline',
amoxclav875:'Amoxicillin-clavulanate 875 mg|PO|bid|penicillin', amox500:'Amoxicillin 500 mg|PO|tid|penicillin', levo750:'Levofloxacin 750 mg|PO|daily|quinolone||renal=levo750q48', levo750q48:'Levofloxacin 750 mg|PO|q48h|quinolone',
piptazo45:'Piperacillin-tazobactam 4.5 g|IV|q8h|penicillin||renal=piptazo225', piptazo225:'Piperacillin-tazobactam 2.25 g|IV|q8h|penicillin', cefepime2g:'Cefepime 2 g|IV|q8h|cephalosporin||renal=cefepime1g', cefepime1g:'Cefepime 1 g|IV|q12h|cephalosporin',
vanc1250:'Vancomycin 1,250 mg|IV|q12h|glycopeptide||renal=vanc750', vanc750:'Vancomycin 750 mg|IV|q24h|glycopeptide', mero1g:'Meropenem 1 g|IV|q8h|carbapenem', cefazolin2g:'Cefazolin 2 g|IV|q8h|cephalosporin', cefazolin2once:'Cefazolin 2 g|IV|once|cephalosporin',
cephalexin500:'Cephalexin 500 mg|PO|qid|cephalosporin||renal=cephalexin500b', cephalexin500b:'Cephalexin 500 mg|PO|bid|cephalosporin', metro500iv:'Metronidazole 500 mg|IV|q8h|nitroimidazole', metro500:'Metronidazole 500 mg|PO|tid|nitroimidazole',
cipro500:'Ciprofloxacin 500 mg|PO|bid|quinolone', nitro100:'Nitrofurantoin 100 mg|PO|bid|urinary', tmpsmxds:'Trimethoprim-sulfamethoxazole double strength|PO|bid|sulfonamide', tmpsmxss:'Trimethoprim-sulfamethoxazole single strength|PO|daily|sulfonamide',
clinda600:'Clindamycin 600 mg|IV|q8h|lincosamide', clinda300:'Clindamycin 300 mg|PO|tid|lincosamide', ampsulb3g:'Ampicillin-sulbactam 3 g|IV|q6h|penicillin', vancpo125:'Vancomycin 125 mg|PO|qid|glycopeptide', oseltamivir75:'Oseltamivir 75 mg|PO|bid|antiviral',
fluconazole200:'Fluconazole 200 mg|PO|daily|azole', acyclovir400:'Acyclovir 400 mg|PO|bid|antiviral', valgan450:'Valganciclovir 450 mg|PO|daily|antiviral', posaconazole300:'Posaconazole 300 mg|PO|daily|azole',
/* heart and circulation */
furo40iv:'Furosemide 40 mg|IV|bid|diuretic', furo80iv:'Furosemide 80 mg|IV|bid|diuretic', furo40:'Furosemide 40 mg|PO|daily|diuretic', furo20:'Furosemide 20 mg|PO|daily|diuretic', torsemide20:'Torsemide 20 mg|PO|daily|diuretic',
spiro25:'Spironolactone 25 mg|PO|daily|mra', metotart25:'Metoprolol tartrate 25 mg|PO|bid|betablocker', metosucc25:'Metoprolol succinate 25 mg|PO|daily|betablocker', metosucc50:'Metoprolol succinate 50 mg|PO|daily|betablocker',
metosucc100:'Metoprolol succinate 100 mg|PO|daily|betablocker', carvedilol625:'Carvedilol 6.25 mg|PO|bid|betablocker', carvedilol125:'Carvedilol 12.5 mg|PO|bid|betablocker', lisinopril5:'Lisinopril 5 mg|PO|daily|acei',
lisinopril10:'Lisinopril 10 mg|PO|daily|acei', lisinopril20:'Lisinopril 20 mg|PO|daily|acei', lisinopril40:'Lisinopril 40 mg|PO|daily|acei', losartan50:'Losartan 50 mg|PO|daily|acei', losartan100:'Losartan 100 mg|PO|daily|acei',
amlodipine5:'Amlodipine 5 mg|PO|daily|ccb', amlodipine10:'Amlodipine 10 mg|PO|daily|ccb', hctz25:'Hydrochlorothiazide 25 mg|PO|daily|diuretic', chlorthal25:'Chlorthalidone 25 mg|PO|daily|diuretic', hydral25:'Hydralazine 25 mg|PO|tid|vasodilator',
atorva20:'Atorvastatin 20 mg|PO|nightly|statin', atorva40:'Atorvastatin 40 mg|PO|nightly|statin', atorva80:'Atorvastatin 80 mg|PO|nightly|statin', rosuva20:'Rosuvastatin 20 mg|PO|nightly|statin', ezetimibe10:'Ezetimibe 10 mg|PO|daily|lipid',
sacval2426:'Sacubitril-valsartan 24/26 mg|PO|bid|acei', sacval4951:'Sacubitril-valsartan 49/51 mg|PO|bid|acei', empa10:'Empagliflozin 10 mg|PO|daily|sglt2', dapa10:'Dapagliflozin 10 mg|PO|daily|sglt2', digoxin125:'Digoxin 0.125 mg|PO|daily|digoxin',
diltiazem30:'Diltiazem 30 mg|PO|q6h|ccb', diltinf:'Diltiazem infusion|IV|inf|ccb|10 mg/h', diltcd180:'Diltiazem extended-release 180 mg|PO|daily|ccb', amio200:'Amiodarone 200 mg|PO|daily|antiarrhythmic', ntgsl:'Nitroglycerin 0.4 mg|SL|prn-q2h|nitrate|chest pain',
ntginf:'Nitroglycerin infusion|IV|inf|nitrate|10 mcg/min', isosorbide30:'Isosorbide mononitrate extended-release 30 mg|PO|daily|nitrate', labetalol200:'Labetalol 200 mg|PO|bid|betablocker', nifedxl30:'Nifedipine extended-release 30 mg|PO|daily|ccb',
norepi:'Norepinephrine infusion|IV|inf|vasopressor|0.08 mcg/kg/min, titrate to mean arterial pressure 65', vasopressin:'Vasopressin infusion|IV|inf|vasopressor|0.03 units/min',
/* lungs */
albneb:'Albuterol 2.5 mg|NEB|q4h|bronchodilator', albnebprn:'Albuterol 2.5 mg|NEB|prn-q4h|bronchodilator|wheeze or breathlessness', duoneb:'Ipratropium-albuterol 3 mL|NEB|q6h|bronchodilator', albmdi:'Albuterol inhaler 2 puffs|INH|prn-q4h|bronchodilator|wheeze',
pred40:'Prednisone 40 mg|PO|daily|steroid', pred20:'Prednisone 20 mg|PO|daily|steroid', pred5:'Prednisone 5 mg|PO|daily|steroid', mpred40:'Methylprednisolone 40 mg|IV|q8h|steroid', hydrocort50:'Hydrocortisone 50 mg|IV|q6h|steroid', dex4:'Dexamethasone 4 mg|PO|daily|steroid',
tiotropium:'Tiotropium 18 mcg|INH|daily|bronchodilator', budform:'Budesonide-formoterol 160/4.5 mcg 2 puffs|INH|bid|inhaledsteroid', flutisalm:'Fluticasone-salmeterol 250/50 mcg|INH|bid|inhaledsteroid', montelukast10:'Montelukast 10 mg|PO|nightly|leukotriene',
guaif:'Guaifenesin 600 mg|PO|bid|expectorant', nicpatch21:'Nicotine patch 21 mg|TD|daily|nicotine',
/* diabetes and hormones */
glargine10:'Insulin glargine 10 units|SC|nightly|insulin', glargine20:'Insulin glargine 20 units|SC|nightly|insulin', glargine30:'Insulin glargine 30 units|SC|nightly|insulin', lisprosc:'Insulin lispro correction scale|SC|ac|insulin',
lispro6:'Insulin lispro 6 units|SC|ac|insulin', insinf:'Insulin regular infusion|IV|inf|insulin|0.1 units/kg/h per protocol', metformin500:'Metformin 500 mg|PO|bid|metformin', metformin1000:'Metformin 1,000 mg|PO|bid|metformin',
glipizide5:'Glipizide 5 mg|PO|daily|sulfonylurea', sita100:'Sitagliptin 100 mg|PO|daily|dpp4||renal=sita50', sita50:'Sitagliptin 50 mg|PO|daily|dpp4', sema05:'Semaglutide 0.5 mg|SC|weekly|glp1', sema1:'Semaglutide 1 mg|SC|weekly|glp1',
levo50:'Levothyroxine 50 mcg|PO|am|thyroid', levo75:'Levothyroxine 75 mcg|PO|am|thyroid', levo100:'Levothyroxine 100 mcg|PO|am|thyroid', levo125:'Levothyroxine 125 mcg|PO|am|thyroid', alendronate70:'Alendronate 70 mg|PO|weekly|bisphosphonate',
/* brain and mood */
sertraline50:'Sertraline 50 mg|PO|daily|ssri', sertraline100:'Sertraline 100 mg|PO|daily|ssri', escital10:'Escitalopram 10 mg|PO|daily|ssri', mirtaz15:'Mirtazapine 15 mg|PO|nightly|antidepressant', trazodone50:'Trazodone 50 mg|PO|prn-nightly|sedative|sleep',
melatonin3:'Melatonin 3 mg|PO|prn-nightly|sleep|sleep', quetiapine25:'Quetiapine 25 mg|PO|nightly|antipsychotic', quetiapine125:'Quetiapine 12.5 mg|PO|prn-q8h|antipsychotic|severe agitation after non-drug measures', haldol05:'Haloperidol 0.5 mg|PO|prn-q8h|antipsychotic|severe agitation',
olanz5:'Olanzapine 5 mg|PO|nightly|antipsychotic', olanz10:'Olanzapine 10 mg|PO|nightly|antipsychotic', risperidone2:'Risperidone 2 mg|PO|bid|antipsychotic', lorazepam1:'Lorazepam 1 mg|PO|prn-q6h|benzodiazepine|anxiety or agitation',
lorazepam05:'Lorazepam 0.5 mg|PO|prn-q8h|benzodiazepine|anxiety', lithium600:'Lithium carbonate 600 mg|PO|bid|lithium', valproate500:'Valproate 500 mg|PO|bid|antiepileptic', donepezil10:'Donepezil 10 mg|PO|nightly|cholinesterase',
memantine10:'Memantine 10 mg|PO|bid|nmda', keppra500:'Levetiracetam 500 mg|PO|bid|antiepileptic', keppra1000:'Levetiracetam 1,000 mg|IV|q12h|antiepileptic', cdp50:'Chlordiazepoxide 50 mg|PO|q6h|benzodiazepine',
propofol:'Propofol infusion|IV|inf|sedative|25 mcg/kg/min, titrate to light sedation', dexmed:'Dexmedetomidine infusion|IV|inf|sedative|0.4 mcg/kg/h', fentinf:'Fentanyl infusion|IV|inf|opioid|50 mcg/h', baclofen10:'Baclofen 10 mg|PO|tid|antispasmodic',
/* kidney, urinary, gout */
sevelamer800:'Sevelamer 800 mg|PO|ac|binder', calcitriol:'Calcitriol 0.25 mcg|PO|daily|vitd', epo:'Epoetin alfa 4,000 units|SC|weekly|esa', tamsulosin:'Tamsulosin 0.4 mg|PO|nightly|alphablocker', finasteride5:'Finasteride 5 mg|PO|daily|urinary',
allopurinol100:'Allopurinol 100 mg|PO|daily|gout', allopurinol300:'Allopurinol 300 mg|PO|daily|gout||renal=allopurinol100', oxybutynin5:'Oxybutynin 5 mg|PO|bid|anticholinergic',
/* cancer and transplant */
tamoxifen20:'Tamoxifen 20 mg|PO|daily|hormonal', anastrozole1:'Anastrozole 1 mg|PO|daily|hormonal', letrozole25:'Letrozole 2.5 mg|PO|daily|hormonal', capecitabine:'Capecitabine 1,500 mg|PO|bid|chemotherapy', filgrastim:'Filgrastim 480 mcg|SC|daily|growthfactor',
tacro2:'Tacrolimus 2 mg|PO|q12h|immunosuppressant', mmf1000:'Mycophenolate mofetil 1,000 mg|PO|bid|immunosuppressant', octreotide:'Octreotide infusion|IV|inf|gi|50 mcg/h', rifaximin550:'Rifaximin 550 mg|PO|bid|antibiotic',
/* pregnancy and birth */
oxytocin:'Oxytocin 30 units in 500 mL|IV|inf|uterotonic|125 mL/h for 4 hours after birth', mgso4inf:'Magnesium sulfate infusion|IV|inf|magnesium|2 g/h', prenatal:'Prenatal vitamin|PO|daily|supplement', lanolin:'Lanolin nipple cream|TOP|prn-q4h|topical|nipple soreness',
rhig:'Rh immune globulin 300 mcg|IM|once|immunoglobulin', witchhazel:'Witch hazel pads|TOP|prn-q4h|topical|perineal discomfort', benzspray:'Benzocaine perineal spray|TOP|prn-q6h|local|perineal pain',
/* children and newborns (weight-based: {d} is replaced by the calculated dose) */
apapkg:'Acetaminophen {d} mg|PO|prn-q6h|analgesic|pain or fever|kg=15,650,10', ibukg:'Ibuprofen {d} mg|PO|prn-q6h|nsaid|pain or fever|kg=10,400,10', predkg:'Prednisolone {d} mg|PO|daily|steroid||kg=1,40,1',
dexkg:'Dexamethasone {d} mg|PO|once|steroid||kg=0.6,16,1', ceftrikg:'Ceftriaxone {d} mg|IV|q24h|cephalosporin||kg=50,2000,50', amoxkg:'Amoxicillin {d} mg|PO|bid|penicillin||kg=45,1000,25', ampkg:'Ampicillin {d} mg|IV|q6h|penicillin||kg=50,2000,25',
gentkg:'Gentamicin {d} mg|IV|q24h|aminoglycoside||kg=4,360,1', ondkg:'Ondansetron {d} mg|PO|prn-q8h|antiemetic|nausea|kg=0.15,4,0.5', morphkg:'Morphine {d} mg|IV|prn-q4h|opioid|severe pain|kg=0.05,4,0.1',
albnebp:'Albuterol 2.5 mg|NEB|q4h|bronchodilator', albmdip:'Albuterol inhaler 4 puffs with spacer|INH|q4h|bronchodilator', caffeine:'Caffeine citrate {d} mg|IV|q24h|stimulant||kg=5,40,0.5', vitk:'Phytonadione 1 mg|IM|once|vitamin',
tpn:'Parenteral nutrition|IV|inf|nutrition|per daily prescription', hepbvac:'Hepatitis B vaccine 0.5 mL|IM|once|vaccine', erythroeye:'Erythromycin eye ointment|EYE|once|antibiotic', sucrose:'Sucrose 24% solution 0.5 mL|PO|prn-q2h|comfort|painful procedures',
/* skin and other */
silvadene:'Silver sulfadiazine 1% cream|TOP|bid|topical', chg:'Chlorhexidine 0.12% mouth rinse 15 mL|TOP|bid|antiseptic', tears:'Artificial tears|EYE|prn-q4h|topical|dry eyes', nystatin:'Nystatin suspension 5 mL|PO|qid|antifungal',
colchicine06:'Colchicine 0.6 mg|PO|daily|gout', vitdrops:'Cholecalciferol 400 units drops|PO|daily|supplement', zincoxide:'Zinc oxide barrier cream|TOP|prn-q4h|topical|nappy rash', salinenose:'Sodium chloride 0.9% nasal drops|NAS|prn-q4h|topical|blocked nose',
glucosegel:'Glucose 40% oral gel 0.5 mL/kg|PO|prn-q2h|glucose|glucose below 45 mg/dL', emla:'Lidocaine-prilocaine cream|TOP|prn-q4h|local|before needle procedures', ors:'Oral rehydration solution 50 mL|PO|prn-q2h|rehydration|after each loose stool or vomit',
hydroxyzine25:'Hydroxyzine 25 mg|PO|prn-q6h|antihistamine|anxiety', antacid:'Aluminium-magnesium hydroxide 30 mL|PO|prn-q6h|gi|indigestion', ursodiol300:'Ursodiol 300 mg|PO|bid|gi', pancrelipase:'Pancrelipase 24,000 units|PO|ac|enzyme'};
var T=H.T;T.meds={};
for(var k in M){var a=M[k].split('|'),o={key:k,name:a[0],route:a[1],freq:a[2],cls:a[3]||'',extra:a[4]||''};
  (a[5]||'').split(';').forEach(function(x){if(!x)return;var p=x.split('=');if(p[0]==='kg')o.kg=p[1].split(',').map(Number);else o[p[0]]=p[1];});T.meds[k]=o;}
/* allergy groups: substance shown in the chart -> classes it blocks, and the substitute class map */
T.allergies=[['Penicillin','rash',['penicillin'],.09],['Sulfonamide antibiotics','hives',['sulfonamide'],.04],['Codeine','nausea and vomiting',[],.04],['Latex','contact rash',[],.02],['Ibuprofen','wheeze',['nsaid'],.02],
 ['Cephalexin','rash',['cephalosporin'],.015],['Shellfish','lip swelling',[],.02],['Adhesive tape','skin blistering',[],.02],['Morphine','itching',[],.02],['Lisinopril','cough',['acei'],.02],['Iodinated contrast','hives',[],.015]];
T.allergySwap={penicillin:{piptazo45:'cefepime2g',piptazo225:'cefepime1g',amoxclav875:'levo750',amox500:'doxy100',ampsulb3g:'levo750',amoxkg:'ceftrikg',ampkg:'ceftrikg'},
 cephalosporin:{ceftriaxone1g:'levo750',ceftriaxone2g:'levo750',cefazolin2g:'clinda600',cefazolin2once:'clinda600',cephalexin500:'doxy100',cefepime2g:'mero1g',ceftrikg:'ceftrikg'},
 nsaid:{ketorolac15:'apap1giv',ibu600:'apap1g',ibu400:'apap650',celecoxib200:'apap1g',naproxen500:'apap1g',ibukg:'apapkg'},sulfonamide:{tmpsmxds:'nitro100',tmpsmxss:'nitro100'},acei:{}};
})(HOSP);
