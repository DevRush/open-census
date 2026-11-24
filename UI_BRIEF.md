# UI work order: Larkspur practice chart

You own ONE file for this job: `/home/user/practice-emr/larkspur-practice-chart.html` (plus any NEW .js files you create beside it and load with `<script src>`). Do NOT edit `data.js`, `patients/*.js`, `SCHEMA.md`, `validate.js` (other agents are editing patient data right now), and do not edit anything under `export/`, `mockups/`, `research/`.

## What this is
A single-page, clickable practice hospital record system on fully synthetic patients. It is published as a claude.ai Artifact: the HTML file is wrapped in a document skeleton at publish time, so the file has NO doctype/html/head/body tags, starts with a meta + `<title>` + `<link>` + `<style>`, then markup, then scripts. Constraints you must keep:
- External scripts only from cdnjs.cloudflare.com (none needed). Fonts only from Google Fonts (already linked). Relative `<script src="…">` to files beside the page is fine.
- No `alert/confirm/prompt`, no `window.print`, no download links, no iframes. Build confirmations into the page.
- All colours are CSS custom properties defined on `:root` with a dark-mode block under `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){…}}` and again under `:root[data-theme="dark"]`. Never hard-code a colour that only works in one theme (exception: "paper" canvases such as an ECG, which keep their own fixed paper colours). The visual style may be changed later, so keep everything on tokens.
- Must work at phone width (~400px): no horizontal page scroll; wide tables scroll inside their own container. Desktop is a full-height app shell (html/body height 100%, panes scroll internally).
- Plain, direct interface wording. No vendor names (never "Epic", "Cerner" or their module names such as Storyboard, In Basket, SmartPhrase, Hyperspace) anywhere in the page. No licensed instrument names (Braden, Morse, NANDA, CPT codes, APACHE, CAM-ICU, RASS, PHQ, ESI, I-PASS).

## How it is built today
Vanilla JS, one IIFE in the inline `<script>`, string-template rendering: `draw()` rebuilds `#work` from state `S`; clicks are delegated through `data-a` / `data-v` to `act(a,v,ev)`. Read the whole file before changing it. `data.js` supplies globals: `NOW` (simulated clock, a Date; starts Tue 17 Nov 2026 14:30), `T`, `dt`, `dm`, `hm`, `p2`, `esc`, `rng`, `grid`, `gen`, `G`, `seed()` (3 patients), `CATALOG`, `EXTRA` (builders for more patients, pushed by `patients/pN.js`). `norm(p)` in the page normalises each patient (ids, orders as objects `{id,cat,text,st,t,by}`, `pending` list). `SCHEMA.md` documents the patient object.

## Test loop (required)
Write a preview wrapper so relative scripts resolve, then drive it with Playwright (already installed: `require('playwright')`, `chromium.launch()` with no options; do not install anything):
```
node -e "const fs=require('fs');fs.writeFileSync('/home/user/practice-emr/_preview.html','<!doctype html><html><head><meta charset=utf-8><meta name=viewport content=\"width=device-width,initial-scale=1\"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>'+fs.readFileSync('/home/user/practice-emr/larkspur-practice-chart.html','utf8')+'</body></html>')"
```
An existing click-through script you can adapt is `/tmp/claude-0/-home-user/17186154-afd8-5934-a019-e37c5dd32a36/scratchpad/shot4.js` (it uses a different wrapper path; point yours at `_preview.html`). Your final script must: sign in, visit every top-level screen, open EVERY patient and every chart tab, exercise each new feature below, at 1440x880 light and 400x800 dark, and report zero console errors, zero page errors and no horizontal overflow (`document.documentElement.scrollWidth > innerWidth`). Save it as `/home/user/practice-emr/_test.js`. Look at screenshots of the main screens yourself and fix what looks broken. Pause the simulated clock in tests where timing would make clicks flaky.

## Work items (do all; order is priority)

### 1. Chart layout: tabs on top, patient sidebar on the left
The owner wants the layout most hospital doctors already know: chart activities as a horizontal tab row across the top of the chart (under the workspace tabs), and a persistent patient sidebar down the left. Replace the current left activity rail and the wide banner:
- Left sidebar (~230px, scrolls on its own, collapses to a compact strip above the content on phones): initials avatar in the unit colour, name, age/sex, born, record number, bed and unit, admitted + day, attending, weight/height, allergies (red pills), resuscitation status, precautions, then compact live blocks: latest vitals (with abnormal flags), a short "due now" list (doses due/overdue, pending results), active problem list, care team. Items link to the relevant tab.
- Top tab row: Summary, Chart review, Results, Flowsheets, Medications, Orders, Notes, History, Discharge, Coding, Answer key, with the existing count badges and small icons; scrolls horizontally when narrow. Keep an obvious selected state.
- Keep our own visual identity and names; this is about layout convention, not copying any vendor's artwork.

### 2. A clock that runs
- Simulated time advances: `NOW = new Date(+NOW + ms)` (always assign a new Date; other code holds references). Default real-time (1 s per second); top-bar controls: pause/resume, speed toggle x1 / x60, and "+1 h". Show seconds and the correct weekday.
- Redraw only when something changed or on a minute boundary, never while a dialog is open, a mouse button is down, or focus is in an input/textarea/select (mark dirty and redraw when free). Preserve scroll (the `data-sc` mechanism) and any text being typed.
- Things that happen as time passes: (a) doses become due/overdue (already computed from NOW); scheduled medicines get their next due dose generated from the frequency in `sig` after a dose is documented; (b) signed lab/imaging orders come back: turnaround about 10 min for immediate, 20 urgent, 45 routine. Chemistry/blood count/coagulation/liver orders append a new time column to the matching existing panel with values drifting plausibly from the last result; single-analyte orders append to the row with that name, or to an "Additional tests" panel using a small built-in reference table; cultures file a preliminary microbiology report; imaging files a clearly-labelled preliminary report. The order becomes Completed, an inbox message "Resulted: …" arrives, and a toast shows. (c) Vitals auto-chart at each patient's existing interval (1 h intensive care, 4 h wards) with small plausible drift. (d) Chat replies arrive (item 7). The MAR "Now" button and anything else hard-coded to 17 Nov must follow NOW. Reset restores 17 Nov 14:30.

### 3. Images
In Results > Imaging, show an image above the report where we can generate one honestly:
- 12-lead ECG drawn on a canvas (pink grid paper, 4x3 lead layout plus a lead II rhythm strip, 25 mm/s, 10 mm/mV) from the report text: rate, sinus vs atrial fibrillation (no P waves, irregular), left bundle branch block (broad QRS, appropriate lead pattern), plus ST elevation/depression if the report says so.
- Chest X-ray drawn procedurally on a canvas (dark field, lungs, ribs, clavicles, mediastinum, heart, diaphragm) with findings placed from the report text: lobar consolidation by side/zone, effusions, congestion, enlarged heart, lines/tubes/drains, pneumothorax. Patient's right on image left, an "R" marker, an Invert button and a brightness slider.
- Every generated image carries a visible caption saying it is drawn by the simulator from the report and is not a real tracing/radiograph. Other study types say plainly that no image is available.
- Keep the simulated heart-monitor strip on Summary.

### 4. Order entry depth
- Medicine order dialog: separate editable Dose, Route, Frequency, Priority, first-dose time, Indication; a dose-by-weight helper (enter mg/kg, multiplies by the patient's weight parsed from `p.wt`); for children default to showing the helper. PRN orders need a reason.
- Drug-drug interaction checking against active medicines and the unsigned basket (build a table of at least 40 clinically real pairs/classes: anticoagulant combinations, QT-prolonging pairs, opioid + sedative, potassium-raising combinations, calcineurin inhibitor + azole/macrolide, warfarin interactions, serotonergic pairs, steroid + anti-inflammatory, metformin + contrast, digoxin + amiodarone, etc.), plus the existing allergy, duplicate, kidney, platelet, potassium, age and child checks (`alertsFor`). Warnings require an override reason, shown on the unsigned order.
- Grow the catalogue to roughly 400 orderables with sensible default doses/routes/frequencies (compact string tables are fine), including blood products, respiratory care, therapy, isolation, code-status and diet orders.
- Order sets tied to the patient's problems ("Suggested for this patient" appears first when the search box is focused and empty). At least 20 sets (sepsis, ketoacidosis, stroke, heart failure, GI bleed, asthma/COPD, post-op day 1, neutropenic fever, chest pain, potassium replacement, alcohol withdrawal, pre-op, pain ladder, bowel regimen, comfort care, transfusion, heparin infusion, insulin correction, pre-eclampsia, paediatric asthma). Every item in a set must exist in the catalogue.
- Keyboard: arrow keys move through search results, Enter selects.

### 5. Roles that matter
Sign-in role changes what you can do; a "Switch role" control in the status bar reopens sign-in.
- Attending / resident / advanced practice provider: orders become active on signing (medicines first show "Awaiting pharmacy check" and are verified automatically after about 5 simulated minutes, with a toast); attendings can cosign notes and orders.
- Medical student: orders are saved as "Needs cosign" and are not active until a physician cosigns; notes are flagged "Cosign needed".
- Nurse: lands on a shift worklist for the unit (tasks due by hour: doses, vitals, assessments); can document doses and chart flowsheets; orders are entered as verbal orders that need a doctor's signature; cannot sign physician note types.
- Pharmacist: lands on a verification queue of medicine orders awaiting check across all patients, with the warnings shown; can verify or send back with a comment.
- Show the signed-in name on everything that person signs.

### 6. Discharge and coding tabs
- Discharge: a readiness checklist computed from the chart (pending results, overdue doses, unsigned orders, lines still in place, medicine decisions outstanding, summary written) plus manual ticks; discharge medicine reconciliation (every inpatient and home medicine gets Continue / Stop / Change / New prescription); follow-up appointments (add/remove); patient instructions (editable, pre-filled); "Write discharge summary" (opens a pre-filled note of type Discharge summary); "Preview patient handout" (a clean page-like dialog assembled from the above); "Discharge patient" (blocked with a clear list of what is missing; on success stamps the time, completes active orders, shows "Discharged" in the sidebar, and the Unit board shows the bed as being cleaned).
- Coding: suggested ICD-10-CM diagnosis codes for each problem from a built-in keyword table (ICD-10-CM is public domain; do NOT use CPT), principal diagnosis selector, add/remove codes with search over a built-in list of at least 300 common codes, a visit-level choice in plain words (no CPT numbers), and documentation queries the coder can send to the doctor's inbox (e.g. "anaemia: please specify type and cause").

### 7. Chat
A "Chat" top-level screen with an unread count: conversations with care-team members about a patient (seed four realistic threads from the existing inbox staff messages), start a new conversation (pick patient, pick a team member from that patient's team), send messages, and receive a plausible short reply after 20 to 60 simulated seconds. Opening a thread clears its unread count; each thread links to the patient's chart.

### 8. Data explorer (uses a module another agent is writing)
Another agent is writing `/home/user/practice-emr/fhir-map.js`, which defines a global `FHIRMAP` with `FHIRMAP.toBundle(patient)` returning a FHIR R4 Bundle (plain object) for one patient object. Add a top-level "Data" screen that, when `window.FHIRMAP` exists, lets the user pick a patient and a resource type, shows resource counts, and displays the JSON (pretty-printed, with a Copy button that falls back to selecting the text). Also show the request each view corresponds to in a FHIR API (for example `GET /Patient/p1`, `GET /Observation?patient=p1&category=vital-signs`) and one line saying the data files are available separately. Load the module with `<script src="fhir-map.js"></script>` and degrade gracefully if it is missing. The bundle should be built from the live in-page patient so new results and orders appear.

### 9. More patients and units
Twelve more patients are being written as `patients/p13.js` … `patients/p24.js` (same contract). Add the script tags for them (a missing file must not break the page). Add two units to `UNITS`: `['cvicu','Cardiac Surgery ICU','#b03a2e','CVICU',8]` and `['psych','Behavioural Health','#4a6fa5','BH',10]`, with three filler beds each in `FILL` (invented uncommon names), and make sure every screen copes with 24 patients (lists scroll, search finds them, handoff works, unit board shows them).

## Finish
Run your full test, fix everything it finds, and report: what you built per item, anything you could not finish, the names of any new files that must be published with the page, and the test's final output.
