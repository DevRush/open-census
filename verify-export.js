#!/usr/bin/env node
/* verify-export.js — checks the folder written by export.js. Exit code 0 = all checks passed.
 *
 *   node verify-export.js [export-folder]
 *
 * Checks: manifest (files exist, sizes, SHA-256, row counts), CSV shape and timestamps,
 * NDJSON parses, FHIR ids and references (per bundle and across the NDJSON set),
 * bundles and NDJSON hold the same resources, tables agree with FHIR, base64 text round-trips,
 * no answer-key text outside answer_key/, and the zip holds exactly the manifest files.
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'export'));
const ZIP_NAME = 'practice-emr-data.zip';
let fails = 0, passes = 0;
const ok = (cond, msg, detail) => { if (cond) { passes++; console.log('  ok    ' + msg); } else { fails++; console.log('  FAIL  ' + msg + (detail ? '\n        ' + String(detail).slice(0, 600) : '')); } };
const info = msg => console.log('  note  ' + msg);
const read = rel => fs.readFileSync(path.join(OUT, rel), 'utf8');

function parseCsv(text) { // RFC 4180
  const rows = []; let row = [], cell = '', q = false, i = 0, any = false;
  for (; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') { q = true; any = true; }
    else if (c === ',') { row.push(cell); cell = ''; any = true; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; any = false; }
    else { cell += c; any = true; }
  }
  if (q) throw new Error('unterminated quoted field');
  if (any || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function walk(dir, base) {
  let out = [];
  fs.readdirSync(dir).sort().forEach(f => { const full = path.join(dir, f), rel = base ? base + '/' + f : f; if (fs.statSync(full).isDirectory()) out = out.concat(walk(full, rel)); else out.push(rel); });
  return out;
}
function refsOf(node, out) {
  if (Array.isArray(node)) node.forEach(n => refsOf(n, out));
  else if (node && typeof node === 'object') Object.keys(node).forEach(k => { if (k === 'reference' && typeof node[k] === 'string') out.push(node[k]); else refsOf(node[k], out); });
  return out;
}

console.log('Verifying ' + OUT);
if (!fs.existsSync(path.join(OUT, 'manifest.json'))) { console.log('  FAIL  manifest.json not found; run node export.js first'); process.exit(1); }
const manifest = JSON.parse(read('manifest.json'));
const mf = new Map(manifest.files.map(f => [f.path, f]));

/* 1. manifest against disk */
console.log('\nManifest');
const onDisk = walk(OUT, '').filter(f => f !== 'manifest.json' && f !== ZIP_NAME);
ok(onDisk.every(f => mf.has(f)) && manifest.files.every(f => onDisk.includes(f.path)), 'manifest lists exactly the files on disk (' + manifest.files.length + ')',
  'unlisted: ' + onDisk.filter(f => !mf.has(f)).join(', ') + ' | missing: ' + manifest.files.filter(f => !onDisk.includes(f.path)).map(f => f.path).join(', '));
const badSum = manifest.files.filter(f => { try { const b = fs.readFileSync(path.join(OUT, f.path)); return b.length !== f.bytes || crypto.createHash('sha256').update(b).digest('hex') !== f.sha256; } catch (e) { return true; } });
ok(!badSum.length, 'sizes and SHA-256 checksums match', badSum.map(f => f.path).join(', '));
['README.md', 'DATA_DICTIONARY.md', 'json/patients.json', 'answer_key/answer_key.csv', 'answer_key/answer_key.json'].forEach(f => ok(mf.has(f), f + ' present'));

/* 2. CSV */
console.log('\nCSV files');
const csv = {};
const TS = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?)?$/;
let csvBad = [], tsBad = [], shapeBad = [];
manifest.files.filter(f => f.kind === 'csv').forEach(f => {
  let rows;
  try { rows = parseCsv(read(f.path)); } catch (e) { csvBad.push(f.path + ': ' + e.message); return; }
  const head = rows[0], data = rows.slice(1);
  csv[f.path] = { head, data };
  if (data.length !== f.rows) csvBad.push(f.path + ': ' + data.length + ' rows, manifest says ' + f.rows);
  const ragged = data.findIndex(r => r.length !== head.length);
  if (ragged >= 0) shapeBad.push(f.path + ' row ' + (ragged + 2) + ' has ' + data[ragged].length + ' cells, header has ' + head.length);
  head.forEach((h, ci) => { if (/^(time|time_end|admit_time|start_time|ordered_time|placed_time|date|birth_date)$/.test(h)) data.forEach((r, ri) => { if (r[ci] !== '' && !TS.test(r[ci])) tsBad.push(f.path + ' row ' + (ri + 2) + ' ' + h + '=' + r[ci]); }); });
});
ok(!csvBad.length, 'every CSV parses and its row count matches the manifest (' + Object.keys(csv).length + ' files)', csvBad.join(' | '));
ok(!shapeBad.length, 'every CSV row has the same number of cells as its header', shapeBad.join(' | '));
ok(!tsBad.length, 'every timestamp cell is ISO 8601', tsBad.slice(0, 5).join(' | '));
const col = (rel, name) => { const t = csv[rel]; const i = t.head.indexOf(name); return t.data.map(r => r[i]); };
const pids = new Set(col('tables/patients.csv', 'patient_id'));
const orphan = Object.keys(csv).filter(k => k.startsWith('tables/') || k.startsWith('answer_key/')).filter(k => col(k, 'patient_id').some(v => !pids.has(v)));
ok(!orphan.length, 'every patient_id in tables/ and answer_key/ exists in patients.csv (' + pids.size + ' patients)', orphan.join(', '));
ok(JSON.stringify([...pids]) === JSON.stringify(manifest.patients), 'patients.csv matches the manifest patient list');

/* 3. NDJSON */
console.log('\nFHIR NDJSON');
const IDRE = /^[A-Za-z0-9\-.]{1,64}$/;
const nd = new Map(); let ndBad = [], ndCount = 0;
manifest.files.filter(f => f.kind === 'ndjson').forEach(f => {
  const type = path.basename(f.path, '.ndjson'), text = read(f.path);
  const lines = text.split('\n'); if (lines[lines.length - 1] === '') lines.pop();
  if (lines.length !== f.rows) ndBad.push(f.path + ': ' + lines.length + ' lines, manifest says ' + f.rows);
  lines.forEach((l, i) => {
    let r; try { r = JSON.parse(l); } catch (e) { ndBad.push(f.path + ' line ' + (i + 1) + ' does not parse'); return; }
    ndCount++;
    if (r.resourceType !== type) ndBad.push(f.path + ' line ' + (i + 1) + ' has resourceType ' + r.resourceType);
    if (!IDRE.test(r.id || '')) ndBad.push(f.path + ' line ' + (i + 1) + ' has a bad id ' + r.id);
    const k = r.resourceType + '/' + r.id; if (nd.has(k)) ndBad.push('duplicate ' + k); nd.set(k, r);
  });
});
ok(!ndBad.length, 'every NDJSON line parses, has the right resourceType and a unique valid id (' + ndCount + ' resources)', ndBad.slice(0, 5).join(' | '));
let dangling = [];
nd.forEach((r, k) => refsOf(r, []).forEach(x => { if (!nd.has(x)) dangling.push(k + ' -> ' + x); }));
ok(!dangling.length, 'every reference resolves inside the NDJSON set', dangling.slice(0, 5).join(' | '));

/* 4. Bundles */
console.log('\nFHIR bundles');
const bundleFiles = manifest.files.filter(f => f.kind === 'fhir-bundle');
let bBad = [], bRefs = 0, fromBundles = new Map();
const REQUIRED = { Observation: ['status', 'code', 'subject'], Condition: ['code', 'subject'], Encounter: ['status', 'class', 'subject'], MedicationRequest: ['status', 'intent', 'medicationCodeableConcept', 'subject'], MedicationAdministration: ['status', 'medicationCodeableConcept', 'subject', 'effectiveDateTime'], ServiceRequest: ['status', 'intent', 'code', 'subject'], DiagnosticReport: ['status', 'code', 'subject'], DocumentReference: ['status', 'type', 'content', 'text'], AllergyIntolerance: ['patient', 'code'], Procedure: ['status', 'subject', 'code'], Patient: ['name', 'gender'], CareTeam: ['subject', 'participant'], MedicationStatement: ['status', 'medicationCodeableConcept', 'subject'] };
let obsNoTime = 0, obsNoValue = 0, labNoRange = 0;
bundleFiles.forEach(f => {
  let b; try { b = JSON.parse(read(f.path)); } catch (e) { bBad.push(f.path + ' does not parse'); return; }
  if (b.resourceType !== 'Bundle' || b.type !== 'collection' || !IDRE.test(b.id || '')) bBad.push(f.path + ': not a collection Bundle with an id');
  if (!Array.isArray(b.entry) || b.entry.length !== f.rows) { bBad.push(f.path + ': entry count differs from manifest'); return; }
  const ids = new Set();
  b.entry.forEach((e, i) => {
    const r = e.resource;
    if (!r || !r.resourceType || !IDRE.test(r.id || '')) { bBad.push(f.path + ' entry ' + i + ' lacks resourceType or valid id'); return; }
    const k = r.resourceType + '/' + r.id;
    if (ids.has(k)) bBad.push(f.path + ' duplicate ' + k); ids.add(k);
    if (!e.fullUrl || !e.fullUrl.endsWith('/' + k)) bBad.push(f.path + ' ' + k + ' fullUrl mismatch');
    (REQUIRED[r.resourceType] || []).forEach(p => { if (r[p] === undefined) bBad.push(f.path + ' ' + k + ' lacks ' + p); });
    if ('key' in r || 'alerts' in r) bBad.push(f.path + ' ' + k + ' carries key/alerts');
    if (r.resourceType === 'Observation') {
      if (!r.effectiveDateTime && !r.effectivePeriod) obsNoTime++;
      if (r.valueQuantity === undefined && r.valueString === undefined && !r.component) obsNoValue++;
      if ((r.category || []).some(c => (c.coding || []).some(x => x.code === 'laboratory')) && !r.referenceRange) labNoRange++;
    }
    const prev = fromBundles.get(k), s = JSON.stringify(r);
    if (prev !== undefined && prev !== s) bBad.push(k + ' differs between bundles');
    fromBundles.set(k, s);
  });
  const pat = b.entry.filter(e => e.resource && e.resource.resourceType === 'Patient');
  if (pat.length !== 1 || pat[0].resource.id !== path.basename(f.path, '.json')) bBad.push(f.path + ': expected exactly one Patient with the file\'s id');
  b.entry.forEach(e => refsOf(e.resource, []).forEach(x => { bRefs++; if (!ids.has(x)) bBad.push(f.path + ': ' + e.resource.resourceType + '/' + e.resource.id + ' -> ' + x + ' does not resolve'); }));
});
ok(bundleFiles.length === pids.size, 'one bundle per patient (' + bundleFiles.length + ')');
ok(!bBad.length, 'every bundle is a collection with valid unique ids, required fields, and ' + bRefs + ' references that all resolve inside the bundle', bBad.slice(0, 6).join(' | '));
ok(obsNoValue === 0, 'every Observation has a value', obsNoValue + ' without');
ok(labNoRange === 0, 'every laboratory Observation has a referenceRange', labNoRange + ' without');
if (obsNoTime) info(obsNoTime + ' Observation(s) have no effective time (shift column label without a readable date; label kept in note)'); else ok(true, 'every Observation has an effective time');
let diff = [];
fromBundles.forEach((s, k) => { if (!nd.has(k)) diff.push(k + ' only in bundles'); else if (JSON.stringify(nd.get(k)) !== s) diff.push(k + ' differs'); });
nd.forEach((r, k) => { if (!fromBundles.has(k)) diff.push(k + ' only in NDJSON'); });
ok(!diff.length, 'bundles and NDJSON hold exactly the same ' + nd.size + ' resources', diff.slice(0, 5).join(' | '));

/* 5. tables agree with FHIR */
console.log('\nTables against FHIR');
const count = (type, pred) => { let n = 0; nd.forEach(r => { if (r.resourceType === type && (!pred || pred(r))) n++; }); return n; };
const n = rel => csv['tables/' + rel + '.csv'].data.length;
const hasCat = c => r => (r.category || []).some(x => (x.coding || []).some(y => y.code === c));
ok(count('Patient') === n('patients'), 'patients = Patient (' + n('patients') + ')');
ok(count('Encounter') === n('encounters'), 'encounters = Encounter (' + n('encounters') + ')');
ok(count('Observation', hasCat('laboratory')) === n('labs'), 'labs = laboratory Observations (' + n('labs') + ')');
ok(count('DocumentReference') === n('notes'), 'notes = DocumentReference (' + n('notes') + ')');
ok(count('DiagnosticReport') === n('reports'), 'reports = DiagnosticReport (' + n('reports') + ')');
ok(count('ServiceRequest') === n('orders'), 'orders = ServiceRequest (' + n('orders') + ')');
ok(count('MedicationRequest') === n('medication_orders'), 'medication_orders = MedicationRequest (' + n('medication_orders') + ')');
const admins = csv['tables/medication_administrations.csv'], st = admins.head.indexOf('status');
ok(count('MedicationAdministration') === admins.data.filter(r => r[st] !== 'due').length, 'given + held doses = MedicationAdministration (' + count('MedicationAdministration') + '; ' + admins.data.filter(r => r[st] === 'due').length + ' due doses are CSV-only)');
ok(count('Condition', hasCat('problem-list-item')) === n('problems'), 'problems = problem-list Conditions (' + n('problems') + ')');
ok(count('AllergyIntolerance') === n('allergies'), 'allergies = AllergyIntolerance (' + n('allergies') + ')');
const noteText = new Map(csv['tables/notes.csv'].data.map(r => [r[1], r[7]])), repText = new Map(csv['tables/reports.csv'].data.map(r => [r[1], r[7]]));
let b64Bad = [];
nd.forEach(r => {
  if (r.resourceType === 'DocumentReference') { const t = Buffer.from(r.content[0].attachment.data, 'base64').toString('utf8'); if (t !== noteText.get(r.id)) b64Bad.push(r.id); }
  if (r.resourceType === 'DiagnosticReport' && r.presentedForm) { const t = Buffer.from(r.presentedForm[0].data, 'base64').toString('utf8'); if (t !== repText.get(r.id)) b64Bad.push(r.id); }
});
ok(!b64Bad.length, 'base64 note and report text decodes to exactly the text in notes.csv / reports.csv', b64Bad.slice(0, 5).join(', '));
const medsRows = csv['meds/data.csv'].data; let unsorted = 0;
for (let i = 1; i < medsRows.length; i++) { const a = medsRows[i - 1], b = medsRows[i]; if (+a[0] > +b[0] || (+a[0] === +b[0] && a[1] > b[1])) unsorted++; }
ok(unsorted === 0 && medsRows.every(r => /^\d+$/.test(r[0]) && r[2] !== ''), 'MEDS events are sorted by subject and time, with integer subject ids and a code on every row (' + medsRows.length + ')');
const codeSet = new Set(col('meds/codes.csv', 'code'));
ok(medsRows.every(r => codeSet.has(r[2])), 'every MEDS code is described in codes.csv (' + codeSet.size + ' codes)');

/* 6. answer-key leakage */
console.log('\nAnswer key hold-out');
const key = JSON.parse(read('answer_key/answer_key.json'));
const publicFiles = manifest.files.filter(f => /^(fhir|tables|meds|json)\//.test(f.path)).map(f => f.path).concat(['README.md', 'DATA_DICTIONARY.md']);
let hay = publicFiles.map(f => read(f)).join('\n');
// also search the decoded attachments, the JSON-unescaped text, and a whitespace-normalised copy
const decoded = []; nd.forEach(r => { if (r.resourceType === 'DocumentReference') decoded.push(Buffer.from(r.content[0].attachment.data, 'base64').toString('utf8')); if (r.presentedForm) decoded.push(Buffer.from(r.presentedForm[0].data, 'base64').toString('utf8')); });
const strings = []; (function grab(v) { if (typeof v === 'string') strings.push(v); else if (Array.isArray(v)) v.forEach(grab); else if (v && typeof v === 'object') Object.values(v).forEach(grab); })(JSON.parse(read('json/patients.json')));
const norm = s => s.replace(/""/g, '"').replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').toLowerCase();
hay = norm(hay + '\n' + decoded.join('\n') + '\n' + strings.join('\n'));
let items = 0, leaks = [], sentenceHits = [];
key.patients.forEach(p => {
  p.items.forEach(it => {
    items++;
    [['title', it.title], ['explanation', it.explanation]].forEach(x => { if (x[1] && x[1].length >= 12 && hay.includes(norm(x[1]))) leaks.push(it.item_id + ' ' + x[0] + ': ' + x[1].slice(0, 80)); });
    String(it.explanation || '').split(/(?<=[.!?])\s+/).forEach(s => { if (s.length >= 50 && hay.includes(norm(s))) sentenceHits.push(it.item_id + ': ' + s.slice(0, 90)); });
  });
  Object.keys(p.order_alerts || {}).forEach(a => { items++; const w = p.order_alerts[a]; if (w && w.length >= 12 && hay.includes(norm(w))) leaks.push(p.patient_id + ' alert ' + a + ': ' + w.slice(0, 80)); });
});
ok(items > 0 && !leaks.length, 'no answer-key title, explanation or alert text (' + items + ' items) appears in fhir/, tables/, meds/, json/ or the docs', leaks.slice(0, 6).join(' | '));
ok(!sentenceHits.length, 'no full sentence (50+ characters) of any key explanation appears outside answer_key/', sentenceHits.slice(0, 6).join(' | '));
const pj = JSON.parse(read('json/patients.json'));
ok(pj.patients.every(p => !('key' in p) && !('alerts' in p)), 'json/patients.json has no key or alerts fields');
let headBad = [];
Object.keys(csv).filter(k => !k.startsWith('answer_key/')).forEach(k => { if (csv[k].head.some(h => /^(key|answer|explanation|where_to_look|kind_label)$/.test(h))) headBad.push(k); });
ok(!headBad.length, 'no answer-key columns in public tables', headBad.join(', '));

/* 7. zip */
console.log('\nZip archive');
if (!fs.existsSync(path.join(OUT, ZIP_NAME))) info(ZIP_NAME + ' not present (export was run with --no-zip?)');
else {
  const want = manifest.files.map(f => f.path).concat(['manifest.json']).sort();
  let got = null;
  const z = spawnSync('unzip', ['-Z1', ZIP_NAME], { cwd: OUT, encoding: 'utf8' });
  if (!z.error && z.status === 0) {
    got = z.stdout.split('\n').filter(l => l && !l.endsWith('/')).sort();
    const t = spawnSync('unzip', ['-tq', ZIP_NAME], { cwd: OUT, encoding: 'utf8' });
    ok(t.status === 0, 'zip passes its integrity test', t.stdout);
  } else { // read the central directory ourselves
    const b = fs.readFileSync(path.join(OUT, ZIP_NAME)); got = [];
    for (let i = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])), off = b.readUInt32LE(i + 16), k = b.readUInt16LE(i + 10); k > 0; k--) { const len = b.readUInt16LE(off + 28); got.push(b.slice(off + 46, off + 46 + len).toString('utf8')); off += 46 + len + b.readUInt16LE(off + 30) + b.readUInt16LE(off + 32); }
    got.sort();
  }
  ok(JSON.stringify(got) === JSON.stringify(want), 'zip holds exactly the manifest files plus manifest.json (' + want.length + ' files)', 'extra: ' + got.filter(f => !want.includes(f)).join(', ') + ' | missing: ' + want.filter(f => !got.includes(f)).join(', '));
  const m = spawnSync('unzip', ['-p', ZIP_NAME, 'manifest.json'], { cwd: OUT, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (!m.error && m.status === 0) ok(m.stdout === read('manifest.json'), 'zip was built from this manifest (not stale)');
}

console.log('\n' + (fails ? fails + ' check(s) FAILED, ' : 'All ') + passes + ' checks passed' + (manifest.warnings && manifest.warnings.length ? '; export had ' + manifest.warnings.length + ' warning(s)' : '') + '.');
process.exit(fails ? 1 : 0);
