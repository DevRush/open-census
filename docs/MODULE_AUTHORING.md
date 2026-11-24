# How to write a module

A module is one small data file. The engine turns it into any number of patients. You write it once; nobody edits generated charts by hand.

Three kinds:

| Kind | Folder | Call | Describes |
|---|---|---|---|
| Condition | `modules/conditions/<key>.js` | `HOSP.condition({...})` | one reason for admission, from arrival to discharge |
| Comorbidity | `modules/comorbidities/<key>.js` | `HOSP.comorbidity({...})` | a long-term condition a patient brings along |
| Clinic | `modules/clinics/<key>.js` | `HOSP.clinic({...})` | what one type of outpatient clinic sees and does |

Check your file, and fix until it prints `OK`:

```
node tools/validate-module.js modules/conditions/<key>.js
```

The validator checks every field against the shared tables, then builds about 200 to 600 real charts from your module (every variant, seven points in the stay) and runs the chart checks on each. Lines that start `note:` are advice, not failures.

## Ground rules

1. **Data only.** One call, one object literal. No functions, no `require`.
2. **Refer to shared things by key.** Medicines: `modules/shared/meds.js`. Labs, vital signs, dose frequencies: `modules/shared/tables.js`. Reusable complications: `modules/shared/complications.js`. Services, unit kinds and clinic keys: `hospital/hospital.js`, `hospital/clinics.js`. If a medicine is missing, add one line to `meds.js`; never write a dose inside a module.
3. **Never type a number that the engine also generates.** Vital signs, lab values, weights, ages, dates and drug names in note text come from slots (below). A typed "white cells 14" will disagree with the results table.
4. **Never name a medicine in note text.** The engine swaps medicines for allergies and kidney function. Write `{med.ceftriaxone1g}` or `{rx}`; the note then names whatever was really given.
5. British spelling, US lab units, plain words. No licensed instrument names (Braden, Morse, NANDA, CPT, APACHE, CAM-ICU, RASS, PHQ, ESI), no vendor names, no real people. ICD-10-CM codes only where you are sure.
6. Clinically sensible, not exhaustive. Leave out rare edge cases.

## Time

All times are **days after admission** as decimals. `0` is admission, `1.5` is 36 hours in, negative values are before admission (the emergency department work-up; `-0.2` is a good "on arrival" value).

Write the timeline for a typical stay, the midpoint of `los`. The engine stretches or shrinks it to each patient's actual length of stay, so "day 3" in your module is "about 60% of the way through" for everyone.

## Text: alternatives and slots

- `[a|b|c]` picks one at random. Each group is picked independently.
- `[=a|b|c]` linked groups: every `[=...]` group in the same string uses the same position. Use this when a finding and its impression must match: `'Lungs [=clear|hazy at the right base].\n\nImpression: [=No pneumonia|Right basal pneumonia].'`
- `{slot}` is replaced by a value. Unknown slots are an error.

Standard slots:

| Slot | Gives |
|---|---|
| `{age}` `{sex}` | `67-year-old` `woman` (also `5-month-old` `boy`, `3-day-old` `baby`); write `{age} {sex}` |
| `{he}` `{He}` `{his}` `{His}` `{him}` `{title}` `{name}` | pronouns, `Mrs Ashgrove`, full name |
| `{side}` `{Side}` `{otherside}` `{Otherside}` | `left`/`right`, fixed per patient |
| `{temp}` `{hr}` `{rr}` `{bp}` `{spo2}` `{pain}` `{o2}` `{wt}` | the charted values at the time of the note; `{o2}` reads `room air` or `2 L nasal oxygen` |
| `{fever}` | `febrile`, `low-grade temperature` or `afebrile`, from the charted temperature |
| `{rhythm}` `{Rhythm}` `{pulse}` `{Pulse}` | `sinus rhythm` / `atrial fibrillation` ..., `regular` / `irregular`, from the patient's conditions |
| `{lab.cr}` `{prev.cr}` `{lab0.cr}` `{peak.cr}` | latest, previous, admission and highest value of a lab (any lab key your module draws) |
| `{med.KEY}` | the medicine actually given for your key, e.g. `{med.cephalexin500}` gives `cephalexin 500 mg` or its substitute |
| `{rx}` | all current condition medicines with route and frequency (skips fluids, as-needed and items marked `aux:1`) |
| `{crx}` | the same for medicines started for a complication |
| `{day}` `{pod}` `{dx}` `{unit}` `{service}` `{attending}` | hospital day, post-operative day (needs `pod`), diagnosis text, and so on |
| anything in `vars` | your own per-patient choices, e.g. `{lobe}` |

`vars:{lobe:['right lower lobe','left lower lobe']}` picks one value per patient and keeps it for the whole chart. Use `vars` for anything that must stay the same everywhere (the lobe, the organism, the baby's weight). Use `[a|b]` only for wording that may vary from note to note.

**Do not state a measured fact in fixed words.** "Afebrile overnight" in a phrase bank will sometimes sit next to a temperature of 38.4. Write `{fever} at last check`.

## Condition module: fields

Required: `key` (same as the file name), `name`, `units`, `age` (or `ageDays`), `los`, `phases`, `course`, `notes`.

```js
HOSP.condition({
 key:'cellulitis',                       // file name without .js
 name:'Cellulitis of the {side} lower leg',   // shown as the diagnosis; under 60 characters after slots
 icd:'L03.119',                          // optional
 pop:'adult',                            // 'adult' (default) | 'peds' | 'neonate' | 'ob' | 'psych'; must match the unit
 service:'hospmed',                      // primary service key (ICUs and the emergency department use their own)
 via:'ed',                               // 'ed' (default) | 'elective' | 'direct' | 'transfer'
 units:{med:3,id:5,obs:3},               // unit KINDS that take this condition, with weights (1 rare .. 8 very common)
 age:[24,92,62],                         // [youngest, oldest, most common] in years.  Newborns: ageDays:[0,2] and wt:[2.4,3.9] (kg)
 sex:[55,45],                            // optional [male, female] weights
 los:[2,5],                              // length of stay in days [shortest, longest]
 comorb:{dm2:.4,obesity:.45},            // optional: chance of each comorbidity for these patients (otherwise by age)
 vars:{entry:['a cracked heel','an insect bite']},
```

**Variants** go from simple to complex. Each needs `key`, `w` (weight) and `sev` (0.6 mild, 1 typical, 1.4 severe: scales how far numbers move from normal). A variant may add or change almost anything:

```js
 variants:[
  {key:'simple',w:6,sev:1},
  {key:'short',w:3,sev:.7,los:[1,3]},
  {key:'abscess',w:2,sev:1.15,los:[3,6],
   name:'Cellulitis of the {side} lower leg with abscess',
   units:['id','med'],                   // optional: only in units of these kinds
   course:{crp:[[-.2,180],[2,90]]},      // replaces the module course for these keys
   meds:[...], orders:[...], reports:[...], procs:[...], consults:[...], comps:[...], labs:[...], lines:[...], vars:{...}}],
```

Lists in a variant are **added** to the module's lists. Single values (`name`, `los`, `icd`, `service`, `phases`, `dc`, `iso`, `pod`, `draws`, ...) **replace** the module's. To keep a module-level list item out of some variants, put `v:['a','b']` (only these variants) or `notv:['c']` (all except) on that item.

**Phases** name the stages of the illness; text banks are keyed by these names.

```js
 phases:[['acute',0],['improving',1.2],['ready',2.6]],     // [name, first day]; first must start at 0
```

**Course**: the heart of the module. For each number that matters, give `[day, value]` points for a typical patient; the engine draws straight lines between points and holds the last value. Use vital-sign keys (`temp hr rr sbp dbp spo2 o2 pain`), any lab key, `wt` and `uo`, or your own keys from `custom`.

```js
 course:{temp:[[-.2,38.4],[1,37.8],[2,37.1]],
         hr:[[-.2,104],[1,92],[2.5,80]],
         pain:[[-.2,6],[1,5],[2,3],[3.5,2]],
         wbc:[[-.2,14.6],[1,12.8],[2.5,9.4]],
         crp:[[-.2,122],[1,104],[2.5,46],[4,18]]},
```

- Write the values you would expect in an otherwise healthy patient of the typical age. The engine adds each patient's own baseline (a kidney patient's creatinine starts higher and moves by the same amount).
- Keys you leave out stay at the patient's normal.
- `o2` is oxygen in L/min: `0` room air, `1` to `6` nasal, `7` to `15` mask, `20` to `60` high-flow, `100` ventilator.
- `wt` is kilograms **above or below usual weight** (fluid overload `[[0,4.5],[4,0]]`). `uo` is urine in mL per hour.
- **Children and newborns:** write heart rate, breathing rate and blood pressure as the **adult-equivalent** number (100 means "30% faster than normal for age"); the engine scales to the child's age. Write lab values as real values and give the normal range for that age in `ranges`.
- End near normal: the last point is what the patient goes home with.

```js
 custom:{pef:{l:'Peak flow',u:'L/min',base:300,noise:12,dec:0}},   // optional extra numeric keys for course and flow rows
 ranges:{cr:[.2,.8],hgb:[11,15]},        // optional normal ranges for this population (children, pregnancy, newborns)
 labs:['crp','procal@3'],                // labs drawn besides chemistry and blood count; '@3' = first 3 draws only
 track:['wbc','crp','cr'],               // labs quoted in every progress note (default wbc, hgb, cr, k)
 draws:1,                                // optional: days between morning blood draws (0.5, 1, 2, 7), 'day1' or 'adm'
```

**Medicines**: `{m:KEY, d:[start]}` or `{m:KEY, d:[start, stop]}`.

```js
 meds:[{m:'cefazolin2g',d:[0,2.6],ed:1},          // ed:1 = first dose given before reaching the unit
       {m:'cephalexin500',d:[2.6,8]},             // same day number as the stop above = a switch on morning rounds
       {m:'apap1g',d:[0],aux:1},                  // aux:1 = supportive; left out of {rx}
       {m:'oxy5',d:[0,2],aux:1}],
```

Other options: `f:'bid'` (override frequency), `unless:['renal']` / `needs:['dm2']` (comorbidity keys or flags), `v` / `notv`. Every patient also gets the standing medicines for their population (pain relief, anti-nausea, clot prevention ...). `nostd:['enox40']` removes some; `std:[...]` replaces the list. `holds:['diuretic']` puts home medicines of a class on hold.

**Orders** `[category, text, start day?, end day?]`; category is Nursing, Diet, Laboratory, Imaging, Consult or Medication. With an end day the order becomes Completed. Standing orders (admit, vital signs, diet, code status ...) are added for you.

**Lines** `[item, site, [start day, removal day?], status]`. A peripheral IV, oxygen device and monitor are added for you.

**Reports** (aim for two or more available at admission, `d` below 0):

```js
 reports:[{k:'imaging',t:'Leg vein ultrasound, {side} leg',d:-.4,
           body:'Veins compress fully with normal flow.\n\nImpression: No deep vein thrombosis.'},
          {k:'micro',t:'Blood cultures, 2 sets',d:-.6,by:'micro',final:2,
           pre:'No growth to date at 24 hours.',body:'No growth after 48 hours in either set.'}],
```

`k` is `imaging`, `micro` or `path`. `by`: `rad` (default), `micro`, `path`, `team` or a service key. `final:2` with `pre` shows a preliminary text for the first 2 days. `h:5` places a report exactly 5 hours after admission.

**Procedures and operations**

```js
 pod:.25,                                // optional: day of the operation, enables {pod} and "post-operative day" in notes
 procs:[{h:5.5,type:'Operative note',title:'Laparoscopic appendicectomy',event:'Laparoscopic appendicectomy',
         by:'gensurg',body:'Procedure: ...\nFindings: ...\nPlan: ...'}],
```

Give `h` (hours after admission) or `d` (day). `type` is `Operative note` (an anaesthesia note is added) or `Procedure note`. For planned surgery use `via:'elective'` and `pod:0`; the pre-operative clinic notes are written for you.

**Consults**: `{svc:'gensurg',d:.3,reason:'...',recs:'...'}`; optional `p` (chance) and `v`.

**Complications**: at most one happens per patient.

```js
 comps:[{use:'aki',p:.04},{use:'cdiff',p:.02},          // from modules/shared/complications.js
        {key:'effusion',name:'Parapneumonic effusion',problem:'Parapneumonic pleural effusion',
         p:.06,d:[1.8,3],lag:[8,20],los:3,               // chance, onset window (days), hours until recognised, extra days
         course:{temp:[[0,0],[.5,1.1],[3,.4],[5,0]]},    // CHANGES added to the numbers, by days since true onset; start at [0,0]
         meds:[{m:'piptazo45',d:[0,6]}],                 // days since recognition
         orders:[...], report:{k:'imaging',t:'...',body:'...'}, consult:{svc:'pulm',reason:'...',recs:'...'},
         event:'Fever returned with pleuritic pain',     // timeline entry and nurse's report
         assess:'...', plan:'... ({crx}) ...',           // added to progress notes while active
         nursing:{Respiratory:'...'},                    // replaces nursing-assessment rows while active
         truth:'Temperature began to climb again at the true onset time.'}],
```

The true onset time is recorded in the chart's `truth` block; the chart itself shows the complication only from the time the team recognises it, while the numbers start to move at the true onset.

**Flowsheet group** for the condition, 5 to 8 rows. A row is a number (`k`) or text by phase (`p`). `every:2` charts it in every second column.

```js
 flow:{name:'Skin and limb',rows:[
   {l:'Redness beyond the pen mark',p:{acute:'[2 cm beyond the first mark|At the mark]',improving:'Receding',ready:'Fading'},every:2},
   {l:'Chest pain',u:'0–10',k:'pain',lo:-1,hi:1}]},
```

**Nursing assessment** rows you want to differ from the defaults (see `modules/shared/defaults.js` for the row names of each population):

```js
 nursing:{Skin:{acute:'{Side} lower leg red, hot and swollen; edge marked',improving:'Redness receding',ready:'Fading'}},
```

**Notes**: you supply the clinical content; the engine builds every note around it (emergency triage and physician notes, admission consult, history and physical, a progress note for every hospital day, nursing shift notes, consults, event notes, discharge planning and summary) and inserts the day's actual numbers, results with previous values, and medicine changes.

```js
 notes:{
  cc:'[Red, hot, swollen {side} lower leg for 2 days|Painful red {side} leg with fever]',
  hpi:'{age} {sex} with [two|three] days of spreading redness ... Likely entry point: {entry}.',
  exam:  {acute:'...',improving:'...',ready:'...'},      // examination findings (no vital signs: they are added)
  subj:  {acute:'...',improving:'...',ready:'...'},      // what the patient says
  assess:{acute:'Cellulitis ... on {rx}',improving:'... {fever}, white cells {lab.wbc}',ready:'...'},
  plan:  {acute:['Intravenous antibiotic: {rx}','Elevate the leg'],improving:['...'],ready:['...']},   // lists of plan lines
  nursing:{acute:'Leg elevated. Pain {pain} of 10 at last check',improving:'...',ready:'...'}},        // opening of shift notes
```

A bank may omit later phases (the earlier text is reused), but must have the first phase.

**Allied-health notes.** `ancillary:['rt','pt','ot','slp','nutr','sw','cm','wound','lact','pharm2','diabed','childlife']` asks for those notes where the condition calls for them (several are also added automatically: respiratory therapy when on oxygen, occupational therapy from age 75, case management for longer stays). Replace a standard text with `anc:{pt:'...'}`.

**Discharge**

```js
 dc:{dispo:{Home:8,'Home with services':2,'Skilled nursing facility':1},     // weights
     follow:[['pcp',7],['cardc',14,'Hospital follow-up']],                   // [clinic key or 'pcp', days after discharge, visit label?]
     text:'Treated with {med.cefazolin2g}, changed to oral {med.cephalexin500} as the redness receded.',
     teach:'Finish the antibiotic. Return if redness spreads past the pen mark.'}
});
```

Follow-up appointments really appear on that clinic's schedule and in the patient's outpatient chart.

Other optional fields: `iso` (precautions text), `io:{npo:1, out:[{l:'Surgical drain',k:'drain'}]}`, `entry` and `entryNurse` (where the patient arrives if not the emergency department, e.g. `'delivery room'`), `anaes`, `problems:[...]` (extra problem-list lines), `events:[[day,'text']]`, `rhythm`.

Complete worked examples: `modules/conditions/cellulitis.js` (short medical), `cap.js` (variants, own complication), `hip-replacement.js` (elective surgery), `bronchiolitis.js` (infants), `vaginal-birth.js` (obstetric), `modules/generic/g-neo.js` (newborns).

### Checklist for a condition module

- [ ] File name equals `key`; one `HOSP.condition({...})` call; data only.
- [ ] `units` uses unit kinds that exist and match `pop`.
- [ ] At least two variants (a mild or typical one, and a more complex one).
- [ ] `phases` start at day 0; every text bank has the first phase.
- [ ] `course` covers the vital signs and labs that define the illness, starts at about `-0.2` and ends near normal.
- [ ] Every lab used in a slot or in `track` is in `labs` (chemistry `na k cl hco3 bun cr glu` and blood count `hgb wbc plt` are always drawn).
- [ ] Medicines by key with `d`; day-0 emergency doses have `ed:1`; a switch from intravenous to oral uses the same day number for stop and start.
- [ ] No medicine names and no measured numbers typed into note text; `{rx}`, `{med.KEY}`, `{lab.KEY}`, `{fever}` used instead.
- [ ] Matched findings and impressions use `[=...]` or `vars`.
- [ ] Two or more reports with `d` below 0.
- [ ] One to four complications, mostly `use:` from the shared list.
- [ ] `dc` with `dispo`, `follow`, `text`, `teach`.
- [ ] `node tools/validate-module.js <file>` prints `OK`.

## Comorbidity module

One long-term condition. It contributes a problem-list line, history text, home medicines, baseline shifts, inpatient orders, interactions, and a visit-by-visit clinic course.

```js
HOSP.comorbidity({key:'dm2',name:'Type 2 diabetes mellitus',icd:'E11.9',
 prior:[.05,.17,.25],                    // chance at ages 40, 60, 80 (0 at 18; straight lines between)
 minAge:30,                              // optional; also sex:'F', ob:true (allowed in maternity patients), excludes:['dm1']
 problem:'Type 2 diabetes mellitus (HbA1c {a1c}%)',       // slots: any tracked key, {yrs}, {year}, {egfr}, {stage}, {side}
 pmh:'Type 2 diabetes for {yrs} years (latest HbA1c {a1c}%)',
 home:['atorva20'],                      // fixed home medicines
 opd:{clinic:{key:'endoc',p:.35},        // followed in this clinic with this chance; otherwise by primary care
      every:[13,26],                     // weeks between visits
      tracks:{a1c:{start:[7.2,10.4],drift:.12,noise:.3,floor:6.2}},     // value at first visit, change per visit, scatter
      ladder:{on:'a1c',above:7.5,effect:.8,                             // when the track is above target, step up;
              steps:['metformin500','metformin1000','+empa10','+sema05','+glargine10','glargine20']},   // '+' adds, no '+' replaces
      labs:['uacr'],
      sx:['no low-glucose episodes; checks glucose [most mornings|a few times a week]'],    // interval history phrases
      plan:['Eye examination and urine albumin due yearly']},                               // plan phrases
 labs:{glu:48}, vitals:{},               // shifts to inpatient baselines for keys that are NOT tracked
 flags:['diabetic'],                     // 'renal' turns on kidney dosing; 'diabetic' glucose checks; 'anticoag'; 'hepatic'; 'frail'
 hold:['metformin','sglt2'],             // medicine classes put on hold during any admission
 avoid:['nsaid'],                        // classes never started (the engine substitutes)
 meds:[{m:'lisprosc'}],                  // inpatient additions
 orders:[['Nursing','Bedside glucose before meals and at bedtime']],
 showLabs:['a1c@1'],                     // extra admission labs
 plan:'Type 2 diabetes: hold oral agents in hospital, correction-scale insulin, target glucose 140 to 180 mg/dL.',
 consult:{svc:'diabed',p:.15,reason:'diabetes teaching before discharge'},
 interact:{hypogly:1,ssi:1.6},           // multiplies the chance of those complications
 los:.3});                               // days added to any stay
```

How the clinic course works: at each attended visit the tracked values are recorded; if the ladder's track is above `above`, treatment usually steps up one step and the next visit's value falls by about `effect`; otherwise values move by `drift` and `noise`. The state on the day of admission becomes the inpatient chart's home medicines, problem text and baseline lab values. A ladder without `on` is a fixed regimen (a random step up to `startMax`).

Checklist: key equals file name; `prior` has three numbers; all medicine keys and classes exist; `opd` has `sx` and `plan`; ladder steps are valid keys and `on` is one of the tracks; `plan` is one sentence; validator prints `OK`.

## Clinic module

One clinic type. Several clinics in `hospital/clinics.js` may use the same module (optionally restricted to some problems with `pk:`).

```js
HOSP.clinic({key:'cardiology',name:'Cardiology',
 every:[13,26,52],                       // usual weeks between visits
 noShow:.06, age:[35,92,66],
 manages:['htn'],                        // comorbidities this clinic adjusts besides the patient's main problem
 visitTypes:['New patient','Return visit','Hospital follow-up'],
 problems:[{c:'hf',w:3},{c:'af',w:3},    // a comorbidity module, with weight
  {key:'valve',name:'Aortic stenosis, moderate, under surveillance',icd:'I35.0',w:1,age:[62,90,76],every:[26,52],   // or written here,
   home:[...],tracks:{...},ladder:{...},                                                                           // same fields as `opd`
   sx:['no chest pain, fainting or new breathlessness'],plan:['Echocardiogram every 12 months']}],
 exam:'Pulse [regular|irregular]. Heart sounds normal. Chest clear.',
 referral:'Referred by primary care for [an abnormal ECG|a new murmur]',
 notes:{new:'New patient consultation. {age} {sex}. {referral}.',      // opening sentence by visit type
        ret:'{age} {sex} returning for cardiology follow-up.',
        hfu:'{age} {sex} seen within two weeks of leaving hospital.'},
 hmAll:true,                             // health-maintenance items apply in this clinic (always true for primary care)
 hm:[['12-lead ECG',52,18,200],['Bone density scan',260,65,200,'F']],   // [item, every N weeks, min age, max age, sex?]
 orders:['12-lead ECG in clinic']});
```

Slots in clinic text: `{age} {sex} {he} {He} {his} {him} {name} {side} {clinic} {referral} {reason} {weeks} {yrs}`. The engine writes the rest of each visit note: medicine list on that date, weight, blood pressure, tracked results with last visit's values, treatment changes, health maintenance and the return interval.

Checklist: key equals file name; every `c:` is an existing comorbidity; inline problems have `key`, `name`, `sx`, `plan`; `notes.new` and `notes.ret` exist; a row in `hospital/clinics.js` uses the module; validator prints `OK`.
