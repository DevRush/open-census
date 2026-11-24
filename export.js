#!/usr/bin/env node
/* export.js — builds the downloadable data layer for the synthetic practice hospital dataset.
 *
 *   node export.js            writes ./export/ (FHIR NDJSON + bundles, CSV tables, MEDS events,
 *                             answer key, native JSON, data dictionary, README, manifest, zip)
 *   node export.js --no-zip   same, without the zip archive
 *
 * Re-runnable: loads data.js and whatever patients/p*.js exist right now. A patient file that fails
 * to load or to map is skipped with a warning; the rest still export. Output is deterministic
 * for a given set of patient files (no wall-clock times except `generated_at` in manifest.json).
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), zlib = require('zlib');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'export');
const ZIP_NAME = 'practice-emr-data.zip';
const FHIRMAP = require(path.join(ROOT, 'fhir-map.js'));
const U = FHIRMAP.util, ID = FHIRMAP.ids, LK = FHIRMAP.lookup;
const TZ = process.env.EXPORT_TZ_OFFSET || FHIRMAP.config.tz;
const iso = U.mkIso(TZ);
const warnings = [];
function warn(m) { warnings.push(m); console.warn('WARNING: ' + m); }
const arr = x => Array.isArray(x) ? x : [];
const str = x => x == null ? '' : String(x);

/* ------------------------------------------------------------------ load patients */
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), { filename: 'data.js' });
/* global seed, EXTRA, NOW */
const loaded = [];
function accept(p, source) {
  if (!p || typeof p !== 'object' || !p.id || !p.name) { warn(source + ': did not return a patient object with id and name; skipped'); return; }
  if (!(p.admit instanceof Date) || isNaN(p.admit)) { warn(source + ': patient ' + p.id + ' has no valid admit date; skipped'); return; }
  if (loaded.some(x => x.p.id === p.id)) { warn(source + ': duplicate patient id ' + p.id + '; skipped'); return; }
  loaded.push({ p, source });
}
try { seed().forEach((p, i) => accept(p, 'data.js seed()[' + i + ']')); } catch (e) { warn('data.js seed() failed: ' + e.message); }
const pdir = path.join(ROOT, 'patients');
const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const pfiles = fs.existsSync(pdir) ? fs.readdirSync(pdir).filter(f => /^p.*\.js$/.test(f)).sort(natural) : [];
for (const f of pfiles) {
  const before = EXTRA.length;
  try {
    vm.runInThisContext(fs.readFileSync(path.join(pdir, f), 'utf8'), { filename: 'patients/' + f });
  } catch (e) { EXTRA.length = before; warn('patients/' + f + ' failed to load (' + e.message.split('\n')[0] + '); skipped'); continue; }
  if (EXTRA.length === before) { warn('patients/' + f + ' did not call EXTRA.push; skipped'); continue; }
  EXTRA.slice(before).forEach(fn => {
    try { accept(fn(), 'patients/' + f); } catch (e) { warn('patients/' + f + ' threw while building its patient (' + e.message.split('\n')[0] + '); skipped'); }
  });
}
loaded.sort((a, b) => natural(String(a.p.id), String(b.p.id)));

/* ------------------------------------------------------------------ table definitions
 * One place for file name, description and columns, so the CSV headers and the data dictionary
 * can never drift apart. */
const TABLES = {
  patients: ['One row per patient: who they are and where they are now.', [
    ['patient_id', 'Dataset patient id (p1, p2, …). Joins every table. Same as the FHIR Patient id.'],
    ['mrn', 'Invented medical record number (LX-000000 style).'],
    ['name', 'Invented name as charted, "Surname, Given".'], ['family_name', 'Surname.'], ['given_name', 'Given name(s).'],
    ['sex', 'M or F as charted.'], ['age_years', 'Age in whole years (0 for infants; see age_text).'], ['age_text', 'Free-text age for young children, e.g. "6 days". Empty otherwise.'],
    ['birth_date', 'Date of birth, YYYY-MM-DD.'], ['unit', 'Current unit or ward.'], ['unit_key', 'Short unit type key used by the chart app (may be empty for the first three patients).'],
    ['bed', 'Bed label.'], ['service', 'Admitting service.'], ['attending', 'Attending doctor.'], ['admit_time', 'Start of this admission.'],
    ['code_status', 'Resuscitation status as charted.'], ['weight_text', 'Weight exactly as charted.'], ['weight_kg', 'Leading number from weight_text when it is in kg.'],
    ['height_text', 'Height exactly as charted.'], ['height_cm', 'Leading number from height_text when it is in cm.'], ['isolation', 'Isolation and other precautions.'], ['main_problem', 'Short main problem for this admission.']]],
  encounters: ['Every encounter: the current admission (is_current = 1) plus earlier contacts.', [
    ['encounter_id', 'Same as the FHIR Encounter id.'], ['patient_id', 'Patient.'], ['is_current', '1 for the current admission, 0 for earlier contacts.'],
    ['kind', 'Admission, Emergency visit, Clinic visit, Procedure or Telephone.'], ['fhir_class', 'FHIR encounter class code (IMP, EMER, AMB, VR).'], ['status', 'in-progress or finished.'],
    ['start_time', 'Start. Earlier contacts are recorded to the day only (YYYY-MM-DD).'], ['department', 'Unit (current) or department (earlier contacts).'], ['title', 'Main problem (current) or visit title (earlier contacts).'], ['summary', 'One to three sentence summary (earlier contacts only).']]],
  prior_encounters: ['Earlier contacts only (the back-story before this admission), newest first.', [
    ['patient_id', 'Patient.'], ['encounter_id', 'Same as the FHIR Encounter id.'], ['seq', 'Order in the chart, 0 = most recent.'], ['date', 'Date of the contact, YYYY-MM-DD.'],
    ['kind', 'Clinic visit, Emergency visit, Admission, Procedure or Telephone.'], ['department', 'Department.'], ['title', 'Visit title.'], ['summary', 'One to three sentence summary.']]],
  problems: ['Problem list for the current admission.', [
    ['patient_id', 'Patient.'], ['seq', 'Order on the problem list, 0 first.'], ['problem', 'Problem as written.'],
    ['icd10cm_code', 'ICD-10-CM code, only where a small keyword table gave a confident match; otherwise empty.'], ['icd10cm_display', 'Official description of that code.']]],
  allergies: ['Allergies and intolerances. A patient with none has one row "No known allergies".', [
    ['patient_id', 'Patient.'], ['seq', 'Order as charted.'], ['substance', 'Substance.'], ['reaction', 'Reaction as charted.']]],
  vitals: ['Vital signs, long format: one row per patient, time and measure.', [
    ['patient_id', 'Patient.'], ['time', 'When it was charted.'],
    ['measure', 'temp, hr, rr, sbp, dbp, map, spo2, o2 (oxygen delivery, text) or pain. map is computed as (sbp + 2 × dbp) / 3, rounded, exactly as the chart app shows it.'],
    ['label', 'Label shown in the chart.'], ['value', 'Numeric value. Empty when the entry is text.'], ['value_text', 'Text value (oxygen delivery). Empty when numeric.'], ['unit', 'Unit as charted.'],
    ['low', 'Lower flag limit set for this patient (empty if none).'], ['high', 'Upper flag limit set for this patient (empty if none).'], ['flag', 'H above high, L below low, empty otherwise.'], ['loinc_code', 'LOINC code where one is assigned.']]],
  flowsheet: ['All other flowsheet groups (specialty monitoring, nursing assessment, intake and output), long format.', [
    ['patient_id', 'Patient.'], ['group', 'Flowsheet group name.'], ['time', 'Charted time. For shift columns: the time parsed from the column label (start of the shift when a range is given); empty if the label has no date.'],
    ['time_end', 'End of the shift when the column label gives a range.'], ['column_label', 'Original column label for shift-based groups, e.g. "16 Nov night (19–07)". Empty for timed groups.'],
    ['measure', 'Row label.'], ['value', 'Numeric value ("+1,110" style balances are converted to numbers).'], ['value_text', 'Text value when the entry is not a number.'], ['unit', 'Unit or scale caption as charted.'],
    ['low', 'Lower flag limit (empty if none; the chart uses −1 for "no lower limit", exported as empty).'], ['high', 'Upper flag limit (empty if none; 999 means "no upper limit", exported as empty).'], ['flag', 'H, L or empty.'],
    ['is_total', '1 for total and net-balance rows of intake and output, else 0. Do not add these to their parts.'], ['loinc_code', 'LOINC code where one is assigned.']]],
  labs: ['Laboratory results, long format: one row per patient, time and test.', [
    ['patient_id', 'Patient.'], ['lab_id', 'Same as the FHIR Observation id.'], ['panel', 'Panel name as charted.'], ['time', 'Collection time.'], ['test', 'Test name as charted.'], ['value', 'Result (numeric).'], ['unit', 'Unit as charted.'],
    ['low', 'Lower reference limit.'], ['high', 'Upper reference limit.'], ['flag', 'H above high, L below low, empty otherwise.'], ['loinc_code', 'LOINC code where the built-in table gives a confident match; otherwise empty.']]],
  reports: ['Microbiology, imaging and other diagnostic, and pathology reports with full text.', [
    ['patient_id', 'Patient.'], ['report_id', 'Same as the FHIR DiagnosticReport id.'], ['kind', 'micro, imaging or path.'], ['title', 'Report title.'], ['time', 'Time of the study or specimen.'], ['status', 'Final or Preliminary.'], ['author', 'Reporting department or person.'], ['text', 'Full report text (contains line breaks).']]],
  notes: ['Clinical notes with full text, newest first within each patient.', [
    ['patient_id', 'Patient.'], ['note_id', 'Same as the FHIR DocumentReference id.'], ['type', 'Note type, e.g. Progress note, Nursing note, Consult.'], ['title', 'Note title.'], ['author', 'Author.'], ['time', 'Time written.'], ['word_count', 'Number of words in the text.'], ['text', 'Full note text (contains line breaks).']]],
  medication_orders: ['Medicine orders on the medication record.', [
    ['patient_id', 'Patient.'], ['med_order_id', 'Same as the FHIR MedicationRequest id.'], ['medication', 'Medicine and dose as ordered.'], ['sig', 'Directions as charted ("Route · frequency").'], ['route', 'Route taken from the directions, when the first part is a route word.'], ['frequency', 'Rest of the directions.'],
    ['kind', 'scheduled, prn (as needed) or infusion (continuous).'], ['rate', 'Current rate for infusions.'], ['ordered_time', 'When ordered.'], ['note', 'Free-text note on the order (mostly infusions).'], ['source', 'medication_record for regular entries; orders_list for free-text one-off, held or completed medicine orders.'], ['status', 'Active, Completed or On hold.']]],
  medication_administrations: ['Every dose on the medication record: given, held, or due (scheduled, not yet given).', [
    ['patient_id', 'Patient.'], ['admin_id', 'Same as the FHIR MedicationAdministration id (given and held doses; due doses have no FHIR resource, they are listed in MedicationRequest timing).'], ['med_order_id', 'Order this dose belongs to.'], ['medication', 'Medicine and dose.'],
    ['time', 'Scheduled or charted time of the dose.'], ['status', 'given, held or due.'], ['given_by', 'Who charted it.'], ['note', 'Dose note, e.g. reason held.']]],
  orders: ['Non-medicine orders (nursing, diet, laboratory, imaging, consult).', [
    ['patient_id', 'Patient.'], ['order_id', 'Same as the FHIR ServiceRequest id.'], ['category', 'Nursing, Diet, Laboratory, Imaging or Consult.'], ['text', 'Order text.'], ['status', 'Active, Pending, Completed or On hold.'], ['time', 'When ordered.'], ['ordered_by', 'Who ordered it, when recorded.']]],
  lines: ['Lines, tubes, drains and devices in place.', [
    ['patient_id', 'Patient.'], ['seq', 'Order as charted.'], ['item', 'Device.'], ['site', 'Site.'], ['placed', 'When placed, free text as charted (e.g. "16 Nov 01:45").'], ['placed_time', 'placed parsed to a timestamp when it starts with a day, month and time; otherwise empty.'], ['status', 'Status note.']]],
  care_team: ['Care team for the current admission.', [
    ['patient_id', 'Patient.'], ['seq', 'Order as charted.'], ['role', 'Role.'], ['name', 'Name.']]],
  home_medications: ['Home medication list from the admission history.', [
    ['patient_id', 'Patient.'], ['seq', 'Order as charted.'], ['medication_text', 'Medicine, dose and frequency as one line of text.']]],
  history: ['Background history lists (extra table): medical, surgical, family, social, immunisations.', [
    ['patient_id', 'Patient.'], ['category', 'past_medical, past_surgical, family, social or immunisation.'], ['seq', 'Order as charted.'], ['text', 'Entry as written.']]],
  timeline_events: ['Key events of this admission (extra table), oldest first.', [
    ['patient_id', 'Patient.'], ['time', 'Event time.'], ['event', 'What happened.']]]
};
const MEDS_TABLES = {
  data: ['MEDS-style event stream: one row per event, sorted by subject_id then time (static events with no time come first).', [
    ['subject_id', 'Integer subject id (the number in the patient id; see subjects.csv).'], ['time', 'Event time, local wall-clock, no offset (YYYY-MM-DDTHH:MM:SS). Empty for static facts.'],
    ['code', 'Event code; see codes.csv.'], ['numeric_value', 'Numeric value, if any.'], ['text_value', 'Text value, if any (note and report text included).']]],
  codes: ['Every code used in data.csv.', [
    ['code', 'Event code.'], ['description', 'Plain-language description.'], ['parent_codes', 'Standard code this maps to (LOINC/…, ICD10CM/…), if any.'], ['n_events', 'Number of rows in data.csv with this code.']]],
  subjects: ['Lookup from MEDS subject_id to dataset patient id.', [
    ['subject_id', 'Integer subject id.'], ['patient_id', 'Dataset patient id.'], ['mrn', 'Invented medical record number.']]]
};
const KEY_TABLES = {
  answer_key: ['Hidden ground truth: one row per planted item.', [
    ['patient_id', 'Patient.'], ['item_id', 'patient id + "-key-" + number.'], ['seq', 'Order in the key.'], ['kind', 'err, doc, time or dis.'],
    ['kind_label', 'Planted error / Note contradicts record / Hidden truth / Distractor (looks wrong, is right).'], ['title', 'Short title.'], ['explanation', 'What is planted and why.'], ['where_to_look', 'Chart areas where the evidence sits.']]],
  order_alerts: ['Decision-support warnings the chart app shows if someone orders the item for this patient. They give away findings, so they are held out with the key.', [
    ['patient_id', 'Patient.'], ['alert_key', 'Catalogue key of the order that triggers the warning (pip, ct, kcl, hep, furo, apap, mag).'], ['warning', 'Warning text.']]]
};
const KIND_LABEL = { err: 'Planted error', doc: 'Note contradicts record', time: 'Hidden truth', dis: 'Distractor (looks wrong, is right)' };

const rows = {}; Object.keys(TABLES).forEach(k => rows[k] = []);
const meds = [], medsCodes = new Map(), subjects = [], keyRows = [], alertRows = [], keyJson = [], nativeJson = [];
const ndjson = {}; const seenRes = new Set(); const bundles = [];

/* ------------------------------------------------------------------ per-patient extraction */
const lim = (v, isLow, sentinels) => typeof v !== 'number' ? '' : (sentinels && (isLow ? v < 0 : v >= 999)) ? '' : v;
function parsePlaced(s, year) { // "16 Nov 01:45" at the start of the text only
  const m = /^(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}):(\d{2})\b/.exec(str(s));
  if (!m || !year) return '';
  return iso(new Date(year, ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(m[2]), +m[1], +m[3], +m[4]));
}
function dateOrTime(d) { return (d instanceof Date && !d.getHours() && !d.getMinutes()) ? U.isoDate(d) : iso(d); }

function extract(p, sid) {
  const R = {}; Object.keys(TABLES).forEach(k => R[k] = []);
  const M = [];
  const pid = String(p.id), year = p.admit.getFullYear();
  const naive = d => U.isoLocal(d) || '';
  const ev = (time, code, num, text, desc, parent) => {
    M.push([sid, time || '', code, num == null ? '' : num, text == null ? '' : text]);
    if (!medsCodes.has(code)) medsCodes.set(code, { description: desc || '', parent: parent || '', n: 0 });
  };
  const nm = U.parseName(p.name), wt = /^\s*(\d+(?:\.\d+)?)\s*kg\b/.exec(str(p.wt)), ht = /^\s*(\d+(?:\.\d+)?)\s*cm\b/.exec(str(p.ht));
  const birth = U.parseDob(p.dob) || '';
  const isEd = p.unitKey === 'ed' || /^emergency/i.test(str(p.unit));

  R.patients.push([pid, p.mrn, p.name, nm.family || '', arr(nm.given).join(' '), p.sex, p.age, p.ageText || '', birth, p.unit, p.unitKey || '', p.bed, p.service, p.attending, iso(p.admit), p.code, p.wt, wt ? +wt[1] : '', p.ht, ht ? +ht[1] : '', p.iso, p.dx]);
  if (birth) ev(birth + 'T00:00:00', 'MEDS_BIRTH', null, null, 'Date of birth');
  if (p.sex) ev('', 'GENDER//' + p.sex, null, null, 'Sex as charted');
  ev(naive(p.admit), 'HOSPITAL_ADMISSION//' + (p.unitKey || U.slug(p.unit)), null, [p.unit, p.service, p.dx].filter(Boolean).join(' | '), 'Start of the current admission, by unit type');
  if (wt) ev(naive(p.admit), 'VITAL//weight', +wt[1], null, 'Body weight (kg) from the chart banner, stamped at admission', 'LOINC/29463-7');
  if (ht) ev(naive(p.admit), 'VITAL//height', +ht[1], null, 'Body height (cm) from the chart banner, stamped at admission', 'LOINC/8302-2');
  if (p.code) ev(naive(p.admit), 'CODE_STATUS', null, p.code, 'Resuscitation status, stamped at admission');

  R.encounters.push([ID.encounter(pid), pid, 1, isEd ? 'Emergency visit' : 'Admission', isEd ? 'EMER' : 'IMP', 'in-progress', iso(p.admit), p.unit, p.dx, '']);
  const CLS = { 'Clinic visit': 'AMB', 'Emergency visit': 'EMER', 'Admission': 'IMP', 'Procedure': 'AMB', 'Telephone': 'VR' };
  arr(p.encounters).forEach((e, i) => {
    if (!e) return;
    const id = ID.priorEncounter(pid, i);
    R.encounters.push([id, pid, 0, e.kind, CLS[e.kind] || '', 'finished', dateOrTime(e.t), e.dept, e.title, e.summary]);
    R.prior_encounters.push([pid, id, i, U.isoDate(e.t), e.kind, e.dept, e.title, e.summary]);
    ev(naive(e.t), 'PRIOR_ENCOUNTER//' + str(e.kind), null, [e.dept, e.title, e.summary].filter(Boolean).join(' | '), 'Earlier contact with the hospital, by kind');
  });

  arr(p.problems).forEach((t, i) => {
    const icd = LK.icd10(t);
    R.problems.push([pid, i, t, icd ? icd.code : '', icd ? icd.display : '']);
    ev(naive(p.admit), 'PROBLEM', null, t, 'Problem list entry (free text), stamped at admission');
    if (icd) ev(naive(p.admit), 'DIAGNOSIS//ICD10CM//' + icd.code, null, t, icd.display, 'ICD10CM/' + icd.code);
  });
  arr(p.allergies).forEach((a, i) => {
    if (!Array.isArray(a)) return;
    R.allergies.push([pid, i, a[0], a[1] || '']);
    ev('', 'ALLERGY', null, a[0] + (a[1] ? ': ' + a[1] : ''), 'Allergy or intolerance (static)');
  });
  arr(p.team).forEach((t, i) => { if (Array.isArray(t)) R.care_team.push([pid, i, t[0], t[1]]); });
  arr(p.lines).forEach((l, i) => { if (Array.isArray(l)) R.lines.push([pid, i, l[0], l[1], l[2], parsePlaced(l[2], year), l[3]]); });
  arr(p.events).forEach(e => {
    if (!Array.isArray(e)) return;
    R.timeline_events.push([pid, iso(e[0]), e[1]]);
    ev(naive(e[0]), 'TIMELINE_EVENT', null, e[1], 'Key event of this admission (free text)');
  });
  const hx = p.hx || {};
  [['pmh', 'past_medical'], ['psh', 'past_surgical'], ['fam', 'family'], ['soc', 'social'], ['imm', 'immunisation']].forEach(k => arr(hx[k[0]]).forEach((t, i) => {
    R.history.push([pid, k[1], i, t]);
    ev('', 'HISTORY//' + k[1], null, t, 'Background history entry (static): ' + k[1].replace('_', ' '));
  }));
  arr(hx.home).forEach((t, i) => { R.home_medications.push([pid, i, t]); ev('', 'HOME_MEDICATION', null, t, 'Home medication list entry (static)'); });

  /* flowsheets */
  arr(p.flows).forEach(g => {
    if (!g || !Array.isArray(g.rows)) return;
    const isV = g.name === 'Vitals';
    const times = Array.isArray(g.times) ? g.times : null, cols = Array.isArray(g.cols) ? g.cols : null;
    const n = times ? times.length : cols ? cols.length : 0;
    const colT = cols ? cols.map(c => U.parseCol(c, year, iso)) : null;
    const colNaive = cols ? cols.map(c => U.parseCol(c, year, U.isoLocal)) : null;
    const tOf = ci => times ? iso(times[ci]) : (colT[ci] ? (colT[ci].period ? colT[ci].period.start : colT[ci].dateTime || colT[ci].date) : '');
    const tEnd = ci => (!times && colT[ci] && colT[ci].period) ? colT[ci].period.end : '';
    // MEDS time: charted time; for shift columns the end of the shift (when the totals are known)
    const tMeds = ci => times ? naive(times[ci]) : (colNaive[ci] ? (colNaive[ci].period ? colNaive[ci].period.end : colNaive[ci].dateTime || (colNaive[ci].date + 'T00:00:00')) : null);
    const bp = g.rows.find(r => r && r.type === 'bp');
    g.rows.forEach(r => {
      if (!r) return;
      const label = r.l || r.k || '', unit = r.u || g.unit || '';
      const put = (ci, measure, lab, v, u, lo, hi, loinc) => {
        if (v == null || v === '') return;
        const numericRow = !!u || typeof lo === 'number' || typeof hi === 'number';
        const nv = typeof v === 'number' ? v : (numericRow || /^[+−-]/.test(str(v)) ? U.num(v) : null);
        const f = nv != null ? U.flag(nv, lo, hi) : '';
        if (isV) {
          R.vitals.push([pid, tOf(ci), measure, lab, nv != null ? nv : '', nv != null ? '' : v, u, lim(lo, true, true), lim(hi, false, true), f, loinc || '']);
          ev(tMeds(ci), 'VITAL//' + measure, nv, nv != null ? null : v, lab + (u ? ' (' + u + ')' : ''), loinc ? 'LOINC/' + loinc : '');
        } else {
          R.flowsheet.push([pid, g.name, tOf(ci), tEnd(ci), cols ? cols[ci] : '', lab, nv != null ? nv : '', nv != null ? '' : v, u, lim(lo, true, true), lim(hi, false, true), f, r.sum ? 1 : 0, loinc || '']);
          const tm = tMeds(ci);
          if (tm) ev(tm, 'FLOWSHEET//' + g.name + '//' + lab, nv, nv != null ? null : v, g.name + ': ' + lab + (u ? ' (' + u + ')' : '') + (cols ? '; shift column, stamped at the end of the shift' : ''), loinc ? 'LOINC/' + loinc : '');
        }
      };
      if (r.type === 'bp') {
        for (let c = 0; c < n; c++) { put(c, 'sbp', 'Systolic blood pressure', arr(r.s)[c], 'mmHg', undefined, undefined, '8480-6'); put(c, 'dbp', 'Diastolic blood pressure', arr(r.d)[c], 'mmHg', undefined, undefined, '8462-4'); }
      } else if (r.type === 'map') {
        if (!bp) return;
        for (let c = 0; c < n; c++) { const s = U.num(arr(bp.s)[c]), d = U.num(arr(bp.d)[c]); if (s != null && d != null) put(c, 'map', label, Math.round((s + 2 * d) / 3), r.u || 'mmHg', r.lo, r.hi, '8478-0'); }
      } else {
        const lc = isV ? (LK.vitalLoinc[r.k] ? LK.vitalLoinc[r.k][0] : '') : ((LK.flowLoinc(label, unit) || {}).code || '');
        arr(r.v).forEach((v, ci) => { if (ci < n) put(ci, r.k || label, label, v, unit, r.lo, r.hi, lc); });
      }
    });
  });

  /* labs */
  arr(p.labs).forEach((L, li) => arr(L && L.rows).forEach((r, ri) => {
    if (!Array.isArray(r)) return;
    const lc = LK.labLoinc(L.panel, r[0], r[1] || '');
    arr(r[4]).forEach((v, ti) => {
      if (v == null || v === '') return;
      const t = arr(L.times)[ti];
      R.labs.push([pid, ID.lab(pid, li, ri, ti), L.panel, iso(t), r[0], v, r[1] || '', lim(r[2]), lim(r[3]), U.flag(v, r[2], r[3]), lc ? lc.code : '']);
      const coded = !!lc;
      ev(naive(t), 'LAB//' + (coded ? r[0] : L.panel + '//' + r[0]) + '//' + (r[1] || 'no unit'), typeof v === 'number' ? v : null, typeof v === 'number' ? null : v,
        r[0] + (r[1] ? ' (' + r[1] + ')' : '') + (coded ? '' : '; panel: ' + L.panel), lc ? 'LOINC/' + lc.code : '');
    });
  }));

  /* reports and notes */
  [['micro', 'micro'], ['imaging', 'img'], ['path', 'path']].forEach(k => arr(p[k[0]]).forEach((x, i) => {
    if (!x) return;
    R.reports.push([pid, ID.report(pid, k[1], i), k[0], x.title, iso(x.t), x.status, x.by, x.body]);
    ev(naive(x.t), 'REPORT//' + k[0], null, str(x.title) + ' [' + str(x.status) + ']\n\n' + str(x.body), 'Diagnostic report text: ' + k[0]);
  }));
  arr(p.notes).forEach((nt, i) => {
    if (!nt) return;
    const body = str(nt.body);
    R.notes.push([pid, ID.note(pid, i), nt.type, nt.title, nt.by, iso(nt.t), body.split(/\s+/).filter(Boolean).length, body]);
    ev(naive(nt.t), 'NOTE//' + str(nt.type), null, str(nt.title) + '\n\n' + body, 'Clinical note text: ' + str(nt.type));
  });

  /* medicines */
  const medList = arr(p.meds);
  medList.forEach((m, i) => {
    if (!m || !m.name) return;
    const mid = ID.med(pid, i), route = U.routeOf(m.sig);
    R.medication_orders.push([pid, mid, m.name, m.sig, route ? route.text : '', U.frequencyOf(m.sig), m.type === 'inf' ? 'infusion' : m.type === 'prn' ? 'prn' : 'scheduled', m.rate || '', iso(m.ordered), m.note || '', 'medication_record', 'Active']);
    ev(naive(m.ordered), 'MEDICATION_ORDER//' + m.name, null, [m.sig, m.rate ? 'Rate: ' + m.rate : ''].filter(Boolean).join(' · '), 'Medicine ordered (text = directions)');
    arr(m.a).forEach((a, j) => {
      if (!a) return;
      R.medication_administrations.push([pid, a.st === 'due' ? '' : ID.medAdmin(pid, i, j), mid, m.name, iso(a.t), a.st, a.by || '', a.note || '']);
      if (a.st !== 'due') ev(naive(a.t), 'MEDICATION//' + m.name + '//' + a.st, null, a.note || null, 'Dose ' + a.st + ' (doses that are only due are not events)');
    });
  });
  /* orders */
  arr(p.orders).forEach((raw, i) => {
    const o = U.normOrder(raw);
    if (!o.text || U.isMedCopy(o, medList)) return;
    const id = ID.order(pid, i);
    if (o.cat === 'Medication') {
      R.medication_orders.push([pid, id, o.text, '', '', '', 'one-off or held', '', iso(o.t), '', 'orders_list', o.st]);
      ev(naive(o.t), 'ORDER//Medication', null, o.text + ' [' + str(o.st) + ']', 'Free-text medicine order from the orders list (one-off, held or completed)');
    } else {
      R.orders.push([pid, id, o.cat, o.text, o.st, iso(o.t), o.by || '']);
      ev(naive(o.t), 'ORDER//' + str(o.cat), null, o.text + ' [' + str(o.st) + ']', 'Non-medicine order: ' + str(o.cat));
    }
  });
  return { R, M };
}

function dateToIso(v) { // deep copy with Dates as ISO strings
  if (v instanceof Date) return isNaN(v) ? null : iso(v);
  if (Array.isArray(v)) return v.map(dateToIso);
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(k => { if (typeof v[k] !== 'function') o[k] = dateToIso(v[k]); }); return o; }
  return v;
}

const usedSid = new Set();
const exported = [];
for (const { p, source } of loaded) {
  try {
    const m = /^p(\d+)$/.exec(String(p.id));
    let sid = m ? +m[1] : null;
    if (sid == null || usedSid.has(sid)) { sid = 100000 + exported.length; }
    const bundle = FHIRMAP.toBundle(p, { tz: TZ, now: NOW });
    const { R, M } = extract(p, sid);
    // only now commit, so a patient that fails half-way leaves nothing behind
    usedSid.add(sid);
    Object.keys(R).forEach(k => rows[k].push(...R[k]));
    meds.push(...M);
    subjects.push([sid, p.id, p.mrn]);
    bundles.push({ id: p.id, bundle });
    bundle.entry.forEach(e => {
      const r = e.resource, key = r.resourceType + '/' + r.id;
      if (seenRes.has(key)) return; // shared resources (Organization, Practitioner, Location) appear once
      seenRes.add(key); (ndjson[r.resourceType] = ndjson[r.resourceType] || []).push(r);
    });
    const key = arr(p.key).filter(Array.isArray), alerts = p.alerts && typeof p.alerts === 'object' ? p.alerts : {};
    key.forEach((k, i) => keyRows.push([p.id, p.id + '-key-' + (i + 1), i + 1, k[0], KIND_LABEL[k[0]] || '', k[1], k[2], k[3]]));
    Object.keys(alerts).forEach(a => alertRows.push([p.id, a, alerts[a]]));
    keyJson.push({ patient_id: p.id, mrn: p.mrn, name: p.name, items: key.map((k, i) => ({ item_id: p.id + '-key-' + (i + 1), kind: k[0], kind_label: KIND_LABEL[k[0]] || '', title: k[1], explanation: k[2], where_to_look: k[3] })), order_alerts: alerts });
    const native = dateToIso(p); delete native.key; delete native.alerts; delete native.pending;
    nativeJson.push(native);
    exported.push(p);
  } catch (e) { warn(source + ': patient ' + p.id + ' could not be exported (' + e.message.split('\n')[0] + '); skipped'); }
}
if (!exported.length) { console.error('No patients could be exported.'); process.exit(1); }

/* ------------------------------------------------------------------ writing */
const written = []; // {path, rows, kind, bytes, sha256}
function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\r\n]|^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(header, data) { return [header].concat(data).map(r => r.map(csvCell).join(',')).join('\n') + '\n'; }
function write(rel, content, rowsN, kind) {
  const full = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const buf = Buffer.from(content, 'utf8');
  fs.writeFileSync(full, buf);
  written.push({ path: rel.split(path.sep).join('/'), kind, rows: rowsN, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') });
}
// clear previous output (only what this script owns)
['fhir', 'tables', 'meds', 'answer_key', 'json'].forEach(d => fs.rmSync(path.join(OUT, d), { recursive: true, force: true }));
['DATA_DICTIONARY.md', 'README.md', 'manifest.json', ZIP_NAME].forEach(f => fs.rmSync(path.join(OUT, f), { force: true }));
fs.mkdirSync(OUT, { recursive: true });

const resTypes = Object.keys(ndjson).sort();
resTypes.forEach(t => write('fhir/' + t + '.ndjson', ndjson[t].map(r => JSON.stringify(r)).join('\n') + '\n', ndjson[t].length, 'ndjson'));
bundles.forEach(b => write('fhir/bundles/' + b.id + '.json', JSON.stringify(b.bundle, null, 1) + '\n', b.bundle.entry.length, 'fhir-bundle'));

Object.keys(TABLES).forEach(k => write('tables/' + k + '.csv', toCsv(TABLES[k][1].map(c => c[0]), rows[k]), rows[k].length, 'csv'));

// MEDS: sort by subject, then time with static (empty) first; stable for ties
const medsSorted = meds.map((r, i) => [r, i]).sort((a, b) => a[0][0] - b[0][0] || (a[0][1] < b[0][1] ? -1 : a[0][1] > b[0][1] ? 1 : a[1] - b[1])).map(x => x[0]);
medsSorted.forEach(r => { medsCodes.get(r[2]).n++; });
write('meds/data.csv', toCsv(MEDS_TABLES.data[1].map(c => c[0]), medsSorted), medsSorted.length, 'csv');
const codeRows = [...medsCodes.keys()].sort().map(c => [c, medsCodes.get(c).description, medsCodes.get(c).parent, medsCodes.get(c).n]);
write('meds/codes.csv', toCsv(MEDS_TABLES.codes[1].map(c => c[0]), codeRows), codeRows.length, 'csv');
subjects.sort((a, b) => a[0] - b[0]);
write('meds/subjects.csv', toCsv(MEDS_TABLES.subjects[1].map(c => c[0]), subjects), subjects.length, 'csv');

write('answer_key/answer_key.csv', toCsv(KEY_TABLES.answer_key[1].map(c => c[0]), keyRows), keyRows.length, 'csv');
write('answer_key/order_alerts.csv', toCsv(KEY_TABLES.order_alerts[1].map(c => c[0]), alertRows), alertRows.length, 'csv');
write('answer_key/answer_key.json', JSON.stringify({ note: 'Hidden ground truth for the synthetic practice hospital dataset. Hold this folder out when benchmarking.', kinds: KIND_LABEL, patients: keyJson }, null, 1) + '\n', keyRows.length, 'json');
write('json/patients.json', JSON.stringify({ simulated_now: iso(NOW), timezone_offset: TZ, note: 'Native chart objects. The answer key (key) and ordering alerts (alerts) are removed; see answer_key/.', patients: nativeJson }, null, 1) + '\n', nativeJson.length, 'json');

/* ------------------------------------------------------------------ documentation */
const N = exported.length;
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const rowsOf = rel => { const w = written.find(x => x.path === rel); return w ? w.rows : 0; };
const resCounts = resTypes.map(t => [t, ndjson[t].length]);
const totalRes = resCounts.reduce((s, x) => s + x[1], 0);
const codedLabs = rows.labs.filter(r => r[10]).length, codedProblems = rows.problems.filter(r => r[3]).length;
const mdTable = (head, body) => ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|'].concat(body.map(r => '| ' + r.map(c => String(c).replace(/\|/g, '\\|')).join(' | ') + ' |')).join('\n');
const section = (dir, name, def, ext) => '### `' + dir + '/' + name + (ext || '.csv') + '` — ' + fmt(rowsOf(dir + '/' + name + (ext || '.csv'))) + ' rows\n\n' + def[0] + '\n\n' + mdTable(['Column', 'Meaning'], def[1].map(c => ['`' + c[0] + '`', c[1]])) + '\n';

const FHIR_FROM = {
  Organization: 'The fictional hospital.', Patient: 'Demographics and record number.', Encounter: 'The current admission and each earlier contact.',
  Location: 'Unit and bed.', Practitioner: 'Attending and care team members.', CareTeam: 'Care team with roles.',
  AllergyIntolerance: 'Allergy list ("No known allergies" is coded as such).', Condition: 'Problem list entries, plus the main problem as the encounter diagnosis. ICD-10-CM where confident.',
  Observation: 'Every vital sign, flowsheet value and lab result; weight and height from the banner.', MedicationRequest: 'Each medicine order, plus free-text one-off or held medicine orders from the orders list.',
  MedicationAdministration: 'Each given or held dose.', MedicationStatement: 'Home medication list.', ServiceRequest: 'Non-medicine orders.',
  DiagnosticReport: 'Microbiology, imaging and pathology reports with full text.', DocumentReference: 'Every clinical note with full text.',
  Procedure: 'Operative and procedure notes, past surgical history, and earlier encounters of kind Procedure.'
};
const DD = `# Data dictionary

Synthetic practice hospital dataset (${CONFIG_NAME()}). ${N} invented patients, snapshot at the simulated time ${iso(NOW)}.
Everything here is machine-written fiction. It has not been reviewed by clinicians and must not be used for clinical care.

This file is written by \`export.js\`; the row counts below are from the run that produced the files next to it.

## Conventions

- **Text encoding** UTF-8, no byte-order mark. **CSV** follows RFC 4180: comma separated, fields with commas, quotes or line breaks are wrapped in double quotes, and a quote inside a field is doubled. Note and report text contains real line breaks inside quoted fields, so use a proper CSV reader, not line splitting.
- **Timestamps** are ISO 8601 local hospital time with a fixed offset, for example \`2026-11-17T14:30:00${TZ}\`. The hospital is fictional; the offset is a convention so the files load the same way everywhere. Values recorded only to the day are \`YYYY-MM-DD\`. The MEDS files use the same wall-clock time without an offset.
- **Empty cell** means not recorded or not applicable.
- **Ids** \`patient_id\` (p1, p2, …) joins every table. Ids ending in a number (\`p4-note-2\`, \`p4-lab-0-3-1\`) are positions in the source chart: stable between runs unless the chart itself is edited.
- **Spelling and units** British spelling (haemoglobin, oedema); US conventional lab units (mg/dL, g/dL; mmol/L for electrolytes).
- **Codes** LOINC, ICD-10-CM and SNOMED CT codes come from a small built-in table and are only attached where the match is confident (${fmt(codedLabs)} of ${fmt(rows.labs.length)} lab rows, ${fmt(codedProblems)} of ${fmt(rows.problems.length)} problems). Everything else is text only. Medicines are text only (no RxNorm).
- **Held out** The answer key and the ordering alerts are only in \`answer_key/\`. Nothing from them is in \`fhir/\`, \`tables/\`, \`meds/\` or \`json/\`.

## Files at a glance

${mdTable(['File', 'Rows', 'What it is'], [].concat(
    Object.keys(TABLES).map(k => ['`tables/' + k + '.csv`', fmt(rows[k].length), TABLES[k][0]]),
    Object.keys(MEDS_TABLES).map(k => ['`meds/' + k + '.csv`', fmt(rowsOf('meds/' + k + '.csv')), MEDS_TABLES[k][0]]),
    resTypes.map(t => ['`fhir/' + t + '.ndjson`', fmt(ndjson[t].length), 'FHIR R4 ' + t + ' resources, one JSON object per line.']),
    [['`fhir/bundles/<patient_id>.json`', N + ' files', 'One FHIR R4 Bundle (type collection) per patient with all of that patient\'s resources.'],
    ['`json/patients.json`', fmt(N), 'The native chart objects, one per patient, dates as ISO strings. Answer key and alerts removed.'],
    ['`answer_key/answer_key.csv`', fmt(keyRows.length), KEY_TABLES.answer_key[0]],
    ['`answer_key/answer_key.json`', fmt(keyRows.length), 'The same key grouped by patient, plus the ordering alerts.'],
    ['`answer_key/order_alerts.csv`', fmt(alertRows.length), KEY_TABLES.order_alerts[0]],
    ['`manifest.json`', written.length + ' files', 'Every file with its row count, size in bytes and SHA-256 checksum.']]))}

## Tables (\`tables/\`)

${Object.keys(TABLES).map(k => section('tables', k, TABLES[k])).join('\n')}
## MEDS event stream (\`meds/\`)

The same chart as one long list of timestamped events, in the column layout of the Medical Event Data Standard (MEDS): \`subject_id, time, code, numeric_value, text_value\`. MEDS itself is stored as Parquet; these are CSV so they open anywhere (see "How to load" for a one-line conversion).

${Object.keys(MEDS_TABLES).map(k => section('meds', k, MEDS_TABLES[k])).join('\n')}
Code families in \`data.csv\`:

${mdTable(['Code pattern', 'Meaning', 'Value'], [
    ['`MEDS_BIRTH`', 'Date of birth', 'none'],
    ['`GENDER//M`, `GENDER//F`', 'Sex (static, no time)', 'none'],
    ['`HOSPITAL_ADMISSION//<unit key>`', 'Start of the current admission', 'text: unit, service, main problem'],
    ['`VITAL//<measure>`', 'Vital sign (temp, hr, rr, sbp, dbp, map, spo2, pain, o2, weight, height)', 'numeric; text for o2'],
    ['`FLOWSHEET//<group>//<row>`', 'Other flowsheet entry. Shift columns are stamped at the end of the shift; columns with no readable date are left out', 'numeric or text'],
    ['`LAB//<test>//<unit>`', 'Lab result that has a LOINC code', 'numeric'],
    ['`LAB//<panel>//<test>//<unit>`', 'Lab result without a LOINC code (panel kept so that, say, urine and blood white cells stay apart)', 'numeric'],
    ['`MEDICATION_ORDER//<medicine>`', 'Medicine ordered', 'text: directions'],
    ['`MEDICATION//<medicine>//given` or `//held`', 'Dose given or held. Doses that are only due are not events', 'text: dose note'],
    ['`ORDER//<category>`', 'Other order', 'text: order and status'],
    ['`NOTE//<type>`', 'Clinical note', 'text: title and full note'],
    ['`REPORT//micro`, `//imaging`, `//path`', 'Diagnostic report', 'text: title, status and full report'],
    ['`PROBLEM`, `DIAGNOSIS//ICD10CM//<code>`', 'Problem list entry at admission time; a second coded event where a code was assigned', 'text'],
    ['`PRIOR_ENCOUNTER//<kind>`', 'Earlier contact', 'text'],
    ['`TIMELINE_EVENT`', 'Key event of the admission', 'text'],
    ['`CODE_STATUS`', 'Resuscitation status at admission', 'text'],
    ['`ALLERGY`, `HISTORY//<category>`, `HOME_MEDICATION`', 'Static background facts (no time)', 'text']])}

A caution for model builders: the chart is a snapshot at ${iso(NOW)}. Problem list entries are stamped at admission although some were written later, and notes describe events before their own timestamp. Filter by \`time\` if you need a strict "known at this moment" view.

## Answer key (\`answer_key/\`) — hold this out

Each patient chart has deliberate items planted in it for teaching and benchmarking.

${mdTable(['kind', 'Meaning'], [
    ['`err`', 'Planted error: a real, findable mistake in the chart (wrong dose, duplicate, missed or overdue item, contraindicated medicine still active).'],
    ['`doc`', 'A note that contradicts the structured record. The contradiction is really in the note text.'],
    ['`time`', 'A hidden truth, such as the true onset time of a complication or its true cause.'],
    ['`dis`', 'A distractor: looks like an error but is correct, with the justification somewhere in the chart.']])}

${Object.keys(KEY_TABLES).map(k => section('answer_key', k, KEY_TABLES[k])).join('\n')}
\`answer_key.json\` holds the same items as \`{ patients: [ { patient_id, mrn, name, items: [...], order_alerts: {...} } ] }\`.

## FHIR (\`fhir/\`)

FHIR R4 (4.0.1). One NDJSON file per resource type across all patients (the layout of a FHIR bulk data export), and one collection Bundle per patient in \`fhir/bundles/\`. References are relative (\`Patient/p4\`) and always resolve inside the patient's bundle. Shared resources (the organisation, wards, beds, staff) appear in every bundle that uses them and once in the NDJSON files.

${mdTable(['Resource', 'Count', 'Built from'], resCounts.map(r => [r[0], fmt(r[1]), FHIR_FROM[r[0]] || '']))}

Mapping notes:

- Vital signs carry LOINC codes (temperature 8310-5, heart rate 8867-4, respiratory rate 9279-1, blood pressure panel 85354-9 with systolic 8480-6 and diastolic 8462-4, mean pressure 8478-0, pulse oximetry 59408-5, pain score 72514-3). Mean arterial pressure is not stored in the chart; it is computed from the blood pressure and linked with \`derivedFrom\`.
- Flag limits become \`referenceRange\`, and values outside them get \`interpretation\` H or L. For vitals and flowsheets these are the nurse-set flag limits for that patient, not population normal ranges.
- Shift-based flowsheet columns (nursing assessment, intake and output) get \`effectivePeriod\` or \`effectiveDateTime\` parsed from the column label, and the label itself is kept in \`note\`.
- A dose that is only due is not a MedicationAdministration. Its time is in the order's \`dosageInstruction.timing.event\`. Given doses have status \`completed\`; held doses \`not-done\`.
- Order status: Active and Pending → \`active\`, Completed → \`completed\`, On hold → \`on-hold\`. The original word is kept in \`note\`.
- Note and report text is in \`text.div\` (readable) and as a base64 \`text/plain\` attachment (\`content.attachment.data\`, \`presentedForm.data\`). \`DiagnosticReport.conclusion\` is the Impression section when the report has one, otherwise the whole text.
- Not in FHIR (tables and JSON only): lines and devices, timeline events, code status, isolation, and the medical, family, social and immunisation history lists.

## How to load

Python (pandas):

\`\`\`python
import pandas as pd
labs  = pd.read_csv("tables/labs.csv", parse_dates=["time"])
notes = pd.read_csv("tables/notes.csv", parse_dates=["time"])      # multi-line text loads correctly
vitals = pd.read_csv("tables/vitals.csv", parse_dates=["time"])
wide = vitals.pivot_table(index=["patient_id", "time"], columns="measure", values="value")
key = pd.read_csv("answer_key/answer_key.csv")                      # keep away from the model under test
\`\`\`

DuckDB:

\`\`\`sql
CREATE TABLE labs  AS SELECT * FROM read_csv_auto('tables/labs.csv');
CREATE TABLE notes AS SELECT * FROM read_csv_auto('tables/notes.csv');
SELECT patient_id, test, max(value) FROM labs WHERE flag = 'H' GROUP BY ALL;
-- FHIR lines as JSON
SELECT resourceType, id FROM read_ndjson_auto('fhir/Condition.ndjson');
-- MEDS as Parquet
COPY (SELECT subject_id, CAST(time AS TIMESTAMP) AS time, code, CAST(numeric_value AS FLOAT) AS numeric_value, text_value
      FROM read_csv('meds/data.csv', all_varchar = true) ORDER BY subject_id, time NULLS FIRST)
  TO 'meds/data.parquet' (FORMAT PARQUET);
\`\`\`

FHIR server (for example HAPI FHIR, R4). Every resource has its own id, so load with PUT. Load order matters only if the server checks references: Organization, Location, Practitioner, Patient, Encounter, then the rest.

\`\`\`bash
BASE=http://localhost:8080/fhir
for T in Organization Location Practitioner Patient Encounter Condition AllergyIntolerance CareTeam \\
         Observation MedicationRequest MedicationAdministration MedicationStatement ServiceRequest \\
         DiagnosticReport DocumentReference Procedure; do
  [ -f "fhir/$T.ndjson" ] || continue
  while IFS= read -r line; do
    id=$(printf '%s' "$line" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
    printf '%s' "$line" | curl -s -o /dev/null -X PUT -H 'Content-Type: application/fhir+json' --data-binary @- "$BASE/$T/$id"
  done < "fhir/$T.ndjson"
done
\`\`\`

Servers with bulk import (HAPI \`$import\`) can take the NDJSON files directly from any URL that serves them. To load one patient in one request, turn a bundle into a transaction with \`FHIRMAP.toTransaction(bundle)\` from \`fhir-map.js\` and POST it to the server base URL.

## Regenerating

\`node export.js\` from the project folder rebuilds everything from \`data.js\` and \`patients/p*.js\`. \`node verify-export.js\` checks the result.
`;
function CONFIG_NAME() { return FHIRMAP.config.orgName.replace(/ \(.*$/, '') + ', a fictional hospital'; }
write('DATA_DICTIONARY.md', DD, null, 'doc');

const README = `# Synthetic practice hospital dataset

${N} invented inpatient charts from a fictional hospital (${CONFIG_NAME()}), frozen at one simulated moment: ${iso(NOW)}. Each chart has demographics, problems, allergies, vital signs and flowsheets, laboratory results, diagnostic reports, medicines with every dose, orders, clinical notes, background history and earlier encounters.

## Read this first

- **Fully synthetic.** No real patients, staff or events. Names, record numbers, dates and results are invented. Any resemblance to a real person is coincidence.
- **Machine-written.** The charts were written by an AI language model.
- **Not clinician-reviewed.** No doctor, nurse or pharmacist has checked them. Doses, values and timelines can be wrong in ways that were not intended.
- **Not for clinical use.** Do not use this to make or support decisions about real patients, and do not treat it as a reference for medical practice. It is for practising with chart software, teaching, and testing tools.
- **Contains deliberate errors.** Every chart has planted mistakes, notes that contradict the record, and distractors. That is the point of the dataset. The list is in \`answer_key/\`, kept apart so it can be held out.

## What is in the box

| Folder | What | For whom |
|---|---|---|
| \`tables/\` | ${Object.keys(TABLES).length} tidy CSV files (${fmt(Object.keys(TABLES).reduce((s, k) => s + rows[k].length, 0))} rows) | Analysts: pandas, R, DuckDB, spreadsheets |
| \`fhir/\` | FHIR R4: ${resTypes.length} NDJSON files (${fmt(totalRes)} resources) and ${N} patient bundles | Health-IT developers, FHIR servers |
| \`meds/\` | MEDS-style event stream (${fmt(medsSorted.length)} events, ${fmt(codeRows.length)} codes) | Machine-learning users |
| \`json/patients.json\` | The native chart objects | Anyone who wants the source shape |
| \`answer_key/\` | ${fmt(keyRows.length)} planted items and ${fmt(alertRows.length)} ordering alerts | Benchmark owners. **Hold out.** |
| \`DATA_DICTIONARY.md\` | Every file and column, and how to load | Everyone |
| \`manifest.json\` | Row counts and SHA-256 checksums | Integrity checks |

## Counts

${mdTable(['Table', 'Rows'], Object.keys(TABLES).map(k => ['`' + k + '`', fmt(rows[k].length)]))}

${mdTable(['FHIR resource', 'Count'], resCounts.map(r => [r[0], fmt(r[1])]).concat([['**Total**', '**' + fmt(totalRes) + '**']]))}

Answer key items by kind: ${Object.keys(KIND_LABEL).map(k => KIND_LABEL[k].toLowerCase() + ' ' + keyRows.filter(r => r[3] === k).length).join(', ')}.

Patients:

${mdTable(['Id', 'Age', 'Sex', 'Unit', 'Main problem'], exported.map(p => [p.id, p.ageText || p.age, p.sex, p.unit, p.dx]))}

## Using it as a benchmark

Give the system under test \`tables/\`, \`fhir/\`, \`meds/\` or \`json/\`. Keep \`answer_key/\` back and score against it. The answer key text does not appear anywhere outside that folder (checked by \`verify-export.js\`), but the planted items themselves are, by design, findable in the data.

## Known limits

- Small: ${N} patients, one admission each, a few days of data.
- A snapshot, not a full stay: nothing is charted after the simulated "now", except doses marked due.
- Standard codes are sparse on purpose. A code is attached only where a small built-in table matches with confidence; medicines have no codes.
- Timestamps carry a fixed offset (${TZ}) as a convention; the hospital has no real location.

## Licence

**Licence: to be chosen by the dataset owner.** No licence has been granted yet. Until the owner replaces this paragraph, treat the files as "all rights reserved" and ask before redistributing.

<!-- LICENCE PLACEHOLDER: replace the paragraph above with the chosen licence (for example CC0-1.0, CC BY 4.0, or a custom data use agreement) and add a LICENSE file. -->

## Rebuilding

\`\`\`bash
node export.js          # rebuild everything from data.js and patients/p*.js
node verify-export.js   # check the output
\`\`\`
${warnings.length ? '\n## Warnings from this run\n\n' + warnings.map(w => '- ' + w).join('\n') + '\n' : ''}`;
write('README.md', README, null, 'doc');

const manifest = {
  dataset: 'Synthetic practice hospital dataset',
  synthetic: true, clinician_reviewed: false, not_for_clinical_use: true,
  licence: 'TO BE CHOSEN BY OWNER',
  generated_at: new Date().toISOString(),
  simulated_now: iso(NOW), timezone_offset: TZ,
  generator: { script: 'export.js', fhir_map_version: FHIRMAP.version, node: process.version },
  patients: exported.map(p => p.id),
  counts: { patients: N, fhir_resources: Object.fromEntries(resCounts), fhir_resources_total: totalRes, tables: Object.fromEntries(Object.keys(TABLES).map(k => [k, rows[k].length])), meds_events: medsSorted.length, answer_key_items: keyRows.length, order_alerts: alertRows.length },
  row_count_meaning: { csv: 'data rows, header not counted', ndjson: 'lines (resources)', 'fhir-bundle': 'entries', json: 'patients (patients.json) or key items (answer_key.json)', doc: null },
  warnings,
  files: written.slice().sort((a, b) => a.path < b.path ? -1 : 1)
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');

/* ------------------------------------------------------------------ zip */
function listFiles(dir, base) {
  let out = [];
  fs.readdirSync(dir).sort().forEach(f => {
    const full = path.join(dir, f), rel = base ? base + '/' + f : f;
    if (fs.statSync(full).isDirectory()) out = out.concat(listFiles(full, rel));
    else if (rel !== ZIP_NAME) out.push(rel);
  });
  return out;
}
function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let c, crc = ~0;
  for (let i = 0; i < buf.length; i++) { c = (crc ^ buf[i]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ~crc >>> 0;
}
function nodeZip(files, dest) { // minimal store/deflate zip writer, used only when the `zip` command is missing
  const parts = [], central = []; let offset = 0;
  files.forEach(rel => {
    const data = fs.readFileSync(path.join(OUT, rel)), comp = zlib.deflateRawSync(data, { level: 9 }), name = Buffer.from(rel, 'utf8'), crc = crc32(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8); h.writeUInt16LE(0, 10); h.writeUInt16LE(0x21, 12);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26); h.writeUInt16LE(0, 28);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10); c.writeUInt16LE(0, 12); c.writeUInt16LE(0x21, 14);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    parts.push(h, name, comp); central.push(c, name); offset += 30 + name.length + comp.length;
  });
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  fs.writeFileSync(dest, Buffer.concat(parts.concat([cd, end])));
}
let zipHow = 'skipped (--no-zip)';
if (!process.argv.includes('--no-zip')) {
  const files = listFiles(OUT, '');
  const z = spawnSync('zip', ['-X', '-q', '-9', ZIP_NAME, '-@'], { cwd: OUT, input: files.join('\n') + '\n' });
  if (!z.error && z.status === 0) zipHow = 'zip command';
  else { fs.rmSync(path.join(OUT, ZIP_NAME), { force: true }); nodeZip(files, path.join(OUT, ZIP_NAME)); zipHow = 'built-in Node writer (zip command not available)'; }
}

/* ------------------------------------------------------------------ summary */
console.log('Exported ' + N + ' patients (' + exported.map(p => p.id).join(', ') + ') to ' + OUT);
console.log('FHIR resources: ' + resCounts.map(r => r[0] + ' ' + r[1]).join(', ') + ' (total ' + totalRes + ')');
console.log('Tables: ' + Object.keys(TABLES).map(k => k + ' ' + rows[k].length).join(', '));
console.log('MEDS events: ' + medsSorted.length + ' (' + codeRows.length + ' codes); answer key items: ' + keyRows.length + '; order alerts: ' + alertRows.length);
console.log('Files: ' + written.length + ' + manifest.json' + (zipHow.startsWith('skipped') ? '' : ' + ' + ZIP_NAME) + '; zip: ' + zipHow);
if (warnings.length) console.log(warnings.length + ' warning(s), listed above and in README.md / manifest.json');
