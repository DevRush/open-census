# Patient file contract (Larkspur practice chart)

You write ONE file: `/home/user/practice-emr/patients/<id>.js`. It must be exactly:

```js
EXTRA.push(function(){
  var r=rng(<seed>);            // seeded noise source
  // ...local helpers/arrays...
  return { id:'<id>', ... };    // one patient object
});
```

Read `/home/user/practice-emr/data.js` first. It defines the helpers you may call (`T`, `grid`, `gen`, `G`, `rng`, `NOW`) and contains three complete example patients inside `seed()`; **patient 3 (Achterberg, "Patient 3: cardiology ward") is the model to imitate** for structure, depth, tone and length. Your object uses the same fields as those examples, plus the new fields `unitKey`, `hx`, `encounters` described below. Do NOT set `id` on meds/notes/orders or add `pending` (the app does that).

Simulated "now" is Tue 17 Nov 2026 14:30. `T(day,'HH:MM')` = that day of November 2026; `T(day,'HH:MM',9)` = October (month index). Nothing charted may be later than now, except doses with status 'due'.

## Fields (all required unless marked optional)
- `id`, `name` ('Surname, Given' — invented, uncommon, must not match the examples or any famous person), `age` (number; for a child under 2 use a number of years like 0 and put the real age in `ageText`, optional string e.g. '6 days'), `sex` ('M'/'F'), `dob` ('11 May 1952' style, consistent with age), `mrn` ('LX-' + 6 digits), `unit`, `bed`, `unitKey` (given in your brief), `service`, `attending` ('Dr. …'), `admit` (Date), `code` ('Full code' or another short phrase), `wt`, `ht` (strings with units), `allergies` (array of [substance, reaction]; use [['No known allergies','']] if none), `iso` (precautions string), `dx` (short main problem, under 60 characters), `problems` (5–8 strings), `team` (4–6 [role, name]), `events` (5–8 [Date, text] timeline, oldest first).
- `flows`: array of groups, in this order:
  1. `{name:'Vitals', chart:true, times:[Date…], rows:[…]}` with rows having exactly these `k` values in this order: `temp` (°C, 1 decimal), `hr`, `rr`, a row `{k:'bp',type:'bp',s:[…],d:[…]}`, a row `{k:'map',type:'map',lo,hi}` (no values; computed), `spo2`, `o2` (strings), `pain`. Each numeric row has `l` (label), `u` (unit), `lo`, `hi` (flag limits appropriate to THIS patient's age) and `v` with one value per time. Use `gen(times, [[Date,value],…], noise, decimals, r)` for realistic trends. ICU-type patients: hourly for the last 24 h. Ward patients: every 4 h since admission (cap about 16 columns).
  2. One specialty group with `times` (same or own time grid) and 5–8 rows specific to this patient's condition (numbers with lo/hi where sensible, or short strings; '' for not charted).
  3. `{name:'Nursing assessment', cols:[…3–4 shift labels…], rows:[8–10 rows of {l, v:[string per col]}]}`.
  4. `{name:'Intake and output', cols:[…shift labels…], unit:'mL', rows:[…]}` — name must be exactly this; rows with `sum:1` for totals; the LAST row must be `{l:'Net balance',sum:1,v:[strings like '+540' or '−620']}`.
  Every row's `v` (or `s`/`d`) length must equal the group's `times`/`cols` length.
- `lines`: 3–5 arrays [item, site, placed, status].
- `labs`: 3–5 panels `{panel, times:[Date…], rows:[[name, unit, low, high, [values or null per time]], …]}`. Chemistry and blood count at minimum, plus specialty panels. 2–5 time points each, showing a believable course. Numeric values only.
- `micro`, `imaging`, `path`: arrays (may be empty) of `{title, t:Date, status:'Final' or 'Preliminary', by, body}` — full report text with Findings/Impression. At least 2 imaging or other diagnostic reports overall; include `path` and `micro` reports where the case warrants.
- `meds`: 7–12 entries `{name, sig, ordered:Date, a:[G(Date,'given'|'held'|'due', by, note)…]}`; add `type:'prn'` for as-needed, or `type:'inf', rate, note` (no `a`) for continuous infusions. `name` includes the dose ('Furosemide 80 mg'); `sig` is 'Route · frequency' using the words Oral / Intravenous / Subcutaneous / Inhaled etc. Give the last 24 h of doses plus the next due dose(s) today/tomorrow with status 'due'. Having one dose due around 14:00–15:00 today is good.
- `orders`: 8–12 non-medication orders as arrays [category, text, status, Date]; category is one of 'Nursing','Diet','Laboratory','Imaging','Consult','Medication' (use 'Medication' here only for held/completed one-offs); status one of 'Active','Pending','Completed','On hold'.
- `alerts`: object, optional keys `pip` (piperacillin-tazobactam), `ct` (CT with IV contrast), `kcl` (potassium chloride), `hep` (heparin), `furo` (furosemide), `apap` (acetaminophen), `mag` (magnesium): a one-sentence warning shown if someone orders that item for THIS patient. Include 2–4 that are clinically apt.
- `notes`: 7–9 notes, newest first, `{type, title, by, t, body}`. Allowed `type` values: 'Progress note','History and physical','Emergency note','Operative note','Anaesthesia note','Procedure note','Consult','Nursing note','Pharmacy note','Case management','Therapy note','Social work','Discharge planning'. Must include a History and physical, at least one Progress note from today, at least one Nursing note, and at least one Consult. Bodies are real clinical prose with newlines, 120–350 words each, in the voice of that profession. Notes must agree with the structured data (same numbers, doses, times) EXCEPT for the deliberately planted conflicts you list in `key`.
- `hx`: `{pmh:[strings], psh:[strings], fam:[strings], soc:[strings], imm:[strings], home:[strings — home medication list with dose and frequency]}`.
- `encounters`: 5–8 earlier contacts, newest first, `{t:Date (use new Date(year, monthIndex, day) for earlier years), kind:'Clinic visit'|'Emergency visit'|'Admission'|'Procedure'|'Telephone', dept, title, summary}` — summary 1–3 sentences. They should tell the back-story that leads to this admission.
- `key`: 4–5 arrays [kind, title, explanation, whereToLook]; kinds: 'err' (planted error — a real, findable mistake in the chart such as a wrong dose, duplicate, missed/overdue item, contraindicated drug still active), 'doc' (a note that contradicts the structured record — you must actually write that contradiction into the note), 'time' (a hidden truth such as the true onset time of a complication or the true cause), 'dis' (a distractor that looks like an error but is correct, with the justification present somewhere in the chart). At least one each of err, doc, time, dis. Every item must be genuinely present and discoverable in the data you wrote.

## Rules
- Entirely invented. No real people. Clinically coherent and realistic for a US academic medical center, reviewed for plausibility of doses, lab values and timelines.
- British spellings as in the examples (haemoglobin, oedema, anaesthesia). US conventional lab units as in the examples (mg/dL, g/dL, mmol/L for electrolytes).
- Do NOT use licensed instruments or vocabularies by name: no Braden, Morse, NANDA, NIC, NOC, CPT codes, APACHE, CAM-ICU, RASS, PHQ. Describe in plain words ('Fall risk: High', 'Sedation: drowsy, rouses to voice'). Glasgow Coma Scale and NIH Stroke Scale totals are fine. No vendor names (Epic, Cerner).
- Plain strings only; no HTML. Inside JS strings use \n for newlines and typographic apostrophes (’) or escape quotes correctly.
- Aim for 18–28 KB.

## Check your work
Run: `node /home/user/practice-emr/validate.js /home/user/practice-emr/patients/<id>.js` and fix until it prints `OK`. Then re-read your `key` and confirm each item is truly in the chart. Report back in 3–5 lines: patient, what you planted, anything you were unsure about clinically.
