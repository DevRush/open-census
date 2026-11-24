# Per-patient extras (benchmark and enrichment layer)

One file per patient: `/home/user/practice-emr/extras/<id>.json` (valid JSON, UTF-8). It adds what app builders and evaluators asked for and what the chart itself cannot contain. Read the patient's chart first (`patients/<id>.js`, or for p1–p3 the matching object inside `seed()` in `data.js`; helpers and `NOW` = 17 Nov 2026 14:30 are defined in `data.js`; the chart contract is `SCHEMA.md`). Everything you write must be consistent with that chart: same numbers, doses, names, times. Do not edit any chart file. British spelling, US lab units, plain strings, ISO 8601 local timestamps like "2026-11-17T14:30". No licensed instrument names (Braden, Morse, NANDA, CPT, APACHE, CAM-ICU, RASS, PHQ) and no vendor names.

```json
{
  "id": "p6",
  "reference": {
    "one_line": "≤ 30 words: who, why here, where things stand now",
    "handoff": {"severity": "Stable | Watch closely | Unstable", "summary": "3–5 sentences", "to_do": ["…"], "if_then": ["If …, then …"]},
    "brief_hospital_course": "150–250 words, as it would read in a discharge summary written at 'now' (truthful to the chart, including the planted problems only where a careful clinician would have noticed and stated them)",
    "problem_list": [{"problem": "…", "status": "active|improving|resolved", "icd10cm": "code or null if not confident", "evidence": ["short pointer such as 'labs: Creatinine 16 Nov 04:30'"]}],
    "reconciled_medications": [{"medicine": "name and dose", "source": "home|inpatient|both", "recommended_action": "continue|hold|stop|change", "reason": "…"}],
    "pending_items": ["results or decisions outstanding at 'now'"]
  },
  "qa": [ {"q": "question a clinician might ask of this chart", "a": "short exact answer", "type": "lookup|trend|temporal|reasoning|absence", "evidence": ["where in the chart"]} ],
  "tasks": [ {"key_index": 0, "kind": "err|doc|time|dis", "prompt": "a neutral instruction that does not give the answer away, e.g. 'Review the active medication orders for safety problems.'", "expected_findings": ["what a correct answer must state"], "acceptable_actions": ["e.g. discontinue order X; notify Y"], "must_not": ["actions that would be wrong, e.g. flagging the distractor as an error"], "evidence": ["chart locations that prove it"]} ],
  "epilogue": {
    "note": "What happens AFTER 'now' in this simulated world. Never shown in the chart; for outcome-prediction ground truth.",
    "course": "100–180 words",
    "events": [{"t": "2026-11-18T09:10", "event": "…"}],
    "discharge": {"t": "ISO time or null if died in hospital", "disposition": "Home | Home with services | Rehabilitation | Skilled nursing facility | Hospice | Transfer | Died", "length_of_stay_days": 0},
    "outcomes_30_day": {"readmitted": false, "readmission_reason": null, "emergency_visits": 0, "died": false, "notable": "one line"}
  },
  "portal_messages": [ {"t": "ISO", "from": "patient | family member (relationship) | clinician role", "channel": "patient portal", "subject": "…", "body": "40–120 words in a realistic lay voice (or clinician reply)", "urgency_truth": "routine | same day | urgent", "ideal_reply_points": ["…"]} ],
  "conversation": {
    "setting": "e.g. bedside ward round, 17 Nov morning",
    "participants": ["Dr. …", "patient", "…"],
    "turns": [{"speaker": "…", "text": "…"}],
    "note_it_should_produce": "which existing note this conversation corresponds to, or 'new' with a 80–150 word ideal note"
  }
}
```

Requirements: `qa` has 12–15 items covering all five types (at least two "absence" questions whose correct answer is that the chart does not say). `tasks` has exactly one entry per item in the patient's `key` array, `key_index` matching its position. `portal_messages` has 4–6 messages (at least one from before this admission that fits the back-story, at least one in the epilogue period, at least one clinician reply; for patients who could not write, use a family member). `conversation.turns` has 25–45 turns of natural spoken language (interruptions, lay words, the clinician checking understanding) that is consistent with a note in the chart. The epilogue must follow plausibly from the chart, including consequences of planted errors that were not caught where that is realistic, and across the set should include a realistic mix of good and bad outcomes. Target 14–22 KB per file.

Check each file with: `node /home/user/practice-emr/validate-extras.js /home/user/practice-emr/extras/<id>.json` until it prints OK.
