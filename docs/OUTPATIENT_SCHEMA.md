# Outpatient chart contract

`HOSP.outpatient(id)` returns one longitudinal record for a person. `id` may be an outpatient id (`o.<clinicKey>.<number>`), a generated inpatient stay id (`g.med.00.5`) or a hand-written case id (`p13`). Unknown ids return `null`. All dates are `Date` objects; strings are plain text.

```js
{
  id: 'o.endoc.5',              // the id to use for this person
  personId: 'o.endoc.5',
  name: 'Surname, Given', age: 61, ageText: null, sex: 'F', dob: '04 Mar 1965', mrn: 'LX-431220',
  wt: '82.4 kg', ht: '164 cm',
  allergies: [['Penicillin','rash']],            // [substance, reaction]; [['No known allergies','']] if none
  problems: ['Type 2 diabetes mellitus (HbA1c 7.9%)', 'Hypertension'],     // as of now
  meds: [ { name:'Metformin 1,000 mg', text:'Metformin 1,000 mg twice daily', forProblem:'dm2' } ],   // current home medicines
  clinics: [ { key:'endoc', name:'Diabetes Clinic', everyWeeks:13 } ],      // who follows this person
  visits: [ Visit ],            // past and in-progress contacts, newest first (up to 5 years)
  upcoming: [ Visit ],          // booked future appointments, soonest first (status 'Scheduled' or a cancellation)
  labs: [ { panel:'Clinic results over time', times:[Date], rows:[[name, unit, low, high, [value|null per time]]] } ],   // same shape as inpatient labs
  healthMaintenance: [ { item, everyWeeks, last:Date|null, due:Date|null, status:'Up to date'|'Due'|'No record in this chart' } ],
  otherEncounters: [ ],         // hand-written cases only: their non-clinic encounters, unchanged
  inpatient: null | { id, unit, bed, admit:Date, discharge:Date|null, dx, current:true|false },   // the linked hospital stay, if any
  handwritten: false, generated: true, asOf: Date,
  truth: { comorbidities:['dm2','htn'], ladderPositions:{dm2:2,htn:1}, seed }
}
```

A `Visit`:

```js
{
  id: 'o.endoc.5@endoc@2026-08-18T09:22',        // also the visitId on clinic schedules and in inpatient `encounters`
  t: Date, clinicKey: 'endoc', clinic: 'Diabetes Clinic',
  type: 'New patient' | 'Return visit' | 'Hospital follow-up' | 'Post-operative check' | 'Telephone' | ...,
  status: 'Seen' | 'No-show' | 'Cancelled (in hospital)' | 'Scheduled' | 'Arrived' | 'Roomed' | 'In visit' | 'Completed (telephone)',
  clinician: 'Dr. ...', location: 'Marlowe Outpatient Pavilion, floor 4, Suite 4A', minutes: 26,
  reason: 'Type 2 diabetes mellitus',
  // the rest only when status is 'Seen':
  vitals: { weightKg: 82.9, heightCm: 164, bmi: 30.8, bp: '138/84', hr: 76 },
  labs: [ ['Haemoglobin A1c','%',4,5.6,8.4] ],   // [name, unit, low, high, value] measured for this visit
  changes: [ 'Changed Metformin 500 mg to Metformin 1,000 mg (twice daily)' ],
  orders: [ 'Laboratory: ... before next visit' ],
  healthMaintenance: [ 'Diabetic eye examination' ],                // items done at this visit
  note: { title:'Diabetes Clinic: return visit', by:'Dr. ...', body:'...' },
  next: Date | null
}
```

## What is guaranteed

- **A visit is the same object everywhere.** The row on `HOSP.clinicSchedule(clinicKey, date)`, the entry in `visits` or `upcoming`, and (for a past clinic visit of an inpatient) the item in the inpatient chart's `encounters` share one `id`, time, clinic and clinician.
- **Notes quote the recorded values.** Weight, blood pressure and every tracked result in a visit note are the values in `vitals` and `labs` for that visit; "last visit" values are the previous visit's.
- **Treatment follows the numbers.** When a tracked value is above target the regimen usually steps up at that visit (`changes`), the medicine list from that date on includes the change, and the next visit's value responds.
- **Both sides of a person agree.** For someone who is also an inpatient, the home medicine list, the long-term problems and the baseline of tracked labs (HbA1c, creatinine, haemoglobin in kidney disease, and so on) in the inpatient chart are the state of this record on the day of admission. Appointments that fall during the stay are `Cancelled (in hospital)`. Follow-up named in the discharge plan is a real booked visit of type `Hospital follow-up` (or the label the condition module gives).
- **Time.** Visits before `HOSP.now()` are complete; today's move through `Scheduled`, `Arrived`, `Roomed`, `In visit`, `Seen` as the clock passes their slot; later ones are `Scheduled`.

## Hand-written cases

For `p1` to `p24` the record is assembled from the case's own `encounters`: items of kind `Clinic visit` or `Telephone` whose department maps to a clinic (table `deptMap` in `hospital/clinics.js`) become `visits` with the hand-written summary as the note; other encounters are passed through in `otherEncounters`. Twenty-one future follow-up appointments for these cases are listed in `handFollow` in the same file and appear in `upcoming` and on the clinic schedules. These records have `handwritten:true`, no `truth`, and no tracked labs.
