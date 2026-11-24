# Open Census: handoff notes

Read this first if you are a new Claude session (or a person) picking up this project. It was built in one long cloud session on 17–18 Nov 2026 and moved to its own repository, **DevRush/open-census**, on 23 Nov 2026 (local folder `~/Projects/OpenCensus`). The original copy, including the `research/` and `reports/` folders that were left out of the public repository, stays on the `open-census-source` branch of the private `annasrahman.com` repository.

## What it is

**Open Census** is an open, clickable, fully synthetic academic hospital record (an EMR), for people to explore, analyse, and build and test tools against (apps, plugins, AI agents, research analyses) before trying them on a real system. Every patient is invented. The fictional hospital is **Northfield Medical Center**. It is a developer and research playground, **not** a teaching or grading product: do not add scoring, teacher workspaces or learner tracking.

## Owner decisions (keep to these)

- Product name: **Open Census** (temporary but in use). Hospital: **Northfield Medical Center**. Rejected: Larkspur, OpenEMR, Chicago EMR, EMR Playground.
- Look: the **Spectrum** direction (`mockups/05-spectrum.png`): chart tabs across the top, each with its own colour carried into its panels; patient summary sidebar on the left; dark mode optional.
- Scale: about **1,200 inpatient beds**, every specialty and subspecialty, attendings/fellows/residents/students, all ages from neonates to the frail elderly, simple to complex patients, units by floor, consult lists, outpatient clinics by specialty and subspecialty, some people seen both as inpatients and in clinic.
- Nursing and ancillary staff (pharmacy, respiratory, PT/OT/speech, dietitian, social work, case management, wound care) matter as much as doctors.
- Data must be believable and internally consistent (values, orders, medicines, notes, dates agree within and across records) because others will analyse it. Clinically sensible, not perfect.
- Licence: open with credit. Plan: **Apache-2.0 for code, CC BY 4.0 for data** (not yet added as files).
- Be economical with tokens: prefer the generator and reusable modules over hand-writing charts; use smaller models for structured work.
- Notes get light formatting (bold section labels, tidy numbered plans).
- Sign-in is two clickable lists (role, department), no name typing.

## Where things are live

- App: **annasrahman.com/open-census/** (a copy of `app.html` plus its scripts, in the `annasrahman.com` repo on `main`, folder `open-census/`).
- Linked from **SimpleEMR**'s landing page (badge "Open Census · Preview", repo DevRush/SimpleEMR). The separate card on annasrahman.com was removed at the owner's request.
- A private preview also exists as a claude.ai artifact (the owner has the link).

## Look rule (owner, 23 Nov 2026)

No single-side accents: never mark a container, row, or chip with only a left or right colored edge. To highlight something, color all four borders. A top-edge color on tabs and cards is acceptable.

## Open items, in priority order

1. ~~Create the dedicated GitHub repository~~ Done 23 Nov 2026: public repo, `LICENSE` (Apache-2.0), `DATA-LICENSE.md` (CC BY 4.0), and README added.
2. **Wire the hospital generator into the app** (`docs/ENGINE_API.md`): patient lists for every unit and floor, consult lists, unit board, and new **outpatient clinic** screens (clinic list by specialty/subspecialty, day schedules, outpatient charts), with the 24 hand-written patients kept as deep cases and also shown in clinics.
3. **Write more condition modules** (`docs/NEXT_MODULES.md`, `docs/MODULE_AUTHORING.md`): only 11 specific conditions exist, so diagnoses repeat; 60 of 72 clinics use a generic pattern. Fan out with smaller models; validate with `node tools/validate-module.js`.
4. **Rebuild the operations dataset on the generator's 1,200-bed hospital** (`ops/` was built for ~540 beds with its own patient ids, so it does not join the charts yet).
5. **Consistency fixes** collected from the extras writers (small in-chart contradictions in p1–p24), plus: add a disposition value for "medical respite" (do it with the operations rebuild in item 4); ICD-10-CM and LOINC codes were written from memory and need spot-checking; five SNOMED CT route codes remain in `fhir-map.js`. Done 23 Nov 2026: p3's answer key now says only the weight is overstated; the "no known allergy" SNOMED code was removed (text only now); p3 no longer mentions a left bundle branch block.
6. Mother–baby linking in the generator; operating-room and emergency boards driven by data instead of static lists; top bar wrapping at 1440 px.

## Folder map

| Path | What |
|---|---|
| `app.html` | The whole clickable app (vanilla JS, single page). It was published as an artifact, so it has no `<html>/<head>` wrapper; see `annasrahman.com/open-census/index.html` for the wrapped version. Loads the scripts below. |
| `data.js` | Helpers (`T`, `gen`, `G`, `rng`, simulated `NOW` = Tue 17 Nov 2026 14:30) and hand-written patients p1–p3 |
| `patients/p4.js`…`p24.js` | Hand-written deep patients (each pushes a builder onto `EXTRA`) |
| `clinical-data.js` | ~630 orderables, 24 order sets, drug-interaction pairs, reference ranges, ICD-10-CM list |
| `sim-images.js` | Generated ECG and chest X-ray drawings (labelled as simulated) |
| `fhir-map.js` | Patient → FHIR R4 Bundle mapper (Node and browser) |
| `SCHEMA.md`, `validate.js` | Patient object contract and validator |
| `extras/`, `EXTRAS_SCHEMA.md`, `validate-extras.js` | Per-patient reference answers, Q&A, tasks, post-"now" outcomes, portal messages, conversation transcripts |
| `export.js`, `verify-export.js` | Build `export/` (FHIR NDJSON + bundles, CSV tables, MEDS events, held-out answer key). `export/` is not committed: run `node export.js` |
| `engine/`, `hospital/`, `modules/`, `tools/` | The on-demand 1,200-bed hospital generator. Tests: `node tools/test-engine.js`. Bundle: `engine/hosp.bundle.js` |
| `ops/` | 180-day operations simulator. Data not committed: run `node ops/generate.js` then `node ops/checks.js` |
| `docs/` | Architecture, module authoring guide, engine API, outpatient schema, next 100 modules, original work orders |
| `research/`, `reports/` | Not in this repository. Landscape research, use cases, competitor feature review, and name vetting are kept on the private `open-census-source` branch of `annasrahman.com`. |
| `mockups/` | Eight visual directions (Spectrum chosen) |
| `UI_BRIEF.md`, `_test.js` | Interface work order and the Playwright click-through test (it reads `app.html` and writes `_preview.html`) |

## How to run

Serve the folder with any static server and open `app.html` inside a wrapper, or simply use the wrapped copy in the website repo (`open-census/index.html`). Node scripts need no dependencies except Playwright for `_test.js`.

## Lessons for cost

Hand-written deep charts cost roughly 130k tokens each, and their "extras" about as much again; that is why the 1,200-bed hospital is generated from reusable condition, comorbidity and clinic modules instead. Running ~20 agents at once multiplied cost. Prefer the generator, small batches, and smaller models for module authoring.
