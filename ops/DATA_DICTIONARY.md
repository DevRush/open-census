# Data dictionary: Northfield Medical Center synthetic operations dataset

Fully synthetic, simulator-generated, not real data. Default seed 20261117. Window 2026-05-22T00:00 to the snapshot at 2026-11-18T00:00 (180 days ending Tue 17 Nov 2026).

## Conventions

- **Timestamps**: ISO 8601 local hospital time, minute resolution, no zone, no daylight saving (`2026-05-22T07:30`). Dates are `YYYY-MM-DD`.
- **Blank** means not applicable, not recorded, or not yet happened at the snapshot.
- **Flags** are `1` / `0`.
- **Units**: `icu` Medical ICU (MICU, 24 beds), `neuro` Neuro ICU (NICU, 16), `trauma` Trauma ICU (TICU, 12), `cvicu` Cardiac Surgery ICU (CVICU, 12), `sx` 6 West Surgery (6W, 64), `ortho` 5 North Orthopaedics (5N, 48), `card` 4 East Cardiology (4E, 56), `med` 3 West Medicine (3W, 128), `haem` 7 South Haematology (7S, 36), `tx` Transplant Unit (TX, 24), `ob` Labour and Postnatal (LP, 44), `peds` Paediatrics (PD, 40), `psych` Behavioural Health (BH, 32), `ed` Emergency Department (ED, 60 spaces). 536 inpatient beds plus 60 emergency spaces.
- **Rooms**: `OR 1` to `OR 12`, `Radiology suite`, `Heart cath lab`. OR 11 and OR 12 hold no elective blocks; they take add-on and emergency cases around the clock.
- **Identifiers**: patient `OPS-000001`, record number `LX-` + 6 digits, encounter `ENC-0000001`, emergency visit `EDV-000001`, bed movement `ADT-0000001`, case `ORC-000001`, block `BLK-001`, appointment `APT-0000001`, message `MSG-000001`, staff `STF-00001`, shift `SHF-00001`, bed `3W-001`, emergency space `ED-B01` (also `ED-R1` resuscitation, `ED-FT1` fast track, `ED-H01` hallway).
- **Carry-in**: stays and emergency visits that began in the simulated warm-up before 22 May and were still open on that day are included with `carry_in = 1`, with all of their bed movements. Operating cases before 22 May are not included.

## Row counts (default seed)

| File | Rows | Columns | Size (MB) |
|---|---:|---:|---:|
| `patients.csv` | 40,000 | 27 | 4.5 |
| `encounters.csv` | 76,711 | 25 | 13.6 |
| `adt_events.csv` | 33,061 | 19 | 5.1 |
| `beds.csv` | 596 | 6 | 0.03 |
| `bed_census_hourly.csv` | 60,480 | 14 | 3.1 |
| `ed_visits.csv` | 37,394 | 33 | 9.4 |
| `or_blocks.csv` | 120 | 10 | 0.01 |
| `or_block_days.csv` | 1,536 | 15 | 0.14 |
| `or_cases.csv` | 7,201 | 50 | 2.9 |
| `or_staff.csv` | 212 | 9 | 0.02 |
| `clinic_appointments.csv` | 29,456 | 27 | 6.6 |
| `staff.csv` | 1,604 | 8 | 0.12 |
| `staffing_shifts.csv` | 5,040 | 25 | 0.6 |
| `inbox_messages.csv` | 24,734 | 16 | 6.3 |
| `vitals_ward_sample.csv` | 61,334 | 16 | 5.0 |
| `ground_truth/vitals_deterioration_truth.csv` | 1,929 | 13 | 0.09 |
| `ground_truth/case_duration_procedure_params.csv` | 88 | 13 | 0.01 |
| `ground_truth/case_duration_surgeon_effects.csv` | 64 | 7 | <0.01 |
| `ground_truth/case_duration_surgeon_procedure_effects.csv` | 364 | 3 | 0.02 |
| `ground_truth/case_duration_case_truth.csv` | 6,607 | 7 | 0.26 |
| `ground_truth/or_delay_truth.csv` | 2,594 | 15 | 0.37 |
| `ground_truth/no_show_truth.csv` | 29,456 | 5 | 1.1 |
| `ground_truth/inbox_truth.csv` | 24,734 | 4 | 0.9 |
| `ground_truth/censored_outcomes.csv` | 2,983 | 7 | 0.2 |
| `ground_truth/length_of_stay_params.csv` | 43 | 11 | <0.01 |
| `ground_truth/or_reference_schedule.csv` | 679 | 12 | 0.06 |
| `ground_truth/or_reference_objective.csv` | 237 | 15 | 0.01 |
| `ground_truth/*.json` (3 files) | | | <0.01 |
| **Total** | | | **60.4** |

Encounters by type: 37,394 emergency, 20,822 outpatient, 15,465 inpatient, 3,030 day surgery. 501 encounters are carry-ins.

---

## Tables

### patients.csv
One row per person in the hospital's catchment (not all have an encounter).

| Column | Meaning |
|---|---|
| `patient_id` | `OPS-` + 6 digits. Key used in every table. |
| `record_number` | `LX-` + 6 digits, unique. |
| `given_name`, `family_name` | Invented, uncommon names. |
| `sex` | `F` / `M`. |
| `birth_date` | Consistent with `age_years`. |
| `age_years` | Age on 17 Nov 2026. Used as the age for every encounter. |
| `insurance_type` | `medicare`, `medicaid`, `commercial`, `self_pay`, `other_government`. |
| `distance_from_hospital_km` | Home to hospital. |
| `preferred_language`, `interpreter_needed` | Language and whether an interpreter is needed. |
| `lives_alone`, `portal_account` | Flags. |
| `body_mass_index` | Adults only. |
| `smoker`, `high_blood_pressure`, `diabetes`, `heart_failure`, `chronic_lung_disease`, `chronic_kidney_disease`, `cancer`, `dementia`, `depression`, `asthma` | Long-term condition flags. |
| `chronic_condition_count` | Sum of the seven major flags (blood pressure, diabetes, heart failure, lung, kidney, cancer, dementia). |
| `admissions_prior_12m`, `no_shows_prior_12m` | History before the window. |

### encounters.csv
One row per contact: inpatient stay, emergency visit, clinic visit that took place, or day surgery.

| Column | Meaning |
|---|---|
| `encounter_id`, `patient_id` | Keys. |
| `encounter_type` | `inpatient`, `emergency`, `outpatient`, `day_surgery`. |
| `status` | `completed`, `in_progress` (still here at the snapshot), `awaiting_bed` (direct admission accepted, bed not yet reached). |
| `admit_time` | Inpatient from the emergency department: time of the decision to admit. Planned surgery: arrival at the pre-operative area. Direct admission or transfer in: arrival in the first bed. Emergency: arrival. Outpatient: check-in. |
| `discharge_time` | Time the patient left (or died). Outpatient: checkout. |
| `length_of_stay_hours` | Discharge minus admit. |
| `service` | Responsible service, in plain words. |
| `admitting_diagnosis_group` | Inpatient: one of 43 plain-language groups, or "Planned surgery: ...". Emergency: the chief complaint. Outpatient: visit type. |
| `admit_source` | Inpatient: `emergency`, `elective`, `direct`, `clinic`, `transfer_in`. Emergency: `self_or_ambulance` or `transfer_in`. |
| `ed_urgency_level` | Urgency level 1 to 5 on arrival, where the stay began in the emergency department. |
| `first_unit`, `last_unit` | First and last unit occupied. |
| `had_icu_stay`, `icu_hours` | Intensive care use so far. |
| `discharge_disposition` | `home`, `home_with_services`, `skilled_nursing_facility`, `rehabilitation_facility`, `hospice`, `against_medical_advice`, `transfer_other_hospital`, `expired`; emergency visits also `admitted_to_hospital`, `left_without_being_seen`. |
| `medically_ready_time` | When the patient no longer needed hospital care. The gap to `discharge_time` is avoidable stay. |
| `discharge_order_time` | When the discharge order was written. |
| `discharged_before_noon` | Flag, live discharges only. |
| `is_readmission_30d` | This inpatient stay began within 30 days of the patient's previous inpatient discharge. |
| `days_since_last_discharge` | Days since that previous discharge. |
| `readmitted_within_30d` | Outcome label: another inpatient stay began within 30 days of this discharge. Blank when 30 days had not yet passed at the snapshot (truth in `ground_truth/censored_outcomes.csv`). |
| `linked_encounter_id` | Emergency visit that led to this stay, or the stay that followed this emergency visit. |
| `age_at_admit` | Age in years. |
| `carry_in` | Began before 22 May 2026. |

### adt_events.csv
Bed movements of inpatient encounters. Emergency department spaces are in `ed_visits.csv`.

| Column | Meaning |
|---|---|
| `event_id`, `encounter_id`, `patient_id` | Keys. |
| `event_type` | `admit` (first bed), `transfer`, `discharge`. |
| `reason` | `ed_admission`, `direct_admission`, `transfer_in`, `post_operative`, `icu_stepdown`, `deterioration`, `discharge`, `death`. |
| `request_time` | When the bed was requested; for a discharge, when the order was written. |
| `bed_assigned_time` | When the bed manager assigned a bed. |
| `actual_time` | When the patient arrived in the bed, or left on discharge. |
| `request_to_actual_min` | Minutes between request and actual. |
| `from_unit`, `from_bed` | Where the patient came from. `ed`, `periop` (operating room or recovery) and `outside` have no inpatient bed. |
| `to_unit`, `to_bed` | Destination bed. |
| `requested_unit` | Unit asked for. |
| `off_service_placement` | Flag: placed in a different unit because the requested one was full. |
| `vacated_bed_clean_start`, `vacated_bed_clean_end`, `vacated_bed_turnaround_min` | Cleaning of the bed the patient left (transfer and discharge rows). |
| `status` | `completed`; at the snapshot also `bed_assigned`, `waiting_for_bed`, `discharge_ordered`. |

### beds.csv
`bed_id`, `unit`, `unit_name`, `unit_code`, `bed_type` (`intensive care`, `ward`, `resuscitation bay`, `treatment bay`, `fast-track chair`, `hallway space`), `room`.

### bed_census_hourly.csv
One row per unit per hour (14 units x 4,320 hours). State is taken at the start of the hour; counts cover the following 60 minutes.

| Column | Meaning |
|---|---|
| `timestamp`, `unit` | Key. |
| `beds_total` | Beds in the unit. |
| `occupied`, `occupancy_pct` | Patients in beds at that instant. |
| `beds_being_cleaned` | Vacated and not yet clean. Always 0 for `ed`. |
| `beds_reserved` | Assigned to a patient who has not yet arrived. Always 0 for `ed`. |
| `beds_available` | Total minus occupied, cleaning and reserved. |
| `patients_waiting_for_bed` | Requests for this unit not yet arrived. For `ed`: patients in the waiting room. |
| `ed_boarders` | Of those, admitted patients still in the emergency department. For `ed`: all boarders. |
| `admissions_in_hour`, `transfers_in_in_hour`, `transfers_out_in_hour`, `discharges_in_hour` | Movements in the hour. For `ed`: arrivals and departures. |

### ed_visits.csv
One row per emergency department visit.

| Column | Meaning |
|---|---|
| `visit_id`, `encounter_id`, `patient_id` | Keys. |
| `arrival_time`, `arrival_mode` | `walk-in`, `ambulance`, `helicopter`, `police`, `transfer from another facility`. |
| `urgency_level`, `urgency_description` | 1 Immediate, 2 Very urgent, 3 Urgent, 4 Standard, 5 Non-urgent. |
| `chief_complaint` | One of 35 plain-language complaints. |
| `age_years` | Age. |
| `triage_time` and `triage_heart_rate`, `triage_resp_rate`, `triage_systolic_bp`, `triage_diastolic_bp`, `triage_temperature_c`, `triage_spo2_pct`, `triage_pain_score` (0 to 10), `triage_gcs` (3 to 15) | Triage observations. |
| `ed_space`, `roomed_time` | Treatment space and when the patient was placed in it. |
| `doctor_seen_time`, `door_to_doctor_min` | First seen by a doctor. |
| `disposition_decision_time` | Decision to admit, discharge or transfer. |
| `disposition` | `discharged`, `admitted`, `transferred`, `left_without_being_seen`, `left_against_advice`, `died`. |
| `departure_time`, `ed_length_of_stay_min` | Leaving the department. |
| `boarding_hours` | Admitted patients: decision to departure. |
| `left_without_being_seen` | Flag. |
| `admitted_encounter_id`, `requested_unit` | The inpatient stay and the unit first requested. |
| `went_direct_to_procedure` | Flag: left for an operating room or procedure suite rather than a ward bed. |
| `ed_occupancy_at_rooming` | Spaces in use when the patient was roomed. |
| `status` | `departed`, `in_department`, `boarding`, `waiting_room`. |

### or_blocks.csv
The repeating two-week block template: `block_id`, `room`, `weekday`, `week_pattern` (`A` or `B`; the week of Mon 18 May 2026 is A, then alternating), `specialty`, `service`, `surgeon_id`, `start_time` (07:30; 08:30 on Wednesdays; 08:00 in the radiology suite and cath lab), `end_time` (17:00), `block_minutes`.

### or_block_days.csv
One row per block per weekday in the window: `date`, `room`, `block_id`, `week_pattern`, `specialty`, `surgeon_id`, `block_status` (`active`, `released_surgeon_leave`, `public_holiday`), `block_minutes`, `cases_booked`, `booked_room_minutes`, `cases_completed`, `actual_room_minutes`, `actual_minutes_inside_block`, `block_utilisation_pct` (room minutes inside the block divided by block minutes, turnover excluded), `overrun_minutes` (last wheels-out after block end).

### or_cases.csv
One row per booked elective case and per add-on case.

| Column | Meaning |
|---|---|
| `case_id`, `case_date`, `room`, `block_id` | Keys. `block_id` is blank for add-ons. |
| `specialty`, `procedure_name`, `complexity_tier` | Procedure in plain words (88 procedures), tier 1 (minor) to 5 (most complex). |
| `surgeon_id`, `anaesthetist_id`, `circulating_nurse_id`, `scrub_practitioner_id` | Staff. No anaesthetist for nurse-led sedation or local cases in the radiology suite and cath lab. Nurse ids are the team at wheels-in. |
| `anaesthesia_type` | `general`, `regional (spinal or nerve block)`, `sedation`, `local with sedation`. |
| `asa_class` | Anaesthetic fitness grade 1 (healthy) to 5. |
| `patient_id`, `encounter_id` | Patient and the stay or day-surgery encounter. Blank encounter when the patient never arrived. |
| `patient_class` | `day_surgery`, `same_day_admission`, `inpatient` (already in a bed), `emergency` (straight from the emergency department). |
| `add_on`, `add_on_urgency`, `add_on_request_time` | Add-on flag; `emergent` (within the hour), `urgent` (within about 6 hours), `expedited` (within about a day, daytime only). |
| `booked_time`, `list_sequence` | Elective: when it was booked and its planned position in the list. |
| `status` | `completed`, `cancelled_day_of`, `cancelled_before_day`, `cancelled_add_on`, `in_progress`, `requested`. |
| `cancellation_time`, `cancellation_reason` | 14 plain-language reasons, including "No intensive care bed available" and "Insufficient operating time, list overran", which arise from the simulation state. |
| `scheduled_start`, `scheduled_end`, `scheduled_duration_min` | Planned room time (wheels-in to wheels-out). For add-ons only the duration. |
| `estimated_procedure_min` | Booking estimate of incision to closure. |
| `wheels_in`, `anaesthesia_ready`, `incision`, `closure`, `wheels_out` | Actual times. |
| `actual_room_min`, `actual_procedure_min` | Wheels-in to wheels-out; incision to closure. |
| `start_delay_min` | Elective: wheels-in minus scheduled start (negative when early). |
| `delay_reason` | Given when the delay exceeds 5 minutes. About a dozen reasons, such as "Previous case ran over", "Bumped by emergency case", "Surgeon arrived late". |
| `add_on_request_to_start_min` | Add-on: request to wheels-in. |
| `first_case_of_day`, `on_time_start` | First elective case in the room that day; started within 5 minutes of schedule. |
| `turnover_after_min` | Clean and set-up time after this case before the room was ready. |
| `teaching_case` | A trainee took part. |
| `bumped_elective_list` | Add-on that went ahead of a waiting elective case. |
| `post_op_destination`, `planned_intensive_care` | Unit or `home`. |
| `recovery_in`, `recovery_out`, `recovery_hold_min` | Recovery area. Hold is time spent there after being ready to leave, waiting for a bed. Blank for patients sent straight to intensive care. |
| `age_years`, `body_mass_index` | Patient features at surgery. |

### or_staff.csv
Surgeons, proceduralists, anaesthetists, circulating nurses and scrub practitioners: `staff_id`, `given_name`, `family_name`, `role`, `specialty`, `years_experience`, `full_time_equivalent`, `elective_blocks_per_fortnight`, `cases_in_window`. All also appear in `staff.csv`.

### clinic_appointments.csv
One row per booked outpatient appointment in 18 clinics, including 1,751 future appointments (up to 14 days ahead) with status `scheduled`.

| Column | Meaning |
|---|---|
| `appointment_id`, `patient_id`, `clinic`, `clinician_id` | Keys. Surgical clinics are run by the surgeons in `or_staff.csv` on days they are not operating. |
| `booked_time`, `appointment_time`, `lead_time_days` | When it was booked, when it is, and the gap. |
| `visit_type` | `new patient`, `follow-up`, `post-discharge follow-up`, `pre-operative assessment`. |
| `mode` | `in_person` or `telehealth`. |
| `slot_minutes`, `overbooked` | Slot length; flag for a second patient booked into the same slot. |
| `reminder_confirmed` | Patient confirmed the reminder. Blank when the reminder had not yet gone out. |
| `prior_no_shows` | No-shows before this appointment (12 months before the window plus those in the dataset). |
| `prior_appointments_in_dataset` | Earlier attended or missed appointments in this file. |
| `status` | `completed`, `no_show`, `cancelled` (more than 24 hours ahead), `cancelled_late`, `scheduled`. |
| `cancellation_time`, `cancellation_reason` | For cancellations. |
| `check_in_time`, `roomed_time`, `doctor_in_time`, `doctor_out_time`, `checkout_time` | Visit flow. No `roomed_time` for telehealth. |
| `wait_after_appointment_time_min` | Minutes from the later of check-in and appointment time until the clinician arrived. |
| `cycle_time_min` | Check-in to checkout. |
| `encounter_id` | Outpatient encounter for completed visits. |
| `follow_up_of_encounter_id` | Inpatient stay this visit follows. |
| `pre_op_for_case_id` | Operation this assessment is for. |

### staff.csv
`staff_id`, `given_name`, `family_name`, `role`, `department`, `specialty`, `years_experience`, `full_time_equivalent`. 1,604 people across 20 roles.

### staffing_shifts.csv
One row per unit per 12-hour shift (day 07:00 to 19:00, night 19:00 to 07:00).

| Column | Meaning |
|---|---|
| `shift_id`, `date`, `unit`, `shift`, `shift_start`, `shift_end` | Key and times. |
| `census_at_start`, `average_census`, `peak_census` | From `bed_census_hourly.csv`. |
| `arrivals_in_shift`, `departures_in_shift` | Admissions plus transfers in; discharges plus transfers out. |
| `target_patients_per_nurse` | Unit standard for that shift. |
| `nurses_required` | Average census divided by target, rounded up, minimum 2. |
| `nurses_scheduled`, `sick_calls`, `float_pool_in`, `agency_nurses`, `overtime_nurses`, `floated_out` | Roster movements. |
| `nurses_actual` | Scheduled minus sick calls plus float, agency and overtime, minus floated out. |
| `nursing_assistants` | Support staff on shift. |
| `patients_per_nurse` | Average census divided by `nurses_actual`. |
| `below_required` | Flag: fewer nurses than required. |
| `overtime_hours`, `charge_nurse_id` | Overtime worked; nurse in charge. |

### inbox_messages.csv
Clinical and administrative messages. About half are tied to simulated events (deteriorating patients, bed waits, discharges, operating-room changes, missed appointments).

| Column | Meaning |
|---|---|
| `message_id`, `created_time` | Key and time sent. |
| `message_type` | 16 types, such as `patient_medical_question`, `prescription_refill`, `test_result`, `nurse_to_doctor`, `bed_request`, `discharge_planning`, `operating_room_schedule`, `missed_appointment`, `referral`, `pharmacy_query`, `staff_announcement`. |
| `sender_role`, `sender_staff_id` | Who sent it. No staff id for patients, laboratory, radiology or administrator. |
| `recipient_role`, `recipient_staff_id` | Who it was for. |
| `patient_id`, `encounter_id` | Subject of the message, where there is one. |
| `urgency` | The flag the sender chose: `routine`, `urgent`, `stat`. Patients can only send `routine`. This is deliberately noisy; the true priority is in `ground_truth/inbox_truth.csv`. |
| `text` | Short message in plain language, built from templates. |
| `read_time`, `actioned_time`, `action_taken` | Response. |
| `minutes_to_read`, `minutes_to_action` | From creation. |

### vitals_ward_sample.csv
Bedside observations for 1,929 adult ward stays (about 18% of eligible stays that began in the window), only while the patient was in a ward bed. Observations are roughly 4-hourly and become more frequent when the score is raised, so sampling is informative.

| Column | Meaning |
|---|---|
| `encounter_id`, `patient_id`, `unit`, `bed_id`, `observation_time` | Key. |
| `heart_rate`, `resp_rate`, `systolic_bp`, `diastolic_bp`, `temperature_c`, `spo2_pct` | Vital signs. Any may be blank (not recorded). |
| `supplemental_oxygen`, `oxygen_l_min` | On oxygen and flow. |
| `consciousness` | `A` alert, `C` new confusion, `V` responds to voice. |
| `pain_score` | 0 to 10. |
| `early_warning_score` | Aggregate score using the widely published seven-item banding (breathing rate, oxygen level, oxygen use, temperature, systolic pressure, heart rate, consciousness). A missing item scores 0. |

---

## ground_truth/ (keep separate from model inputs)

| File | Content |
|---|---|
| `vitals_deterioration_truth.csv` | One row per sampled stay: `deteriorated`, `deterioration_type` (`sepsis`, `respiratory`, `bleeding`, `cardiac`, `neurological`), `onset_time` (hidden start), `recognition_time` (rapid-response moment), `outcome` (`none`, `icu_transfer`, `treated_on_ward_recovered`, `death_on_ward`), `icu_arrival_time`, `hours_onset_to_recognition`, plus flags when onset or recognition lies after the snapshot. Also `observations` and `max_early_warning_score`. |
| `case_duration_procedure_params.csv` | Per procedure: median incision-to-closure minutes, log standard deviation, medians for pre-incision and post-closure time, probability of inpatient stay and intensive care, post-operative ward stay, weight in the elective mix. |
| `case_duration_surgeon_effects.csv` | Per surgeon: log duration effect, probability of arriving late for a first case, booking-estimate multiplier, block fill target, overtime tolerance. |
| `case_duration_surgeon_procedure_effects.csv` | Extra log effect for each surgeon-procedure pair. |
| `case_duration_model.json` | Formula and coefficients (age, body mass index, fitness grade, teaching, add-on, complication tail), turnover and start-delay parameters. |
| `case_duration_case_truth.csv` | Per performed case: true log median, log standard deviation, the noise draw, complication flag and multiplier, true median minutes. |
| `or_delay_truth.csv` | Per elective case delayed by more than 5 minutes: `earliest_feasible_start` (latest of scheduled start, room ready, surgeon free, anaesthetist free, patient ready, equipment ready), `unavoidable_delay_min`, `avoidable_delay_min` (actual start minus earliest feasible), `binding_constraint`, the component times (shown when within 4 hours of the scheduled start), and the discretionary delay and its reason. |
| `no_show_model.json` | Logistic coefficients of the true no-show model. |
| `no_show_truth.csv` | Per appointment: true no-show probability, the patient's hidden random effect, true final status (including future appointments). |
| `inbox_truth.csv` | Per message: `true_priority` 1 (act within the hour), 2 (same day), 3 (within three days), 4 (no clinical action), and whether it relates to a deterioration event. |
| `censored_outcomes.csv` | For stays open at the snapshot, or discharged less than 30 days before it: true discharge time, length of stay, disposition and 30-day readmission, taken from 30 further simulated days. |
| `length_of_stay_params.csv` | Per diagnosis group: ward-stay median and log standard deviation, probability of starting in intensive care, mortality, readmission and deterioration multipliers, probability of an add-on operation. |
| `or_reference_schedule.csv`, `or_reference_objective.csv`, `or_reference_method.json` | Reference schedule for the 20 held-out weekdays 21 Oct to 17 Nov 2026. For each room and day the performed elective cases are re-sequenced and given planned durations. Cost = 1.0 x minutes cases start after their planned start + 0.5 x minutes the room waits idle + 2.0 x minutes past block end, with 30-minute turnovers. The method is sample-average approximation over 150 duration scenarios from the true model, smallest-variance-first ordering, a planning quantile chosen from 0.4 to 0.7, then pairwise-swap local search. It is a heuristic, not a proven optimum. The objective file gives expected and realised cost for the booked and the reference schedule per room and per day (`ALL ROOMS` rows). Total expected cost over the 20 days is about half that of the booked schedules. |

---

## Generating assumptions and their rough real-world basis

Figures in the "result" column are from the default seed. The "basis" column gives the range commonly reported for large teaching hospitals, quoted from general knowledge of the literature. Nothing was fitted to a real dataset.

| Area | Assumption in the simulator | Result | Rough basis |
|---|---|---|---|
| Emergency arrivals | Poisson by hour (trough 04:00, plateau 10:00 to 20:00), Monday highest, breathing complaints rising to 1.5x by November, injuries higher in summer | 208 visits a day | 60,000 to 80,000 visits a year at a 600-bed center |
| Urgency mix | Latent severity from complaint, age and arrival mode, cut into five levels | 2.5 / 19 / 39 / 29 / 10 % | Level 3 the largest group, level 1 about 1 to 3% |
| Admission from the emergency department | Probability by level (78, 46, 22.5, 3, 0.4%), higher for older patients | 24% admitted | 15 to 25% |
| Door to doctor, leaving unseen | Queue for 60 spaces by urgency; patience times for levels 3 to 5 | Median 22 min; 3.1% leave unseen | Median 20 to 40 min; 1 to 5% |
| Boarding | Admitted patients keep their space until a bed is clean and assigned, plus transfer time. Off-service placement after 4 to 6 hours (1 hour for intensive care) | Median 0.9 h, 90th percentile 4.4 h, maximum 64 h | Often 2 to 6 h median in crowded centers; this hospital is moderately crowded |
| Length of stay | Lognormal by diagnosis group (median 1.2 to 20 days), longer with age and long-term conditions; intensive care first for a group-specific share | Median 3.8 d, mean 5.2 d | Mean 4.5 to 6 days |
| Discharge timing | Discharge needs a medically ready day; clock time peaks mid-afternoon; fewer weekend discharges; 45% of facility discharges wait 1 to 3 extra days | 15.5% before noon | 10 to 25% |
| Occupancy | Emerges from arrivals and stays | Medicine 95%, surgery 93%, cardiology 89%, intensive care 80 to 87% | Medical wards commonly above 90% |
| Mortality, readmission | Per-group mortality scaled by age and intensive care; readmission logistic on diagnosis group, long-term conditions, age, disposition | 2.7% die; 14.3% readmitted in 30 days | About 2 to 3%; 12 to 16% |
| Elective schedule | Two-week block template; lists filled to about 70 to 107% of block time from each surgeon's procedure mix; booked 3 to 150 days ahead | 5,016 elective cases | |
| Case duration | Lognormal per procedure (log sd 0.20 to 0.50), surgeon effect sd 0.11, surgeon-procedure effect sd 0.05, small patient effects, 2.5 to 6% complication tail (x1.35 to 2.2) | Actual / estimated median 1.10, 90th percentile 1.78 | Durations are right-skewed; surgeons tend to underestimate |
| First-case starts | Patient late 10%, surgeon late with a surgeon-specific probability (mean 20%), anaesthesia delay 9% | 66% on time | 50 to 75% |
| Turnover | Lognormal, median 22 to 34 min by case type, 5% long delays | Median 26 min | 25 to 35 min |
| Cancellations | Before the day 3.2%; on the day fixed causes 3.8% plus no intensive care bed, no ward bed, list overrun, patient in hospital | 3.5% before, 8.2% on the day | On the day 4 to 10% |
| Add-on cases | From diagnoses (appendicitis, hip fracture, heart attack, major injury, transplant and others); three urgency classes | 2,185 cases; median wait 0.7 h emergent, 1.4 h urgent, 8.4 h expedited | |
| No-shows | Logistic on log lead time, prior no-shows, age, insurance, distance, visit type, mode, weekday, afternoon, clinic, reminder confirmation, patient random effect (sd 0.75) | 11.9% of uncancelled; 7% at under 2 days lead to 16% beyond 60 days | 10 to 20% |
| Nurse staffing | Target ratios 2 (intensive care) to 6 or 8 (behavioural health); sick calls 4.5% plus weekend, Monday, night and autumn effects | 15.7% of unit-shifts below required | |
| Deterioration | 5% base chance per adult ward stay, scaled by diagnosis, age, conditions; ramp 6 to 30 hours to recognition; outcomes intensive care 55%, treated on ward 40%, death 5%, plus ward deaths from the mortality model | 117 of 1,929 sampled stays | Rapid-response events in a few percent of ward stays |
| Inbox | 82 general messages per weekday plus event-linked messages; 7% of patient questions contain a red-flag symptom; sender flags are noisy | 24,734 messages; 6% true priority 1 | |

## Known simplifications

- **One snapshot age.** A patient's age is fixed at the value on 17 Nov 2026.
- **Small catchment.** 40,000 patients feed a 600-bed hospital, so individuals return more often than in reality.
- **No time zone or daylight saving.** Public holidays are 25 May, 3 July and 7 September 2026.
- **Warm-up.** The first days of the window still carry warm-up patients; operating cases before 22 May are not listed even where the patient's stay is.
- **Emergency department.** No observation unit, no separate paediatric area, no physician rostering. Staffing levels do not slow patient flow anywhere in the hospital.
- **Beds.** Every bed in a unit is equivalent (no isolation or sex-segregated rooms, no closed beds). Off-service patients stay where they were placed. Children never use adult intensive care. Recovery-area capacity is unlimited.
- **Operating rooms.** Elective cases never move between rooms, days or surgeons. Cancelled cases are not rebooked. One anaesthetist per room. Surgeon on-call is one person per specialty per day. Caesarean births share the main rooms. Block release rules are not modelled.
- **Emergent add-on waits** can be long when the single on-call surgeon is already operating.
- **Deterioration** is one episode per stay at most; patients with a planned add-on operation have none. Ward deaths are always preceded by a deterioration pattern.
- **Vital signs** come from a simple baseline-plus-noise model with five deterioration shapes. They are easier to separate than real observations.
- **Staffing** is counted per unit and shift. Individual nurses are not assigned to patients, and staffing does not affect outcomes.
- **Clinics** use a simple single-clinician queue. Future appointments cover 14 days only.
- **Inbox text** comes from a limited set of templates and repeats.
- **Reference schedule.** The reference problem ignores patient readiness, equipment, emergencies and cross-room moves, so its costs are comparable only with the booked schedule replayed under the same rules.
- **No causal effects of care quality.** Delays, boarding and staffing shortfalls do not change clinical outcomes.
- **Readmission label near the edges.** `is_readmission_30d` can be 1 because of a stay that ended before the window and is therefore not in the file.
