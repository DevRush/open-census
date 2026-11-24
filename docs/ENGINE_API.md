# Engine API

The engine is one global object, `HOSP`. It has no dependencies, uses no network and no language model, and gives the same hospital for the same seed in a browser and in Node.

## Loading

**Browser.** Load the hand-written cases first (optional), then the engine:

```html
<script src="data.js"></script>
<script src="patients/p4.js"></script> ... <script src="patients/p24.js"></script>
<script src="engine/hosp.bundle.js"></script>      <!-- built by: node tools/build-bundle.js -->
<script>HOSP.init({});</script>
```

`engine/hosp.bundle.js` is the files of `engine/load-order.json` joined in order (about 465 KB, 160 KB gzipped). A page may instead load those files one by one. `HOSP.init` finds `seed()` and `EXTRA` from `data.js` by itself; if they are absent the hospital simply has no hand-written cases.

**Node.**

```js
const HOSP = require('./engine')({ seed: 20261117, now: '2026-11-17T14:30' });   // all options optional
```

## Setup and clock

| Call | Result |
|---|---|
| `HOSP.init({seed, now, handwritten, truthInKey})` | Resets everything. `seed` number (default 20261117). `now` Date or `'YYYY-MM-DDTHH:MM'` (default 17 Nov 2026 14:30). `handwritten` array of patient objects, or `false` for none. `truthInKey:true` copies the truth labels into each chart's `key` array. Returns `HOSP`. |
| `HOSP.setNow(date)` | Moves the clock. Charts and schedules are rebuilt on demand as of the new time. |
| `HOSP.now()` | The current simulated time (Date). |
| `HOSP.hospital()` | `{name, seed, now, inpatientBeds, emergencyBays, units, clinics, services, buildings[], modules:{conditions, comorbidities, clinics, complications}}` |

All dates returned are `Date` objects in local time. Past readings and notes do not change when the clock moves; new ones appear.

## Places and people

```js
HOSP.buildings()        // [{key, name, floors, units:[unitKey], clinics:[clinicKey]}]
HOSP.units()            // [{key, name, prefix, beds, building, buildingKey, floor, acuity, population, kinds[], services:[{key,name}]}]
HOSP.units({counts:true})   // adds occupied
HOSP.services()         // [{key, name, group, primary, consult, allied, teams:[{name, attending, fellow, senior, residents[], students[], app}]}]
HOSP.consultServices()  // [{key, name, group, allied}]
HOSP.operatingRooms()   // [{key, name, building, floor, rooms[], services[]}]
HOSP.staff()            // roster for today: [{id, name, role, grade?, service?, unit?, team?, shift?, onService?}]
HOSP.staff({unit:'med'})  HOSP.staff({service:'card'})  HOSP.staff({role:'Pharmacist'})  HOSP.staff({date:'2026-11-20'})
HOSP.unitStaff('med')   // {nurses:{day[],night[]}, chargeDay, chargeNight, manager, pharmacist, caseManager, socialWorker, pt, ot, slp, dietitian, rt, wound, clerk, ratio}
HOSP.serviceTeams('card')  // the teams with full staff objects
```

`acuity` is `icu`, `step`, `ward` or `ed`. `population` is `adult`, `peds`, `neonate`, `ob` or `psych`. Roles on the roster: Attending, Fellow, Senior resident, Resident, Medical student, Advanced practice provider, Lead clinician, Nurse, Charge nurse, Nurse manager, Pharmacist, Case manager, Social worker, Physical therapist, Occupational therapist, Speech therapist, Dietitian, Respiratory therapist, Wound and ostomy nurse, Lactation consultant, Child life specialist, Unit clerk.

## Census

```js
HOSP.census('med')      // one row per bed, in bed order
HOSP.censusAll()        // {unitKey: rows}
```

An occupied row:

```js
{ id:'g.med.00.5', unitKey:'med', unit:'3 West Medicine', bed:'3W-01', status:'occupied',
  name:'Olorunfemi, Otis', age:52, ageText:null, sex:'M', mrn:'LX-268044',
  dx:'Community-acquired pneumonia, right lower lobe',
  admit:Date, day:4, expectedDischarge:Date,
  service:'Hospital Medicine', serviceKey:'hospmed', team:'Hospital Medicine Team C', attending:'Dr. ...', nurse:'V. Vandekamp RN',
  code:'Full code', iso:'Standard precautions', phase:'improving', condition:'cap', handwritten:false,
  flags:['Fall risk'],          // New admission, Discharge today, Discharge tomorrow, No CPR, High oxygen need, Abnormal vital signs, Isolation, Fall risk, <complication name>, Hand-written case
  vitals:{ t:Date, temp:37.4, hr:101, rr:21, bp:'136/75', spo2:91, o2:'2 L nasal', pain:2 } }
```

`ageText` is set for children under 2 (`'12 days'`, `'5 months'`) and `age` is then whole years (0 or 1). An empty bed is `{id:null, unitKey, unit, bed, status:'empty'|'cleaning', lastPatient}`. Hand-written cases appear in their own beds with `handwritten:true`, `serviceKey:null`, `condition:null`.

The whole hospital (1,228 beds) takes about 0.3 s the first time and about 25 ms afterwards.

```js
HOSP.discharges('card', 5)   // stays that ended in the last 5 days: [{id, unitKey, unit, bed, name, age, sex, mrn, dx, admit, discharge, lengthOfStayDays}]
HOSP.discharges(null, 14)    // all units
```

## Inpatient chart

```js
const p = HOSP.patient('g.med.00.5');   // or 'p13' for a hand-written case
```

Returns the patient object of `/SCHEMA.md`, exactly as a hand-written file returns it (orders as 4-item arrays, no ids on medicines). Built on first request (about 4 ms, largest about 50 ms) and cached until the clock changes. Returns `null` for an unknown id or a stay that has not started. Differences for generated charts:

- `key` is `[]` (or truth labels when `truthInKey` is on). Nothing is planted for scoring.
- extra fields: `generated:true`, `asOf` (Date), `ageText` (young children), `discharged` (Date, when the stay is over), `truth`:

```js
truth:{ condition:'cap', conditionName, icd10cm, variant:'moderate', severity:1.03, comorbidities:['copd','dm2'],
        complication:null | {key, name, trueOnset:Date, recognised:Date, note},
        arrival:Date, admit:Date, plannedDischarge:Date, lengthOfStayDays, disposition,
        followUp:[{clinicKey, clinic, t:Date}], personId, seed }
```

- notes are shorter than the hand-written ones; every chart has the emergency or pre-operative notes, a history and physical, a progress note for each hospital day from day 2, nursing shift notes for the last five days, and consult, pharmacy, therapy, dietitian, social work, case management, wound care and discharge notes where they apply.
- after discharge the chart is frozen at the discharge time and gains a discharge summary.

`HOSP.prepare(p)` applies the page's own normalisation (ids on medicines and notes, orders as `{id,cat,text,st,t,by}`, `pending:[]`) for callers that want that form.

Ids: `g.<unitKey>.<bed index, 2 digits>.<stay number>` for generated stays; `p1` to `p24` for hand-written cases.

## Consult lists

```js
HOSP.consultList('neph')
// [{ id, unitKey, unit, bed, name, age, ageText, sex, mrn, dx, reason, requested:Date, requestedBy, primaryService,
//    status:'New'|'Following'|'Signed off', seen:Date|null, handwritten }]   new first, then newest request
```

Works for every key from `HOSP.consultServices()`, including allied services (`pt`, `ot`, `slp`, `nutr`, `sw`, `cm`, `pharm`, `wound`, `rt`).

## Clinics

```js
HOSP.clinics()
// [{ key, name, group, service, serviceKey, module, building, floor, suite,
//    sessions:[{day:'Mon', half:'AM', start:'08:30', end:'12:00'}], cliniciansPerSession, slotsPerClinician, panelSize }]

HOSP.clinicSchedule('cardc')                 // today
HOSP.clinicSchedule('cardc', '2026-11-19')   // any date, past or future
// [{ t:Date, time:'09:22', clinicKey, patientId, visitId, name, age, ageText, sex, mrn,
//    type:'New patient'|'Return visit'|'Hospital follow-up'|..., reason, clinician, minutes,
//    status:'Scheduled'|'Arrived'|'Roomed'|'In visit'|'Seen'|'No-show'|'Cancelled (in hospital)'|'Completed (telephone)',
//    inpatientNow:false, inpatientId?, handwritten }]
```

`patientId` opens the outpatient chart. It is an outpatient id (`o.cardc.118`), a generated stay id (the same person has been, is, or will be an inpatient) or a hand-written id. The first schedule call builds an index of inpatients' clinic links (about 1 s, once); later calls take a few ms to about 100 ms.

```js
const o = HOSP.outpatient('o.cardc.118');    // also accepts 'g.med.00.5' and 'p13'
```

Shape: `docs/OUTPATIENT_SCHEMA.md`.

## Search

```js
HOSP.search('ashgrove')      // name, record number, diagnosis or bed; at least 2 characters; up to 50 results
// [{ kind:'inpatient'|'outpatient', id, name, mrn, age, sex, where, dx, handwritten }]
```

## Helpers that are safe to use

`HOSP.plan(id)` (the light plan behind a stay), `HOSP.valueAt(plan, key, date)` (any vital sign or lab at any time), `HOSP.buildChart(plan, date)` (a chart as of any time without moving the clock), `HOSP.dt(date)`, `HOSP.hm(date)`, `HOSP.iso(date)`, `HOSP.ageAt(person, date)`.

## Tools

```
node tools/test-engine.js            acceptance tests
node tools/validate-module.js --all  check every module (or one file)
node tools/generate.js --out DIR     dump the hospital to JSON, JSON Lines and CSV
node tools/build-bundle.js           rebuild engine/hosp.bundle.js and print sizes
```
