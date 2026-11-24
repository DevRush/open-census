# Northfield Medical Center: synthetic hospital operations dataset

**This is not real data.** Every row was produced by the seeded simulator in `generate.js`. Northfield Medical Center is fictional. All patient and staff names are invented; no real person, hospital or record was used.

The dataset describes 180 days of operations (Fri 22 May 2026 to Tue 17 Nov 2026) at a roughly 600-bed academic medical center: 536 inpatient beds in 13 units, 60 emergency department spaces, 12 operating rooms, a radiology suite and a heart cath lab. It is a snapshot taken at midnight at the end of 17 Nov 2026, so some patients are still in hospital, some operations are still running and some clinic appointments lie in the future.

It is meant for analysis and prototypes in: operating-room scheduling and block optimisation, case-duration prediction, bed management and capacity forecasting, triage and prioritisation, emergency department flow and boarding, length-of-stay and discharge prediction, clinic scheduling and no-show prediction, nurse staffing, inbox triage, and early-warning scores.

## What is in the folder

| Path | What it is |
|---|---|
| `generate.js` | The simulator. One file, no dependencies, seeded and deterministic. |
| `checks.js` | Re-reads the CSV files and verifies the consistency rules. |
| `data/*.csv` | 15 tables (about 57 MB). |
| `data/ground_truth/` | Hidden parameters and true outcomes (about 3 MB). Keep these away from any model you are testing. |
| `data/manifest.json` | Seed, window and row counts of the last run. |
| `DATA_DICTIONARY.md` | Every table and column, row counts, generating assumptions, simplifications. |
| `ops-data.zip` | Everything above in one archive. |

## Regenerate

```
node generate.js            # default seed 20261117, rewrites data/ (about 8 seconds)
node generate.js 12345      # a different hospital history; also --seed 12345 or OPS_SEED=12345
node checks.js              # exit code 0 when all 32 checks pass
```

The same seed gives byte-identical files. The row counts in `DATA_DICTIONARY.md` are for the default seed. Seeds 7 and 424242 were also run and pass all checks.

## Why the tables agree with each other

The generator is a discrete-event simulation, not a set of independent random tables. One event queue drives the emergency department, the bed manager, the wards and intensive care units, and the operating rooms, so:

- a bed holds one patient at a time and is not reused until its cleaning has finished;
- a patient waits for a bed only when the requested unit has no clean, unreserved bed. Emergency department boarding is therefore caused by full wards;
- an operating room, a surgeon and an anaesthetist each do one case at a time, and a case cannot start before the previous case in that room has left and the room has been turned over, so late cases push later cases back;
- emergency operations take the next free room and can bump an elective list;
- elective operations are cancelled when no intensive care bed is free or the list has overrun;
- a patient is in one place at a time across inpatient stays, emergency visits, day surgery and clinic visits;
- the hourly census is counted from the same bed movements that are written to `adt_events.csv`.

`checks.js` verifies each of these from the files alone.

## Example questions per table

| Table | Questions it can answer |
|---|---|
| `patients.csv` | Who uses the hospital? Which patient traits go with no-shows, readmission or long stays? |
| `encounters.csv` | Length of stay by service and diagnosis group. Who is readmitted within 30 days? What share leave before noon? Which current inpatients are likely to go home tomorrow? |
| `adt_events.csv` | How long from bed request to arrival, by unit and hour? How long do beds stay empty for cleaning? How often are patients placed off-service? |
| `beds.csv`, `bed_census_hourly.csv` | Occupancy by unit and hour, forecast of tomorrow's census, when do units fill, how many patients are waiting for a bed? |
| `ed_visits.csv` | Arrival curves by hour and weekday, door-to-doctor time by urgency, who is admitted, how long do admitted patients board, who leaves without being seen? |
| `or_blocks.csv`, `or_block_days.csv` | Block utilisation by service, surgeon and weekday. Which blocks overrun or sit empty? How should block time be reallocated? |
| `or_cases.csv` | Predict case duration from procedure, surgeon and patient. First-case on-time starts. Turnover times. Why are cases delayed or cancelled? How long do add-on cases wait? |
| `or_staff.csv` | Surgeon-level effects on duration and lateness. |
| `clinic_appointments.csv` | Predict no-shows from lead time, prior no-shows, clinic and patient traits. Overbooking policies. Waiting time and cycle time by clinic. |
| `staff.csv`, `staffing_shifts.csv` | Patients per nurse by unit and shift, sick-call patterns, which shifts fall below the required number of nurses? |
| `inbox_messages.csv` | Rank messages by clinical urgency from the text. Which urgent messages were sent as routine? How long until messages are read and acted on? |
| `vitals_ward_sample.csv` | Build and test early-warning scores. How many hours before an intensive care transfer do vital signs change? |
| `ground_truth/` | Score a model against the truth: deterioration onset times, true duration and no-show parameters, earliest feasible start of delayed cases, a reference operating schedule for 20 held-out days, true message priority, and the real outcome of stays still open at the snapshot. |

## Things to know before using it

- Timestamps are ISO 8601 local hospital time at minute resolution, for example `2026-05-22T07:30`, with no time zone and no daylight-saving changes.
- The simulation ran for 42 days before the window to fill the hospital. Stays that began before 22 May and were still open on that day are included and flagged `carry_in = 1`.
- A blank value means "did not happen" or "had not happened by the snapshot". Nothing after `2026-11-18T00:00` is recorded outside `ground_truth/`, except future clinic `appointment_time` values.
- Magnitudes follow commonly reported figures for large teaching hospitals, but they are the author's approximations. They were not fitted to any real dataset and should not be quoted as benchmarks.
- See "Known simplifications" in `DATA_DICTIONARY.md` before drawing conclusions about real hospitals.
