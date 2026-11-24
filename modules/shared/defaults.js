/* modules/shared/defaults.js — standing medicines, standing orders, default nursing rows and history phrase banks
   by patient population. A module only writes what is DIFFERENT for its condition. Text may use [a|b] and {slots}. */
(function(H){
var D=H.T.defaults;
/* medicines every patient of this population gets unless the module lists the key in `nostd` */
D.meds={adult:['apap650','ondansetron4','senna','enox40','melatonin3','flush','peg'],
 icu:['apap650','ondansetron4','hep5000','flush','chg','famotidine20','senna'],
 peds:['apapkg','ibukg','ondkg','flush','emla','salinenose','ors'],
 neonate:['vitk','erythroeye','hepbvac','sucrose','vitdrops','zincoxide','salinenose','glucosegel'],
 ob:['apap650','ibu600','docusate100','prenatal','ondansetron4','lanolin','witchhazel','simeth'],
 psych:['apap650','melatonin3','lorazepam1','multivit','senna','hydroxyzine25','antacid','nicpatch21']};
/* standing non-medication orders: [category, text]. {unit} and {code} are filled in. */
D.orders={adult:[['Nursing','Admit to {unit}'],['Nursing','Vital signs every 4 hours'],['Nursing','Fall-risk precautions'],['Nursing','Activity as tolerated, up with assistance at first'],
   ['Nursing','Resuscitation status: {code}'],['Diet','Regular diet'],['Laboratory','Chemistry and blood count each morning'],['Nursing','Notify team for heart rate above 120, systolic below 90, saturation below 90% or new confusion'],['Consult','Case management: discharge planning']],
 icu:[['Nursing','Admit to {unit}'],['Nursing','Continuous cardiac and oxygen monitoring, vital signs hourly'],['Nursing','Hourly intake and output'],['Nursing','Head of bed 30 degrees; turn every 2 hours'],
   ['Nursing','Resuscitation status: {code}'],['Diet','Diet per team; dietitian to review within 48 hours'],['Laboratory','Chemistry and blood count every 12 hours'],['Nursing','Daily review of lines and catheters for removal'],['Consult','Clinical pharmacy: daily medicine review']],
 peds:[['Nursing','Admit to {unit}'],['Nursing','Vital signs every 4 hours with age-based warning score'],['Nursing','Daily weight; strict intake and output'],['Nursing','Parent or carer may stay at the bedside'],
   ['Nursing','Resuscitation status: {code}'],['Diet','Regular diet for age'],['Laboratory','Blood tests only as ordered'],['Nursing','Notify team for increased work of breathing, poor feeding or carer concern'],['Consult','Child life specialist']],
 neonate:[['Nursing','Admit to {unit}'],['Nursing','Continuous heart, breathing and saturation monitoring'],['Nursing','Daily weight; strict intake and output'],['Nursing','Skin-to-skin care with parents when stable'],
   ['Nursing','Resuscitation status: {code}'],['Diet','Feeds per neonatal feeding plan'],['Laboratory','Bedside glucose per protocol'],['Nursing','Temperature control in incubator or open cot as charted'],['Consult','Lactation consultant']],
 ob:[['Nursing','Admit to {unit}'],['Nursing','Vital signs every 4 hours; fundus and bleeding checks per protocol'],['Nursing','Encourage walking; assistance for first time out of bed'],['Nursing','Breastfeeding support'],
   ['Nursing','Resuscitation status: {code}'],['Diet','Regular diet'],['Laboratory','Blood count on day 1 after birth'],['Nursing','Notify team for heavy bleeding, systolic above 160 or below 90, or severe headache'],['Consult','Lactation consultant']],
 psych:[['Nursing','Admit to {unit}'],['Nursing','Vital signs twice daily'],['Nursing','Safety observations every 15 minutes'],['Nursing','Belongings search and safe-room checklist completed'],
   ['Nursing','Resuscitation status: {code}'],['Diet','Regular diet'],['Laboratory','Admission blood tests and urine drug screen'],['Nursing','Group programme as tolerated'],['Consult','Social work: discharge planning']]};
/* Default nursing-assessment rows. Each row: label -> [text while acutely unwell, text while improving, text when nearly ready to go]. */
D.nursing={adult:{
  Neurological:['Alert and oriented, [tired|anxious|uncomfortable]','Alert and oriented','Alert and oriented, [cheerful|keen to go home|calm]'],
  Respiratory:['Breathing unlaboured, chest clear','Breathing unlaboured, chest clear','Breathing unlaboured on room air, chest clear'],
  Cardiovascular:['{Pulse} pulse, warm hands and feet, no leg swelling','{Pulse} pulse, warm and well perfused','{Pulse} pulse, no leg swelling'],
  Gastrointestinal:['Poor appetite, [sips only|ate a quarter of meals], abdomen soft','Eating [half|most] of meals, bowels [opened|not opened today]','Eating full meals, bowels opened'],
  Urinary:['Passing urine, [dark yellow|concentrated]','Passing urine, clear yellow','Passing urine without difficulty'],
  Skin:['Intact; heels and sacrum checked','Intact; pressure areas checked','Intact'],
  Mobility:['Bed to chair with 1 assist','Walking to bathroom with [standby help|a frame and 1 assist]','Walking in corridor independently'],
  'Fall risk':['High','Moderate','[Moderate|Low]'],
  Teaching:['Plan of care and call bell explained','Medicines and reason for each explained','Discharge instructions reviewed with patient[ and family|]']},
 icu:{
  Neurological:['[Drowsy, rouses to voice|Sedated, opens eyes to voice|Alert but tired]','Alert, follows commands','Alert and oriented'],
  Respiratory:['Laboured, on support as charted','Less laboured, support weaning','Unlaboured, minimal oxygen'],
  Cardiovascular:['{Rhythm} on the monitor, cool peripheries, pulses weak','{Rhythm}, warm, pulses 2+','{Rhythm}, warm, pulses 2+'],
  Gastrointestinal:['Nothing by mouth, abdomen soft, bowel sounds quiet','Sips and medicines tolerated','Diet tolerated'],
  Urinary:['Urinary catheter, low volumes','Urinary catheter, adequate volumes','Catheter removed, passing urine'],
  Skin:['Intact; turned every 2 hours, heels offloaded','Intact; turned every 2 hours','Intact'],
  Mobility:['Bed rest, passive range of movement','Sat at edge of bed with 2 assist','Chair for meals with 1 assist'],
  'Fall risk':['High','High','High'],
  'Lines and devices':['All sites clean; need reviewed on rounds','Sites clean; need reviewed on rounds','Sites clean; unneeded lines removed'],
  Teaching:['Family updated at bedside','Family updated; visiting plan agreed','Transfer to ward explained']},
 peds:{
  Neurological:['Awake, [miserable|clingy|quiet], consolable by parent','Alert and interactive','Playing, alert and interactive'],
  Respiratory:['Work of breathing as charted','Easier breathing','No extra work of breathing'],
  Cardiovascular:['Warm, capillary refill 2 seconds','Warm and well perfused','Warm and well perfused'],
  'Feeding and hydration':['Drinking poorly, moist mouth','Drinking better, [2|3] wet nappies or voids this shift','Eating and drinking normally'],
  Urinary:['Reduced wet nappies or voids','Voiding','Voiding normally'],
  Skin:['Intact','Intact','Intact'],
  Activity:['In bed or on parent’s lap','Up to playroom briefly','Active in playroom'],
  'Family':['[Mother|Father|Grandmother] at bedside, anxious','Parent at bedside, involved in care','Parent confident with home plan'],
  Teaching:['Plan of care explained to family','Signs of worsening explained','Discharge teaching completed with return demonstration']},
 neonate:{
  'Tone and activity':['[Quiet, reduced tone|Sleepy, rouses with cares]','Active with cares, good tone','Active and alert, good tone'],
  Respiratory:['Work of breathing as charted','Mild or no recession','Breathing easily in room air'],
  Cardiovascular:['Pink, capillary refill 2 to 3 seconds','Pink and well perfused','Pink and well perfused'],
  Feeding:['[Nothing by mouth|Small tube feeds]','Tube feeds increasing, some at the breast or bottle','Full feeds by breast or bottle'],
  Elimination:['Passing urine; meconium passed','Passing urine and stool','Passing urine and stool normally'],
  Skin:['Intact; jaundice as charted','Intact','Intact, cord dry'],
  Temperature:['Incubator','[Incubator, weaning|Open cot with wrap]','Open cot, stable'],
  Family:['Parents visited; update given','Skin-to-skin care with [mother|father]','Parents rooming in and confident with cares'],
  Teaching:['Unit routines and hand hygiene explained','Feeding plan explained','Safe sleep and discharge teaching completed']},
 ob:{
  Neurological:['Alert and oriented, tired','Alert and oriented','Alert and oriented'],
  'Uterus and bleeding':['Fundus firm at the umbilicus, moderate red loss','Fundus firm, light loss','Fundus firm below the umbilicus, scant loss'],
  Cardiovascular:['{Pulse} pulse, mild ankle swelling','{Pulse} pulse','{Pulse} pulse, calves soft'],
  Breasts:['Soft; colostrum expressed','Filling; latch [improving|good]','Feeding well'],
  Urinary:['[Urinary catheter in place|Passed urine twice since birth]','Passing urine without difficulty','Passing urine without difficulty'],
  'Perineum or wound':['As charted; ice pack applied','Clean, mild swelling','Clean and healing'],
  Mobility:['Up to bathroom with 1 assist','Walking independently','Walking independently'],
  'Mood and bonding':['Holding baby skin-to-skin','Caring for baby with support','Confident with baby care'],
  Teaching:['Bleeding and warning signs explained','Feeding and newborn care teaching','Discharge teaching completed']},
 psych:{
  'Mental state':['As charted in behavioural observations','More settled','Settled, future-oriented'],
  Sleep:['[2|3|4] hours overnight','[5|6] hours overnight','[6|7] hours overnight'],
  'Appetite and fluids':['Eating little, needs prompting','Eating most meals','Eating all meals'],
  'Risk to self':['[Denies current thoughts of self-harm|Passive thoughts, no plan]; on 15-minute observations','Denies; on 15-minute observations','Denies; observations hourly'],
  'Risk to others':['No aggression this shift','None','None'],
  'Medication':['Took medicines after encouragement','Taking medicines','Taking medicines, can name them'],
  'Groups and activity':['Stayed in room','Attended one group','Attended groups, sociable with peers'],
  'Physical health':['Vital signs within limits','No physical complaints','No physical complaints'],
  Teaching:['Unit routine and rights explained','Medicine purpose and side effects discussed','Safety plan reviewed']}};
/* history banks: the engine picks a few. */
D.soc={adult:['[Retired teacher|Retired bus driver|Works in a warehouse|Bookkeeper|Retired machinist|Shop assistant|Works from home in software|Retired nurse|Farm worker|Taxi driver|Librarian|Chef]',
   '[Lives with spouse|Lives alone, daughter nearby|Lives with adult son|Lives with partner|Lives alone in a ground-floor flat|Lives in an assisted-living flat]',
   '[Never smoked|Stopped smoking 10 years ago, 20 pack-years|Smokes 10 cigarettes a day|Stopped smoking in 2015|Never smoked]','Alcohol: [none|1 to 2 drinks a week|a glass of wine most evenings|rarely]','[Independent in daily activities|Independent; uses a stick outdoors|Needs help with shopping only]'],
 peds:['Lives with [both parents|mother and grandmother|parents and two siblings]','[Attends school, doing well|Attends nursery|At home with a parent]','No smokers in the home[|; one parent smokes outside]','[A dog|A cat|No pets] at home'],
 neonate:['Parents [first baby|have one older child|have two older children]','Mother intends to [breastfeed|breastfeed and express|formula feed]','No smokers in the home','Home has a safe sleep space ready'],
 ob:['Lives with [partner|husband|partner and toddler]','[Works as a teacher|Works in retail|Works as an accountant|At home with children|Works as a care assistant]','Does not smoke; no alcohol in pregnancy','Feels safe at home'],
 psych:['[Lives with a flatmate|Lives with parents|Lives alone|Staying with a sister]','[Unemployed for 6 months|Works part-time in a café|University student|On medical leave from work]','[Smokes a pack a day|Does not smoke]','Alcohol: [none|binge at weekends|2 drinks most nights]; cannabis: [none|occasional|daily]']};
D.fam=['[Father had a heart attack at 62|Mother had a stroke at 78|No family history of note|Mother had type 2 diabetes|Father had bowel cancer at 70|Sister has thyroid disease|Brother has high blood pressure]','[Mother had breast cancer at 66|No early heart disease in the family|Father had emphysema|Parents lived into their 80s]'];
D.psh=['Appendix removed in [1988|1994|2003]','Gallbladder removed in [2009|2014|2019]','Right knee arthroscopy in [2012|2017]','Cataract surgery in [2021|2023|2024]','Hernia repair in [2006|2016]','Tonsils removed in childhood','Caesarean birth in [1996|2004]','Wrist fracture fixed in [2010|2018]','No previous operations'];
D.imm={adult:['Influenza vaccine [October 2026|September 2026|not yet this season]','COVID-19 vaccine [autumn 2026|autumn 2025]','Tetanus booster [2019|2021|2023]'],old:['Pneumococcal vaccine [2022|2024]','Shingles vaccine [2021|2023|not given]'],
 peds:['Childhood immunisations up to date','Influenza vaccine [this season|not yet this season]'],neonate:['Hepatitis B vaccine given at birth with consent','Vitamin K given at birth']};
D.code=[['Full code',.86],['No CPR (intubation acceptable)',.04],['No CPR, no intubation',.1]];
D.eth=['English','English','English','English','Spanish (interpreter needed)','English and Polish','English and Yoruba','English and Punjabi','English and Cantonese'];
D.dispo={Home:7,'Home with services':2,'Skilled nursing facility':1,Rehabilitation:.5};
D.edNames=['ED nurse'];
})(HOSP);
/* Ancillary and allied-health documentation. The engine writes one of these when the condition or the patient calls for it
   (module field `ancillary:[...]`, or automatic rules: oxygen -> rt, age 75+ -> ot, long stay -> nutr, and so on).
   A module can replace a body with its own text in `anc:{pt:'...'}`. Slots are the same as for notes. */
(function(H){
H.T.anc={
 pt:{type:'Therapy note',title:'Physical therapy evaluation',body:'Referred for mobility and discharge needs. Hospital day {day}.\nBefore admission: [independent indoors, stick outdoors|independent without aids|walked with a frame, one fall this year|independent, drives].\nToday: heart rate {hr}, saturation {spo2}% on {o2} before walking. Bed to standing with [standby help|1 assist|supervision]. Walked [15|25|40|60] m with [a frame|no aid|a stick] and [1 assist|standby help]; saturation stayed above [90|92]%. [Mildly breathless, recovered in 2 minutes|No dizziness|Steady, slow pace]. Stairs [not yet tried|4 steps with rail and supervision].\nAssessment: below usual level because of acute illness; good potential to return to baseline.\nPlan: daily therapy, walking three times a day with nursing, chair for meals. Likely discharge [home with family help|home with home therapy|home, no equipment needs].'},
 ot:{type:'Therapy note',title:'Occupational therapy evaluation',body:'Seen for daily living assessment. Hospital day {day}.\nHome set-up: [bathroom upstairs, rail on one side|single-level home, walk-in shower|bath with overhead shower, no rails].\nWashing and dressing: upper body independent, lower body [with help for socks and shoes|with long-handled aids|independent, slow]. Toilet transfer with [standby help|1 assist].\nThinking and memory: [oriented, recalls 3 of 3 words|oriented, recalls 2 of 3 words after delay|follows 3-step instructions].\nPlan: practise dressing with aids, energy-saving advice, [raised toilet seat|shower chair|no equipment] recommended. Family teaching before discharge.'},
 slp:{type:'Therapy note',title:'Speech and swallowing assessment',body:'Bedside swallow assessment requested. Alert and able to follow instructions.\nMouth: [moist, own teeth|dry, dentures in place]. Voice [clear|slightly hoarse]. Cough [strong|weak but effective].\nTrials: thin liquid by teaspoon and cup, purée and soft solid. [No cough or wet voice on any trial|One delayed cough on consecutive sips of thin liquid; none with single sips|Slow chewing, no coughing].\nImpression: [swallow safe for regular diet with thin liquids|mild swallowing impairment; safe with soft diet and single sips].\nRecommendations: sit fully upright for meals, small mouthfuls, mouth care after eating. Will review if chest worsens or coughing at meals is seen.'},
 nutr:{type:'Consult',title:'Dietitian assessment',body:'Nutrition assessment, hospital day {day}.\nWeight {wt}. Intake before admission: [reduced for about a week|normal until 2 days before admission|poor for several weeks with some weight loss]. Current intake about [50|60|75]% of meals.\nRelevant results: glucose {lab.glu} mg/dL, creatinine {lab.cr} mg/dL, potassium {lab.k} mmol/L.\nAssessment: [at risk of under-nutrition during acute illness|mild under-nutrition|adequately nourished; needs diet teaching].\nPlan: [oral nutrition supplement twice daily|high-protein snacks between meals|consistent-carbohydrate teaching with written plan], food record for 3 days, weigh twice weekly. Diet order confirmed with the team.'},
 rt:{type:'Therapy note',title:'Respiratory therapy note',body:'Assessment at the bedside. Respiratory rate {rr}, saturation {spo2}% on {o2}. Breath sounds [reduced at the bases|scattered wheeze|coarse at the {side} base|clear with good air entry]. Cough [strong, clearing own secretions|weak, encouraged to huff|dry].\nTreatments: [nebuliser given with good effect|incentive spirometer coached, reached 1,250 mL|breathing exercises and positioning|oxygen device and tubing checked and humidifier filled].\nOxygen plan: titrate to saturation 92% or above (88 to 92% if known carbon dioxide retention); wean when saturation is steady at rest and on walking.\nNext review this shift and as needed.'},
 sw:{type:'Social work',title:'Social work assessment',body:'Met with [the patient|the patient and family|the family] on hospital day {day}.\nLiving situation and support: [stable housing, family close by|lives alone, neighbour checks in|relies on a relative for transport|family under strain with work and caring].\nConcerns raised: [worry about time off work|cost of new medicines|managing at home after discharge|none at present].\nSafety screen completed in private: no concerns disclosed.\nPlan: [information on community support given|benefits and transport advice given|will meet family again before discharge|referral to community services with consent]. Available through the unit if needs change.'},
 cm:{type:'Case management',title:'Case management assessment',body:'Initial assessment, hospital day {day}.\nBefore admission: [independent at home|home with family help|home with weekly help from an agency]. Insurance and pharmacy details confirmed.\nExpected discharge needs: [none beyond prescriptions|home nursing visits|walking aid and home therapy|short rehabilitation stay to be considered].\nPatient goal: [to get home as soon as it is safe|to be home for a family event|to avoid a care facility].\nPlan: follow daily with the team, arrange services 24 hours before discharge, confirm transport and follow-up appointments.'},
 wound:{type:'Nursing note',title:'Wound and ostomy nurse note',body:'Asked to review the wound. Wound bed [pink with a little slough|clean, granulating|moist with cloudy drainage]; surrounding skin [red for 2 to 3 cm, edge marked|intact|dry]. Size recorded in the wound chart with a photograph (with consent). Pain {pain} of 10 at dressing change.\nPlan: clean with saline, [silver-containing dressing|non-adherent dressing with absorbent pad|loose packing with moist gauze], change [daily|every 2 days] and when soiled. Offload pressure, protein intake reviewed with the dietitian. Review in 3 days or sooner if redness spreads.'},
 lact:{type:'Nursing note',title:'Lactation consultant note',body:'Feeding support visit. Mother [wishes to breastfeed|is expressing for her baby|is combining breast and formula feeds].\nObserved a feed: [deep latch after repositioning, rhythmic sucking with swallows heard|shallow latch at first, improved with cross-cradle hold|baby sleepy; hand expression taught and colostrum given by syringe].\nBreasts [soft|filling]; nipples [intact|slightly tender, no cracks].\nPlan: feed or express at least 8 times in 24 hours, skin-to-skin care, record wet and dirty nappies. Pump and storage teaching given. Will see again tomorrow and before discharge.'},
 pharm2:{type:'Pharmacy note',title:'Pharmacy medicine review',body:'Medicine review, hospital day {day}.\nKidney function: creatinine {lab.cr} mg/dL (admission {lab0.cr}). Doses of kidney-cleared medicines checked against today’s value.\nPotassium {lab.k} mmol/L, platelets {lab.plt} ×10⁹/L.\nInteractions: [none needing a change|one moderate interaction noted; monitoring advised and team informed|duplicate as-needed pain orders rationalised].\nBlood-clot prevention: [in place and appropriate|reviewed against bleeding risk].\nHome medicines: reconciled against the admission history; held items are flagged for review at discharge.\nPlan: continue daily review; discharge medicine teaching before the patient leaves.'},
 pharm:{type:'Pharmacy note',title:'Pharmacy consult',body:'Asked to review medicines and doses, hospital day {day}.\nCreatinine {lab.cr} mg/dL, potassium {lab.k} mmol/L. Allergy list checked against active orders: no conflict.\nActive orders reviewed for dose, route and duplication; [no changes needed|one dose interval adjusted for kidney function|suggested oral route where the gut is working].\nHome medicines reconciled with the admission list.\nPlan: daily review while in hospital and teaching before discharge.'},
 diabed:{type:'Nursing note',title:'Diabetes education note',body:'Teaching session at the bedside. Glucose today {lab.glu} mg/dL.\nCovered: [how to check glucose and when|recognising and treating a low glucose|sick-day rules|injection technique with return demonstration].\n[Patient|Patient and family member] able to repeat the key points. Written plan and meter log given. Follow-up arranged with the diabetes clinic.'},
 childlife:{type:'Social work',title:'Child life specialist note',body:'Met [the child and parent|the family] at the bedside. Explained the hospital routine with age-appropriate play. Coping: [anxious with procedures, calmer with distraction|settled and curious|tearful when parent leaves].\nPlan: distraction and comfort positioning for blood tests, playroom time when well enough, sibling visit supported. Will follow during the stay.'}};
})(HOSP);
