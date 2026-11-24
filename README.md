# Open Census

An open, clickable, fully synthetic academic hospital record. Use it to explore, analyze, and build and test tools (apps, plugins, AI agents, research analyses) before trying them on a real system.

**Every patient is invented.** The hospital, Northfield Medical Center, is fictional. Nothing here is real patient data, and nothing here is medical advice.

Live preview: https://annasrahman.com/open-census/

## What is in it

- **A clickable record** (`app.html`): a single-page app in plain JavaScript with chart tabs for summary, notes, results, orders, medications, flowsheets, and more.
- **24 hand-written deep patients** (`data.js`, `patients/`): complete, internally consistent charts, from simple to complex.
- **Reference material per patient** (`extras/`): answer keys, questions and answers, tasks, later outcomes, portal messages, and conversation transcripts.
- **A hospital generator** (`engine/`, `hospital/`, `modules/`): a deterministic, on-demand hospital of about 1,200 beds built from reusable condition, comorbidity, and clinic modules. It is not yet wired into the app.
- **Exports** (`export.js`, `fhir-map.js`): FHIR R4 bundles and NDJSON, CSV tables, and MEDS events.
- **An operations simulator** (`ops/`): 180 days of bed flow, emergency visits, and surgery. It currently models a smaller hospital with its own patient IDs, so it does not join the charts yet.

## Run it

The app is static. `app.html` has no `<html>` wrapper, so serve the folder and load it through a small wrapper page, or use the live preview.

The Node scripts need no dependencies (Playwright only for `_test.js`):

```bash
node tools/test-engine.js   # generator tests
node export.js              # build export/ (FHIR, CSV, MEDS)
node ops/generate.js        # build the operations dataset
```

## Status and known limits

This is a preview. Clinical content aims to be sensible and internally consistent, not perfect. ICD-10-CM and LOINC codes have not all been checked against the official lists. See `HANDOFF.md` for open work.

## License

- Code: [Apache License 2.0](LICENSE).
- Data and written content (patients, extras, generated records, docs): [Creative Commons Attribution 4.0](DATA-LICENSE.md).

If you use Open Census, please credit "Open Census by Annas Rahman (Northfield Medical Center synthetic record)" and link to this repository.

Copyright 2026 Annas Rahman.
