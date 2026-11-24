# Architecture: one simulated hospital, generated on demand

Product: Open Census. Hospital: Northfield Medical Center (the name lives in one constant, `M.name` in `hospital/hospital.js`).

## The idea

Hand-writing a chart costs about 130,000 tokens. Here a chart is **computed** from small reusable modules by a seeded, dependency-free JavaScript engine. A module is written once (by a language model, then reviewed) and reused for any number of patients. No language model runs when the hospital is used. The same seed always gives the same hospital, in the browser and in Node.

```
complexity of one patient  =  one condition module (a variant of it)
                            + several comorbidity modules
                            + at most one complication
                            + the patient's own baseline and noise
```

## Folder layout

```
engine/      core.js        namespace, seeded random numbers, dates, text templating, registries
             staff.js       roster and "who is on today"
             census.js      people, bed histories, stay plans, the value function, census, consult lists, search
             chart.js       the full inpatient chart for one stay as of a time
             outpatient.js  clinic panels, schedules, long-term simulation, outpatient charts
             api.js         public API (docs/ENGINE_API.md)
             index.js       Node loader;  load-order.json  the order a browser loads files in
             hosp.bundle.js generated single-file build (tools/build-bundle.js)
hospital/    hospital.js    buildings, 51 units, 75 services, operating rooms
             clinics.js     72 clinics, the map from hand-written departments to clinics, hand-written follow-ups
             names.js       combinable name lists
modules/     shared/        tables.js (labs, vital signs, frequencies), meds.js, defaults.js (standing orders and
                            medicines, nursing rows, history banks, allied-health note texts), complications.js
             conditions/    one file per reason for admission
             generic/       fallback conditions per unit type, so every bed is filled
             comorbidities/ one file per long-term condition
             clinics/       one file per clinic type, plus generic.js
tools/       test-engine.js  validate-module.js  generate.js  build-bundle.js  lib-checks.js
docs/        this file, MODULE_AUTHORING.md, ENGINE_API.md, OUTPATIENT_SCHEMA.md, NEXT_MODULES.md
```

Nothing outside these folders is changed. `data.js` and `patients/` are read, never written.

## How a bed gets a patient

1. **Bed history.** Each bed has its own random stream (`seed + unit + bed number`). Starting 30 days before the base time, the engine lays stays end to end: pick a condition module for the unit, make the plan, add a turnover gap, repeat. `census()` returns the stay that covers the current time. Moving the clock forward discharges people and admits new ones.
2. **Choosing a module.** A unit has ordered `kinds` (for example `resp med`). Every condition module whose `units` names one of them and whose population matches is a candidate; weight is the module's number, halved for the unit's second kind. Generic modules are ordinary candidates, so they fade as specific modules are added.
3. **The plan** (cheap; this is all the census needs): person (age, sex, name, record number, size), variant, severity, comorbidities (by age priors or the module's own odds), complication (first that rolls true; odds multiplied by comorbidity interactions), length of stay (variant range + comorbidity days + complication days), arrival, admission and discharge times, service, team, code status.
4. **Hand-written cases** are pinned to their beds and returned unchanged.

Stay ids encode where to find them: `g.<unit>.<bed>.<stay number>`. Any stay can be rebuilt from its id alone.

## The value function

Every vital sign and lab comes from one function, `HOSP.valueAt(plan, key, time)`:

```
value = patient baseline (normal for age and sex + personal offset + comorbidity shifts,
                          or the last clinic value for tracked labs)
      + severity x (module course at this point of the stay - typical normal)
      + complication change (by time since TRUE onset)
      + small noise fixed by (patient, key, time)
```

Flowsheets, results, census rows and every sentence in every note read this function, which is why they agree and why a reading never changes when the clock moves. The module's course is written for a typical stay and stretched to each patient's actual length of stay.

## The chart

`chart.js` assembles the SCHEMA.md object as of a time: observation grid (hourly for the last 24 hours in ICUs, four-hourly on wards, capped at 16 columns), the condition's flowsheet group, nursing assessment (defaults by population, overridden by module and complication), intake and output from the active infusions and an age-based intake and urine model, lab draws on the unit's cadence, medicines (condition, home, comorbidity, complication, standing) with allergy and kidney substitution, holds and an administration record that is a fixed function of clock time, orders, lines, reports, alerts, problems (module, complication, data-driven, long-term), events, team from the roster, history, and notes.

Notes are engine-built frames filled with module text: triage, emergency physician, pharmacy history, admission consult, handover, history and physical (or the pre-operative set for planned surgery), a progress note for every hospital day with that day's numbers, previous values and medicine changes, nursing shift notes, consults, operative and anaesthesia notes, complication event note, allied-health notes, discharge planning and summary.

`truth` holds ground-truth labels (condition, variant, severity, comorbidities, complication with true onset and recognition times, planned discharge, disposition, follow-up). `key` stays empty unless `truthInKey` is set. Nothing is built for scoring learners.

## Outpatients and people on both sides

- Each clinic has a **panel** of pure outpatients (`o.<clinic>.<n>`); a member has a home session, a visit interval and a phase, so the schedule for any date is "members whose visit falls today".
- Each person's long-term conditions are **simulated visit by visit**: tracked values drift, treatment steps up a ladder when above target, the next value responds.
- Each inpatient is linked to a primary-care clinic and, by chance per comorbidity, to specialty clinics. Their visits appear on those clinics' schedules. The simulation state on the admission date supplies the inpatient chart's home medicines, problem wording and lab baselines; past visits become the chart's `encounters`; visits during the stay are cancelled; the discharge plan books real follow-up visits.
- Hand-written cases get clinic records built from their own `encounters`, plus listed future appointments.

## Time

The clock is `HOSP.now()`. Everything is a function of it: census, chart contents up to that minute (doses due, results pending as preliminary, notes written so far), schedules (scheduled, arrived, roomed, seen). Known limits: bed histories begin 30 days before 17 Nov 2026; the index that puts inpatients on clinic schedules covers stays from about 30 days before to 21 days after the base time.

## How to add things

**A unit.** Add one row to `UNITS` in `hospital/hospital.js`: key, name, bed prefix, beds, building, floor, kinds (most specific first), acuity, population, default services. If its first kind is new, name that kind in the `units` of at least one condition module (a generic one will do), or the engine stops with "No condition module matches unit". The first 14 rows are the original units; do not change their keys, names or prefixes.

**A service.** Add a row to `SV` in the same file (flags `p` primary, `c` consult, `a` allied).

**A clinic.** Add one row to `hospital/clinics.js`: key, name, group, service, module, building, floor, sessions a week, clinicians a session, slots per clinician. Use module `generic` with a list of reasons, or a real clinic module (optionally `pk:` to keep some of its problems).

**A condition, comorbidity or clinic module.** Follow `docs/MODULE_AUTHORING.md`, drop the file in the right folder (the loaders pick up every `.js` file there), run `node tools/validate-module.js <file>`, then `node tools/test-engine.js` and `node tools/build-bundle.js`.

**A medicine, lab or shared complication.** One line in `modules/shared/meds.js`, `tables.js` or `complications.js`.

Adding a module changes which patient is in which bed (the candidates' weights change). The hospital for a given seed is stable only for a given set of modules; the module list is recorded in `manifest.json` by `tools/generate.js`.

## Cost

A condition module is 4 to 8 KB (roughly 1,500 to 3,000 tokens to write). One module yields unlimited charts of 20 to 80 KB each. The whole runtime is one 465 KB script.
