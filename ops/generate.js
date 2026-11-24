#!/usr/bin/env node
/*
 * Northfield Medical Center - synthetic hospital OPERATIONS dataset generator.
 *
 * FULLY SYNTHETIC. Every row is produced by the seeded discrete-event simulation in this file.
 * No real patients, staff or hospital data are used anywhere.
 *
 *   node generate.js            -> default seed 20261117
 *   node generate.js 12345      -> another seed (or --seed 12345, or OPS_SEED=12345)
 *
 * Dependency-free (Node >= 16). Same seed -> byte-identical output.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SEED = (() => {
  const i = process.argv.indexOf('--seed');
  const pos = process.argv.slice(2).find(x => /^\d+$/.test(x));
  const v = i >= 0 ? process.argv[i + 1] : pos || process.env.OPS_SEED || '20261117';
  return parseInt(v, 10) >>> 0;
})();
const OUT = path.join(__dirname, 'data');
const GT = path.join(OUT, 'ground_truth');

// ------------------------------------------------------------------ time base
const DAY = 1440;
const N_DAYS = 180;          // reporting window: 2026-05-22 .. 2026-11-17
const WARM_DAYS = 42;        // simulated but not reported (fills the hospital)
const COOL_DAYS = 30;        // simulated after the snapshot; used only for ground truth of censored outcomes
const END = N_DAYS * DAY;    // snapshot instant = 2026-11-18T00:00 (end of Tue 17 Nov 2026)
const T_STOP = (N_DAYS + COOL_DAYS) * DAY;
const EPOCH = Date.UTC(2026, 4, 22, 0, 0, 0);
const iso = t => new Date(EPOCH + Math.round(t) * 60000).toISOString().slice(0, 16);   // minute resolution, local hospital time
const T = t => (t == null || t > END) ? '' : iso(t);           // censored timestamp
const D = (a, b) => (a == null || b == null || a > END || b > END) ? '' : Math.round(b - a); // censored duration (min)
const dstr = d => iso(d * DAY).slice(0, 10);
const dowOf = d => (((d + 5) % 7) + 7) % 7;                     // day 0 is a Friday
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOLIDAYS = new Set(['2026-05-25', '2026-07-03', '2026-09-07', '2026-11-26']);
const isWorkday = d => { const w = dowOf(d); return w >= 1 && w <= 5 && !HOLIDAYS.has(dstr(d)); };
const weekOf = d => Math.floor((d + 4) / 7);
const parityOf = d => ((weekOf(d) % 2) + 2) % 2;
const monthOf = d => parseInt(dstr(d).slice(5, 7), 10);
const pad = (n, w) => String(n).padStart(w, '0');
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r1 = x => Math.round(x * 10) / 10;
const r2 = x => Math.round(x * 100) / 100;

// ------------------------------------------------------------------ RNG
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
class Rng {
  constructor(name) { this.a = (SEED ^ hashStr(name)) >>> 0; this.spare = null; }
  u() { let t = (this.a = (this.a + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  int(a, b) { return a + Math.floor(this.u() * (b - a + 1)); }
  uni(a, b) { return a + this.u() * (b - a); }
  bern(p) { return this.u() < p; }
  norm(m = 0, s = 1) {
    if (this.spare !== null) { const z = this.spare; this.spare = null; return m + s * z; }
    let u1; do { u1 = this.u(); } while (u1 < 1e-12);
    const u2 = this.u(), r = Math.sqrt(-2 * Math.log(u1));
    this.spare = r * Math.sin(2 * Math.PI * u2); return m + s * r * Math.cos(2 * Math.PI * u2);
  }
  logn(med, sg) { return med * Math.exp(sg * this.norm()); }
  exp(mean) { return -mean * Math.log(1 - this.u()); }
  pick(a) { return a[Math.floor(this.u() * a.length)]; }
  wpick(items, w) { let s = 0; for (const x of w) s += x; let r = this.u() * s; for (let i = 0; i < items.length; i++) { r -= w[i]; if (r < 0) return items[i]; } return items[items.length - 1]; }
  pois(l) { if (l <= 0) return 0; if (l < 30) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= this.u(); } while (p > L); return k - 1; } return Math.max(0, Math.round(l + Math.sqrt(l) * this.norm())); }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.u() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
}

// ------------------------------------------------------------------ CSV
function csvCell(v) { if (v == null) return ''; const s = String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
const FILES = [];
function writeCsv(rel, header, rows) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, 'w');
  fs.writeSync(fd, header.join(',') + '\n');
  let buf = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]; let line = '';
    for (let j = 0; j < header.length; j++) { if (j) line += ','; line += csvCell(r[j]); }
    buf.push(line);
    if (buf.length >= 5000) { fs.writeSync(fd, buf.join('\n') + '\n'); buf = []; }
  }
  if (buf.length) fs.writeSync(fd, buf.join('\n') + '\n');
  fs.closeSync(fd);
  FILES.push({ file: rel, rows: rows.length, cols: header.length, bytes: fs.statSync(file).size });
}

// ------------------------------------------------------------------ reference data: units
const UNITS = [
  // key, name, code, beds, kind, day ratio, night ratio (patients per nurse)
  ['icu', 'Medical ICU', 'MICU', 24, 'icu', 2, 2],
  ['neuro', 'Neuro ICU', 'NICU', 16, 'icu', 2, 2],
  ['trauma', 'Trauma ICU', 'TICU', 12, 'icu', 2, 2],
  ['cvicu', 'Cardiac Surgery ICU', 'CVICU', 12, 'icu', 2, 2],
  ['sx', '6 West Surgery', '6W', 64, 'ward', 5, 6],
  ['ortho', '5 North Orthopaedics', '5N', 48, 'ward', 5, 6],
  ['card', '4 East Cardiology', '4E', 56, 'ward', 4, 5],
  ['med', '3 West Medicine', '3W', 128, 'ward', 5, 6],
  ['haem', '7 South Haematology', '7S', 36, 'ward', 4, 5],
  ['tx', 'Transplant Unit', 'TX', 24, 'ward', 4, 5],
  ['ob', 'Labour and Postnatal', 'LP', 44, 'ward', 3, 4],
  ['peds', 'Paediatrics', 'PD', 40, 'ward', 4, 4],
  ['psych', 'Behavioural Health', 'BH', 32, 'ward', 6, 8],
  ['ed', 'Emergency Department', 'ED', 60, 'ed', 4, 4],
];
const OVERFLOW = { med: ['card', 'sx', 'ortho'], card: ['med'], sx: ['ortho', 'med'], ortho: ['sx'], haem: ['med'], tx: ['sx', 'med'], icu: ['cvicu', 'trauma', 'neuro'], neuro: ['icu', 'trauma'], trauma: ['icu', 'neuro'], cvicu: ['icu'] };
const OV_WAIT = { med: 240, card: 240, sx: 240, ortho: 240, haem: 360, tx: 360, icu: 60, neuro: 60, trauma: 60, cvicu: 60 };
const DIVERT = { icu: 4, neuro: 3, trauma: 3, cvicu: 3, med: 14, card: 8, sx: 9, ortho: 8, haem: 5, tx: 4, ob: 6, peds: 6, psych: 3 };
const ICU_LOS = { icu: 2.9, neuro: 3.4, trauma: 3.0, cvicu: 3.0 };
const DBN_W = { med: 0.11, card: 0.14, sx: 0.13, ortho: 0.18, haem: 0.10, tx: 0.10, ob: 0.30, peds: 0.22, psych: 0.25, icu: 0.1, neuro: 0.1, trauma: 0.1, cvicu: 0.1 };
const ADULT_WARDS = new Set(['med', 'card', 'sx', 'ortho', 'haem', 'tx']);

// ------------------------------------------------------------------ reference data: admitting diagnosis groups
// los = median ward days, sg = log-sd, picu = base probability of starting in intensive care, iu = which ICU,
// mort = base in-hospital mortality, ra = readmission odds multiplier, det = deterioration multiplier,
// ao = [procedure key(s), probability, urgency class, min h, max h] for an add-on operation.
const DX = {
  hf: { n: 'Heart failure', svc: 'Cardiology', u: 'card', los: 4.3, sg: .55, picu: .05, mort: .03, ra: 1.7, det: 1.3 },
  mi: { n: 'Heart attack', svc: 'Cardiology', u: 'card', los: 2.9, sg: .5, picu: .12, mort: .04, ra: 1.1, det: 1.3, ao: ['pci_em', .5, 'emergent', .1, .4] },
  cp: { n: 'Chest pain, heart attack ruled out', svc: 'Cardiology', u: 'card', los: 1.2, sg: .45, picu: 0, mort: .001, ra: .6, det: .3 },
  af: { n: 'Irregular heart rhythm', svc: 'Cardiology', u: 'card', los: 2.2, sg: .5, picu: .03, mort: .008, ra: .9, det: .8 },
  pna: { n: 'Pneumonia', svc: 'General medicine', u: 'med', los: 4.1, sg: .55, picu: .09, mort: .035, ra: 1.1, det: 1.5 },
  copd: { n: 'Flare-up of chronic lung disease', svc: 'General medicine', u: 'med', los: 3.8, sg: .5, picu: .07, mort: .022, ra: 1.6, det: 1.4 },
  sepsis: { n: 'Sepsis (severe infection)', svc: 'General medicine', u: 'med', los: 5.8, sg: .6, picu: .28, mort: .09, ra: 1.2, det: 1.8 },
  uti: { n: 'Urinary or kidney infection', svc: 'General medicine', u: 'med', los: 3.2, sg: .5, picu: .02, mort: .008, ra: 1.0, det: .9 },
  stroke: { n: 'Stroke', svc: 'Neurology', u: 'med', iu: 'neuro', los: 4.6, sg: .6, picu: .22, mort: .06, ra: 1.0, det: 1.2, ao: ['thrombectomy', .12, 'emergent', .2, .8] },
  ich: { n: 'Bleeding in or around the brain', svc: 'Neurosurgery', u: 'sx', iu: 'neuro', los: 6.5, sg: .6, picu: .8, mort: .14, ra: .9, det: 1.2, ao: ['haematoma', .4, 'emergent', .3, 2] },
  seiz: { n: 'Seizure', svc: 'Neurology', u: 'med', iu: 'neuro', los: 2.4, sg: .5, picu: .08, mort: .006, ra: 1.0, det: .7 },
  gib: { n: 'Bleeding from the gut', svc: 'General medicine', u: 'med', los: 3.5, sg: .5, picu: .14, mort: .025, ra: 1.1, det: 1.4, ao: ['embol', .08, 'urgent', 1, 6] },
  sbo: { n: 'Bowel obstruction', svc: 'General surgery', u: 'sx', los: 4.0, sg: .55, picu: .05, mort: .02, ra: 1.0, det: 1.1, ao: ['laparotomy', .3, 'urgent', 2, 24] },
  appy: { n: 'Appendicitis', svc: 'General surgery', u: 'sx', los: 1.6, sg: .45, picu: .005, mort: .001, ra: .5, det: .4, ao: ['appy', .93, 'urgent', .5, 3] },
  chole: { n: 'Gallbladder inflammation', svc: 'General surgery', u: 'sx', los: 2.6, sg: .45, picu: .02, mort: .004, ra: .8, det: .6, ao: ['lapchole', .45, 'expedited', 2, 12] },
  panc: { n: 'Inflammation of the pancreas', svc: 'General medicine', u: 'med', los: 4.4, sg: .6, picu: .07, mort: .015, ra: 1.2, det: 1.1 },
  hipfx: { n: 'Hip fracture', svc: 'Orthopaedics', u: 'ortho', los: 4.5, sg: .4, picu: .02, mort: .025, ra: 1.0, det: 1.2, ao: ['hipfix', .95, 'expedited', 2, 8] },
  fx: { n: 'Other broken bone', svc: 'Orthopaedics', u: 'ortho', los: 2.3, sg: .5, picu: .005, mort: .003, ra: .7, det: .6, ao: [['anklefix', 'wristfix', 'femurnail'], .6, 'expedited', 2, 8] },
  trauma: { n: 'Major injury', svc: 'Trauma surgery', u: 'sx', iu: 'trauma', los: 5.4, sg: .7, picu: .55, mort: .06, ra: .8, det: 1.1, ao: ['damage', .28, 'emergent', .1, .5] },
  cellulitis: { n: 'Skin and soft-tissue infection', svc: 'General medicine', u: 'med', los: 3.0, sg: .5, picu: .01, mort: .003, ra: .9, det: .6, ao: ['abscess', .2, 'urgent', 1, 8] },
  aki: { n: 'Sudden kidney injury', svc: 'General medicine', u: 'med', los: 4.0, sg: .5, picu: .04, mort: .02, ra: 1.3, det: 1.0 },
  dka: { n: 'Diabetes emergency', svc: 'General medicine', u: 'med', los: 2.6, sg: .5, picu: .2, mort: .006, ra: 1.3, det: .7 },
  resp: { n: 'Breathing failure', svc: 'General medicine', u: 'med', los: 6.0, sg: .6, picu: .55, mort: .13, ra: 1.3, det: 1.8 },
  vte: { n: 'Blood clot in leg or lung', svc: 'General medicine', u: 'med', los: 2.8, sg: .5, picu: .05, mort: .012, ra: .9, det: 1.0 },
  gastro: { n: 'Dehydration or gut infection', svc: 'General medicine', u: 'med', los: 2.0, sg: .45, picu: 0, mort: .002, ra: .8, det: .5 },
  frail: { n: 'Confusion or decline in an older person', svc: 'General medicine', u: 'med', los: 5.0, sg: .6, picu: .01, mort: .03, ra: 1.3, det: 1.0 },
  od: { n: 'Overdose or poisoning', svc: 'General medicine', u: 'med', los: 1.7, sg: .6, picu: .22, mort: .008, ra: 1.2, det: .6 },
  withdrawal: { n: 'Alcohol or drug withdrawal', svc: 'General medicine', u: 'med', los: 3.2, sg: .5, picu: .07, mort: .004, ra: 1.6, det: .8 },
  onc: { n: 'Complication of cancer or its treatment', svc: 'Haematology and oncology', u: 'haem', los: 5.0, sg: .6, picu: .05, mort: .05, ra: 1.6, det: 1.5 },
  nf: { n: 'Fever with low blood counts', svc: 'Haematology and oncology', u: 'haem', los: 5.5, sg: .5, picu: .08, mort: .03, ra: 1.5, det: 1.7 },
  chemo: { n: 'Planned chemotherapy admission', svc: 'Haematology and oncology', u: 'haem', los: 6.5, sg: .6, picu: .01, mort: .008, ra: 1.8, det: 1.0 },
  sct: { n: 'Stem-cell transplant admission', svc: 'Haematology and oncology', u: 'haem', los: 20, sg: .25, picu: .03, mort: .03, ra: 1.5, det: 1.6 },
  txcomp: { n: 'Complication after organ transplant', svc: 'Transplant', u: 'tx', los: 5.0, sg: .6, picu: .07, mort: .02, ra: 1.6, det: 1.2 },
  ktx: { n: 'Kidney transplant', svc: 'Transplant', u: 'tx', los: 5.5, sg: .3, picu: 0, mort: .004, ra: 1.5, det: .9, ao: ['ktx', 1, 'urgent', 3, 9] },
  ltx: { n: 'Liver transplant', svc: 'Transplant', u: 'tx', los: 10, sg: .4, picu: 0, mort: .03, ra: 1.5, det: 1.2, ao: ['ltx', 1, 'urgent', 3, 9] },
  labour: { n: 'Labour and birth', svc: 'Obstetrics', u: 'ob', los: 2.1, sg: .3, picu: 0, mort: 0, ra: .12, det: 0, ao: ['csemerg', .13, 'emergent', 3, 16] },
  pregcomp: { n: 'Pregnancy complication', svc: 'Obstetrics', u: 'ob', los: 2.6, sg: .6, picu: 0, mort: 0, ra: .5, det: 0 },
  pasthma: { n: 'Child with asthma or chest infection', svc: 'Paediatrics', u: 'peds', los: 2.0, sg: .5, picu: 0, mort: 0, ra: .7, det: 0 },
  pinf: { n: 'Child with infection or fever', svc: 'Paediatrics', u: 'peds', los: 2.4, sg: .5, picu: 0, mort: 0, ra: .6, det: 0 },
  pinj: { n: 'Child with injury or surgical problem', svc: 'Paediatrics', u: 'peds', los: 1.9, sg: .5, picu: 0, mort: 0, ra: .4, det: 0, ao: ['pappy', .3, 'urgent', 1, 5] },
  pchronic: { n: 'Child with a long-term condition', svc: 'Paediatrics', u: 'peds', los: 3.0, sg: .55, picu: 0, mort: 0, ra: 1.4, det: 0 },
  depr: { n: 'Depression or suicidal crisis', svc: 'Psychiatry', u: 'psych', los: 6.8, sg: .55, picu: 0, mort: 0, ra: 1.3, det: 0 },
  psychosis: { n: 'Psychosis or mania', svc: 'Psychiatry', u: 'psych', los: 10, sg: .55, picu: 0, mort: 0, ra: 1.4, det: 0 },
};

// ED chief complaints: label, weight adult, weight child, multiplier if age>=65, severity shift (negative = sicker),
// admitted-diagnosis weights, tag
const CC = [
  ['Chest pain', 9, .3, 1.3, -.5, { cp: 5, mi: 1.6, af: .8, hf: .6, pna: .4, vte: .4 }, ''],
  ['Shortness of breath', 7, 0, 1.6, -.5, { hf: 2.5, copd: 2.5, pna: 2.5, resp: 1, vte: .5, af: .4 }, 'resp'],
  ['Abdominal pain', 11, 4, 1.0, 0, { appy: 1.4, chole: 1.2, sbo: 1, panc: 1, gastro: 1, uti: .6, gib: .4 }, ''],
  ['Fever', 3.5, 0, 1.3, 0, { pna: 2, uti: 2, sepsis: 2, cellulitis: 1, nf: .7 }, 'resp'],
  ['Fall or injury to an arm or leg', 9, 9, 1.4, .3, { fx: 2, hipfx: 0, frail: .4 }, 'inj'],
  ['Headache', 3.5, 1, .8, 0, { ich: 1, stroke: .5, seiz: .3, gastro: .5 }, ''],
  ['Weakness or numbness on one side', 2, 0, 2, -.9, { stroke: 5, ich: 1, seiz: .5 }, ''],
  ['Back pain', 4.5, .3, 1, .4, { fx: .5, uti: 1, frail: .5 }, ''],
  ['Vomiting or diarrhoea', 4.5, 6, 1, .3, { gastro: 3, aki: 1, sbo: .5, dka: .4 }, ''],
  ['Cough or sore throat', 5, 9, .8, .7, { pna: 3, copd: 1 }, 'resp'],
  ['Urinary symptoms', 3, 1, 1.3, .4, { uti: 4, aki: 1, sepsis: .6 }, ''],
  ['Cut or wound', 5, 6, .6, .8, { cellulitis: 1 }, 'inj'],
  ['Sprain or minor injury', 5, 5, .5, 1, { fx: 1 }, 'inj'],
  ['Mental health crisis', 4.2, .3, .3, -.4, { depr: 5, psychosis: 2.5, withdrawal: .5 }, 'mh'],
  ['Alcohol or drug intoxication', 2.6, 0, .2, -.1, { od: 2.5, withdrawal: 3 }, 'mh'],
  ['Allergic reaction', 1.2, 1.5, .5, -.1, { resp: 1 }, ''],
  ['Pregnancy-related problem', 2, 0, 0, 0, { pregcomp: 1 }, 'preg'],
  ['Seizure', 1.2, .8, .8, -.8, { seiz: 5, ich: .4, withdrawal: .8 }, ''],
  ['Dizziness or fainting', 4, .5, 1.6, 0, { af: 2, stroke: .6, aki: .6, frail: 1, gastro: .5 }, ''],
  ['Road traffic collision', 3.4, 1.4, .6, -.6, { trauma: 3, fx: 2, ich: .5 }, 'inj'],
  ['Serious injury from a fall or assault', 2.2, .3, 1, -1.1, { trauma: 4, ich: 1.2, fx: 1.5 }, 'inj'],
  ['Rash or skin infection', 2.6, 3, .9, .8, { cellulitis: 5 }, ''],
  ['Eye problem', 1.3, 1, .8, 1, {}, ''],
  ['Vomiting blood or black stools', 1.3, 0, 1.6, -.6, { gib: 6 }, ''],
  ['Confusion', 1.8, 0, 3.5, -.3, { frail: 3, uti: 2, sepsis: 1.5, stroke: .8, aki: .8 }, ''],
  ['Palpitations', 2, 0, 1.2, -.1, { af: 5, cp: 1 }, ''],
  ['Swollen or painful leg', 2, 0, 1.3, .3, { vte: 3, cellulitis: 2, hf: 1 }, ''],
  ['High blood sugar', 1.2, .2, 1, -.2, { dka: 5 }, ''],
  ['Collapse, found unresponsive', .7, 0, 1.5, -1.8, { sepsis: 2, resp: 2, od: 2, mi: 1.5, ich: 1.5, stroke: 1 }, ''],
  ['Child with fever', 0, 16, 0, .3, { pinf: 1 }, 'resp'],
  ['Child with breathing difficulty', 0, 9, 0, -.4, { pasthma: 1 }, 'resp'],
  ['Earache', .8, 5, .3, 1.1, {}, ''],
  ['Toothache', 1.3, .5, .5, 1.2, {}, ''],
  ['Medication refill or minor request', 1.2, 0, 1, 1.5, {}, ''],
  ['Nosebleed', .8, .6, 1.6, .6, {}, ''],
];
const LEVEL_TEXT = ['', 'Immediate', 'Very urgent', 'Urgent', 'Standard', 'Non-urgent'];
const ED_HOUR_W = [0.45, 0.38, 0.32, 0.28, 0.27, 0.3, 0.42, 0.62, 0.9, 1.15, 1.35, 1.42, 1.4, 1.38, 1.35, 1.33, 1.32, 1.33, 1.35, 1.3, 1.18, 1.0, 0.8, 0.6];
const ED_DOW_W = [0.97, 1.08, 1.02, 1.0, 0.99, 0.98, 0.96];
const ED_MONTH_W = { 4: 1.0, 5: 1.0, 6: 1.02, 7: 1.04, 8: 1.02, 9: 1.0, 10: 1.04, 11: 1.09, 12: 1.1 };
const RESP_MONTH_W = { 4: 1.0, 5: .9, 6: .82, 7: .8, 8: .82, 9: 1.0, 10: 1.25, 11: 1.5, 12: 1.6 };
const INJ_MONTH_W = { 4: 1.0, 5: 1.08, 6: 1.15, 7: 1.18, 8: 1.15, 9: 1.05, 10: .98, 11: .94, 12: .92 };
const ED_PER_DAY = 207;

// ------------------------------------------------------------------ reference data: operating rooms and procedures
const ROOM_NAMES = ['OR 1', 'OR 2', 'OR 3', 'OR 4', 'OR 5', 'OR 6', 'OR 7', 'OR 8', 'OR 9', 'OR 10', 'OR 11', 'OR 12', 'Radiology suite', 'Heart cath lab'];
const BLOCK_TEMPLATE = {
  'OR 1': ['cardiac', 'cardiac', 'cardiac', 'cardiac', 'cardiac'],
  'OR 2': ['cardiac', 'thoracic', 'cardiac', 'thoracic', 'vascular'],
  'OR 3': ['neurosurgery', 'neurosurgery', 'neurosurgery', 'neurosurgery', 'neurosurgery'],
  'OR 4': ['neurosurgery', 'neurosurgery', 'ent', 'ent', 'plastics'],
  'OR 5': ['orthopaedics', 'orthopaedics', 'orthopaedics', 'orthopaedics', 'orthopaedics'],
  'OR 6': ['orthopaedics', 'orthopaedics', 'orthopaedics', 'orthopaedics', 'paediatric surgery'],
  'OR 7': ['general', 'general', 'general', 'general', 'general'],
  'OR 8': ['colorectal', 'colorectal', 'vascular', 'colorectal', 'general'],
  'OR 9': ['urology', 'gynaecology', 'urology', 'gynaecology', 'urology'],
  'OR 10': ['ophthalmology', 'plastics', 'ophthalmology', 'ent', 'gynaecology'],
  'Radiology suite': ['interventional radiology', 'interventional radiology', 'interventional radiology', 'interventional radiology', 'interventional radiology'],
  'Heart cath lab': ['cardiology', 'cardiology', 'cardiology', 'cardiology', 'cardiology'],
};
const SPEC = {
  // specialty: [label, service name, surgeons, default ward, default ICU]
  general: ['General surgery', 'General surgery', 5, 'sx', 'trauma'],
  colorectal: ['Bowel, liver and pancreas surgery', 'General surgery', 3, 'sx', 'trauma'],
  orthopaedics: ['Orthopaedics', 'Orthopaedics', 9, 'ortho', 'trauma'],
  neurosurgery: ['Neurosurgery', 'Neurosurgery', 5, 'sx', 'neuro'],
  cardiac: ['Heart surgery', 'Cardiac surgery', 4, 'card', 'cvicu'],
  thoracic: ['Chest surgery', 'Thoracic surgery', 2, 'sx', 'cvicu'],
  vascular: ['Blood vessel surgery', 'Vascular surgery', 3, 'sx', 'cvicu'],
  urology: ['Urology', 'Urology', 3, 'sx', 'trauma'],
  gynaecology: ['Gynaecology and obstetrics', 'Gynaecology', 4, 'sx', 'icu'],
  ent: ['Ear, nose and throat surgery', 'Ear, nose and throat', 3, 'sx', 'trauma'],
  plastics: ['Plastic surgery', 'Plastic surgery', 3, 'sx', 'trauma'],
  ophthalmology: ['Eye surgery', 'Ophthalmology', 3, 'sx', 'icu'],
  'paediatric surgery': ['Children\'s surgery', 'Paediatric surgery', 2, 'peds', 'icu'],
  transplant: ['Transplant surgery', 'Transplant', 3, 'tx', 'icu'],
  trauma: ['Trauma surgery', 'Trauma surgery', 3, 'sx', 'trauma'],
  'interventional radiology': ['Interventional radiology', 'Interventional radiology', 4, 'med', 'icu'],
  cardiology: ['Heart catheter procedures', 'Cardiology', 5, 'card', 'icu'],
};
const PROC = {};
function P(key, spec, name, tier, med, sg, pre, post, an, pInp, pIcu, postLos, w, pf, o) {
  PROC[key] = Object.assign({ key, spec, name, tier, med, sg, pre, post, an, pInp, pIcu, postLos, w, pf, ward: SPEC[spec][3], icu: SPEC[spec][4], suite: spec === 'interventional radiology' ? 'ir' : spec === 'cardiology' ? 'cath' : 'or' }, o || {});
}
P('lapchole', 'general', 'Keyhole gallbladder removal', 2, 62, .30, 22, 12, 'G', .15, 0, 1.3, 10, 'adult');
P('inghernia', 'general', 'Keyhole groin hernia repair', 1, 52, .30, 20, 10, 'G', .04, 0, 1, 8, 'adult');
P('venthernia', 'general', 'Open abdominal wall hernia repair', 2, 88, .35, 22, 12, 'G', .35, 0, 2.2, 5, 'adult');
P('thyroid', 'general', 'Removal of part or all of the thyroid gland', 3, 108, .28, 25, 12, 'G', .7, 0, 1.2, 4, 'adult');
P('lumpectomy', 'general', 'Breast lump removal', 1, 48, .30, 18, 10, 'G', .03, 0, 1, 6, 'F');
P('mastectomy', 'general', 'Breast removal (mastectomy)', 3, 118, .30, 24, 12, 'G', .85, 0, 1.8, 3, 'F');
P('sleeve', 'general', 'Keyhole weight-loss stomach surgery', 3, 92, .28, 28, 14, 'G', 1, .02, 1.6, 3, 'adult');
P('appy', 'general', 'Keyhole appendix removal', 2, 48, .32, 20, 10, 'G', 1, 0, 1.4, 0, 'adult');
P('laparotomy', 'general', 'Emergency open abdominal surgery', 4, 135, .45, 28, 15, 'G', 1, .35, 6.5, 0, 'adult');
P('abscess', 'general', 'Drainage of an abscess', 1, 24, .40, 15, 8, 'G', 1, 0, 1.5, 0, 'adult');
P('lapcolon', 'colorectal', 'Keyhole removal of part of the bowel', 4, 185, .32, 30, 15, 'G', 1, .05, 4.5, 6, 'adult');
P('opencolon', 'colorectal', 'Open removal of part of the bowel', 4, 205, .35, 30, 15, 'G', 1, .12, 6.5, 3, 'adult');
P('liver', 'colorectal', 'Removal of part of the liver', 5, 265, .33, 40, 15, 'G', 1, .5, 6, 1.5, 'adult');
P('whipple', 'colorectal', 'Removal of the head of the pancreas (Whipple operation)', 5, 395, .25, 45, 15, 'G', 1, .7, 9, 1, 'adult');
P('stoma', 'colorectal', 'Stoma reversal', 3, 98, .30, 25, 12, 'G', 1, 0, 3.5, 2.5, 'adult');
P('haemorrhoid', 'colorectal', 'Haemorrhoid surgery', 1, 34, .30, 15, 8, 'GR', .02, 0, 1, 3, 'adult');
P('thr', 'orthopaedics', 'Total hip replacement', 3, 92, .22, 30, 10, 'GR', 1, .01, 2.1, 9, 'old');
P('tkr', 'orthopaedics', 'Total knee replacement', 3, 98, .22, 30, 10, 'GR', 1, .01, 2.1, 9, 'old');
P('revhip', 'orthopaedics', 'Revision hip replacement', 5, 185, .30, 35, 12, 'G', 1, .08, 4.5, 1.2, 'old');
P('kneescope', 'orthopaedics', 'Keyhole knee surgery (arthroscopy)', 1, 38, .30, 18, 8, 'G', 0, 0, 1, 6, 'adult');
P('cuff', 'orthopaedics', 'Keyhole shoulder tendon repair', 2, 88, .28, 28, 10, 'GR', .05, 0, 1, 4, 'adult');
P('acl', 'orthopaedics', 'Knee ligament reconstruction', 2, 98, .25, 22, 10, 'G', .03, 0, 1, 3, 'young');
P('fusion', 'orthopaedics', 'Lower-back spinal fusion', 4, 225, .30, 40, 15, 'G', 1, .06, 3.8, 2, 'adult');
P('carpal', 'orthopaedics', 'Carpal tunnel release', 1, 19, .30, 10, 5, 'L', 0, 0, 1, 4, 'adult');
P('hipfix', 'orthopaedics', 'Hip fracture repair', 3, 78, .30, 30, 10, 'GR', 1, .03, 4.8, 0, 'old');
P('anklefix', 'orthopaedics', 'Ankle fracture fixation', 2, 82, .30, 24, 10, 'GR', 1, 0, 1.6, 0, 'adult');
P('wristfix', 'orthopaedics', 'Wrist fracture fixation', 2, 62, .30, 22, 8, 'GR', 1, 0, 1.2, 0, 'adult');
P('femurnail', 'orthopaedics', 'Thigh-bone fracture nailing', 3, 108, .30, 30, 12, 'G', 1, .1, 5, 0, 'adult');
P('crani', 'neurosurgery', 'Brain tumour removal (craniotomy)', 5, 255, .30, 50, 15, 'G', 1, .95, 4.5, 3, 'adult');
P('discectomy', 'neurosurgery', 'Removal of a slipped disc in the lower back', 3, 92, .30, 32, 12, 'G', .5, 0, 1.3, 5, 'adult');
P('acdf', 'neurosurgery', 'Neck spinal fusion from the front', 4, 148, .28, 35, 12, 'G', 1, .08, 1.8, 3.5, 'adult');
P('shunt', 'neurosurgery', 'Brain fluid shunt placement', 3, 78, .30, 30, 12, 'G', 1, .3, 2.5, 1.5, 'adult');
P('aneurysm', 'neurosurgery', 'Brain aneurysm clipping', 5, 295, .30, 55, 15, 'G', 1, 1, 6.5, .8, 'adult');
P('haematoma', 'neurosurgery', 'Emergency removal of a blood clot on the brain', 4, 108, .40, 25, 15, 'G', 1, .92, 7, 0, 'adult');
P('cabg', 'cardiac', 'Coronary artery bypass surgery', 5, 250, .20, 55, 20, 'G', 1, 1, 5.2, 6, 'old');
P('avr', 'cardiac', 'Aortic valve replacement', 5, 225, .22, 55, 20, 'G', 1, 1, 5.5, 2.5, 'old');
P('mvr', 'cardiac', 'Mitral valve repair', 5, 255, .22, 55, 20, 'G', 1, 1, 5.8, 1.6, 'adult');
P('cabgvalve', 'cardiac', 'Bypass and valve surgery combined', 5, 325, .22, 55, 20, 'G', 1, 1, 7.5, 1, 'old');
P('dissection', 'cardiac', 'Emergency repair of a torn main artery (aortic dissection)', 5, 375, .30, 40, 20, 'G', 1, 1, 10, 0, 'adult');
P('lobectomy', 'thoracic', 'Keyhole removal of a lung lobe', 4, 178, .28, 40, 15, 'G', 1, .15, 3.5, 4, 'old');
P('wedge', 'thoracic', 'Keyhole removal of a small piece of lung', 3, 88, .30, 35, 12, 'G', 1, .03, 2.2, 3, 'adult');
P('medscope', 'thoracic', 'Camera examination of the centre of the chest', 2, 48, .30, 25, 10, 'G', .1, 0, 1, 2, 'adult');
P('carotid', 'vascular', 'Clearing a narrowed neck artery', 4, 128, .25, 35, 12, 'G', 1, .1, 1.8, 3, 'old');
P('legbypass', 'vascular', 'Leg artery bypass', 4, 235, .30, 40, 15, 'G', 1, .1, 5.5, 2.5, 'old');
P('evar', 'vascular', 'Keyhole stent repair of an aortic aneurysm', 4, 145, .30, 40, 12, 'G', 1, .2, 2.2, 2, 'old');
P('fistula', 'vascular', 'Creating a dialysis access (fistula)', 2, 72, .30, 20, 8, 'R', .15, 0, 1, 4, 'adult');
P('bka', 'vascular', 'Below-knee amputation', 3, 82, .30, 30, 12, 'GR', 1, .05, 6.5, 1, 'old');
P('prostatectomy', 'urology', 'Robotic prostate removal', 4, 195, .22, 40, 15, 'G', 1, 0, 1.5, 4, 'Mold');
P('turbt', 'urology', 'Bladder tumour removal through the urethra', 2, 42, .35, 18, 10, 'G', .3, 0, 1.2, 6, 'old');
P('stone', 'urology', 'Kidney stone laser treatment', 2, 52, .35, 18, 10, 'G', .12, 0, 1, 7, 'adult');
P('nephrectomy', 'urology', 'Keyhole kidney removal', 4, 175, .28, 40, 15, 'G', 1, .04, 2.8, 2, 'adult');
P('turp', 'urology', 'Prostate reduction through the urethra', 2, 62, .30, 20, 10, 'GR', .75, 0, 1.5, 4, 'Mold');
P('laphyst', 'gynaecology', 'Keyhole womb removal (hysterectomy)', 3, 122, .28, 28, 12, 'G', .65, 0, 1.4, 6, 'F');
P('openhyst', 'gynaecology', 'Open womb removal (hysterectomy)', 3, 128, .30, 28, 12, 'G', 1, .01, 2.8, 2, 'F');
P('diaglap', 'gynaecology', 'Diagnostic keyhole pelvic surgery', 1, 42, .35, 20, 10, 'G', .03, 0, 1, 5, 'Fy');
P('ovcyst', 'gynaecology', 'Keyhole ovarian cyst removal', 2, 68, .30, 22, 10, 'G', .15, 0, 1, 4, 'Fy');
P('csplan', 'gynaecology', 'Planned caesarean birth', 2, 48, .20, 28, 8, 'R', 1, 0, 2.9, 5, 'Fpreg', { ward: 'ob' });
P('csemerg', 'gynaecology', 'Emergency caesarean birth', 3, 44, .28, 15, 8, 'R', 1, .01, 3.3, 0, 'Fpreg', { ward: 'ob' });
P('tonsil', 'ent', 'Tonsil removal', 1, 34, .30, 18, 10, 'G', .08, 0, 1, 7, 'kidmix');
P('fess', 'ent', 'Endoscopic sinus surgery', 2, 92, .30, 25, 12, 'G', .04, 0, 1, 5, 'adult');
P('grommet', 'ent', 'Ear tube (grommet) placement', 1, 14, .30, 10, 6, 'G', 0, 0, 1, 5, 'kid');
P('neckdiss', 'ent', 'Neck surgery for cancer with lymph node removal', 4, 235, .30, 40, 15, 'G', 1, .12, 4.5, 1.5, 'old');
P('cochlear', 'ent', 'Cochlear implant', 3, 128, .25, 30, 12, 'G', .4, 0, 1, 1.5, 'adult');
P('skinflap', 'plastics', 'Skin cancer removal with flap repair', 2, 68, .35, 15, 8, 'L', .03, 0, 1, 7, 'old');
P('diep', 'plastics', 'Breast reconstruction using the patient\'s own tissue', 5, 415, .25, 45, 15, 'G', 1, .3, 4.2, 1.2, 'F');
P('tendon', 'plastics', 'Hand tendon repair', 2, 58, .35, 22, 8, 'R', .05, 0, 1, 3, 'adult');
P('graft', 'plastics', 'Skin graft for a burn or wound', 2, 72, .35, 22, 10, 'G', .5, 0, 3, 3, 'adult');
P('cataract', 'ophthalmology', 'Cataract removal with lens implant', 1, 17, .25, 8, 4, 'L', 0, 0, 1, 14, 'old');
P('vitrectomy', 'ophthalmology', 'Retina repair (vitrectomy)', 2, 68, .30, 15, 8, 'L', .02, 0, 1, 3, 'old');
P('phernia', 'paediatric surgery', 'Child hernia repair', 1, 34, .30, 18, 10, 'G', .03, 0, 1, 5, 'kid');
P('orchid', 'paediatric surgery', 'Correction of an undescended testicle', 1, 44, .30, 18, 10, 'G', .02, 0, 1, 3, 'kidM');
P('pcirc', 'paediatric surgery', 'Child foreskin surgery', 1, 28, .30, 15, 8, 'G', 0, 0, 1, 3, 'kidM');
P('pappy', 'paediatric surgery', 'Child appendix removal', 2, 46, .30, 18, 10, 'G', 1, 0, 1.5, 0, 'kid');
P('ktx', 'transplant', 'Kidney transplant', 5, 205, .22, 40, 15, 'G', 1, .1, 6, 0, 'adult');
P('ltx', 'transplant', 'Liver transplant', 5, 410, .25, 55, 20, 'G', 1, 1, 11, 0, 'adult');
P('damage', 'trauma', 'Damage-control surgery after major injury', 5, 145, .50, 20, 15, 'G', 1, .9, 9, 0, 'adult');
P('biopsy', 'interventional radiology', 'Image-guided needle biopsy', 1, 32, .35, 10, 5, 'L', .03, 0, 1, 9, 'adult');
P('drain', 'interventional radiology', 'Image-guided drain placement', 1, 38, .35, 10, 5, 'S', .25, 0, 2.5, 2, 'adult');
P('embol', 'interventional radiology', 'Blocking a bleeding blood vessel (embolisation)', 3, 88, .40, 15, 8, 'S', 1, .3, 4, 0, 'adult');
P('thrombectomy', 'interventional radiology', 'Clot removal from a brain artery after a stroke', 4, 68, .40, 15, 10, 'G', 1, .9, 6, 0, 'adult', { icu: 'neuro' });
P('port', 'interventional radiology', 'Tunnelled line or port placement', 1, 38, .30, 10, 5, 'S', .02, 0, 1, 7, 'adult');
P('ablation', 'interventional radiology', 'Heat treatment of a liver tumour (ablation)', 3, 98, .30, 25, 12, 'G', .5, 0, 1.2, 2, 'old');
P('angio', 'cardiology', 'Diagnostic heart catheter (angiogram)', 1, 34, .35, 12, 6, 'S', .08, 0, 1, 9, 'old');
P('pci', 'cardiology', 'Planned coronary stent placement', 2, 58, .35, 12, 6, 'S', .3, 0, 1.1, 5, 'old');
P('pci_em', 'cardiology', 'Emergency coronary stent for a heart attack', 3, 52, .40, 8, 6, 'S', 1, .25, 3, 0, 'adult');
P('pacemaker', 'cardiology', 'Pacemaker implant', 2, 68, .30, 12, 6, 'S', .6, 0, 1.1, 4, 'old');
P('epablation', 'cardiology', 'Heart rhythm ablation', 3, 148, .30, 25, 10, 'GS', .4, 0, 1.1, 3, 'adult');
P('tavi', 'cardiology', 'Keyhole aortic valve replacement', 4, 108, .25, 25, 10, 'GS', 1, .15, 2.2, 2, 'old');

// true (hidden) duration model coefficients on the log scale
const DUR_MODEL = { age_per_decade_over_55: 0.012, bmi_per_5_over_27: 0.022, asa_per_class_over_2: 0.045, teaching_case: 0.045, add_on: 0.05, surgeon_procedure_sd: 0.05, complication_base_p: 0.025, complication_p_per_tier: 0.008, complication_multiplier: [1.35, 2.2], booking_estimate_noise_sd: 0.10, booking_uses_fraction_of_surgeon_effect: 0.7 };

// ------------------------------------------------------------------ names (invented, uncommon)
const GIVEN_F = ['Araminta', 'Belphoebe', 'Briseis', 'Calanthe', 'Cosima', 'Damaris', 'Delphine', 'Drusilla', 'Elowen', 'Endellion', 'Fenella', 'Ferelith', 'Galatea', 'Ginevra', 'Halcyon', 'Hesper', 'Illari', 'Isolde', 'Jocasta', 'Kerensa', 'Linnea', 'Lucasta', 'Maelys', 'Melisande', 'Nerys', 'Odalys', 'Orlaith', 'Ottoline', 'Perpetua', 'Quintessa', 'Rhosyn', 'Roswitha', 'Saffron', 'Seren', 'Sidonie', 'Tamsin', 'Theodosia', 'Undine', 'Venetia', 'Wilhelmina', 'Xanthe', 'Ysolde', 'Zenobia', 'Zephyrine', 'Bettrys', 'Demelza', 'Eluned', 'Gwendolen', 'Hyacinth', 'Ione', 'Jessamy', 'Morwenna', 'Rosamund', 'Sunniva', 'Tegwen', 'Viatrix'];
const GIVEN_M = ['Alaric', 'Anselm', 'Barnaby', 'Cadoc', 'Caspian', 'Crispin', 'Eamon', 'Emrys', 'Evander', 'Finlo', 'Florian', 'Gaius', 'Garrick', 'Hadrian', 'Ignatius', 'Jorvik', 'Kester', 'Lazarus', 'Leander', 'Lorcan', 'Marius', 'Merrick', 'Nicodemus', 'Oberon', 'Osric', 'Peregrine', 'Quillon', 'Rafferty', 'Septimus', 'Silvanus', 'Tavish', 'Thaddeus', 'Tiberius', 'Ulric', 'Valerian', 'Viggo', 'Wystan', 'Yestin', 'Zebedee', 'Aurelian', 'Corentin', 'Fabian', 'Lysander', 'Ozias', 'Piran', 'Ambrose', 'Balthazar', 'Cormac', 'Dunstan', 'Eldric'];
const FAM_A = ['Quill', 'Marrow', 'Thistle', 'Ember', 'Hollow', 'Wren', 'Fenn', 'Dusk', 'Larch', 'Sorrel', 'Briar', 'Tarn', 'Wick', 'Ost', 'Vane', 'Corv', 'Elder', 'Hazel', 'Pell', 'Rook', 'Sedge', 'Tamar', 'Umber', 'Yarrow', 'Zeph', 'Calder', 'Dray', 'Garn', 'Isk', 'Juni', 'Kestr', 'Lund', 'Morv', 'Neth', 'Orl', 'Pryd', 'Rusk', 'Syl', 'Thorn', 'Vesp', 'Alder', 'Brack', 'Cinder', 'Dapple'];
const FAM_B = ['mere', 'thwaite', 'wyn', 'holt', 'croft', 'vale', 'wick', 'stead', 'by', 'ander', 'ell', 'oway', 'marsh', 'fen', 'garth', 'lowe', 'ridge', 'combe', 'shaw', 'dene', 'rith', 'ock'];
const rN = new Rng('names');
function mkName(sex) { return [rN.pick(sex === 'F' ? GIVEN_F : GIVEN_M), rN.pick(FAM_A) + rN.pick(FAM_B)]; }

// ------------------------------------------------------------------ patients
const N_PAT = 40000;
const patients = [];
(function makePatients() {
  const r = new Rng('patients'); const used = new Set();
  const LANG = ['Spanish', 'Mandarin', 'Vietnamese', 'Arabic', 'Portuguese', 'Somali', 'Polish', 'Tagalog'];
  for (let i = 0; i < N_PAT; i++) {
    const g = r.u(); let age;
    if (g < .15) age = r.int(0, 15); else if (g < .40) age = r.int(16, 39); else if (g < .70) age = r.int(40, 64);
    else age = Math.min(101, Math.round(65 + Math.abs(r.norm(0, 10)) + r.uni(0, 5)));
    const sex = r.bern(.52) ? 'F' : 'M';
    const [given, family] = mkName(sex);
    let mrn; do { mrn = 'LX-' + pad(r.int(100000, 999999), 6); } while (used.has(mrn)); used.add(mrn);
    const dob = new Date(EPOCH + (N_DAYS - 1 - Math.floor(age * 365.25) - r.int(0, 364)) * 86400000).toISOString().slice(0, 10);
    const adult = age >= 18;
    const smoker = adult && r.bern(.17) ? 1 : 0;
    const htn = adult && r.bern(clamp(.02 + (age - 20) * .011, 0, .7)) ? 1 : 0;
    const dm = age > 30 && r.bern(clamp(.04 + (age - 30) * .0045, 0, .3)) ? 1 : 0;
    const hf = age > 45 && r.bern(clamp((age - 45) * .004, 0, .2)) ? 1 : 0;
    const copd = age > 40 && r.bern(clamp((age - 40) * .004 * (smoker ? 2.2 : 1), 0, .3)) ? 1 : 0;
    const ckd = age > 40 && r.bern(clamp((age - 40) * .004, 0, .2)) ? 1 : 0;
    const cancer = r.bern(.008 + Math.max(0, age - 20) * .0018) ? 1 : 0;
    const dementia = age > 65 && r.bern(clamp((age - 65) * .008, 0, .3)) ? 1 : 0;
    const depression = age >= 14 && r.bern(.13) ? 1 : 0;
    const asthma = r.bern(.09) ? 1 : 0;
    let ins; const x = r.u();
    if (age >= 65) ins = x < .86 ? 'medicare' : x < .94 ? 'commercial' : x < .97 ? 'medicaid' : 'other_government';
    else if (age < 18) ins = x < .5 ? 'commercial' : x < .93 ? 'medicaid' : x < .97 ? 'self_pay' : 'other_government';
    else ins = x < .56 ? 'commercial' : x < .80 ? 'medicaid' : x < .90 ? 'self_pay' : x < .96 ? 'other_government' : 'medicare';
    const dx = r.u(); const dist = r1(clamp(dx < .70 ? r.logn(7, .7) : dx < .92 ? r.logn(28, .5) : r.logn(95, .5), .4, 420));
    const interp = r.bern(.07) ? 1 : 0;
    const nsRE = r.norm(0, .75);
    const nChronic = htn + dm + hf + copd + ckd + cancer + dementia;
    patients.push({
      i, id: 'OPS-' + pad(i + 1, 6), mrn, given, family, sex, age, dob, ins, dist, interp, lang: interp ? r.pick(LANG) : 'English',
      smoker, htn, dm, hf, copd, ckd, cancer, dementia, depression, asthma, nChronic,
      bmi: adult ? r1(clamp(r.norm(28.5, 6), 16, 58)) : null, alone: age >= 65 ? (r.bern(.32) ? 1 : 0) : (adult && r.bern(.14) ? 1 : 0),
      portal: r.bern(age >= 75 ? .35 : .66) ? 1 : 0, priorAdm: r.pois(.12 * (1 + nChronic)),
      priorNS: r.pois(.45 * Math.exp(.8 * nsRE)), nsRE, nsCount: 0, okCount: 0,
      inHouse: false, dead: false, deathT: null, intervals: [], elective: false, apptDays: null,
    });
  }
})();
const POOL = { kid: [], kidM: [], adult: [], old: [], young: [], F: [], Fy: [], Fpreg: [], Mold: [] };
for (const p of patients) {
  if (p.age < 16) { POOL.kid.push(p); if (p.sex === 'M') POOL.kidM.push(p); }
  if (p.age >= 18) POOL.adult.push(p);
  if (p.age >= 50) POOL.old.push(p);
  if (p.age >= 16 && p.age <= 40) POOL.young.push(p);
  if (p.sex === 'F' && p.age >= 18) POOL.F.push(p);
  if (p.sex === 'F' && p.age >= 18 && p.age <= 50) POOL.Fy.push(p);
  if (p.sex === 'F' && p.age >= 18 && p.age <= 42) POOL.Fpreg.push(p);
  if (p.sex === 'M' && p.age >= 50) POOL.Mold.push(p);
}
function poolPick(r, key, free) {
  if (key === 'kidmix') key = r.bern(.6) ? 'kid' : 'young';
  const a = POOL[key] || POOL.adult;
  for (let k = 0; k < 80; k++) { const p = a[Math.floor(r.u() * a.length)]; if (p.dead) continue; if (free && p.inHouse) continue; return p; }
  return null;
}

// ------------------------------------------------------------------ staff
const staff = [];
function addStaff(role, dept, spec, r, extra) {
  const sex = rN.bern(.55) ? 'F' : 'M'; const [given, family] = mkName(sex);
  const s = Object.assign({ id: 'STF-' + pad(staff.length + 1, 5), given, family, role, dept, spec: spec || '', years: r.int(1, 32), fte: r.pick([1, 1, 1, 1, .8, .8, .6]), busyUntil: -1e9 }, extra || {});
  staff.push(s); return s;
}
const surgeons = {}, allSurgeons = [];
const anaesthetists = [], circDay = [], circNight = [], scrubDay = [], scrubNight = [];
const wardStaff = {};   // unit -> {charge:[], rn:[], na:[]}
const edDocs = [], hospitalists = [], pharmacists = [], bedManagers = [], frontDesk = [], orCoords = [], caseManagers = [], residents = [];
(function makeStaff() {
  const r = new Rng('staff');
  for (const spec of Object.keys(SPEC)) {
    surgeons[spec] = [];
    for (let k = 0; k < SPEC[spec][2]; k++) {
      const isProc = spec === 'cardiology' || spec === 'interventional radiology';
      const s = addStaff(isProc ? 'proceduralist' : 'surgeon', 'Operating rooms', SPEC[spec][0], r, {
        specKey: spec, eff: clamp(r.norm(0, .11), -.28, .28), pLate: clamp(r.norm(.2, .1), .03, .5), bias: clamp(r.norm(.97, .05), .84, 1.1),
        fill: r.uni(.8, 1.02), otTol: r.int(110, 200), pair: {}, leave: new Set(), blocks: {},
      });
      s.years = r.int(4, 32);
      surgeons[spec].push(s); allSurgeons.push(s);
    }
  }
  for (let k = 0; k < 44; k++) anaesthetists.push(addStaff('anaesthetist', 'Operating rooms', 'Anaesthesia', r));
  for (let k = 0; k < 44; k++) circDay.push(addStaff('circulating nurse', 'Operating rooms', 'Perioperative nursing', r));
  for (let k = 0; k < 8; k++) circNight.push(addStaff('circulating nurse', 'Operating rooms', 'Perioperative nursing (nights and weekends)', r));
  for (let k = 0; k < 44; k++) scrubDay.push(addStaff('scrub practitioner', 'Operating rooms', 'Perioperative nursing', r));
  for (let k = 0; k < 8; k++) scrubNight.push(addStaff('scrub practitioner', 'Operating rooms', 'Perioperative nursing (nights and weekends)', r));
  for (let k = 0; k < 6; k++) orCoords.push(addStaff('operating room coordinator', 'Operating rooms', '', r));
  for (const u of UNITS) {
    const w = wardStaff[u[0]] = { charge: [], rn: [], na: [] };
    const nRn = Math.ceil(u[3] / u[5] * 4.6), nNa = Math.ceil(u[3] / 9 * 4.2);
    for (let k = 0; k < 6; k++) w.charge.push(addStaff('charge nurse', u[1], '', r));
    for (let k = 0; k < nRn; k++) w.rn.push(addStaff('registered nurse', u[1], '', r));
    for (let k = 0; k < nNa; k++) w.na.push(addStaff('nursing assistant', u[1], '', r));
  }
  for (let k = 0; k < 28; k++) edDocs.push(addStaff('emergency physician', 'Emergency Department', 'Emergency medicine', r));
  for (let k = 0; k < 34; k++) hospitalists.push(addStaff('attending physician', 'Inpatient medicine', 'General medicine', r));
  for (let k = 0; k < 14; k++) addStaff('attending physician', 'Critical care', 'Intensive care medicine', r);
  for (let k = 0; k < 60; k++) residents.push(addStaff('resident physician', 'Graduate medical education', '', r));
  for (let k = 0; k < 16; k++) pharmacists.push(addStaff('pharmacist', 'Pharmacy', '', r));
  for (let k = 0; k < 8; k++) bedManagers.push(addStaff('bed manager', 'Patient flow', '', r));
  for (let k = 0; k < 14; k++) caseManagers.push(addStaff('case manager', 'Care coordination', '', r));
  for (let k = 0; k < 18; k++) frontDesk.push(addStaff('front desk coordinator', 'Outpatient clinics', '', r));
  for (let k = 0; k < 20; k++) addStaff('patient transporter', 'Support services', '', r);
  for (let k = 0; k < 26; k++) addStaff('environmental services', 'Support services', '', r);
  // surgeon leave weeks
  for (const s of allSurgeons) for (let w = weekOf(-WARM_DAYS); w <= weekOf(N_DAYS + COOL_DAYS); w++) if (r.bern(.055)) s.leave.add(w);
})();

// ------------------------------------------------------------------ block schedule
const rooms = ROOM_NAMES.map((name, i) => ({ name, i, kind: i < 10 ? 'main' : i < 12 ? 'addon' : i === 12 ? 'ir' : 'cath', lists: {}, list: null, pos: 0, state: 'idle', readyAt: -1e9, lastCase: null, elDay: null }));
const blocks = [];   // {id, room, dow, par, spec, surgeon, start, end}
(function makeBlocks() {
  const r = new Rng('blocks');
  const slots = {};
  for (const room of rooms) { const t = BLOCK_TEMPLATE[room.name]; if (!t) continue; for (let dw = 1; dw <= 5; dw++) (slots[t[dw - 1]] = slots[t[dw - 1]] || []).push({ room, dw }); }
  for (const spec of Object.keys(slots)) {
    const sl = slots[spec].sort((a, b) => a.dw - b.dw || a.room.i - b.room.i);
    let sg = surgeons[spec].slice();
    if (spec === 'orthopaedics') sg = sg.slice(0, 7);          // two orthopaedic trauma surgeons hold no elective blocks
    r.shuffle(sg);
    const shift = Math.max(1, Math.floor(sg.length / 2));
    sl.forEach((s, k) => {
      for (let par = 0; par < 2; par++) {
        const surgeon = sg[(k + (par ? shift : 0)) % sg.length];
        const start = (s.room.kind === 'ir' || s.room.kind === 'cath') ? 480 : (s.dw === 3 ? 510 : 450);
        const b = { room: s.room, dow: s.dw, par, spec, surgeon, start, end: 1020 };
        blocks.push(b); surgeon.blocks[s.dw + '-' + par] = b;
      }
    });
  }
  blocks.sort((a, b) => a.room.i - b.room.i || a.dow - b.dow || a.par - b.par);
  blocks.forEach((b, i) => { b.id = 'BLK-' + pad(i + 1, 3); });
  // procedure mix per surgeon
  for (const s of allSurgeons) {
    const procs = Object.values(PROC).filter(p => p.spec === s.specKey && p.w > 0);
    s.mixProcs = procs; s.mixW = procs.map(p => p.w * Math.exp(r.norm(0, .7)));
  }
})();
const blockFor = (room, d) => blocks.find(b => b.room === room && b.dow === dowOf(d) && b.par === parityOf(d));
function onCall(spec, t) {
  const cd = Math.floor((t - 420) / DAY), dw = dowOf(cd), par = parityOf(cd), wk = weekOf(cd);
  let list = surgeons[spec];
  if (spec === 'gynaecology' || spec === 'general' || spec === 'colorectal') list = surgeons[spec];
  let c = list.filter(s => !(isWorkday(cd) && s.blocks[dw + '-' + par]) && !s.leave.has(wk));
  if (!c.length) c = list.filter(s => !s.leave.has(wk)); if (!c.length) c = list;
  return c[(((cd + hashStr(spec)) % c.length) + c.length) % c.length];
}
const CALL_SPEC = { 'paediatric surgery': 'paediatric surgery' };

// ------------------------------------------------------------------ duration model
const rDur = new Rng('durations');
function anaesType(r, proc) {
  switch (proc.an) {
    case 'G': return 'general';
    case 'GR': return r.bern(.55) ? 'regional (spinal or nerve block)' : 'general';
    case 'R': return r.bern(.92) ? 'regional (spinal or nerve block)' : 'general';
    case 'S': return 'sedation';
    case 'GS': return r.bern(.5) ? 'general' : 'sedation';
    default: return 'local with sedation';
  }
}
function asaOf(r, p) { let a = 1 + (p.age > 50 ? 1 : 0) + (p.nChronic >= 2 ? 1 : 0) + (r.bern(.15) ? 1 : 0); if (p.age < 16) a = r.bern(.85) ? 1 : 2; return clamp(a, 1, 4); }
function pairEff(s, proc) { if (s.pair[proc.key] == null) s.pair[proc.key] = rDur.norm(0, DUR_MODEL.surgeon_procedure_sd); return s.pair[proc.key]; }
function estimateCase(c, r) {
  const s = c.surgeon, proc = c.proc;
  const est = Math.exp(Math.log(proc.med) + DUR_MODEL.booking_uses_fraction_of_surgeon_effect * s.eff) * s.bias * Math.exp(r.norm(0, DUR_MODEL.booking_estimate_noise_sd));
  c.estProc = Math.max(10, Math.round(est / 5) * 5);
  c.estRoom = Math.round((c.estProc + proc.pre + proc.post) / 5) * 5;
}
function trueDuration(c) {
  const s = c.surgeon, proc = c.proc, p = c.p, r = rDur;
  let mu = Math.log(proc.med) + s.eff + pairEff(s, proc);
  if (p.age >= 16) mu += DUR_MODEL.age_per_decade_over_55 * (p.age - 55) / 10;
  if (p.bmi != null) mu += DUR_MODEL.bmi_per_5_over_27 * (p.bmi - 27) / 5;
  mu += DUR_MODEL.asa_per_class_over_2 * (c.asa - 2);
  if (c.teaching) mu += DUR_MODEL.teaching_case;
  if (c.addon) mu += DUR_MODEL.add_on;
  const z = r.norm();
  const comp = r.bern(DUR_MODEL.complication_base_p + DUR_MODEL.complication_p_per_tier * (proc.tier - 1));
  const mult = comp ? r.uni(DUR_MODEL.complication_multiplier[0], DUR_MODEL.complication_multiplier[1]) : 1;
  c.trueMu = mu; c.z = z; c.complication = comp ? 1 : 0; c.compMult = mult;
  const procMin = Math.max(6, Math.round(Math.exp(mu + proc.sg * z) * mult));
  const pre = Math.max(4, Math.round(r.logn(proc.pre, .28)));
  const post = Math.max(3, Math.round(r.logn(proc.post, .35)));
  return { pre, proc: procMin, post };
}

// ------------------------------------------------------------------ elective schedule (built before the simulation, like a real booking system)
const cases = [];
(function buildElective() {
  const r = new Rng('orsched');
  const DAYOF = [['Patient did not attend', .011], ['Patient unwell on the day', .011], ['Not fasted or medicines not stopped', .006], ['Abnormal test results, work-up incomplete', .005], ['Equipment or implant unavailable', .003], ['Surgeon unavailable', .002]];
  const BEFORE = [['Patient cancelled', .4], ['Found unfit at pre-operative assessment', .25], ['Funding or authorisation not confirmed', .12], ['Hospital rescheduled for capacity', .13], ['Surgeon unavailable', .1]];
  for (let d = -WARM_DAYS; d < N_DAYS + COOL_DAYS; d++) {
    if (!isWorkday(d)) continue;
    for (const room of rooms) {
      const b = blockFor(room, d); if (!b) continue;
      const sg = b.surgeon; if (sg.leave.has(weekOf(d))) continue;
      const blockLen = b.end - b.start, target = blockLen * sg.fill * r.uni(.88, 1.05);
      const list = []; let used = 0, misses = 0;
      while (misses < 4 && list.length < 16) {
        const proc = r.wpick(sg.mixProcs, sg.mixW);
        const c = { addon: false, day: d, room, block: b, proc, surgeon: sg, status: 'scheduled' };
        estimateCase(c, r);
        const planTurn = proc.tier >= 5 ? 40 : proc.an === 'L' ? 15 : 30;
        const need = c.estRoom + (list.length ? planTurn : 0);
        if (used + need > target && !(list.length === 0) && !(used + need - target < 25 && r.bern(.35))) { misses++; continue; }
        const p = (() => { for (let k = 0; k < 40; k++) { const q = poolPick(r, proc.pf, false); if (q && !q.elective) return q; } return null; })();
        if (!p) { misses++; continue; }
        p.elective = true; c.p = p; c.planTurn = planTurn;
        c.cls = r.bern(proc.pInp) ? 'inpatient' : 'day_surgery';
        c.needICU = c.cls === 'inpatient' && r.bern(proc.pIcu);
        c.icuUnit = proc.icu; c.ward = (p.age < 16 && c.cls === 'inpatient') ? 'peds' : proc.ward;
        c.asa = asaOf(r, p); c.anaes = anaesType(r, proc); c.teaching = r.bern(.55) ? 1 : 0;
        c.bookedT = d * DAY + 600 - Math.round(clamp(r.logn(24, .6), 3, 150)) * DAY - r.int(0, 400);
        c.sortKey = (p.age < 16 ? -10 : 0) - proc.tier + r.norm(0, 1.3);
        list.push(c); used += need;
        if (used > target) break;
      }
      if (!list.length) continue;
      list.sort((a, b2) => a.sortKey - b2.sortKey);
      let t = d * DAY + b.start;
      list.forEach((c, k) => {
        c.seq = k + 1; c.schedStart = t; c.schedEnd = t + c.estRoom; t = c.schedEnd + c.planTurn;
        const x = r.u();
        if (x < .032) { c.status = 'cancelled_before'; c.cancelReason = r.wpick(BEFORE.map(e => e[0]), BEFORE.map(e => e[1])); c.cancelT = c.day * DAY + 600 - r.int(1, 4) * DAY + r.int(-120, 300); }
        else { let acc = .032; for (const e of DAYOF) { acc += e[1] * (c.p.age < 16 && e[0].includes('unwell') ? 2 : 1); if (x < acc) { c.preCancel = e[0]; break; } } }
        cases.push(c);
      });
      room.lists[d] = list;
    }
  }
})();

// =====================================================================================================
//                                   DISCRETE-EVENT SIMULATION
// =====================================================================================================
let NOW = -WARM_DAYS * DAY;
const HEAP = []; let SEQ = 0;
function push(t, fn, a, b) {
  t = Math.round(t); if (t < NOW) t = NOW;
  const e = [t, SEQ++, fn, a, b]; let i = HEAP.length; HEAP.push(e);
  while (i > 0) { const p = (i - 1) >> 1; if (HEAP[p][0] < e[0] || (HEAP[p][0] === e[0] && HEAP[p][1] < e[1])) break; HEAP[i] = HEAP[p]; i = p; }
  HEAP[i] = e;
}
function pop() {
  const top = HEAP[0], last = HEAP.pop();
  if (HEAP.length) {
    let i = 0; const n = HEAP.length;
    for (;;) {
      let c = 2 * i + 1; if (c >= n) break;
      if (c + 1 < n && (HEAP[c + 1][0] < HEAP[c][0] || (HEAP[c + 1][0] === HEAP[c][0] && HEAP[c + 1][1] < HEAP[c][1]))) c++;
      if (last[0] < HEAP[c][0] || (last[0] === HEAP[c][0] && last[1] < HEAP[c][1])) break;
      HEAP[i] = HEAP[c]; i = c;
    }
    HEAP[i] = last;
  }
  return top;
}

const rS = new Rng('stays'), rB = new Rng('beds'), rE = new Rng('ed'), rO = new Rng('or'), rA = new Rng('arrivals');

// ---- beds
const unit = {}; const beds = [];
for (const u of UNITS) {
  const U = unit[u[0]] = { id: u[0], name: u[1], code: u[2], n: u[3], kind: u[4], ratioDay: u[5], ratioNight: u[6], beds: [], free: [], queue: [] };
  if (U.kind === 'ed') continue;
  for (let k = 1; k <= U.n; k++) {
    const b = { id: U.code + '-' + pad(k, 3), unit: U.id, type: U.kind === 'icu' ? 'intensive care' : 'ward', room: U.code + '-' + pad(Math.ceil(k / (U.kind === 'icu' || U.id === 'haem' || U.id === 'tx' || U.id === 'psych' ? 1 : 2)), 2), status: 'clean', enc: null };
    U.beds.push(b); U.free.push(b); beds.push(b);
  }
}
const edSpaces = [];
(function () {
  const mk = (id, type) => { const s = { id, unit: 'ed', type, v: null, freeAt: -1e9, room: id }; edSpaces.push(s); unit.ed.beds.push(s); };
  for (let k = 1; k <= 4; k++) mk('ED-R' + k, 'resuscitation bay');
  for (let k = 1; k <= 36; k++) mk('ED-B' + pad(k, 2), 'treatment bay');
  for (let k = 1; k <= 8; k++) mk('ED-FT' + k, 'fast-track chair');
  for (let k = 1; k <= 12; k++) mk('ED-H' + pad(k, 2), 'hallway space');
})();
const OVER_INTO = {};
for (const a of Object.keys(OVERFLOW)) for (const b of OVERFLOW[a]) (OVER_INTO[b] = OVER_INTO[b] || []).push(a);

const encs = [];      // inpatient encounters
const dayEncs = [];   // day-surgery encounters
const edVisits = [];
const adt = [];
const reqs = [];
const stays = [];
let warnCount = 0; const WARN = {}; const warn = k => { warnCount++; WARN[k] = (WARN[k] || 0) + 1; };

function newInpatient(p, src, t) {
  const e = { type: 'inpatient', p, admitT: Math.round(t), src, stays: [], cases: [], bed: null, req: null, dcVer: 0, awaitingOR: 0, dischargeT: null, dispo: null, MR: null, hadBed: false };
  encs.push(e); p.inHouse = true; return e;
}
function drawDispo(p, dxKey, elective) {
  const d = DX[dxKey] || {};
  if (dxKey === 'labour' || dxKey === 'pregcomp' || p.age < 16) return rS.bern(.985) ? 'home' : 'transfer_other_hospital';
  if (d.u === 'psych') { const x = rS.u(); return x < .8 ? 'home' : x < .92 ? 'transfer_other_hospital' : 'against_medical_advice'; }
  const age = p.age; const big = (dxKey === 'hipfx' || dxKey === 'stroke' || dxKey === 'frail' || dxKey === 'trauma' || dxKey === 'ich');
  let snf = clamp(.015 + (age - 60) * .006, .008, .3) * (big ? 2.2 : 1) * (elective ? .5 : 1);
  let rehab = .015 + (big ? .12 : 0) + (elective && age > 65 ? .03 : 0);
  let hh = .07 + (age > 65 ? .1 : 0);
  let hospice = (age > 70 ? .022 : .005) * (dxKey === 'onc' ? 3 : 1) * (elective ? .1 : 1);
  let ama = (age < 55 ? .016 : .006) * (dxKey === 'withdrawal' || dxKey === 'od' ? 5 : 1) * (elective ? .1 : 1);
  let tr = .012;
  const x = rS.u(); let a = snf; if (x < a) return 'skilled_nursing_facility';
  a += rehab; if (x < a) return 'rehabilitation_facility';
  a += hh; if (x < a) return 'home_with_services';
  a += hospice; if (x < a) return 'hospice';
  a += ama; if (x < a) return 'against_medical_advice';
  a += tr; if (x < a) return 'transfer_other_hospital';
  return 'home';
}
const DET_TYPES = ['sepsis', 'respiratory', 'bleeding', 'cardiac', 'neurological'];
function drawDet(enc, pdet, forceDeath) {
  const u = enc.wardUnit; if (!ADULT_WARDS.has(u)) return null;
  if (!forceDeath && !rS.bern(pdet)) return null;
  const w = u === 'card' ? [1, 2, 1, 4, .5] : (u === 'sx' || u === 'ortho') ? [3, 2, 3, 1.5, .6] : (u === 'haem' || u === 'tx') ? [5, 2, 1.5, 1, .4] : [3.5, 3, 1, 1.5, .8];
  const x = rS.u();
  return { type: rS.wpick(DET_TYPES, w), frac: rS.uni(.12, .8), ramp: Math.round(rS.uni(6, 30) * 60), mag: rS.uni(.6, 1.2), sEnd: rS.uni(.55, 1), outcome: forceDeath ? 'death' : x < .55 ? 'icu_transfer' : x < .955 ? 'ward_managed' : 'death' };
}
function planStay(enc, dxKey, level) {
  const d = DX[dxKey], p = enc.p;
  enc.dx = dxKey; enc.dxName = d.n; enc.svc = d.svc; enc.wardUnit = d.u; enc.icuUnit = d.iu || 'icu'; enc.level = level;
  let picu = d.picu || 0;
  if (level === 1) picu = Math.min(.95, picu * 3 + .25); else if (level === 2) picu = Math.min(.9, picu * 1.4); else if (level >= 3) picu *= .45;
  if (p.age < 16 || d.u === 'ob' || d.u === 'psych') picu = 0;
  enc.icuFirst = rS.bern(picu);
  const adj = .006 * (Math.max(p.age, 18) - 60) + .05 * Math.min(p.nChronic, 4) + ((dowOf(Math.floor(enc.admitT / DAY)) % 6 === 0) ? .04 : 0);
  enc.wardLos = Math.max(.3 * DAY, Math.round(rS.logn(d.los * Math.exp(adj), d.sg) * DAY));
  enc.icuLos = enc.icuFirst ? Math.max(.4 * DAY, Math.round(rS.logn(ICU_LOS[enc.icuUnit], .75) * DAY)) : 0;
  const mort = clamp(d.mort * (1 + .025 * Math.max(0, p.age - 60)) * (enc.icuFirst ? 2.2 : .3), 0, .6);
  const dead = rS.bern(mort);
  enc.dieICU = dead && enc.icuFirst && rS.bern(.7);
  const dieWard = dead && !enc.dieICU;
  enc.dispoPlan = dead ? 'expired' : drawDispo(p, dxKey, false);
  const pdet = .05 * (d.det || 0) * (1 + .02 * Math.max(0, p.age - 60)) * (1 + .15 * Math.min(p.nChronic, 4));
  enc.det = enc.dieICU ? null : drawDet(enc, pdet, dieWard);
  if (dieWard && !enc.det) { enc.dispoPlan = drawDispo(p, dxKey, false); }
}
function planElective(enc, c) {
  const p = enc.p, proc = c.proc;
  enc.dx = 'elective'; enc.dxName = 'Planned surgery: ' + SPEC[proc.spec][0].toLowerCase(); enc.svc = SPEC[proc.spec][1];
  enc.wardUnit = c.ward; enc.icuUnit = c.icuUnit; enc.icuFirst = c.needICU; enc.level = 0;
  enc.icuLos = c.needICU ? Math.max(.4 * DAY, Math.round(rS.logn(ICU_LOS[c.icuUnit] * .8, .6) * DAY)) : 0;
  const adj = .005 * (Math.max(p.age, 18) - 60) + .04 * Math.min(p.nChronic, 4) + (c.complication ? .35 : 0);
  enc.wardLos = Math.max(.3 * DAY, Math.round(rS.logn(proc.postLos * Math.exp(adj) * (c.needICU ? .75 : 1), .42) * DAY));
  const dead = rS.bern(.0015 * proc.tier * (1 + .03 * Math.max(0, p.age - 60)) * (c.complication ? 3 : 1));
  enc.dieICU = dead && c.needICU; const dieWard = dead && !enc.dieICU;
  enc.dispoPlan = dead ? 'expired' : (c.ward === 'ob' ? 'home' : drawDispo(p, proc.key === 'thr' || proc.key === 'tkr' ? 'elective_joint' : 'elective', true));
  if (!dead && (proc.key === 'thr' || proc.key === 'tkr' || proc.key === 'revhip') && rS.bern(.1)) enc.dispoPlan = 'rehabilitation_facility';
  enc.det = enc.dieICU ? null : drawDet(enc, .035 * (proc.tier / 3) * (1 + .02 * Math.max(0, p.age - 60)) * (c.complication ? 2.5 : 1), dieWard);
  if (dieWard && !enc.det) enc.dispoPlan = 'home';
}

// ---- bed requests / assignment
function requestBed(enc, uid, prio, kind, reason, notBefore) {
  const req = { enc, unit: uid, unit0: uid, prio, kind, reason, reqT: NOW, notBefore: notBefore == null ? -1e9 : notBefore, bed: null, assignT: null, moveT: null, ovOK: false, done: false, fromED: !!(enc.edVisit && !enc.hadBed) };
  enc.req = req; reqs.push(req); unit[uid].queue.push(req);
  if (OV_WAIT[uid] != null) push(NOW + OV_WAIT[uid], evOverflow, req);
  dispatch(uid);
  return req;
}
function dispatch(uid) {
  const U = unit[uid];
  while (U.free.length) {
    let best = null;
    for (const q of U.queue) if (!best || q.prio < best.prio || (q.prio === best.prio && q.reqT < best.reqT)) best = q;
    if (!best) { const src = OVER_INTO[uid]; if (src) for (const v of src) for (const q of unit[v].queue) if (q.ovOK && (!best || q.reqT < best.reqT)) best = q; }
    if (!best) break;
    assign(best, U.free.shift());
  }
}
function evOverflow(req) {
  if (req.bed || req.cancelled) return;
  req.ovOK = true;
  for (const v of OVERFLOW[req.unit] || []) if (unit[v].free.length && unit[v].queue.length === 0) { assign(req, unit[v].free.shift()); return; }
}
function assign(req, bed) {
  const q = unit[req.unit].queue; const i = q.indexOf(req); if (i >= 0) q.splice(i, 1);
  bed.status = 'reserved'; req.bed = bed; req.assignT = NOW;
  const lead = req.prio === 0 ? rB.int(6, 18) : req.reason === 'ed_admission' ? clamp(Math.round(rB.logn(50, .5)), 15, 180) : rB.int(14, 42);
  req.moveT = Math.round(Math.max(NOW + lead, req.notBefore));
  push(req.moveT, evArrive, req);
  const v = req.enc.edVisit;
  if (v && v.departT == null && !req.enc.leftED && !req.enc.hadBed) { req.enc.leftED = true; push(req.moveT - 8, evEdDepart, v); }
}
function vacate(bed, t, stay) {
  bed.enc = null; bed.status = 'dirty';
  const hr = (t % DAY + DAY) % DAY / 60;
  const cs = Math.round(t + rB.logn(12, .7) + ((hr >= 6.5 && hr < 8) || (hr >= 18.5 && hr < 20) ? 12 : 0) + (hr < 6 ? 8 : 0));
  const ce = cs + rB.int(24, 44) + (unit[bed.unit].kind === 'icu' ? 14 : 0) + (rB.bern(.08) ? rB.int(20, 40) : 0);
  stay.cleanS = cs; stay.cleanE = ce;
  push(ce, evClean, bed);
}
function evClean(bed) { bed.status = 'clean'; unit[bed.unit].free.push(bed); dispatch(bed.unit); }
function evArrive(req) {
  const enc = req.enc, bed = req.bed, t = NOW;
  req.done = true;
  if (enc.dischargeT != null) { // should not happen; release bed
    warn('w1'); bed.status = 'clean'; unit[bed.unit].free.push(bed); dispatch(bed.unit); return;
  }
  const from = enc.bed; let prevStay = null;
  if (from) { prevStay = enc.stays[enc.stays.length - 1]; prevStay.tout = t; vacate(from, t, prevStay); }
  const first = !enc.hadBed;
  if (first && (enc.src === 'direct' || enc.src === 'transfer_in' || enc.src === 'clinic')) enc.admitT = t;
  bed.status = 'occ'; bed.enc = enc; enc.bed = bed; enc.hadBed = true; if (enc.req === req) enc.req = null;
  const st = { bed, enc, tin: t, tout: null, cleanS: null, cleanE: null }; enc.stays.push(st); stays.push(st);
  const v = enc.edVisit;
  adt.push({
    enc, type: first ? 'admit' : 'transfer', reason: req.reason, reqT: req.reqT, assignT: req.assignT, t,
    fromUnit: from ? from.unit : (enc.src === 'emergency' ? (req.case || enc.viaOR ? 'periop' : 'ed') : enc.src === 'elective' ? 'periop' : 'outside'),
    fromBed: from ? from.id : (enc.src === 'emergency' && !(req.case || enc.viaOR) && v && v.space ? v.space.id : ''),
    toUnit: bed.unit, toBed: bed.id, reqUnit: req.unit0, prevStay,
  });
  if (req.case) req.case.pacuOut = Math.max(req.case.wheelsOut + (req.case.needICU ? 0 : 5), t - 8);
  if (first) enc.firstBedT = t;
  // progression
  if (unit[bed.unit].kind === 'icu') {
    const start = enc.icuClock != null ? enc.icuClock : t; enc.icuClock = null;
    let tEnd = Math.max(t + 360, start + enc.icuLos);
    if (!enc.dieICU) tEnd = alignWindow(tEnd, 510, 840);
    enc.dcVer++; push(tEnd, evIcuDone, enc, enc.dcVer);
  } else wardArrive(enc);
}
function alignWindow(t, a, b) { const d = Math.floor(t / DAY), c = t - d * DAY; if (c < a) return d * DAY + a + rS.int(0, b - a); if (c > b) return (d + 1) * DAY + a + rS.int(0, b - a); return t; }
function icuFor(enc) { if (enc.icuUnit && enc.icuUnit !== 'icu') return enc.icuUnit; const u = enc.wardUnit; if (u === 'sx' || u === 'ortho') return rS.bern(.6) ? 'trauma' : 'icu'; return 'icu'; }
function wardArrive(enc) {
  const t = NOW, bed = enc.bed;
  let rem = enc.wardLos;
  if (enc.wardClock != null) { rem = Math.max(enc.wardLos - (t - enc.wardClock), 480); enc.wardClock = null; }
  if (unit[bed.unit].queue.length >= 4) rem = Math.round(rem * .9);
  let MR = t + rem;
  const d = enc.det;
  if (d && !d.sched) {
    const onset = t + d.frac * rem, ev = onset + d.ramp;
    if (ev < MR - 120 || d.outcome === 'death') {
      d.sched = true; d.onsetT = Math.round(onset); d.eventT = Math.round(ev); d.unit = bed.unit;
      push(d.eventT, evDet, enc);
      if (d.outcome === 'ward_managed') { MR = Math.max(MR, ev + rS.uni(1, 3) * DAY); scheduleDischarge(enc, MR); }
      else { enc.MR = Math.round(MR); enc.dcVer++; }
      return;
    }
    enc.det = null;
  }
  scheduleDischarge(enc, MR);
}
function evDet(enc) {
  const d = enc.det; if (!d || enc.dischargeT != null) return;
  d.fired = true;
  if (d.outcome === 'icu_transfer') {
    enc.icuLos = Math.max(.4 * DAY, Math.round(rS.logn(2.2, .7) * DAY)); enc.wardLos = Math.max(.5 * DAY, Math.round(rS.logn(3.0, .5) * DAY));
    enc.dieICU = rS.bern(.17); if (enc.dieICU) enc.dispoPlan = 'expired';
    enc.dcVer++; enc.icuClock = null;
    if (enc.req) { warn('w2'); return; }
    requestBed(enc, icuFor(enc), 0, 'transfer', 'deterioration', (enc.orUntil == null ? -1e9 : enc.orUntil));
  } else if (d.outcome === 'death') {
    push(Math.max(NOW + rS.int(5, 90), (enc.orUntil == null ? -1e9 : enc.orUntil)), evDeath, enc);
  }
}
function evDeath(enc) { if (enc.dischargeT == null && enc.bed) discharge(enc, NOW, 'expired'); }
function evIcuDone(enc, ver) {
  if (enc.dischargeT != null || ver !== enc.dcVer || !enc.bed) return;
  if (enc.orUntil != null && enc.orUntil > NOW) { push(enc.orUntil + 60, evIcuDone, enc, ver); return; }
  if (enc.dieICU) { discharge(enc, NOW, 'expired'); return; }
  if (enc.req) return;
  enc.wardClock = NOW;
  requestBed(enc, enc.wardUnit, 3, 'transfer', 'icu_stepdown', (enc.orUntil == null ? -1e9 : enc.orUntil));
}
function dcClock(u) { return rS.bern(DBN_W[u] || .12) ? clamp(rS.norm(640, 45), 450, 715) : clamp(rS.norm(900, 125), 450, 1350); }
function dischargeTime(enc, MR) {
  const u = enc.bed.unit, dp = enc.dispoPlan;
  let place = 0;
  if (dp === 'skilled_nursing_facility' || dp === 'rehabilitation_facility') place = rS.bern(.45) ? rS.int(1, 3) : 0;
  else if (dp === 'home_with_services') place = rS.bern(.12) ? 1 : 0;
  enc.placeDelay = place;
  let day = Math.floor(MR / DAY); if (MR - day * DAY > 19 * 60) day++;
  for (let g = 0; g < 90; g++) {
    const dw = dowOf(day);
    if (place > 0) { place--; day++; continue; }
    if ((dw === 0 || dw === 6) && rS.bern((dw === 0 ? .28 : .2) + (dp === 'skilled_nursing_facility' ? .3 : 0))) { day++; continue; }
    let c = 0, cand = 0;
    for (let k = 0; k < 4; k++) { c = dcClock(u); cand = day * DAY + c; if (cand >= MR + 30) break; }
    if (cand < MR + 30) cand = MR + 30 + rS.uni(0, 90);
    return Math.round(cand);
  }
  return Math.round(MR + DAY);
}
function scheduleDischarge(enc, MR) {
  enc.MR = Math.round(MR);
  const t = dischargeTime(enc, MR);
  enc.dcVer++; enc.dcDeferred = false;
  push(Math.max(t, NOW + 30), evDischarge, enc, enc.dcVer);
}
function evDischarge(enc, ver) {
  if (ver !== enc.dcVer || enc.dischargeT != null) return;
  if (enc.awaitingOR > 0) { enc.dcDeferred = true; return; }
  if (enc.req || !enc.bed) { warn('w3'); return; }
  if (enc.orUntil && enc.orUntil > NOW) { push(enc.orUntil + 240, evDischarge, enc, ver); return; }
  discharge(enc, NOW, enc.dispoPlan === 'expired' ? 'home' : enc.dispoPlan);
}
function discharge(enc, t, dispo) {
  const p = enc.p, bed = enc.bed, st = enc.stays[enc.stays.length - 1];
  enc.dischargeT = t; enc.dispo = dispo;
  let orderT = null;
  if (dispo !== 'expired') { orderT = Math.max(t - Math.round(rS.logn(150, .5)), st.tin + 20, Math.floor(t / DAY) * DAY + 360); if (orderT > t - 15) orderT = t - 15; if (enc.MR != null && enc.MR > orderT) enc.MR = orderT; }
  enc.orderT = orderT;
  st.tout = t; vacate(bed, t, st); enc.bed = null;
  adt.push({ enc, type: 'discharge', reason: dispo === 'expired' ? 'death' : 'discharge', reqT: orderT, assignT: null, t, fromUnit: bed.unit, fromBed: bed.id, toUnit: '', toBed: '', reqUnit: '', prevStay: st });
  p.inHouse = false; p.intervals.push([enc.edVisit ? enc.edVisit.arr : enc.admitT, t, 'inpatient']); p.lastOut = t;
  if (dispo === 'expired') { p.dead = true; p.deathT = t; return; }
  if (dispo === 'transfer_other_hospital' || dispo === 'hospice') return;
  // planned return (readmission pathway)
  const d = DX[enc.dx] || { ra: .5 };
  let lg = -3.0 + Math.log(d.ra || .5) + .25 * Math.min(p.nChronic, 4) + .012 * (Math.max(p.age, 18) - 60) + (dispo === 'skilled_nursing_facility' ? .25 : 0) + (dispo === 'against_medical_advice' ? .9 : 0) + .25 * Math.min(p.priorAdm, 3) + ((t - enc.admitT) > 7 * DAY ? .2 : 0);
  if (enc.dx === 'elective') lg += -.2;
  const pr = 1 / (1 + Math.exp(-lg));
  enc.pReadmit = pr;
  if (rS.bern(pr)) {
    const days = clamp(1 + rS.exp(9), 1, 30);
    push(t + days * DAY + rS.int(-300, 300), evEdArrive, { p, forced: true, dx: (DX[enc.dx] && rS.bern(.6)) ? enc.dx : null, admitP: .88 });
  }
}

// ---- emergency department
const edWait = [];
const edAlias = [];
for (const p of patients) { let w = 1 + Math.min(p.nChronic, 3); if (p.age < 16) w = 2; if (p.age >= 16 && p.age < 40) w = 2; if (rA.bern(.02)) w *= 5; for (let k = 0; k < w; k++) edAlias.push(p.i); }
function pickEdPatient() { for (let k = 0; k < 80; k++) { const p = patients[edAlias[Math.floor(rE.u() * edAlias.length)]]; if (!p.inHouse && !p.dead) return p; } return null; }
const LVL_CUT = [-2.257, -0.834, 0.418, 1.572];
function triageVitals(v) {
  const L = v.level, p = v.p, tag = v.ccTag, r = rE; const kid = p.age < 16;
  const fever = /[Ff]ever|Cough|skin infection/.test(v.cc);
  let hr = r.norm(82 + (3 - L) * 7 + (kid ? 26 - p.age : 0) + (fever ? 10 : 0), 13);
  let rr = r.norm(17 + (3 - L) * 1.8 + (tag === 'resp' ? 3.5 : 0) + (kid ? 6 - p.age * .3 : 0), 2.8);
  let sbp = r.norm(131 - (kid ? 30 - p.age : 0) + (p.htn ? 8 : 0), 19);
  if (L === 1 && r.bern(.35)) sbp = r.norm(84, 10);
  let temp = r.norm(36.9, .4) + (fever ? Math.abs(r.norm(1.1, .7)) : 0);
  let spo2 = 98 - Math.abs(r.norm(0, 1.4)) - (tag === 'resp' ? Math.abs(r.norm(1.5, 2.5)) : 0) - (L <= 2 ? Math.abs(r.norm(1, 2.5)) : 0) - (p.copd ? 2 : 0);
  const painBase = /pain|injury|Headache|Cut|Sprain|Toothache|Earache|collision/.test(v.cc) ? 6 : 2;
  let gcs = 15; if (L === 1) gcs = r.bern(.6) ? r.int(3, 13) : 15; else if (/Confusion|Collapse|Seizure|intoxication/.test(v.cc) && r.bern(.5)) gcs = r.int(11, 14);
  v.hr = Math.round(clamp(hr, 35, 190)); v.rr = Math.round(clamp(rr, 8, 48)); v.sbp = Math.round(clamp(sbp, 60, 230)); v.dbp = Math.round(clamp(v.sbp * .6 + r.norm(2, 7), 35, 130));
  v.temp = r1(clamp(temp, 34.5, 41)); v.spo2 = Math.round(clamp(spo2, 72, 100)); v.pain = clamp(Math.round(r.norm(painBase, 2.2)), 0, 10); v.gcs = gcs;
}
function evEdArrive(spec) {
  const t = NOW; let p;
  if (spec && spec.p) { p = spec.p; if (p.inHouse || p.dead) return; } else p = pickEdPatient();
  if (!p) return;
  p.inHouse = true;
  const v = { p, arr: t, forced: spec || null, space: null, departT: null, inp: null };
  edVisits.push(v);
  const day = Math.floor(t / DAY), mo = monthOf(day), kid = p.age < 16, old = p.age >= 65;
  // complaint
  let cc = null;
  if (spec && spec.dx) { const c = CC.filter(e => e[5][spec.dx] != null && (kid ? e[2] > 0 : e[1] > 0)); if (c.length) cc = rE.pick(c); }
  if (!cc) {
    const w = CC.map(e => { let x = kid ? e[2] : e[1] * (old ? e[3] : 1); if (e[6] === 'preg' && !(p.sex === 'F' && p.age >= 16 && p.age <= 45)) x = 0; if (e[6] === 'resp') x *= RESP_MONTH_W[mo]; if (e[6] === 'inj') x *= INJ_MONTH_W[mo]; return x; });
    cc = rE.wpick(CC, w);
  }
  v.cc = cc[0]; v.ccTag = cc[6]; v.ccDx = cc[5];
  // arrival mode
  const x = rE.u(); const amb = .11 + (old ? .14 : 0) + (cc[4] < -.4 ? .22 : 0);
  v.mode = x < .004 ? 'helicopter' : x < .004 + amb ? 'ambulance' : x < .014 + amb ? 'police' : x < .03 + amb ? 'transfer from another facility' : 'walk-in';
  const z = rE.norm() + cc[4] * .8 + (old ? -.15 : 0) + (kid ? .15 : 0) + (v.mode === 'ambulance' ? -.6 : v.mode === 'helicopter' ? -2.4 : 0) + (spec && spec.forced ? -.5 : 0) + .2;
  let L = 5; for (let k = 0; k < 4; k++) if (z < LVL_CUT[k]) { L = k + 1; break; }
  v.level = L;
  triageVitals(v);
  v.triageT = L === 1 ? t + 1 : t + 2 + Math.round(rE.logn(7, .6) * (1 + edWait.length / 25));
  const pat = L <= 2 ? 0 : 35 + rE.exp(L === 3 ? 720 : L === 4 ? 350 : 250);
  edWait.push(v);
  if (pat > 0) push(t + pat, evLwbs, v);
  edDispatch();
}
function edFree(type) { let n = 0; for (const s of edSpaces) if (s.type === type && !s.v && s.freeAt <= NOW) n++; return n; }
function edGet(type) { for (const s of edSpaces) if (s.type === type && !s.v && s.freeAt <= NOW) return s; return null; }
function edDispatch() {
  if (!edWait.length) return;
  const key = v => (v.level === 1 ? 0 : v.level === 2 ? 1e7 : 2e7) + v.arr + (v.level >= 4 ? 30 : 0);
  edWait.sort((a, b) => key(a) - key(b) || a.arr - b.arr);
  const hr = (NOW % DAY + DAY) % DAY / 60, ftOpen = hr >= 8;
  for (let i = 0; i < edWait.length; i++) {
    const v = edWait[i], w = NOW - v.arr; let s = null;
    if (v.level === 1) s = edGet('resuscitation bay') || edGet('treatment bay') || edGet('hallway space') || edGet('fast-track chair');
    else if (v.level === 2) s = edGet('treatment bay') || (edFree('resuscitation bay') >= 2 ? edGet('resuscitation bay') : null) || edGet('hallway space');
    else if (v.level === 3) s = edGet('treatment bay') || (w > 45 ? edGet('hallway space') : null);
    else s = (ftOpen ? edGet('fast-track chair') : null) || (edFree('treatment bay') >= (ftOpen ? 5 : 2) ? edGet('treatment bay') : null) || (w > 120 && edFree('hallway space') >= 4 ? edGet('hallway space') : null);
    if (s) { edWait.splice(i, 1); i--; edPlace(v, s); }
  }
}
const WORKUP = [0, 150, 215, 200, 85, 48];
function edPlace(v, s) {
  const t = NOW, p = v.p, L = v.level;
  s.v = v; v.space = s; v.roomedT = t;
  if (v.triageT > t) v.triageT = Math.min(v.triageT, t + rE.int(1, 4));
  let load = 0; for (const x of edSpaces) if (x.v) load++;
  v.loadAtRoom = load;
  const hr = (t % DAY + DAY) % DAY / 60;
  const docWait = L === 1 ? 1 : L === 2 ? rE.logn(6, .6) : rE.logn(17, .7) * (1 + Math.max(0, load - 36) / 30) * (hr < 7 ? 1.3 : 1);
  v.docT = Math.round(Math.max(t + 1, Math.max(t, v.triageT) + docWait - (v.triageT > t ? 2 : 0)));
  const workup = Math.round(rE.logn(WORKUP[L], .5) * (1 + Math.max(0, load - 42) / 60));
  // disposition
  const kid = p.age < 16, old = p.age >= 65;
  const dxKeys = Object.keys(v.ccDx).filter(k => v.ccDx[k] > 0);
  let pAd = [0, .78, .46, .225, .03, .004][L] * (dxKeys.length ? 1 : .15) * (old ? 1.35 : kid ? .8 : 1) * (1 + .05 * Math.min(p.nChronic, 4));
  if (v.forced && v.forced.admitP) pAd = Math.max(pAd, v.forced.admitP);
  pAd = Math.min(pAd, .96);
  const x = rE.u();
  const pLeave = .010 + (v.ccTag === 'mh' ? .045 : 0);
  if (L === 1 && rE.bern(.05)) { v.dispo = 'died'; v.decisionT = v.docT + Math.round(workup * .5); }
  else if (x < pLeave && L >= 2) { v.dispo = 'left_against_advice'; v.decisionT = v.docT + Math.round(workup * rE.uni(.2, .9)); }
  else if (rE.bern(pAd)) {
    v.dispo = 'admitted'; v.decisionT = v.docT + workup;
    let dx;
    if (v.forced && v.forced.dx && DX[v.forced.dx]) dx = v.forced.dx;
    else if (kid) dx = v.ccTag === 'inj' || v.cc === 'Abdominal pain' ? 'pinj' : /breathing|Cough/.test(v.cc) ? 'pasthma' : rE.bern(.75) ? 'pinf' : 'pchronic';
    else {
      const ks = dxKeys.length ? dxKeys : ['gastro'];
      const w = ks.map(k => v.ccDx[k] || 1);
      if (v.cc === 'Fall or injury to an arm or leg' && old) { ks.push('hipfx'); w.push(4); }
      dx = rE.wpick(ks, w);
      if (dx === 'nf' && !p.cancer) dx = 'sepsis';
      if (dx === 'pregcomp' && rE.bern(.35)) dx = 'labour';
    }
    if (kid && DX[dx].u !== 'peds') dx = 'pinf';
    v.dx = dx;
  }
  else if (L <= 3 && rE.bern(.013)) { v.dispo = 'transferred'; v.decisionT = v.docT + workup; }
  else { v.dispo = 'discharged'; v.decisionT = v.docT + workup; }
  push(v.decisionT, evEdDecision, v);
}
function evEdDecision(v) {
  const p = v.p, t = NOW;
  if (v.dispo === 'admitted') {
    const enc = { type: 'inpatient', p, admitT: t, src: 'emergency', stays: [], cases: [], bed: null, req: null, dcVer: 0, awaitingOR: 0, dischargeT: null, dispo: null, MR: null, hadBed: false };
    planStay(enc, v.dx, v.level);
    const target = enc.icuFirst ? enc.icuUnit : enc.wardUnit;
    if (unit[target].queue.length >= DIVERT[target] && rE.bern(.6)) { v.dispo = 'transferred'; v.diverted = 1; push(t + rE.logn(150, .5), evEdDepart, v); return; }
    encs.push(enc); enc.edVisit = v; v.inp = enc; enc.req0 = target;
    enc.icuClock = t; enc.wardClock = enc.icuFirst ? null : t;
    planAddon(enc);
    requestBed(enc, target, 2, 'admit', 'ed_admission', null);
  } else if (v.dispo === 'discharged') push(t + 5 + rE.exp(22), evEdDepart, v);
  else if (v.dispo === 'transferred') push(t + rE.logn(150, .5), evEdDepart, v);
  else if (v.dispo === 'died') push(t + rE.int(30, 90), evEdDepart, v);
  else push(t + 1, evEdDepart, v);
}
function evEdDepart(v) {
  if (v.departT != null) return;
  const t = NOW, s = v.space, p = v.p;
  v.departT = t; s.v = null; s.freeAt = t + rE.int(6, 14); push(s.freeAt, edDispatch);
  if (!v.inp) {
    p.inHouse = false; p.intervals.push([v.arr, t, 'emergency']); p.lastOut = t;
    if (v.dispo === 'died') { p.dead = true; p.deathT = t; }
    else if (v.dispo === 'discharged' && p.age >= 16 && (v.cc === 'Fall or injury to an arm or leg' || v.cc === 'Sprain or minor injury') && rE.bern(.045)) {
      // ambulatory fracture: comes back for a booked add-on day-surgery fixation
      const dd = Math.floor(t / DAY) + rE.int(1, 5);
      push(dd * DAY + 390, evAddonReq, { p, proc: rE.bern(.55) ? 'wristfix' : 'anklefix', cls: 'expedited', amb: true });
    }
  }
}
function evLwbs(v) {
  if (v.space || v.departT != null) return;
  const i = edWait.indexOf(v); if (i < 0) return; edWait.splice(i, 1);
  v.dispo = 'left_without_being_seen'; v.departT = NOW; v.p.inHouse = false; v.p.intervals.push([v.arr, NOW, 'emergency']); v.p.lastOut = NOW;
  if (v.triageT > NOW) v.triageT = null;
}

// ---- direct admissions
const DIRECT = [
  // dx (or list), per weekday, per weekend day, hours ('any' | 'day'), source, patient pool, level-equivalent, priority
  [['labour'], 11.2, 11.2, 'any', 'direct', 'Fpreg', 0, 2],
  [['chemo'], 2.3, .3, 'day', 'direct', 'cancer', 0, 4],
  [['sct'], .22, 0, 'day', 'direct', 'cancer', 0, 4],
  [['ktx'], .62, .62, 'any', 'direct', 'adult', 0, 4],
  [['ltx'], .3, .3, 'any', 'direct', 'adult', 0, 4],
  [['pchronic', 'pinf', 'pasthma'], 4.6, 2.2, 'day', 'direct', 'kid', 0, 4],
  [['depr', 'psychosis'], 1.6, .9, 'day', 'transfer_in', 'adult', 0, 4],
  [['stroke', 'ich', 'mi', 'sepsis', 'resp', 'trauma', 'gib', 'hf', 'onc', 'txcomp', 'trauma', 'txcomp'], 4.4, 3.8, 'any', 'transfer_in', 'adult', 2, 4],
  [['hf', 'cellulitis', 'aki', 'pna', 'af', 'onc', 'txcomp', 'pregcomp'], 2.6, .2, 'day', 'clinic', 'adult', 0, 4],
];
POOL.cancer = patients.filter(p => p.cancer && p.age >= 18);
function evDirect(spec) {
  const dx = rA.pick(spec[0]);
  let pool = spec[5]; if (dx === 'pregcomp') pool = 'Fpreg'; if (dx === 'onc') pool = 'cancer';
  const p = poolPick(rA, pool, true); if (!p) return;
  const d = DX[dx];
  const tmp = { type: 'inpatient', p, admitT: NOW, src: spec[4], stays: [], cases: [], bed: null, req: null, dcVer: 0, awaitingOR: 0, dischargeT: null, dispo: null, MR: null, hadBed: false };
  planStay(tmp, dx, spec[6]);
  const target = tmp.icuFirst ? tmp.icuUnit : tmp.wardUnit;
  if (spec[4] !== 'direct' && unit[target].queue.length >= 3) return;          // transfer declined, no capacity
  if (dx !== 'labour' && unit[target].queue.length >= 8) return;               // admission postponed
  encs.push(tmp); p.inHouse = true; tmp.firstReqT = NOW;
  planAddon(tmp);
  requestBed(tmp, target, spec[7], 'admit', spec[4] === 'transfer_in' ? 'transfer_in' : 'direct_admission', null);
}
function evHour(h) {
  const t = h * 60, day = Math.floor(h / 24), hr = ((h % 24) + 24) % 24, dw = dowOf(day), mo = monthOf(day);
  if (t >= T_STOP) return;
  const n = rA.pois(ED_PER_DAY / 24 * ED_HOUR_W[hr] / 0.9625 * ED_DOW_W[dw] * ED_MONTH_W[mo]);
  for (let k = 0; k < n; k++) push(t + rA.int(0, 59), evEdArrive, null);
  const wd = isWorkday(day);
  for (const s of DIRECT) {
    const perDay = wd ? s[1] : s[2]; let rate;
    if (s[3] === 'day') rate = (hr >= 9 && hr < 18) ? perDay / 9 : 0; else rate = perDay / 24;
    const m = rA.pois(rate);
    for (let k = 0; k < m; k++) push(t + rA.int(0, 59), evDirect, s);
  }
  if (hr === 6) push(t + 40, evDayOpen, day);
  if (hr === 7) push(t + 1, tryAddons);
  push(t + 60, evHour, h + 1);
}

// ---- operating rooms
const aoQ = { or: [], ir: [], cath: [] };
const CLS_RANK = { emergent: 0, urgent: 1, expedited: 2 };
function planAddon(enc) {
  const d = DX[enc.dx]; if (!d || !d.ao) return;
  if (!rO.bern(d.ao[1])) return;
  const key = Array.isArray(d.ao[0]) ? rO.pick(d.ao[0]) : d.ao[0];
  enc.awaitingOR++;
  if (enc.det) { if (enc.det.outcome === 'death') enc.dispoPlan = drawDispo(enc.p, enc.dx, false); enc.det = null; }
  push(NOW + rO.uni(d.ao[3], d.ao[4]) * 60, evAddonReq, { enc, p: enc.p, proc: key, cls: d.ao[2] });
}
function evAddonReq(spec) {
  const enc = spec.enc || null, p = spec.p;
  if (enc && enc.dischargeT != null) return;
  if (!enc && (p.dead)) return;
  const proc = PROC[spec.proc];
  const sg = onCall(proc.spec === 'gynaecology' ? 'gynaecology' : proc.spec, NOW);
  const prep = spec.cls === 'emergent' ? rO.int(10, 25) : spec.cls === 'urgent' ? rO.int(30, 90) : rO.int(45, 150);
  const c = { addon: true, cls0: spec.cls, amb: !!spec.amb, proc, surgeon: sg, p, enc, reqT: NOW, readyT: NOW + prep, status: 'requested', day: null, room: null };
  c.cls = spec.amb ? 'day_surgery' : 'inpatient';
  c.needICU = !spec.amb && ((enc && enc.icuFirst && !enc.hadBed) || rO.bern(proc.pIcu));
  c.icuUnit = proc.icu; c.ward = enc ? enc.wardUnit : proc.ward;
  c.asa = clamp(asaOf(rO, p) + (spec.cls === 'emergent' ? 1 : 0), 1, 5); c.anaes = anaesType(rO, proc); c.teaching = rO.bern(.5) ? 1 : 0;
  estimateCase(c, rO);
  cases.push(c); aoQ[proc.suite].push(c);
  if (enc) enc.cases.push(c);
  push(Math.max(NOW, c.readyT - 20), tryAddons);
}
function tryAddons() { for (const i of [10, 11, 12, 13, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) if (rooms[i].state === 'idle') roomNext(rooms[i]); }
function evDayOpen(day) {
  for (const room of rooms) { const l = room.lists[day]; if (l) { room.list = l; room.pos = 0; if (room.state === 'idle') roomNext(room); } }
}
function evRoomNext(room, ver) { if (ver !== room.ver) return; roomNext(room); }
function pickAddon(room, el) {
  const q = room.kind === 'ir' ? aoQ.ir : room.kind === 'cath' ? aoQ.cath : aoQ.or;
  if (!q.length) return null;
  const t = NOW, day = Math.floor(t / DAY), hr = (t - day * DAY) / 60, wk = isWorkday(day);
  let best = null;
  for (const c of q) {
    if (c.readyT > t + 25) continue;
    if (c.cls0 === 'expedited' && !(hr >= 7 && hr < 22)) continue;
    if (room.kind === 'main') {
      if (!(wk && hr >= 7.5 && hr < 16.5)) continue;
      if (el) { if (c.cls0 !== 'emergent' || rooms[10].state === 'idle' || rooms[11].state === 'idle') continue; }
      else if (c.cls0 !== 'emergent' && hr >= 15.5) continue;
    } else if (room.kind !== 'addon') {
      if (el && c.cls0 === 'expedited') continue;
    }
    if (!best || CLS_RANK[c.cls0] < CLS_RANK[best.cls0] || (CLS_RANK[c.cls0] === CLS_RANK[best.cls0] && c.reqT < best.reqT)) best = c;
  }
  if (best) { q.splice(q.indexOf(best), 1); if (el && room.kind !== 'addon') best.bump = true; }
  return best;
}
function roomNext(room) {
  room.state = 'idle';
  for (;;) {
    const list = room.list; let el = list && room.pos < list.length ? list[room.pos] : null;
    if (el && el.status === 'cancelled_before') { room.pos++; continue; }
    const ao = pickAddon(room, el);
    if (ao) { if (startCase(room, ao)) return; continue; }
    if (!el) return;
    room.pos++;
    if (startCase(room, el)) return;
  }
}
function cancelCase(c, reason, t) {
  c.status = c.addon ? 'cancelled_addon' : 'cancelled_day_of'; c.cancelReason = reason;
  if (c.addon) c.cancelT = t;
  else c.cancelT = /attend|unwell|fasted|test results|admitted/.test(reason) ? Math.min(t, c.schedStart - rO.int(10, 100)) : /Equipment|Surgeon/.test(reason) ? c.schedStart - rO.int(20, 180) : t;
  if (c.addon && c.enc) { const e = c.enc; e.awaitingOR = Math.max(0, e.awaitingOR - 1); if (e.dcDeferred && e.dischargeT == null && e.bed) scheduleDischarge(e, NOW); }
}
function anaesFor(room, t) {
  const day = Math.floor(t / DAY), hr = (t - day * DAY) / 60, wk = weekOf(day);
  const n = anaesthetists.length; const callStart = (((wk * 8) % n) + n) % n;
  if (isWorkday(day) && hr >= 6.5 && hr < 18.5) {
    const idx = (((room.i + day * 5) % (n - 8)) + (n - 8)) % (n - 8);
    return anaesthetists[(callStart + 8 + idx) % n];
  }
  const sh = Math.floor((t - 390) / 720);
  return anaesthetists[(callStart + ((((sh * 4 + room.i % 4) % 8) + 8) % 8)) % n];
}
function nurseTeam(room, t) {
  const day = Math.floor(t / DAY), hr = (t - day * DAY) / 60;
  if (isWorkday(day) && hr >= 6.5 && hr < 18.5) { const i = (((room.i + day * 3) % 44) + 44) % 44; return [circDay[i], scrubDay[(i + 7) % 44]]; }
  const sh = Math.floor((t - 390) / 720); const j = (((sh * 4 + room.i % 4) % 8) + 8) % 8; return [circNight[j], scrubNight[j]];
}
function startCase(room, c) {
  const t = NOW, el = !c.addon; let p = c.p;
  if (el) {
    if (c.preCancel) { cancelCase(c, c.preCancel, t); return false; }
    if ((p.dead || p.inHouse) && rO.bern(.8)) {   // the booking office had already replaced a patient who was in hospital
      const q = poolPick(rO, c.proc.pf, true);
      if (q && !q.elective && (q.age < 16) === (p.age < 16)) { q.elective = true; c.p = p = q; c.asa = asaOf(rO, q); }
    }
    if (p.dead || p.inHouse) { cancelCase(c, 'Patient unwell or admitted with another problem', t); return false; }
  } else {
    if (c.enc && (c.enc.dischargeT != null)) { cancelCase(c, 'Patient condition changed, operation no longer needed', t); return false; }
    if (!c.enc && (p.dead || p.inHouse)) { cancelCase(c, 'Patient unwell or admitted with another problem', t); return false; }
  }
  const sg = c.surgeon;
  const an = (c.anaes === 'general' || c.anaes.startsWith('regional') || room.kind === 'main' || room.kind === 'addon') ? anaesFor(room, Math.max(t, el ? c.schedStart : t)) : null;
  const first = el && room.elDay !== c.day;
  let base, patReady, equipReady = -1e9, patReason = '';
  if (el) {
    base = first ? c.schedStart + rO.int(-4, 4) : c.schedStart - 30;
    const x = rO.u();
    if (first) patReady = x < .10 ? c.schedStart + 3 + Math.round(rO.exp(16)) : c.schedStart - 30;
    else patReady = x < .06 ? c.schedStart + Math.round(rO.uni(-10, 35)) : c.schedStart - rO.int(35, 90);
    patReason = rO.wpick(['Patient arrived late', 'Pre-operative work-up incomplete', 'Awaiting transport to the operating room'], c.cls === 'inpatient' ? [3, 3, 2] : [5, 3, 0]);
    if (rO.bern(.03)) equipReady = Math.max(t, room.readyAt, c.schedStart - 10) + rO.int(8, 40);
  } else {
    base = Math.max(t, c.readyT); patReady = c.readyT;
    const rq = c.enc && c.enc.req; if (rq && rq.bed && !rq.done) patReady = Math.max(patReady, rq.moveT + 20);
  }
  const roomReady = room.readyAt, surgFree = sg.busyUntil, anFree = an ? an.busyUntil : -1e9;
  const hard = Math.max(base, patReady, equipReady, roomReady, surgFree, anFree, t);
  let soft = 0, softReason = '';
  if (el && first) { if (rO.bern(sg.pLate)) { soft = 3 + Math.round(rO.exp(13)); softReason = 'Surgeon arrived late'; } else if (rO.bern(.09)) { soft = 3 + Math.round(rO.exp(9)); softReason = 'Anaesthesia team delay'; } }
  else if (el) { if (rO.bern(.10)) { soft = 3 + Math.round(rO.exp(9)); softReason = rO.bern(.5) ? 'Surgeon not immediately available' : 'Anaesthesia team delay'; } }
  else if (rO.bern(.25)) { soft = Math.round(rO.exp(12)); softReason = 'Team assembling for add-on case'; }
  const S = Math.round(hard + soft);
  if (el) {
    const blockEnd = c.day * DAY + c.block.end;
    if (!first && S + c.estRoom > blockEnd + sg.otTol) { cancelCase(c, 'Insufficient operating time, list overran', t); return false; }
    if (c.cls === 'inpatient') {
      if (c.needICU) {
        const iu = unit[c.icuUnit]; let avail = iu.free.length - iu.queue.length;
        for (const v of OVERFLOW[c.icuUnit] || []) avail += Math.max(0, unit[v].free.length - unit[v].queue.length - 1);
        if (avail <= 0 && rO.bern(.75)) { cancelCase(c, 'No intensive care bed available', t); return false; }
      } else if (unit[c.ward].queue.length >= 6 && rO.bern(.2)) { cancelCase(c, 'No ward bed available', t); return false; }
    }
  }
  const dur = trueDuration(c);
  c.status = 'completed'; c.room = room; c.first = first ? 1 : 0;
  c.wheelsIn = S; c.anReady = S + Math.round(dur.pre * .65); c.incision = S + dur.pre; c.closure = c.incision + dur.proc; c.wheelsOut = c.closure + dur.post;
  c.anaesthetist = an; const team = nurseTeam(room, S); c.circ = team[0]; c.scrub = team[1];
  sg.busyUntil = c.wheelsOut; if (an) an.busyUntil = c.wheelsOut + 5;
  const turn = Math.round(rO.logn(c.proc.tier >= 4 ? 34 : c.cls === 'day_surgery' ? 22 : 27, .35)) + (rO.bern(.05) ? rO.int(15, 45) : 0);
  c.turnAfter = turn;
  c.prevInRoom = (room.lastCase && room.lastCase.wheelsOut > S - 600) ? room.lastCase : null;
  room.readyAt = c.wheelsOut + turn; room.state = 'busy'; room.lastCase = c; if (el) room.elDay = c.day;
  room.ver = (room.ver || 0) + 1;
  push(room.readyAt, evRoomNext, room, room.ver);
  push(c.wheelsOut, evCaseOut, c);
  // hidden truth about the start
  c.tr = { room: roomReady, surgeon: surgFree, anaes: anFree, patient: patReady, equip: equipReady, soft, softReason };
  if (el) {
    c.earliest = Math.max(c.schedStart, patReady, equipReady, roomReady, surgFree, anFree);
    c.delay = S - c.schedStart; c.delayReason = '';
    if (c.delay > 5) {
      const comps = [['room', roomReady], ['surgeon', surgFree], ['anaes', anFree], ['patient', patReady], ['equip', equipReady]];
      let mx = comps[0]; for (const x of comps) if (x[1] > mx[1]) mx = x;
      const hardDelay = Math.max(0, mx[1] - c.schedStart);
      if (soft > 0 && soft >= hardDelay) { c.delayReason = softReason; c.binding = 'discretionary'; }
      else {
        c.binding = mx[0];
        if (mx[0] === 'room') { const pv = c.prevInRoom; c.delayReason = pv && pv.bump ? 'Bumped by emergency case' : pv && (pv.addon || pv.wheelsOut > pv.schedEnd + 5 || pv.wheelsIn > pv.schedStart + 5) ? 'Previous case ran over' : 'Slow room turnover'; }
        else if (mx[0] === 'surgeon') c.delayReason = 'Surgeon busy in another case';
        else if (mx[0] === 'anaes') c.delayReason = 'Anaesthetist busy in another case';
        else if (mx[0] === 'patient') c.delayReason = patReason;
        else c.delayReason = 'Equipment or instruments not ready';
      }
    }
  } else { c.earliest = hard; c.day = Math.floor(S / DAY); }
  // patient side
  c.pacuMin = c.needICU ? 0 : Math.round(rO.logn(c.anaes === 'general' ? 78 : c.anaes.startsWith('regional') ? 70 : 38, .35));
  if (el || !c.enc) {
    const arrive = Math.min(S, Math.max(Math.min(S - 45, (el ? c.schedStart : S) - rO.int(80, 140)), p.lastOut == null ? -1e9 : p.lastOut + 5));
    c.pclass = c.cls === 'inpatient' ? 'same_day_admission' : 'day_surgery';
    let enc;
    if (c.cls === 'inpatient') { enc = newInpatient(p, 'elective', arrive); planElective(enc, c); }
    else { enc = { type: 'day_surgery', p, admitT: arrive, dischargeT: null, svc: SPEC[c.proc.spec][1], dxName: 'Day surgery: ' + SPEC[c.proc.spec][0].toLowerCase(), cases: [] }; dayEncs.push(enc); p.inHouse = true; }
    c.enc = enc; enc.cases.push(c);
  } else {
    const enc = c.enc, rq = enc.req;
    c.pclass = enc.hadBed ? 'inpatient' : (enc.edVisit ? 'emergency' : 'inpatient');
    enc.orUntil = c.wheelsOut + c.pacuMin + 10;
    if (rq && !rq.bed) {
      enc.viaOR = true;
      rq.notBefore = c.wheelsOut + (c.needICU ? 10 : c.pacuMin);
      rq.case = c;
      if (c.needICU && unit[rq.unit].kind !== 'icu') {
        const q = unit[rq.unit].queue; q.splice(q.indexOf(rq), 1);
        rq.unit = rq.unit0 = c.icuUnit; rq.prio = 1; rq.ovOK = false; rq.reqT = NOW; rq.reason = 'post_operative'; unit[c.icuUnit].queue.push(rq);
        enc.icuFirst = true; enc.icuClock = null; enc.icuLos = Math.max(.4 * DAY, Math.round(rS.logn(ICU_LOS[c.icuUnit], .7) * DAY));
        push(NOW + OV_WAIT[c.icuUnit], evOverflow, rq); dispatch(c.icuUnit);
      }
      if (enc.edVisit && !enc.leftED) { enc.leftED = true; push(Math.max(t, S - 10), evEdDepart, enc.edVisit); }
    }
  }
  return true;
}
function evCaseOut(c) {
  const enc = c.enc, t = NOW, pacuReady = t + c.pacuMin, postLos = Math.round(rS.logn(c.proc.postLos, .4) * DAY);
  c.pacuIn = c.needICU ? null : t + 3; c.pacuReady = c.needICU ? null : pacuReady;
  if (enc.type === 'day_surgery') { c.pacuOut = pacuReady; c.dest = 'home'; push(pacuReady + rO.int(30, 90), evDayDc, enc); return; }
  if (!c.addon) {
    if (c.needICU) { c.dest = c.icuUnit; const r = requestBed(enc, c.icuUnit, 1, 'admit', 'post_operative', t + 10); r.case = c; }
    else { c.dest = c.ward; push(Math.max(t, pacuReady - 20), evPostopReq, c); }
    return;
  }
  enc.awaitingOR = Math.max(0, enc.awaitingOR - 1);
  const rq = enc.req;
  if (rq && !rq.done) {            // still waiting for (or travelling to) a first bed: request already carries notBefore
    c.dest = rq.unit0; if (!rq.case) rq.case = c;
    enc.wardLos = Math.max(enc.wardLos, postLos); if (enc.wardClock != null) enc.wardClock = t;
    if (rq.bed && !c.pacuOut) c.pacuOut = Math.max(pacuReady, rq.moveT - 8);
  } else if (enc.bed) {
    const inIcu = unit[enc.bed.unit].kind === 'icu';
    if (c.needICU && !inIcu) {
      c.dest = c.icuUnit; enc.icuLos = Math.max(.4 * DAY, Math.round(rS.logn(ICU_LOS[c.icuUnit] * .8, .7) * DAY)); enc.wardLos = postLos; enc.icuClock = null; enc.dcVer++;
      const r = requestBed(enc, c.icuUnit, 1, 'transfer', 'post_operative', t + 10); r.case = c;
    } else {
      c.dest = enc.bed.unit; c.pacuOut = inIcu ? t + 10 : pacuReady + rO.int(5, 25);
      if (inIcu) enc.wardLos = Math.max(enc.wardLos, postLos);
      else scheduleDischarge(enc, Math.max(enc.MR == null ? -1e9 : enc.MR, pacuReady + postLos));
    }
  } else warn('w4');
}
function evPostopReq(c) { const r = requestBed(c.enc, c.ward, 1, 'admit', 'post_operative', c.wheelsOut + c.pacuMin); r.case = c; }
function evDayDc(enc) { enc.dischargeT = NOW; enc.dispo = 'home'; enc.p.inHouse = false; enc.p.intervals.push([enc.admitT, NOW, 'day_surgery']); enc.p.lastOut = NOW; }

// ---- run
push(-WARM_DAYS * DAY, evHour, -WARM_DAYS * 24);
let nEvents = 0;
while (HEAP.length) { const e = pop(); NOW = e[0]; e[2](e[3], e[4]); nEvents++; }

// =====================================================================================================
//                         POST-SIMULATION: window selection, clinics, inbox, vitals
// =====================================================================================================
const inpEncs = encs.filter(e => Math.min(e.admitT, e.firstReqT == null ? 1e12 : e.firstReqT) < END && (e.dischargeT == null || e.dischargeT >= 0));
const edW = edVisits.filter(v => v.arr < END && (v.departT == null || v.departT >= 0));
const dayW = dayEncs.filter(e => e.admitT < END && e.dischargeT >= 0);
const casesW = cases.filter(c => c.addon ? ((c.wheelsIn != null ? c.wheelsIn >= 0 : c.reqT >= 0) && c.reqT < END) : (c.day >= 0 && c.day < N_DAYS));
for (const e of inpEncs) e.inW = true; for (const e of dayW) e.inW = true; for (const v of edW) v.inW = true;

// readmission flags (uses every simulated encounter, including warm-up and the hidden cool-down period)
(function readmissions() {
  const byP = new Map();
  for (const e of encs) { if (!byP.has(e.p)) byP.set(e.p, []); byP.get(e.p).push(e); }
  for (const list of byP.values()) {
    list.sort((a, b) => a.admitT - b.admitT);
    for (let i = 0; i < list.length; i++) {
      const e = list[i], prev = list[i - 1], next = list[i + 1];
      if (prev && prev.dischargeT != null && prev.dischargeT <= e.admitT) { e.daysSince = (e.admitT - prev.dischargeT) / DAY; e.isReadm = e.daysSince <= 30 ? 1 : 0; e.prevEnc = prev; } else e.isReadm = 0;
      e.readmTrue = (next && e.dischargeT != null && e.dispo !== 'expired' && next.admitT - e.dischargeT <= 30 * DAY) ? 1 : 0;
      e.readmNextT = e.readmTrue ? next.admitT : null;
    }
  }
})();

// ------------------------------------------------------------------ outpatient clinics
const FUT_DAYS = 14;
const CLINIC_SCALE = 0.28;
const CLINICS = [
  // key, label, clinicians (count or surgical specialties), sessions per week, follow-up slot, new slot, share new, no-show offset, telehealth share, patient pool, visits per patient
  ['gim', 'General internal medicine', 10, 7, 20, 40, .12, 0, .14, 'adult', 2.6],
  ['cardio', 'Cardiology', 6, 5, 20, 40, .2, -.1, .1, 'adult', 2.2],
  ['ortho', 'Orthopaedics', ['orthopaedics'], 2, 15, 30, .3, .05, .03, 'adult', 1.8],
  ['gensurg', 'General surgery', ['general', 'colorectal'], 2, 15, 30, .35, 0, .05, 'adult', 1.6],
  ['neuro', 'Neurology', 5, 5, 30, 45, .25, .05, .15, 'adult', 2.0],
  ['onc', 'Oncology and haematology', 6, 6, 20, 45, .1, -.8, .08, 'cancer', 4.0],
  ['endo', 'Diabetes and hormone clinic', 4, 6, 20, 40, .15, .1, .2, 'adult', 2.4],
  ['renal', 'Kidney medicine', 3, 5, 20, 40, .15, 0, .12, 'adult', 2.6],
  ['pulm', 'Lung medicine', 3, 5, 20, 40, .2, .05, .1, 'adult', 2.2],
  ['gi', 'Gut and liver medicine', 4, 5, 20, 40, .25, .05, .1, 'adult', 1.9],
  ['antenatal', 'Pregnancy care', 5, 6, 15, 30, .12, -.4, .05, 'Fpreg', 5.0],
  ['paeds', 'Children\'s clinic', 6, 6, 20, 30, .2, .1, .08, 'kid', 2.2],
  ['mh', 'Mental health', 6, 7, 30, 60, .1, .5, .35, 'adult', 4.5],
  ['txc', 'Transplant clinic', 3, 4, 20, 40, .08, -.7, .1, 'adult', 4.5],
  ['uro', 'Urology', ['urology'], 2, 15, 30, .3, 0, .05, 'adult', 1.8],
  ['entc', 'Ear, nose and throat clinic', ['ent'], 2, 15, 30, .35, .05, .03, 'adult', 1.6],
  ['eye', 'Eye clinic', ['ophthalmology'], 3, 15, 30, .25, 0, 0, 'old', 2.2],
  ['preop', 'Pre-operative assessment', 4, 8, 30, 30, 1, -.6, .2, 'adult', 1.0],
];
const NS_MODEL = {
  intercept: -3.35, log1p_lead_days: 0.30, prior_no_shows_capped_5: 0.40, age_18_35: 0.35, age_65_plus: -0.30, age_under_18: -0.10,
  insurance_medicaid: 0.45, insurance_self_pay: 0.55, distance_over_40km: 0.25, interpreter_needed: 0.15, new_patient: 0.15, telehealth: -0.50,
  monday: 0.10, friday: 0.06, afternoon: 0.08, reminder_confirmed: -0.90, reminder_not_confirmed: 0.25, patient_random_effect_sd: 0.75,
  clinic_offsets: {}, early_cancel_p: 0.09, late_cancel_p: 0.035,
};
for (const c of CLINICS) NS_MODEL.clinic_offsets[c[1]] = c[7];
const appts = [];
const outEncs = [];
(function clinics() {
  const r = new Rng('clinic');
  const WARD2CLIN = { med: 'gim', card: 'cardio', sx: 'gensurg', ortho: 'ortho', haem: 'onc', tx: 'txc', ob: 'antenatal', peds: 'paeds', psych: 'mh' };
  for (const s of allSurgeons) s.orIv = [];
  for (const c of cases) if (c.wheelsIn != null) c.surgeon.orIv.push([c.wheelsIn, c.wheelsOut]);
  // clinicians and their weekly templates
  const clin = {};
  for (const c of CLINICS) {
    const o = clin[c[0]] = { key: c[0], label: c[1], fu: c[4], nw: c[5], pNew: c[6], tele: c[8], pool: c[9], vpp: c[10], docs: [], demand: [], dptr: 0, panel: [], inPanel: new Set() };
    if (Array.isArray(c[2])) { for (const sp of c[2]) for (const s of surgeons[sp]) o.docs.push({ s, surg: true, perWk: c[3] * CLINIC_SCALE * 1.3 }); }
    else for (let k = 0; k < c[2]; k++) {
      const s = addStaff(c[0] === 'preop' ? 'nurse practitioner' : 'clinic physician', 'Outpatient clinics', c[1], r);
      const halves = r.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, Math.max(1, Math.round(c[3] * CLINIC_SCALE)));
      const leave = new Set(); for (let w = weekOf(0); w <= weekOf(N_DAYS + FUT_DAYS); w++) if (r.bern(.06)) leave.add(w);
      o.docs.push({ s, surg: false, halves: new Set(halves), leave });
    }
  }
  // sessions
  const sessions = [];
  for (let d = 0; d < N_DAYS + FUT_DAYS; d++) {
    if (!isWorkday(d)) continue; const dw = dowOf(d), par = parityOf(d), wk = weekOf(d);
    for (const c of CLINICS) for (const doc of clin[c[0]].docs) for (let half = 0; half < 2; half++) {
      if (doc.surg) {
        const s = doc.s;
        if (s.blocks[dw + '-' + par] || s.leave.has(wk)) continue;
        if (onCall(s.specKey, d * DAY + 600) === s || onCall(s.specKey, (d - 1) * DAY + 600) === s) continue;
        if (!r.bern(Math.min(.9, doc.perWk / 5))) continue;
        const ss = d * DAY + (half ? 810 : 510) - 45, se = d * DAY + (half ? 1020 : 750) + 150;
        if (ss <= END && s.orIv.some(v => v[0] < se && v[1] > ss)) continue;      // clinic not held: surgeon was operating
      } else { if (!doc.halves.has((dw - 1) * 2 + half) || doc.leave.has(wk) || r.bern(.04)) continue; }
      const start = d * DAY + (half ? 810 : 510), end = d * DAY + (half ? 1020 : 750);
      const slots = []; let t = start; const o = clin[c[0]];
      while (true) { const isNew = r.bern(o.pNew); const len = isNew ? o.nw : o.fu; if (t + len > end) break; slots.push({ t, len, isNew }); t += len; }
      sessions.push({ d, half, start, end, clinic: o, doc, slots });
    }
  }
  sessions.sort((a, b) => a.start - b.start);
  // panels
  const need = {}; for (const s of sessions) need[s.clinic.key] = (need[s.clinic.key] || 0) + s.slots.length;
  const W = {
    gim: p => 1 + p.nChronic, cardio: p => .3 + 6 * p.hf + 2 * p.htn, onc: p => 1, endo: p => .3 + 8 * p.dm, renal: p => .1 + 10 * p.ckd, pulm: p => .1 + 8 * p.copd + 4 * p.asthma,
    neuro: p => 1 + 4 * p.dementia, mh: p => .3 + 8 * p.depression, txc: p => .2 + 3 * p.ckd, gi: p => 1, ortho: p => 1 + (p.age > 55 ? 1 : 0), gensurg: p => 1, uro: p => 1 + (p.sex === 'M' && p.age > 55 ? 2 : 0), entc: p => 1, eye: p => 1 + p.dm, antenatal: p => 1, paeds: p => 1, preop: p => 1,
  };
  for (const c of CLINICS) {
    const o = clin[c[0]]; const M = Math.ceil((need[o.key] || 0) / o.vpp); if (o.key === 'preop') continue;
    const pool = POOL[o.pool] || POOL.adult;
    const keyed = pool.map(p => [Math.pow(r.u(), 1 / W[o.key](p)), p]).sort((a, b) => b[0] - a[0]).slice(0, M);
    for (const k of keyed) { o.panel.push(k[1]); o.inPanel.add(k[1]); }
  }
  // demand lists: post-discharge follow-up and pre-operative assessment
  for (const e of encs) {
    if (e.dischargeT == null || e.dischargeT > END || e.dischargeT < -20 * DAY) continue;
    if (!(e.dispo === 'home' || e.dispo === 'home_with_services')) continue;
    if (!r.bern(.5)) continue;
    let k = WARD2CLIN[e.wardUnit]; if (e.dx === 'stroke' || e.dx === 'seiz') k = 'neuro'; if (!k) continue;
    clin[k].demand.push({ p: e.p, enc: e, earliest: e.dischargeT + 5 * DAY, latest: e.dischargeT + 21 * DAY, bookedT: e.dischargeT - r.int(30, 300), type: 'post-discharge follow-up' });
  }
  for (const c of cases) {
    if (c.addon || c.day < 2 || c.bookedT > END) continue;
    if (!r.bern(c.proc.tier >= 2 || c.p.age > 60 ? .65 : .3)) continue;
    const latest = c.day * DAY - 2 * DAY, earliest = Math.max(c.day * DAY - 21 * DAY, c.bookedT + DAY);
    if (latest - earliest < DAY) continue;
    clin.preop.demand.push({ p: c.p, kase: c, earliest, latest, bookedT: c.bookedT + r.int(30, 600), type: 'pre-operative assessment' });
  }
  for (const k in clin) clin[k].demand.sort((a, b) => a.earliest - b.earliest);
  const busyAt = (p, t) => { for (const iv of p.intervals) if (iv[0] < t + 300 && iv[1] > t - 90) return iv; return null; };
  const sig = x => 1 / (1 + Math.exp(-x));
  function mkAppt(sess, slot, opts) {
    const o = sess.clinic, d = sess.d, T0 = slot.t;
    let p = null, dem = null, vtype = slot.isNew ? 'new patient' : 'follow-up';
    // demand first
    const dl = o.demand; while (o.dptr < dl.length && dl[o.dptr].latest < T0) o.dptr++;
    if (!opts.refill) for (let i = o.dptr; i < dl.length && i < o.dptr + 80; i++) {
      const q = dl[i]; if (q.earliest > T0) break;
      if (q.used || q.bookedT > T0 - 90 || (q.p.deathT != null && q.p.deathT < T0) || (q.p.apptDays && q.p.apptDays.has(d))) continue;
      if (o.key !== 'preop' && !r.bern(.7)) continue;
      dem = q; q.used = true; p = q.p; vtype = q.type; break;
    }
    if (!p) {
      if (o.key === 'preop') return null;
      for (let k = 0; k < 30 && !p; k++) {
        let q;
        if (slot.isNew) { q = poolPick(r, o.pool, false); if (q && o.inPanel.has(q)) q = null; }
        else q = o.panel[Math.floor(r.u() * o.panel.length)];
        if (!q || (q.deathT != null && q.deathT < T0) || (q.apptDays && q.apptDays.has(d))) continue;
        p = q;
      }
      if (!p) return null;
      if (slot.isNew && !o.inPanel.has(p)) { o.inPanel.add(p); o.panel.push(p); }
    }
    (p.apptDays = p.apptDays || new Set()).add(d);
    // booking
    let bookedT;
    if (dem) bookedT = dem.bookedT;
    else if (opts.refill) bookedT = Math.min(T0 - r.int(40, 240), opts.after + r.int(20, 900));
    else {
      const x = r.u(); let lead = slot.isNew ? clamp(r.logn(24, .7), 1, 120) : x < .1 ? r.uni(0, 3) : clamp(r.logn(32, .8), 2, 200);
      bookedT = Math.floor((T0 - lead * DAY) / DAY) * DAY + r.int(480, 1020);
    }
    if (bookedT > T0 - 30) bookedT = T0 - r.int(30, 200);
    bookedT = Math.round(bookedT);
    if (bookedT > END) { p.apptDays.delete(d); if (dem) dem.used = false; return null; }
    const leadDays = (T0 - bookedT) / DAY;
    const tele = !dem && r.bern(o.tele) ? 1 : (dem && dem.type === 'pre-operative assessment' && r.bern(.2) ? 1 : 0);
    const confirmed = r.bern(clamp(.52 + .12 * p.portal - .05 * Math.min(p.priorNS + p.nsCount, 3), .1, .9)) ? 1 : 0;
    const priorNS = p.priorNS + p.nsCount;
    const dw = dowOf(d);
    const lg = NS_MODEL.intercept + NS_MODEL.log1p_lead_days * Math.log(1 + leadDays) + NS_MODEL.prior_no_shows_capped_5 * Math.min(priorNS, 5)
      + (p.age >= 18 && p.age <= 35 ? NS_MODEL.age_18_35 : p.age >= 65 ? NS_MODEL.age_65_plus : p.age < 18 ? NS_MODEL.age_under_18 : 0)
      + (p.ins === 'medicaid' ? NS_MODEL.insurance_medicaid : p.ins === 'self_pay' ? NS_MODEL.insurance_self_pay : 0)
      + (p.dist > 40 ? NS_MODEL.distance_over_40km : 0) + (p.interp ? NS_MODEL.interpreter_needed : 0) + (vtype === 'new patient' ? NS_MODEL.new_patient : 0) + (tele ? NS_MODEL.telehealth : 0)
      + (dw === 1 ? NS_MODEL.monday : dw === 5 ? NS_MODEL.friday : 0) + (sess.half ? NS_MODEL.afternoon : 0) + (confirmed ? NS_MODEL.reminder_confirmed : NS_MODEL.reminder_not_confirmed)
      + NS_MODEL.clinic_offsets[o.label] + p.nsRE;
    const pNS = sig(lg);
    const a = { p, sess, clinic: o, doc: sess.doc.s, T: T0, len: slot.len, vtype, tele, bookedT, leadDays, confirmed, priorNS, priorAppts: p.nsCount + p.okCount, pNS, dem, overbook: opts.overbook ? 1 : 0, status: null, cancelReason: '', cancelT: null };
    // outcome
    const x = r.u(); const iv = busyAt(p, T0);
    if (iv && iv[2] === 'inpatient') { a.status = 'cancelled_late'; a.cancelReason = 'Patient in hospital'; a.cancelT = Math.max(bookedT + 5, Math.min(T0 - 20, iv[0] + r.int(60, 600))); if (T0 - a.cancelT > DAY) a.status = 'cancelled'; }
    else if (iv) { a.status = 'no_show'; }
    else if (x < NS_MODEL.early_cancel_p && leadDays > 1.3) {
      a.status = 'cancelled'; a.cancelT = Math.round(bookedT + r.u() * (T0 - DAY - bookedT - 10) + 5);
      a.cancelReason = r.wpick(['Patient cancelled or rescheduled', 'Clinic cancelled (clinician unavailable)', 'Appointment no longer needed'], [.6, .25, .15]);
    } else if (x < NS_MODEL.early_cancel_p + NS_MODEL.late_cancel_p) {
      a.status = 'cancelled_late'; a.cancelT = Math.max(bookedT + 2, T0 - r.int(30, 1430)); a.cancelReason = r.wpick(['Patient cancelled or rescheduled', 'Patient unwell', 'Transport problem'], [.6, .25, .15]);
    } else if (r.bern(pNS)) a.status = 'no_show';
    else a.status = 'completed';
    if (T0 <= END) { if (a.status === 'no_show') p.nsCount++; else if (a.status === 'completed') p.okCount++; }
    if (a.status !== 'completed' && a.status !== 'no_show') p.apptDays.delete(d);
    appts.push(a);
    return a;
  }
  for (const sess of sessions) {
    const o = sess.clinic; const list = [];
    for (const slot of sess.slots) {
      if (!r.bern(o.key === 'preop' ? 1 : .93)) continue;
      const a = mkAppt(sess, slot, {}); if (!a) continue; list.push(a);
      if (a.status === 'cancelled' && a.cancelT < slot.t - DAY && r.bern(.5)) { const b = mkAppt(sess, slot, { refill: true, after: a.cancelT }); if (b) list.push(b); }
      else if (!slot.isNew && o.key !== 'preop' && r.bern(.04)) { const b = mkAppt(sess, { t: slot.t, len: slot.len, isNew: false }, { overbook: true }); if (b) list.push(b); }
    }
    if (sess.start > END) continue;
    // patient flow through the session (one clinician, one patient at a time)
    let free = Math.max(sess.start + (r.bern(.15) ? r.int(10, 25) : r.int(0, 8)), sess.doc.freeAt == null ? -1e9 : sess.doc.freeAt);
    const done = list.filter(a => a.status === 'completed').sort((x, y) => x.T - y.T);
    for (const a of done) {
      const off = Math.round(clamp(r.norm(-9, 11), -40, 28));
      a.checkIn = a.T + off;
      if (a.tele) { a.roomed = null; a.docIn = Math.round(Math.max(a.T + r.int(-2, 6), free, a.checkIn + 1)); }
      else { a.roomed = Math.round(Math.max(a.checkIn + r.int(3, 9) + r.exp(6), a.T - 12)); a.docIn = Math.round(Math.max(a.roomed + r.int(2, 8), free)); }
      const dur = Math.max(4, Math.round(r.logn((a.vtype === 'new patient' ? o.nw : o.fu) * .8, .35)));
      a.docOut = a.docIn + dur; a.checkout = a.tele ? a.docOut : a.docOut + r.int(2, 12); free = a.docOut + r.int(1, 4);
      const e = { type: 'outpatient', p: a.p, admitT: a.checkIn, dischargeT: a.checkout, svc: o.label, dxName: 'Clinic visit: ' + a.vtype, inW: true, appt: a };
      a.enc = e; outEncs.push(e);
    }
    sess.doc.freeAt = free;
  }
  appts.sort((a, b) => a.T - b.T || a.bookedT - b.bookedT);
})();

// ------------------------------------------------------------------ ids
const allEnc = [];
for (const e of inpEncs) allEnc.push(e);
for (const v of edW) { v.type = 'emergency'; v.admitT = v.arr; allEnc.push(v); }
for (const e of dayW) allEnc.push(e);
for (const e of outEncs) if (e.admitT <= END) allEnc.push(e);
allEnc.sort((a, b) => a.admitT - b.admitT);
allEnc.forEach((e, i) => { e.id = 'ENC-' + pad(i + 1, 7); });
edW.sort((a, b) => a.arr - b.arr).forEach((v, i) => { v.vid = 'EDV-' + pad(i + 1, 6); });
casesW.sort((a, b) => (a.addon ? (a.wheelsIn != null ? a.wheelsIn : a.reqT) : a.schedStart) - (b.addon ? (b.wheelsIn != null ? b.wheelsIn : b.reqT) : b.schedStart));
casesW.forEach((c, i) => { c.id = 'ORC-' + pad(i + 1, 6); c.inW = true; });
appts.forEach((a, i) => { a.id = 'APT-' + pad(i + 1, 7); });

// ------------------------------------------------------------------ vital signs sample with hidden deterioration
const vitRows = [], vitTruth = [];
(function vitals() {
  const r = new Rng('vitals');
  const EFFECT = {
    //            temp   hr   rr   sbp  spo2  conf-threshold
    sepsis: [1.8, 38, 10, -38, -5, .75],
    respiratory: [0.3, 22, 14, 0, -11, .85],
    bleeding: [-.3, 40, 7, -45, -2, .8],
    cardiac: [0, 50, 6, -32, -4, .85],
    neurological: [0, -12, -4, 28, -3, .4],
  };
  const ews = (o) => {
    let s = 0;
    if (o.rr != null) s += o.rr <= 8 ? 3 : o.rr <= 11 ? 1 : o.rr <= 20 ? 0 : o.rr <= 24 ? 2 : 3;
    if (o.spo2 != null) s += o.spo2 <= 91 ? 3 : o.spo2 <= 93 ? 2 : o.spo2 <= 95 ? 1 : 0;
    if (o.o2) s += 2;
    if (o.temp != null) s += o.temp <= 35 ? 3 : o.temp <= 36 ? 1 : o.temp <= 38 ? 0 : o.temp <= 39 ? 1 : 2;
    if (o.sbp != null) s += o.sbp <= 90 ? 3 : o.sbp <= 100 ? 2 : o.sbp <= 110 ? 1 : o.sbp <= 219 ? 0 : 3;
    if (o.hr != null) s += o.hr <= 40 ? 3 : o.hr <= 50 ? 1 : o.hr <= 90 ? 0 : o.hr <= 110 ? 1 : o.hr <= 130 ? 2 : 3;
    if (o.avpu !== 'A') s += 3;
    return s;
  };
  const elig = inpEncs.filter(e => e.admitT >= 0 && e.stays.some(s => ADULT_WARDS.has(s.bed.unit) && s.tin < END));
  for (const e of elig) {
    if (!r.bern(.18)) continue;
    const p = e.p, d = e.det && e.det.sched ? e.det : null;
    e.vitSample = true;
    const hr0 = r.norm(78, 9), rr0 = r.norm(16.5, 1.7), sbp0 = r.norm(124, 13) + (p.htn ? 8 : 0), t0 = r.norm(36.8, .22);
    const lowSat = p.copd === 1; const spo0 = lowSat ? r.norm(93.5, 1.4) : r.norm(97.2, 1.0);
    const homeO2 = lowSat && r.bern(.35);
    const acuity = r.u() * ({ pna: 1, sepsis: 1.2, copd: .9, resp: 1.2, hf: .7, uti: .7, cellulitis: .6, nf: 1 }[e.dx] || .35);
    const feverish = ['pna', 'sepsis', 'uti', 'cellulitis', 'nf'].includes(e.dx);
    const brady = d && d.type === 'cardiac' && r.bern(.25), hypoT = d && d.type === 'sepsis' && r.bern(.1);
    const noise = { hr: 0, rr: 0, sbp: 0, t: 0, sp: 0 };
    const wardStays = e.stays.filter(s => ADULT_WARDS.has(s.bed.unit));
    // benign transient episodes
    const epis = []; const totalEnd = Math.min(END, wardStays[wardStays.length - 1].tout == null ? END : wardStays[wardStays.length - 1].tout);
    for (let t = wardStays[0].tin + r.exp(5 * DAY); t < totalEnd; t += r.exp(5 * DAY)) epis.push({ t, dur: r.uni(120, 420), kind: r.pick(['pain', 'fever', 'anxiety', 'mobilising']) });
    let n = 0, maxEws = 0;
    for (const st of wardStays) {
      const end = Math.min(END, st.tout == null ? END : st.tout);
      let t = st.tin + r.int(8, 40), lastE = 0;
      while (t < end) {
        const hrs = (t - e.admitT) / 60, clock = ((t % DAY) + DAY) % DAY / 60, night = clock >= 23 || clock < 6;
        for (const k in noise) noise[k] = .6 * noise[k] + r.norm();
        const ill = acuity * Math.exp(-hrs / 36);
        let temp = t0 + .12 * noise.t + (feverish ? 1.3 * ill : .3 * ill), hr = hr0 + 4.5 * noise.hr + 16 * ill - (night ? 4 : 0), rr = rr0 + 1.2 * noise.rr + 4 * ill;
        let sbp = sbp0 + 6.5 * noise.sbp - 6 * ill - (night ? 5 : 0), sp = spo0 + .7 * noise.sp - 3 * ill; let avpu = 'A', o2 = homeO2 || ill > .55, s = 0;
        for (const ep of epis) if (t >= ep.t && t < ep.t + ep.dur) { if (ep.kind === 'pain') { hr += 14; sbp += 14; rr += 3; } else if (ep.kind === 'fever') { temp += .9; hr += 8; } else if (ep.kind === 'anxiety') { hr += 10; rr += 4; } else { hr += 12; rr += 3; sp -= 1.5; } }
        if (d && t >= d.onsetT && st.tin <= d.eventT) {
          if (t <= d.eventT) s = d.sEnd * Math.pow(clamp((t - d.onsetT) / d.ramp, 0, 1), 1.3);
          else if (d.outcome === 'ward_managed') s = d.sEnd * Math.exp(-(t - d.eventT) / 600);
          else s = Math.min(1, d.sEnd + (t - d.eventT) / 1200);
          const f = EFFECT[d.type], m = s * d.mag;
          temp += (hypoT ? -1.3 : f[0]) * m; hr += (brady ? -32 : f[1]) * m; rr += f[2] * m; sbp += f[3] * m; sp += f[4] * m;
          if (s > f[5] && r.bern(.55)) avpu = s > .95 && r.bern(.3) ? 'V' : 'C';
          if ((d.type === 'respiratory' && s > .3) || (s > .6 && sp < 93)) o2 = true;
        }
        if (!o2 && sp < (lowSat ? 88 : 92)) o2 = r.bern(.7);
        let flow = '';
        if (o2) { const l = clamp(Math.round(1 + (lowSat ? 1 : 0) + s * 8 + ill * 3 + r.uni(0, 1.5)), 1, 15); flow = l; sp += Math.min(6, 1.5 + l * .5); }
        if (p.dementia && r.bern(.03)) avpu = 'C';
        const o = { hr: Math.round(clamp(hr, 28, 190)), rr: Math.round(clamp(rr, 6, 46)), sbp: Math.round(clamp(sbp, 55, 235)), temp: r1(clamp(temp, 33.5, 41.2)), spo2: Math.round(clamp(sp, 70, 100)), o2: o2 ? 1 : 0, avpu };
        o.dbp = Math.round(clamp(o.sbp * .58 + r.norm(3, 6), 30, 130));
        if (r.bern(.004)) o.spo2 = r.int(78, 88);            // probe artefact
        const sc = ews(o); lastE = sc; if (sc > maxEws) maxEws = sc;
        const pain = clamp(Math.round(r.norm(e.dx === 'elective' && hrs < 72 ? 4 : 2, 2)), 0, 10);
        const miss = k => r.bern(k);
        vitRows.push([e, st, t, miss(.012) ? '' : o.hr, miss(.015) ? '' : o.rr, miss(.012) ? '' : o.sbp, miss(.012) ? '' : o.dbp, miss(.06) ? '' : o.temp.toFixed(1), miss(.012) ? '' : o.spo2, o.o2, flow, o.avpu, miss(.2) ? '' : pain, sc]);
        n++;
        let gap = sc >= 7 ? r.int(45, 75) : sc >= 5 ? r.int(55, 125) : sc >= 3 ? (r.bern(.6) ? r.int(110, 135) : r.int(225, 255)) : r.int(220, 260);
        if (sc <= 1 && clock >= 21.5 && clock < 24 && r.bern(.5)) gap = (30 - clock) * 60 + r.int(-20, 30);
        t += gap;
      }
    }
    if (!n) { e.vitSample = false; continue; }
    e.vitN = n;
    vitTruth.push([e, d, n, maxEws]);
  }
})();

// ------------------------------------------------------------------ inbox messages
const msgs = [];
(function inbox() {
  const r = new Rng('inbox');
  const DRUGS = ['metformin 500 mg', 'lisinopril 10 mg', 'atorvastatin 20 mg', 'amlodipine 5 mg', 'levothyroxine 75 micrograms', 'omeprazole 20 mg', 'sertraline 50 mg', 'apixaban 5 mg', 'furosemide 40 mg', 'salbutamol inhaler', 'insulin glargine', 'gabapentin 300 mg', 'metoprolol 25 mg', 'warfarin', 'prednisone 5 mg', 'losartan 50 mg', 'tamsulosin 0.4 mg', 'citalopram 20 mg'];
  const CRIT_DRUGS = ['insulin glargine', 'apixaban 5 mg', 'levetiracetam 500 mg', 'tacrolimus 1 mg', 'warfarin'];
  const SYM = ['cough', 'sore throat', 'low back ache', 'knee pain', 'heartburn', 'mild headache', 'itchy rash', 'trouble sleeping', 'ankle swelling', 'runny nose', 'constipation', 'tiredness'];
  const PARTS = ['forearm', 'lower leg', 'back', 'neck', 'chest', 'scalp'];
  const SIDE = ['dizzy when I stand up', 'sick to my stomach', 'very tired', 'a dry cough', 'muscle aches', 'more thirsty than usual'];
  const pk = a => r.pick(a);
  const clinicDocs = staff.filter(s => s.role === 'clinic physician' || s.role === 'nurse practitioner');
  const wardRn = u => r.pick(wardStaff[u].rn), wardCharge = u => r.pick(wardStaff[u].charge);
  const add = (t, type, sRole, sStaff, rRole, rStaff, p, enc, text, flag, prio, opts) => {
    t = Math.round(t); if (t < 0 || t > END) return;
    msgs.push({ t, type, sRole, sStaff, rRole, rStaff, p, enc, text, flag, prio, o: opts || {} });
  };
  const bizDelay = (t, rRole) => { // outpatient recipients read during working hours
    const d = Math.floor(t / DAY), c = t - d * DAY;
    if (isWorkday(d) && c >= 450 && c < 1050) return t;
    let nd = (c >= 1050 || !isWorkday(d)) ? d + 1 : d; if (c < 450 && isWorkday(d)) nd = d; while (!isWorkday(nd)) nd++;
    return nd * DAY + 450 + r.int(0, 150);
  };
  // ---------- generic outpatient traffic
  const GEN = [
    ['patient_medical_question', 15], ['prescription_refill', 14], ['test_result', 20], ['appointment_request', 9], ['referral', 6], ['prior_authorisation', 5], ['form_request', 4],
    ['pharmacy_query', 5], ['staff_announcement', 4], ['billing_question', 3], ['patient_update', 5],
  ];
  const portalPts = patients.filter(p => p.portal && p.age >= 18);
  for (let d = 0; d < N_DAYS; d++) {
    const wd = isWorkday(d); const n = r.pois(wd ? 82 : 24);
    for (let k = 0; k < n; k++) {
      const type = r.wpick(GEN.map(g => g[0]), GEN.map(g => g[1]));
      const p = type === 'staff_announcement' ? null : (r.bern(.6) ? pk(portalPts) : pk(POOL.adult));
      if (p && p.deathT != null && p.deathT < d * DAY) continue;
      const doc = pk(clinicDocs);
      const tDay = d * DAY + (wd ? Math.round(clamp(r.norm(690, 170), 380, 1300)) : r.int(420, 1320));
      const tPat = d * DAY + (r.bern(.35) ? r.int(1080, 1380) : r.int(390, 1080));
      let text, flag = 'routine', prio = 3;
      switch (type) {
        case 'patient_medical_question': {
          const x = r.u();
          if (x < .07) {
            const red = [
              ['I have had tightness in my chest since this morning and it spreads into my left arm. I did not want to bother the emergency department. What should I do?', 1],
              ['Earlier today one side of my face felt droopy and my words came out slurred for about 20 minutes. It is better now. Do I need to be seen?', 1],
              ['For two nights I have been short of breath lying flat and my legs are much more swollen than usual.', 2],
              ['My stools have been black and tarry since yesterday and I feel light-headed when I stand up.', 1],
              ['The wound from my operation is red, hot and leaking fluid, and my temperature was 38.9 this afternoon.', 2],
              ['I honestly feel like I cannot go on and I keep thinking about ending my life.', 1],
              ['My calf has been swollen and painful since my long flight and now it hurts to take a deep breath.', 1],
              ['I took double my ' + pk(CRIT_DRUGS) + ' dose by mistake this morning. Is that dangerous?', 2],
              ['My baby is moving much less than usual today. I am 33 weeks pregnant.', 1],
              ['I have had a severe headache for three days with a stiff neck and the light hurts my eyes.', 1],
            ];
            const e = pk(red); text = e[0]; prio = e[1];
          } else {
            const routine = [
              () => 'I have had a ' + pk(SYM) + ' for ' + r.int(2, 14) + ' days. Should I come in or wait for my next appointment?',
              () => 'Since starting ' + pk(DRUGS) + ' I have been feeling ' + pk(SIDE) + '. Is this expected?',
              () => 'My home blood pressure readings have been around ' + r.int(128, 162) + '/' + r.int(78, 98) + ' this week. Do I need to change my tablets?',
              () => 'Should I keep taking ' + pk(DRUGS) + ' before my procedure next week?',
              () => 'My morning blood sugar readings have been between ' + r1(r.uni(6, 8)) + ' and ' + r1(r.uni(9, 13)) + ' mmol/L. Is that all right?',
              () => 'The rash on my ' + pk(PARTS) + ' is not better after a week of the cream. What should I try next?',
              () => 'Could you explain what my recent test results mean? I saw them on the portal but did not understand them.',
              () => 'I am travelling abroad next month. Do I need any vaccinations or changes to my medicines?',
              () => 'My ' + pk(SYM) + ' has come back since I finished the tablets. Can I have another course?',
            ];
            text = pk(routine)(); prio = r.bern(.25) ? 2 : 3;
          }
          add(tPat, type, 'patient', '', r.bern(.6) ? 'physician' : 'clinic nurse pool', r.bern(.6) ? doc.id : '', p, null, text, 'routine', prio); break;
        }
        case 'prescription_refill': {
          const x = r.u();
          if (x < .08) { text = 'I ran out of ' + pk(CRIT_DRUGS) + ' ' + r.int(1, 3) + ' days ago and the pharmacy says there are no refills left.'; prio = 2; add(tPat, type, 'patient', '', 'physician', doc.id, p, null, text, 'routine', prio); }
          else if (x < .55) { text = 'Please refill ' + pk(DRUGS) + '. I have about ' + r.int(4, 14) + ' days left.'; add(tPat, type, 'patient', '', 'physician', doc.id, p, null, text, 'routine', 3); }
          else { text = 'Refill request: ' + pk(DRUGS) + ', last supplied ' + r.int(25, 95) + ' days ago, no refills remaining.'; add(tDay, type, 'pharmacist', pk(pharmacists).id, 'physician', doc.id, p, null, text, 'routine', 3); }
          break;
        }
        case 'test_result': {
          const R = [
            [() => 'Potassium ' + r1(r.uni(6.1, 6.9)) + ' mmol/L (critical high). Sample not haemolysed.', 1, 'stat', 'laboratory'],
            [() => 'Haemoglobin ' + r.int(58, 69) + ' g/L (critical low). Previous ' + r.int(95, 120) + ' g/L.', 1, 'stat', 'laboratory'],
            [() => 'INR ' + r1(r.uni(5.2, 7.5)) + ' (patient on warfarin).', 2, 'urgent', 'laboratory'],
            [() => 'Creatinine ' + r.int(260, 380) + ' micromol/L, previous ' + r.int(95, 150) + '.', 2, 'urgent', 'laboratory'],
            [() => 'Mammogram: suspicious finding, biopsy recommended.', 2, 'routine', 'radiology'],
            [() => 'CT chest: ' + r.int(6, 12) + ' mm lung nodule. Follow-up imaging advised in 3 months.', 3, 'routine', 'radiology'],
            [() => 'Urine culture: E. coli, sensitive to nitrofurantoin.', 3, 'routine', 'laboratory'],
            [() => 'HbA1c ' + r1(r.uni(7.6, 9.8)) + '% (above target).', 3, 'routine', 'laboratory'],
            [() => 'Thyroid stimulating hormone ' + r1(r.uni(5.2, 7.9)) + ' mU/L (slightly raised).', 4, 'routine', 'laboratory'],
            [() => 'Chest X-ray: no acute abnormality.', 4, 'routine', 'radiology'],
            [() => 'Full blood count, kidney function and liver tests all within normal limits.', 4, 'routine', 'laboratory'],
            [() => 'Cholesterol panel: LDL ' + r1(r.uni(2.1, 4.6)) + ' mmol/L.', 4, 'routine', 'laboratory'],
            [() => 'Ultrasound abdomen: gallstones, no signs of inflammation.', 3, 'routine', 'radiology'],
            [() => 'Bone density scan: osteopenia at the hip.', 4, 'routine', 'radiology'],
          ];
          const e = r.wpick(R, [1, 1, 1.5, 1.5, 1, 2, 4, 6, 5, 8, 14, 8, 3, 3]); text = e[0](); prio = e[1];
          add(tDay, type, e[3], '', 'physician', doc.id, p, null, text, e[2], prio); break;
        }
        case 'appointment_request': text = pk(['I need to move my appointment to a later date, mornings are best.', 'Please can I have an earlier appointment if one comes up?', 'I missed my appointment and would like to rebook.', 'Can my next visit be by video instead of in person?', 'I need an interpreter booked for my next visit.']);
          add(tPat, type, 'patient', '', 'front desk', pk(frontDesk).id, p, null, text, 'routine', 4); break;
        case 'referral': {
          const u = r.bern(.15);
          text = u ? 'Urgent referral: ' + pk(['unexplained weight loss and difficulty swallowing', 'new breast lump', 'blood in the urine without infection', 'new iron-deficiency anaemia in a patient over 60']) + '. Please see within two weeks.' : 'Referral: ' + pk(['poorly controlled blood pressure on three medicines', 'worsening knee arthritis, considering joint replacement', 'recurrent sinus infections', 'new atrial fibrillation', 'long-standing reflux not responding to treatment', 'memory concerns raised by family']) + '. Please assess and advise.';
          add(tDay, type, 'physician', pk(clinicDocs).id, 'physician', doc.id, p, null, text, u ? 'urgent' : 'routine', u ? 2 : 3); break;
        }
        case 'prior_authorisation': text = 'Insurer needs more clinical information before approving ' + pk(['an MRI scan of the spine', 'a continuous glucose monitor', 'a biologic injection', 'a sleep study', 'home oxygen']) + '. Reply needed within ' + r.int(2, 10) + ' days.';
          add(tDay, type, 'care coordinator', pk(caseManagers).id, r.bern(.5) ? 'physician' : 'clinic nurse pool', doc.id, p, null, text, 'routine', 3); break;
        case 'form_request': text = pk(['Please complete the attached fitness-for-work form for my employer.', 'I need a letter confirming my diagnosis for my insurance.', 'Could you sign the disabled parking permit form?', 'School needs a medication form completed for my child.']);
          add(tPat, type, 'patient', '', 'front desk', pk(frontDesk).id, p, null, text, 'routine', 4); break;
        case 'pharmacy_query': {
          const u = r.bern(.4);
          text = u ? 'Interaction alert: new prescription for ' + pk(['clarithromycin', 'fluconazole', 'ibuprofen', 'trimethoprim']) + ' with existing ' + pk(['warfarin', 'apixaban 5 mg', 'tacrolimus 1 mg', 'methotrexate']) + '. Please confirm or change before we dispense.' : 'Dose clarification: prescription for ' + pk(DRUGS) + ' does not match the previous dose. Please confirm.';
          add(tDay, type, 'pharmacist', pk(pharmacists).id, 'physician', doc.id, p, null, text, u ? 'urgent' : 'routine', u ? 2 : 3); break;
        }
        case 'staff_announcement': text = pk(['Reminder: fire-safety training is due by the end of the month.', 'Clinic room 4 will be closed for maintenance on Thursday afternoon.', 'New referral forms are now on the shared drive.', 'Flu vaccination sessions for staff start next week.', 'Parking permits must be renewed by Friday.']);
          add(tDay, type, 'administrator', '', 'all clinic staff', '', null, null, text, r.bern(.1) ? 'urgent' : 'routine', 4); break;
        case 'billing_question': text = pk(['I received a bill for a visit I thought was covered. Can someone check?', 'Can I set up a payment plan for my last invoice?', 'My insurance details have changed, how do I update them?']);
          add(tPat, type, 'patient', '', 'front desk', pk(frontDesk).id, p, null, text, 'routine', 4); break;
        default: text = pk(['Just letting you know my blood pressure has been fine since the change in tablets.', 'Thank you for seeing me last week, I am feeling much better.', 'I have booked the scan you asked for, it is on the ' + r.int(1, 28) + 'th.', 'I stopped the new tablet after two days because it upset my stomach. Feeling fine now.']);
          add(tPat, 'patient_update', 'patient', '', 'physician', doc.id, p, null, text, 'routine', 4);
      }
    }
  }
  // ---------- event-linked inpatient traffic
  for (const e of inpEncs) {
    const p = e.p, d = e.det && e.det.sched ? e.det : null;
    const wards = e.stays.filter(s => s.tin < END);
    if (!wards.length) continue;
    const lastOut = Math.min(END, e.dischargeT == null ? END : e.dischargeT);
    // benign nurse pages
    const nPage = r.pois(Math.min(3, (lastOut - wards[0].tin) / DAY * .07));
    for (let k = 0; k < nPage; k++) {
      const t = r.uni(wards[0].tin + 30, lastOut); const st = wards.find(s => s.tin <= t && (s.tout == null || s.tout > t)); if (!st) continue;
      const B = [['Patient in bed ' + st.bed.id + ' is asking for something to help them sleep.', 4, 'routine'], ['Pain is ' + r.int(6, 9) + ' out of 10 despite regular pain relief. Please review.', 3, 'routine'], ['Intravenous line has stopped working and antibiotics are due at ' + pad(r.int(0, 23), 2) + ':00. Needs replacing.', 3, 'routine'],
        ['Family would like an update from the medical team today.', 4, 'routine'], ['Blood sugar ' + r1(r.uni(14, 22)) + ' mmol/L before the meal. Please advise on insulin.', 2, 'urgent'], ['Patient has not passed urine for ' + r.int(7, 10) + ' hours after catheter removal.', 3, 'routine'], ['Please prescribe a laxative, bowels not open for ' + r.int(3, 5) + ' days.', 4, 'routine'],
        ['Blood pressure ' + r.int(165, 190) + '/' + r.int(90, 105) + ', no symptoms. Usual tablets not yet prescribed.', 3, r.bern(.3) ? 'urgent' : 'routine']];
      const b = pk(B); add(t, 'nurse_to_doctor', 'registered nurse', wardRn(st.bed.unit).id, 'resident physician', pk(residents).id, p, e, b[0], b[2], b[1], { inpatient: 1 });
    }
    if (d && d.eventT < END) {
      const u = d.unit;
      const txt = { sepsis: 'temperature 39.1 with shaking, heart rate 124, blood pressure 92/54', respiratory: 'breathing rate 30, oxygen level 87% on 4 litres of oxygen', bleeding: 'heart rate 128, blood pressure 88/50, looks pale and clammy', cardiac: 'heart rate 148 and irregular, blood pressure 90/58, chest discomfort', neurological: 'newly drowsy and confused, one pupil larger than the other' }[d.type];
      add(d.eventT - r.int(2, 25), 'nurse_to_doctor', 'registered nurse', wardRn(u).id, 'resident physician', pk(residents).id, p, e, 'Early warning score has risen sharply: ' + txt + '. Please review urgently.', r.bern(.8) ? 'stat' : 'urgent', 1, { inpatient: 1 });
      if (r.bern(.6)) add(d.onsetT + d.ramp * r.uni(.3, .7), 'nurse_to_doctor', 'registered nurse', wardRn(u).id, 'resident physician', pk(residents).id, p, e, pk(['Patient seems more unwell than this morning, off their food and more sleepy. Observations only slightly changed.', 'New confusion this shift and pulling at lines.', 'Urine output only ' + r.int(40, 90) + ' mL over the last 6 hours.', 'Heart rate creeping up over the shift, now ' + r.int(104, 116) + '. Patient says they feel "not right".']), r.bern(.3) ? 'urgent' : 'routine', 2, { inpatient: 1 });
      if (r.bern(.5)) add(d.eventT - r.int(20, 240), 'test_result', 'laboratory', '', 'resident physician', pk(residents).id, p, e, pk(['Lactate ' + r1(r.uni(3.6, 6.5)) + ' mmol/L (critical high).', 'Blood culture positive: Gram-negative rods in both bottles.', 'Troponin rising: ' + r.int(40, 90) + ' then ' + r.int(280, 900) + ' ng/L.', 'Haemoglobin dropped from ' + r.int(98, 118) + ' to ' + r.int(62, 76) + ' g/L.']), 'stat', 1, { inpatient: 1 });
    }
    if (e.dischargeT != null && e.dischargeT <= END && e.dispo !== 'expired') {
      if (e.placeDelay > 0) add(e.MR + r.int(60, 600), 'discharge_planning', 'case manager', pk(caseManagers).id, 'attending physician', pk(hospitalists).id, p, e, 'Medically ready for discharge but still waiting for ' + (e.dispo === 'home_with_services' ? 'home care services to start' : 'a facility to accept the patient') + '. Will update when a date is confirmed.', 'routine', 3, { inpatient: 1 });
      else if (r.bern(.12)) add(e.dischargeT - r.int(120, 400), 'discharge_planning', 'case manager', pk(caseManagers).id, 'resident physician', pk(residents).id, p, e, 'Transport is booked for ' + iso(e.dischargeT).slice(11, 16) + ' but discharge medicines and letter are not yet done.', 'urgent', 2, { inpatient: 1 });
      if (p.portal && r.bern(.08)) add(e.dischargeT + r.uni(.5, 6) * DAY, 'patient_medical_question', 'patient', '', 'clinic nurse pool', '', p, e, pk(['I went home from hospital a few days ago and I am not sure which of my old tablets I should still be taking.', 'Since leaving hospital my wound dressing keeps soaking through. Is that normal?', 'I was told someone would call about a follow-up appointment after my hospital stay but I have not heard anything.', 'I have felt more breathless each day since I came home from hospital and gained 3 kg.']), 'routine', r.bern(.4) ? 2 : 3);
    }
  }
  for (const q of reqs) {
    if (!q.fromED || q.reqT < 0) continue; const v = q.enc.edVisit; if (!v || !v.inW) continue;
    const dep = v.departT == null ? 1e12 : v.departT;
    for (const h of [4, 10, 20]) { const t = q.reqT + h * 60 + r.int(0, 30); if (t < dep && r.bern(.7)) add(t, 'bed_request', 'charge nurse', wardCharge('ed').id, 'bed manager', pk(bedManagers).id, q.enc.p, q.enc, 'Admitted patient has now waited ' + h + ' hours in the Emergency Department for a ' + unit[q.unit0].name + ' bed. Any update on a bed?', h >= 10 ? 'urgent' : 'routine', h >= 10 ? 2 : 3, { inpatient: 1 }); }
  }
  for (const c of casesW) {
    if (c.addon) { if (c.wheelsIn != null && r.bern(.25)) add(c.reqT + r.int(1, 15), 'operating_room_schedule', 'operating room coordinator', pk(orCoords).id, 'surgeon', c.surgeon.id, c.p, c.enc && c.enc.id ? c.enc : null, 'Add-on case booked: ' + c.proc.name.toLowerCase() + ' (' + c.cls0 + '). You will be called when a room is ready.', c.cls0 === 'emergent' ? 'stat' : 'urgent', c.cls0 === 'emergent' ? 1 : 2, { inpatient: 1 }); continue; }
    if (c.status === 'cancelled_day_of' && r.bern(.8)) add(c.cancelT + r.int(1, 10), 'operating_room_schedule', 'operating room coordinator', pk(orCoords).id, 'surgeon', c.surgeon.id, c.p, null, 'Your ' + iso(c.schedStart).slice(11, 16) + ' case in ' + c.block.room.name + ' has been cancelled: ' + c.cancelReason.toLowerCase() + '.', 'urgent', 2, { inpatient: 1 });
    else if (c.status === 'completed' && c.delay > 45 && r.bern(.5)) add(c.schedStart - r.int(5, 40), 'operating_room_schedule', 'operating room coordinator', pk(orCoords).id, 'surgeon', c.surgeon.id, c.p, null, 'Your ' + iso(c.schedStart).slice(11, 16) + ' case in ' + c.room.name + ' will start about ' + Math.round(c.delay / 5) * 5 + ' minutes late: ' + c.delayReason.toLowerCase() + '.', 'routine', 3, { inpatient: 1 });
  }
  for (const a of appts) {
    if (a.status !== 'no_show' || a.T > END) continue;
    const imp = a.clinic.key === 'onc' || a.clinic.key === 'txc' || a.vtype === 'post-discharge follow-up';
    if (r.bern(imp ? .7 : .2)) add(a.T + r.int(40, 240), 'missed_appointment', 'front desk', pk(frontDesk).id, 'physician', a.doc.id, a.p, null, 'Patient did not attend their ' + a.clinic.label.toLowerCase() + ' appointment (' + a.vtype + ') today. Please advise whether to rebook.', 'routine', imp ? 3 : 4);
  }
  // ---------- response times
  msgs.sort((a, b) => a.t - b.t);
  const ACT = { patient_medical_question: ['Replied to patient', 'Telephone call made', 'Appointment booked', 'Advised to attend emergency department'], prescription_refill: ['Prescription issued', 'Prescription declined, review needed'], test_result: ['Result reviewed, no action', 'Patient contacted', 'Treatment changed', 'Repeat test ordered'], appointment_request: ['Appointment booked', 'Appointment changed'], referral: ['Referral accepted, appointment booked', 'Advice given without appointment'], prior_authorisation: ['Information sent to insurer'], form_request: ['Form completed'], pharmacy_query: ['Prescription changed', 'Prescription confirmed'], staff_announcement: ['No action needed'], billing_question: ['Replied to patient'], patient_update: ['No action needed', 'Replied to patient'], nurse_to_doctor: ['Patient reviewed at bedside', 'Order placed', 'Advice given by phone'], bed_request: ['Bed assigned', 'Update given, still waiting'], discharge_planning: ['Discharge paperwork completed', 'Noted, plan updated'], operating_room_schedule: ['Acknowledged'], missed_appointment: ['Rebooking requested', 'No further action'] };
  for (const m of msgs) {
    // sender-set flag noise: some true emergencies are sent as routine, some routine items are flagged urgent
    if (m.sRole !== 'patient' && m.type !== 'staff_announcement') { if (m.prio <= 2 && m.flag !== 'routine' && r.bern(.12)) m.flag = 'routine'; else if (m.prio >= 3 && m.flag === 'routine' && r.bern(.07)) m.flag = 'urgent'; }
    const med = m.flag === 'stat' ? 6 : m.flag === 'urgent' ? 28 : m.o.inpatient ? 55 : 150;
    let read = (m.o.inpatient ? m.t : bizDelay(m.t, m.rRole)) + Math.round(r.logn(med, .9));
    if (m.type === 'staff_announcement' && r.bern(.2)) read = null;
    let act = null, action = '';
    if (read != null) {
      const amed = m.prio === 1 ? 14 : m.prio === 2 ? 70 : m.prio === 3 ? 300 : 900;
      act = read + Math.round(r.logn(amed * (m.flag === 'routine' && m.prio <= 2 ? 2.2 : 1), .9));
      if (!m.o.inpatient && m.prio >= 3) act = bizDelay(act, m.rRole) + (act % 7);
      if (r.bern(m.prio >= 4 ? .08 : .015)) act = null; else action = r.pick(ACT[m.type]);
      if (m.prio === 1 && m.type === 'patient_medical_question' && action) action = r.bern(.7) ? 'Advised to attend emergency department' : 'Telephone call made';
    }
    m.read = read; m.act = act; m.action = act != null && act <= END ? action : '';
  }
  msgs.forEach((m, i) => { m.id = 'MSG-' + pad(i + 1, 6); });
})();

// =====================================================================================================
//                                            OUTPUT TABLES
// =====================================================================================================
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(GT, { recursive: true });
const eid = e => (e && e.id) ? e.id : '';
const hrs = (a, b) => (a == null || b == null || a > END || b > END) ? '' : r2((b - a) / 60);

// ---- patients
writeCsv('patients.csv',
  ['patient_id', 'record_number', 'given_name', 'family_name', 'sex', 'birth_date', 'age_years', 'insurance_type', 'distance_from_hospital_km', 'preferred_language', 'interpreter_needed', 'lives_alone', 'portal_account', 'body_mass_index', 'smoker', 'high_blood_pressure', 'diabetes', 'heart_failure', 'chronic_lung_disease', 'chronic_kidney_disease', 'cancer', 'dementia', 'depression', 'asthma', 'chronic_condition_count', 'admissions_prior_12m', 'no_shows_prior_12m'],
  patients.map(p => [p.id, p.mrn, p.given, p.family, p.sex, p.dob, p.age, p.ins, p.dist, p.lang, p.interp, p.alone, p.portal, p.bmi == null ? '' : p.bmi, p.smoker, p.htn, p.dm, p.hf, p.copd, p.ckd, p.cancer, p.dementia, p.depression, p.asthma, p.nChronic, p.priorAdm, p.priorNS]));

// ---- staff
writeCsv('staff.csv', ['staff_id', 'given_name', 'family_name', 'role', 'department', 'specialty', 'years_experience', 'full_time_equivalent'],
  staff.map(s => [s.id, s.given, s.family, s.role, s.dept, s.spec, s.years, s.fte]));
(function orStaff() {
  const cnt = new Map();
  const inc = s => { if (s) cnt.set(s, (cnt.get(s) || 0) + 1); };
  for (const c of casesW) if (c.wheelsIn != null && c.wheelsIn <= END) { inc(c.surgeon); inc(c.anaesthetist); inc(c.circ); inc(c.scrub); }
  const list = staff.filter(s => s.dept === 'Operating rooms' && s.role !== 'operating room coordinator');
  writeCsv('or_staff.csv', ['staff_id', 'given_name', 'family_name', 'role', 'specialty', 'years_experience', 'full_time_equivalent', 'elective_blocks_per_fortnight', 'cases_in_window'],
    list.map(s => [s.id, s.given, s.family, s.role, s.spec, s.years, s.fte, s.blocks ? Object.keys(s.blocks).length : '', cnt.get(s) || 0]));
})();

// ---- beds
writeCsv('beds.csv', ['bed_id', 'unit', 'unit_name', 'unit_code', 'bed_type', 'room'],
  beds.map(b => [b.id, b.unit, unit[b.unit].name, unit[b.unit].code, b.type, b.room]).concat(edSpaces.map(s => [s.id, 'ed', unit.ed.name, 'ED', s.type, s.room])));

// ---- encounters
(function encountersOut() {
  const ED_DISPO = { discharged: 'home', admitted: 'admitted_to_hospital', transferred: 'transfer_other_hospital', left_without_being_seen: 'left_without_being_seen', left_against_advice: 'against_medical_advice', died: 'expired' };
  const rows = [];
  for (const e of allEnc) {
    const p = e.p;
    if (e.type === 'inpatient') {
      const done = e.dischargeT != null && e.dischargeT <= END;
      const st = e.stays.filter(s => s.tin <= END);
      let icuMin = 0; for (const s of st) if (unit[s.bed.unit].kind === 'icu') icuMin += Math.min(END, s.tout == null ? END : s.tout) - s.tin;
      let readm = '';
      if (done && e.dispo !== 'expired') { if (e.readmTrue && e.readmNextT <= END) readm = 1; else if (e.dischargeT + 30 * DAY <= END) readm = 0; }
      const link = e.edVisit && e.edVisit.inW ? e.edVisit.id : '';
      rows.push([e.id, p.id, 'inpatient', done ? 'completed' : (e.admitT > END || !st.length ? 'awaiting_bed' : 'in_progress'), T(e.admitT), T(e.dischargeT), hrs(e.admitT, e.dischargeT), e.svc, e.dxName, e.src, e.level || '',
        st.length ? st[0].bed.unit : '', st.length ? st[st.length - 1].bed.unit : '', icuMin > 0 ? 1 : 0, r1(icuMin / 60), done ? e.dispo : '', (e.MR != null && e.MR <= END && e.dispo !== 'expired') ? iso(e.MR) : '', T(e.orderT),
        done && e.dispo !== 'expired' ? ((e.dischargeT % DAY + DAY) % DAY < 720 ? 1 : 0) : '', e.isReadm, e.daysSince != null ? r1(e.daysSince) : '', readm, link, p.age, e.admitT < 0 ? 1 : 0]);
    } else if (e.type === 'emergency') {
      const done = e.departT != null && e.departT <= END;
      rows.push([e.id, p.id, 'emergency', done ? 'completed' : 'in_progress', T(e.arr), T(e.departT), hrs(e.arr, e.departT), 'Emergency medicine', e.cc, e.mode === 'transfer from another facility' ? 'transfer_in' : 'self_or_ambulance', e.level,
        'ed', 'ed', 0, 0, done ? ED_DISPO[e.dispo] : '', '', '', '', '', '', '', e.inp && e.inp.id && e.decisionT <= END ? e.inp.id : '', p.age, e.arr < 0 ? 1 : 0]);
    } else if (e.type === 'day_surgery') {
      const done = e.dischargeT <= END;
      rows.push([e.id, p.id, 'day_surgery', done ? 'completed' : 'in_progress', T(e.admitT), T(e.dischargeT), hrs(e.admitT, e.dischargeT), e.svc, e.dxName, 'elective', '', '', '', 0, 0, done ? 'home' : '', '', '', '', '', '', '', '', p.age, 0]);
    } else {
      rows.push([e.id, p.id, 'outpatient', 'completed', T(e.admitT), T(e.dischargeT), hrs(e.admitT, e.dischargeT), e.svc, e.dxName, 'clinic', '', '', '', 0, 0, 'home', '', '', '', '', '', '', '', p.age, 0]);
    }
  }
  writeCsv('encounters.csv', ['encounter_id', 'patient_id', 'encounter_type', 'status', 'admit_time', 'discharge_time', 'length_of_stay_hours', 'service', 'admitting_diagnosis_group', 'admit_source', 'ed_urgency_level',
    'first_unit', 'last_unit', 'had_icu_stay', 'icu_hours', 'discharge_disposition', 'medically_ready_time', 'discharge_order_time', 'discharged_before_noon', 'is_readmission_30d', 'days_since_last_discharge', 'readmitted_within_30d', 'linked_encounter_id', 'age_at_admit', 'carry_in'], rows);
})();

// ---- ADT events
const adtW = adt.filter(a => a.enc.inW && (a.reqT != null ? Math.min(a.reqT, a.t) : a.t) <= END).sort((a, b) => (a.reqT != null ? Math.min(a.reqT, a.t) : a.t) - (b.reqT != null ? Math.min(b.reqT, b.t) : b.t));
(function adtOut() {
  const rows = adtW.map((a, i) => {
    const doneE = a.t <= END, asg = a.assignT != null && a.assignT <= END, ps = a.prevStay;
    const status = doneE ? 'completed' : a.type === 'discharge' ? 'discharge_ordered' : asg ? 'bed_assigned' : 'waiting_for_bed';
    return ['ADT-' + pad(i + 1, 7), a.enc.id, a.enc.p.id, a.type, a.reason, T(a.reqT), T(a.assignT), T(a.t), D(a.reqT, a.t), a.fromUnit, a.fromBed, a.type === 'discharge' ? '' : (asg || doneE ? a.toUnit : ''), a.type === 'discharge' ? '' : (asg || doneE ? a.toBed : ''),
      a.reqUnit, a.type !== 'discharge' && (asg || doneE) && a.reqUnit !== a.toUnit ? 1 : (a.type === 'discharge' ? '' : 0), doneE && ps ? T(ps.cleanS) : '', doneE && ps ? T(ps.cleanE) : '', doneE && ps ? D(a.t, ps.cleanE) : '', status];
  });
  writeCsv('adt_events.csv', ['event_id', 'encounter_id', 'patient_id', 'event_type', 'reason', 'request_time', 'bed_assigned_time', 'actual_time', 'request_to_actual_min', 'from_unit', 'from_bed', 'to_unit', 'to_bed',
    'requested_unit', 'off_service_placement', 'vacated_bed_clean_start', 'vacated_bed_clean_end', 'vacated_bed_turnaround_min', 'status'], rows);
})();

// ---- hourly census
const NH = N_DAYS * 24;
const CEN = {};
(function census() {
  const mk = () => new Int32Array(NH + 2);
  for (const u of UNITS) CEN[u[0]] = { occ: mk(), dirty: mk(), res: mk(), wait: mk(), board: mk(), adm: mk(), dis: mk(), tin: mk(), tout: mk() };
  const iv = (arr, a, b) => { if (a == null) return; if (b == null) b = 1e12; let ha = Math.ceil(a / 60), hb = Math.ceil(b / 60); if (hb <= 0 || ha >= NH) return; if (ha < 0) ha = 0; if (hb > NH) hb = NH; if (hb <= ha) return; arr[ha]++; arr[hb]--; };
  const ev = (arr, t) => { const h = Math.floor(t / 60); if (h >= 0 && h < NH) arr[h]++; };
  for (const s of stays) { const c = CEN[s.bed.unit]; iv(c.occ, s.tin, s.tout); if (s.tout != null) iv(c.dirty, s.tout, s.cleanE); }
  for (const q of reqs) {
    if (q.cancelled) continue;
    if (q.bed) iv(CEN[q.bed.unit].res, q.assignT, q.moveT);
    iv(CEN[q.unit0].wait, q.reqT, q.moveT);
    if (q.fromED && q.enc.edVisit) iv(CEN[q.unit0].board, q.reqT, q.enc.edVisit.departT);
  }
  for (const a of adt) {
    if (a.type === 'admit') ev(CEN[a.toUnit].adm, a.t);
    else if (a.type === 'transfer') { ev(CEN[a.toUnit].tin, a.t); ev(CEN[a.fromUnit].tout, a.t); }
    else ev(CEN[a.fromUnit].dis, a.t);
  }
  const e = CEN.ed;
  for (const v of edVisits) {
    if (v.roomedT != null) iv(e.occ, v.roomedT, v.departT);
    iv(e.wait, v.arr, v.roomedT != null ? v.roomedT : v.departT);
    if (v.inp) iv(e.board, v.decisionT, v.departT);
    ev(e.adm, v.arr); if (v.departT != null) ev(e.dis, v.departT);
  }
  const rows = [];
  for (const u of UNITS) { const c = CEN[u[0]]; for (const k of ['occ', 'dirty', 'res', 'wait', 'board']) { let s = 0; for (let h = 0; h < NH; h++) { s += c[k][h]; c[k][h] = s; } } }
  for (let h = 0; h < NH; h++) for (const u of UNITS) {
    const c = CEN[u[0]], tot = u[3];
    rows.push([iso(h * 60), u[0], tot, c.occ[h], r1(c.occ[h] / tot * 100), c.dirty[h], c.res[h], tot - c.occ[h] - c.dirty[h] - c.res[h], c.wait[h], c.board[h], c.adm[h], c.tin[h], c.tout[h], c.dis[h]]);
  }
  writeCsv('bed_census_hourly.csv', ['timestamp', 'unit', 'beds_total', 'occupied', 'occupancy_pct', 'beds_being_cleaned', 'beds_reserved', 'beds_available', 'patients_waiting_for_bed', 'ed_boarders', 'admissions_in_hour', 'transfers_in_in_hour', 'transfers_out_in_hour', 'discharges_in_hour'], rows);
})();

// ---- ED visits
(function edOut() {
  const rows = edW.map(v => {
    const p = v.p, seen = v.decisionT != null && v.decisionT <= END, left = v.dispo === 'left_without_being_seen' && v.departT <= END, dep = v.departT != null && v.departT <= END;
    const dispo = left ? 'left_without_being_seen' : seen ? v.dispo : '';
    const adm = dispo === 'admitted';
    const viaOR = adm && v.inp.viaOR && dep ? 1 : 0;
    return [v.vid, v.id, p.id, T(v.arr), v.mode, v.level, LEVEL_TEXT[v.level], v.cc, p.age, T(v.triageT), v.hr, v.rr, v.sbp, v.dbp, v.temp.toFixed(1), v.spo2, v.pain, v.gcs,
      v.roomedT != null && v.roomedT <= END ? v.space.id : '', T(v.roomedT), T(v.docT), D(v.arr, v.docT), T(v.decisionT), dispo, T(v.departT), D(v.arr, v.departT),
      adm && dep ? r2((v.departT - v.decisionT) / 60) : (adm ? '' : (seen ? 0 : '')), left ? 1 : (dep || seen ? 0 : ''), adm ? eid(v.inp) : '', adm ? v.inp.req0 || '' : '', viaOR,
      v.roomedT != null && v.roomedT <= END ? v.loadAtRoom : '', dep ? 'departed' : (v.roomedT != null && v.roomedT <= END ? (adm ? 'boarding' : 'in_department') : 'waiting_room')];
  });
  writeCsv('ed_visits.csv', ['visit_id', 'encounter_id', 'patient_id', 'arrival_time', 'arrival_mode', 'urgency_level', 'urgency_description', 'chief_complaint', 'age_years', 'triage_time', 'triage_heart_rate', 'triage_resp_rate', 'triage_systolic_bp', 'triage_diastolic_bp', 'triage_temperature_c', 'triage_spo2_pct', 'triage_pain_score', 'triage_gcs',
    'ed_space', 'roomed_time', 'doctor_seen_time', 'door_to_doctor_min', 'disposition_decision_time', 'disposition', 'departure_time', 'ed_length_of_stay_min', 'boarding_hours', 'left_without_being_seen', 'admitted_encounter_id', 'requested_unit', 'went_direct_to_procedure', 'ed_occupancy_at_rooming', 'status'], rows);
})();

// ---- OR blocks, block-days, cases
writeCsv('or_blocks.csv', ['block_id', 'room', 'weekday', 'week_pattern', 'specialty', 'service', 'surgeon_id', 'start_time', 'end_time', 'block_minutes'],
  blocks.map(b => [b.id, b.room.name, DOW[b.dow], b.par ? 'B' : 'A', SPEC[b.spec][0], SPEC[b.spec][1], b.surgeon.id, pad(Math.floor(b.start / 60), 2) + ':' + pad(b.start % 60, 2), '17:00', b.end - b.start]));
(function blockDays() {
  const rows = [];
  for (let d = 0; d < N_DAYS; d++) {
    const dw = dowOf(d); if (dw < 1 || dw > 5) continue;
    for (const room of rooms) {
      const b = blockFor(room, d); if (!b) continue;
      const list = room.lists[d] || [];
      const st = HOLIDAYS.has(dstr(d)) ? 'public_holiday' : b.surgeon.leave.has(weekOf(d)) ? 'released_surgeon_leave' : 'active';
      const done = list.filter(c => c.status === 'completed');
      let used = 0, inBlock = 0; const bs = d * DAY + b.start, be = d * DAY + b.end;
      for (const c of done) { used += c.wheelsOut - c.wheelsIn; inBlock += Math.max(0, Math.min(c.wheelsOut, be) - Math.max(c.wheelsIn, bs)); }
      const lastOut = done.length ? Math.max(...done.map(c => c.wheelsOut)) : null;
      rows.push([dstr(d), room.name, b.id, b.par ? 'B' : 'A', SPEC[b.spec][0], b.surgeon.id, st, b.end - b.start, list.length, list.reduce((a, c) => a + c.estRoom, 0), done.length, used, inBlock, st === 'active' ? r1(inBlock / (b.end - b.start) * 100) : '', lastOut != null ? Math.max(0, lastOut - be) : '']);
    }
  }
  writeCsv('or_block_days.csv', ['date', 'room', 'block_id', 'week_pattern', 'specialty', 'surgeon_id', 'block_status', 'block_minutes', 'cases_booked', 'booked_room_minutes', 'cases_completed', 'actual_room_minutes', 'actual_minutes_inside_block', 'block_utilisation_pct', 'overrun_minutes'], rows);
})();
(function casesOut() {
  const rows = casesW.map(c => {
    const el = !c.addon, p = c.p, started = c.wheelsIn != null && c.wheelsIn <= END, fin = started && c.wheelsOut <= END;
    let status;
    if (c.status === 'cancelled_before') status = c.cancelT <= END ? 'cancelled_before_day' : 'scheduled';
    else if (c.status === 'cancelled_day_of') status = 'cancelled_day_of';
    else if (c.status === 'cancelled_addon') status = c.cancelT <= END ? 'cancelled_add_on' : 'requested';
    else status = fin ? 'completed' : started ? 'in_progress' : (el ? 'scheduled' : 'requested');
    const canc = status.startsWith('cancelled');
    const room = el ? c.block.room.name : (started ? c.room.name : '');
    const date = el ? dstr(c.day) : iso(started ? c.wheelsIn : c.reqT).slice(0, 10);
    const hold = (fin && c.pacuReady != null && c.pacuOut != null && c.pacuOut <= END) ? Math.max(0, Math.round(c.pacuOut - c.pacuReady)) : '';
    return [c.id, date, room, el ? c.block.id : '', SPEC[c.proc.spec][0], c.proc.name, c.proc.tier, c.surgeon.id, started && c.anaesthetist ? c.anaesthetist.id : '', started ? c.circ.id : '', started ? c.scrub.id : '', c.anaes, c.asa,
      p.id, started || (c.addon && c.enc && c.enc.id) ? eid(c.enc) : '', c.pclass || (c.cls === 'inpatient' ? (el ? 'same_day_admission' : 'inpatient') : 'day_surgery'), c.addon ? 1 : 0, c.addon ? c.cls0 : '', c.addon ? T(c.reqT) : '', el ? T(c.bookedT) : '', el ? c.seq : '',
      status, canc ? T(c.cancelT) : '', canc ? c.cancelReason : '', el ? T(c.schedStart) : '', el ? T(c.schedEnd) : '', c.estRoom, c.estProc,
      started ? T(c.wheelsIn) : '', started ? T(c.anReady) : '', started ? T(c.incision) : '', started ? T(c.closure) : '', started ? T(c.wheelsOut) : '', fin ? c.wheelsOut - c.wheelsIn : '', started && c.closure <= END ? c.closure - c.incision : '',
      el && started ? c.delay : '', el && started ? c.delayReason : '', c.addon && started ? c.wheelsIn - c.reqT : '', el && started ? c.first : '', el && started ? (c.delay <= 5 ? 1 : 0) : '', fin ? c.turnAfter : '', c.teaching, c.addon && c.bump ? 1 : 0,
      started ? (c.dest || (c.needICU ? c.icuUnit : c.cls === 'day_surgery' ? 'home' : c.ward)) : '', c.needICU ? 1 : 0, fin && c.pacuIn != null ? T(c.pacuIn) : '', fin && c.pacuIn != null ? T(c.pacuOut) : '', hold, p.age, p.bmi == null ? '' : p.bmi];
  });
  writeCsv('or_cases.csv', ['case_id', 'case_date', 'room', 'block_id', 'specialty', 'procedure_name', 'complexity_tier', 'surgeon_id', 'anaesthetist_id', 'circulating_nurse_id', 'scrub_practitioner_id', 'anaesthesia_type', 'asa_class',
    'patient_id', 'encounter_id', 'patient_class', 'add_on', 'add_on_urgency', 'add_on_request_time', 'booked_time', 'list_sequence', 'status', 'cancellation_time', 'cancellation_reason', 'scheduled_start', 'scheduled_end', 'scheduled_duration_min', 'estimated_procedure_min',
    'wheels_in', 'anaesthesia_ready', 'incision', 'closure', 'wheels_out', 'actual_room_min', 'actual_procedure_min', 'start_delay_min', 'delay_reason', 'add_on_request_to_start_min', 'first_case_of_day', 'on_time_start', 'turnover_after_min', 'teaching_case', 'bumped_elective_list',
    'post_op_destination', 'planned_intensive_care', 'recovery_in', 'recovery_out', 'recovery_hold_min', 'age_years', 'body_mass_index'], rows);
})();

// ---- clinic appointments
(function clinicOut() {
  const rows = appts.map(a => {
    const past = a.T <= END;
    let status = a.status, ct = a.cancelT, cr = a.cancelReason;
    if (!past) { if (ct != null && ct <= END) { /* already cancelled */ } else { status = 'scheduled'; ct = null; cr = ''; } }
    const done = past && status === 'completed';
    return [a.id, a.p.id, a.clinic.label, a.doc.id, T(a.bookedT), iso(a.T), r1(a.leadDays), a.vtype, a.tele ? 'telehealth' : 'in_person', a.len, a.overbook, (a.T - 3 * DAY <= END) ? a.confirmed : '', a.priorNS, a.priorAppts,
      status, T(ct), cr, done ? T(a.checkIn) : '', done && a.roomed != null ? T(a.roomed) : '', done ? T(a.docIn) : '', done ? T(a.docOut) : '', done ? T(a.checkout) : '', done ? Math.max(0, a.docIn - Math.max(a.checkIn, a.T)) : '', done ? a.checkout - a.checkIn : '',
      done ? eid(a.enc) : '', a.dem && a.dem.enc ? eid(a.dem.enc) : '', a.dem && a.dem.kase && a.dem.kase.inW ? a.dem.kase.id : ''];
  });
  writeCsv('clinic_appointments.csv', ['appointment_id', 'patient_id', 'clinic', 'clinician_id', 'booked_time', 'appointment_time', 'lead_time_days', 'visit_type', 'mode', 'slot_minutes', 'overbooked', 'reminder_confirmed', 'prior_no_shows', 'prior_appointments_in_dataset',
    'status', 'cancellation_time', 'cancellation_reason', 'check_in_time', 'roomed_time', 'doctor_in_time', 'doctor_out_time', 'checkout_time', 'wait_after_appointment_time_min', 'cycle_time_min', 'encounter_id', 'follow_up_of_encounter_id', 'pre_op_for_case_id'], rows);
})();

// ---- staffing shifts
(function staffing() {
  const r = new Rng('staffing'); const rows = []; let k = 0;
  for (let d = 0; d < N_DAYS; d++) for (const u of UNITS) for (let sh = 0; sh < 2; sh++) {
    const c = CEN[u[0]], h0 = d * 24 + (sh ? 19 : 7), dw = dowOf(d), mo = monthOf(d);
    let sum = 0, n = 0, mx = 0, adm = 0, dis = 0;
    for (let h = h0; h < h0 + 12 && h < NH; h++) { sum += c.occ[h]; n++; if (c.occ[h] > mx) mx = c.occ[h]; adm += c.adm[h] + c.tin[h]; dis += c.dis[h] + c.tout[h]; }
    const avg = sum / n, start = c.occ[h0], ratio = sh ? u[6] : u[5];
    const required = Math.max(2, Math.ceil(avg / ratio));
    const scheduled = Math.max(2, Math.ceil(avg * clamp(r.norm(1, .07), .82, 1.2) / ratio) + (r.bern(.2) ? 1 : 0));
    const pc = .045 + (dw === 0 || dw === 6 ? .02 : 0) + (dw === 1 ? .015 : 0) + (sh ? .01 : 0) + (mo >= 10 ? .012 : 0);
    let call = 0; for (let i = 0; i < scheduled; i++) if (r.bern(pc)) call++;
    let fl = 0, ag = 0, ot = 0; const gap = Math.max(0, required - (scheduled - call));
    for (let i = 0; i < gap; i++) { const x = r.u(); if (x < .3) fl++; else if (x < .45) ag++; else if (x < .65) ot++; }
    const floatOut = (scheduled - call - required >= 2 && r.bern(.5)) ? 1 : 0;
    const actual = scheduled - call + fl + ag + ot - floatOut;
    const na = Math.max(1, Math.round(avg / (u[4] === 'icu' ? 12 : 9) + r.norm(0, .4)));
    const charge = wardStaff[u[0]].charge[(d * 2 + sh + (u[3] % 5)) % 6];
    rows.push(['SHF-' + pad(++k, 5), dstr(d), u[0], sh ? 'night' : 'day', iso(h0 * 60), T((h0 + 12) * 60), start, r1(avg), mx, adm, dis, ratio, required, scheduled, call, fl, ag, ot, floatOut, actual, na, r2(r1(avg) / actual), actual < required ? 1 : 0, ot * 12 + (actual < required ? r.int(1, 6) : 0), charge.id]);
  }
  writeCsv('staffing_shifts.csv', ['shift_id', 'date', 'unit', 'shift', 'shift_start', 'shift_end', 'census_at_start', 'average_census', 'peak_census', 'arrivals_in_shift', 'departures_in_shift', 'target_patients_per_nurse', 'nurses_required', 'nurses_scheduled', 'sick_calls', 'float_pool_in', 'agency_nurses', 'overtime_nurses', 'floated_out', 'nurses_actual', 'nursing_assistants', 'patients_per_nurse', 'below_required', 'overtime_hours', 'charge_nurse_id'], rows);
})();

// ---- inbox
writeCsv('inbox_messages.csv', ['message_id', 'created_time', 'message_type', 'sender_role', 'sender_staff_id', 'recipient_role', 'recipient_staff_id', 'patient_id', 'encounter_id', 'urgency', 'text', 'read_time', 'actioned_time', 'action_taken', 'minutes_to_read', 'minutes_to_action'],
  msgs.map(m => [m.id, iso(m.t), m.type, m.sRole, m.sStaff, m.rRole, m.rStaff, m.p ? m.p.id : '', eid(m.enc), m.flag, m.text, T(m.read), T(m.act), m.action, D(m.t, m.read), D(m.t, m.act)]));

// ---- vitals
writeCsv('vitals_ward_sample.csv', ['encounter_id', 'patient_id', 'unit', 'bed_id', 'observation_time', 'heart_rate', 'resp_rate', 'systolic_bp', 'diastolic_bp', 'temperature_c', 'spo2_pct', 'supplemental_oxygen', 'oxygen_l_min', 'consciousness', 'pain_score', 'early_warning_score'],
  vitRows.map(v => [v[0].id, v[0].p.id, v[1].bed.unit, v[1].bed.id, iso(v[2]), v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10], v[11], v[12], v[13]]));

// =====================================================================================================
//                                            GROUND TRUTH
// =====================================================================================================
writeCsv('ground_truth/vitals_deterioration_truth.csv', ['encounter_id', 'patient_id', 'observations', 'max_early_warning_score', 'deteriorated', 'deterioration_type', 'onset_time', 'recognition_time', 'outcome', 'icu_arrival_time', 'hours_onset_to_recognition', 'onset_after_snapshot', 'recognition_after_snapshot'],
  vitTruth.map(v => {
    const e = v[0], d = v[1]; if (!d) return [e.id, e.p.id, v[2], v[3], 0, '', '', '', 'none', '', '', '', ''];
    let icuT = ''; if (d.outcome === 'icu_transfer') { const s = e.stays.find(s => s.tin >= d.eventT && unit[s.bed.unit].kind === 'icu'); if (s) icuT = iso(s.tin); }
    return [e.id, e.p.id, v[2], v[3], 1, d.type, iso(d.onsetT), iso(d.eventT), d.outcome === 'ward_managed' ? 'treated_on_ward_recovered' : d.outcome === 'death' ? 'death_on_ward' : 'icu_transfer', icuT, r1(d.ramp / 60), d.onsetT > END ? 1 : 0, d.eventT > END ? 1 : 0];
  }));
writeCsv('ground_truth/case_duration_procedure_params.csv', ['procedure_name', 'specialty', 'complexity_tier', 'median_procedure_min', 'log_sd', 'pre_incision_median_min', 'pre_incision_log_sd', 'post_closure_median_min', 'post_closure_log_sd', 'probability_inpatient', 'probability_intensive_care', 'post_op_ward_stay_median_days', 'elective_mix_weight'],
  Object.values(PROC).map(p => [p.name, SPEC[p.spec][0], p.tier, p.med, p.sg, p.pre, .28, p.post, .35, p.pInp, p.pIcu, p.postLos, p.w]));
writeCsv('ground_truth/case_duration_surgeon_effects.csv', ['surgeon_id', 'specialty', 'log_duration_effect', 'first_case_late_probability', 'booking_estimate_multiplier', 'block_fill_target', 'overtime_tolerance_min'],
  allSurgeons.map(s => [s.id, s.spec, Math.round(s.eff * 10000) / 10000, r2(s.pLate), r2(s.bias), r2(s.fill), s.otTol]));
writeCsv('ground_truth/case_duration_surgeon_procedure_effects.csv', ['surgeon_id', 'procedure_name', 'log_duration_effect'],
  [].concat(...allSurgeons.map(s => Object.keys(s.pair).sort().map(k => [s.id, PROC[k].name, Math.round(s.pair[k] * 10000) / 10000]))));
fs.writeFileSync(path.join(GT, 'case_duration_model.json'), JSON.stringify({
  description: 'True generating model for incision-to-closure minutes. log(minutes) = log(median_procedure_min) + surgeon effect + surgeon-by-procedure effect + covariate terms + log_sd * z, z ~ N(0,1); with a small probability the result is multiplied by a complication factor. Pre-incision and post-closure minutes are independent lognormals around the procedure medians. The booking estimate is median * exp(0.7 * surgeon effect) * surgeon booking multiplier * exp(N(0, 0.10)), rounded to 5 minutes.',
  coefficients: DUR_MODEL, turnover: { median_min: { tier_4_5: 34, day_surgery: 22, other: 27 }, log_sd: .35, extra_delay_probability: .05, extra_delay_min: [15, 45] },
  start_delays: { first_case_patient_late_p: .10, to_follow_patient_not_ready_p: .06, equipment_not_ready_p: .03, first_case_anaesthesia_delay_p: .09, to_follow_discretionary_delay_p: .10, early_start_allowance_min: 30 },
}, null, 1) + '\n');
FILES.push({ file: 'ground_truth/case_duration_model.json', rows: '', cols: '', bytes: fs.statSync(path.join(GT, 'case_duration_model.json')).size });
writeCsv('ground_truth/case_duration_case_truth.csv', ['case_id', 'true_log_median', 'log_sd', 'noise_z', 'complication', 'complication_multiplier', 'true_median_procedure_min'],
  casesW.filter(c => c.trueMu != null && c.wheelsIn <= END).map(c => [c.id, Math.round(c.trueMu * 10000) / 10000, c.proc.sg, Math.round(c.z * 10000) / 10000, c.complication, r2(c.compMult), r1(Math.exp(c.trueMu))]));
writeCsv('ground_truth/or_delay_truth.csv', ['case_id', 'scheduled_start', 'actual_start', 'start_delay_min', 'earliest_feasible_start', 'unavoidable_delay_min', 'avoidable_delay_min', 'binding_constraint', 'room_ready_time', 'surgeon_free_time', 'anaesthetist_free_time', 'patient_ready_time', 'equipment_ready_time', 'discretionary_delay_min', 'discretionary_reason'],
  casesW.filter(c => !c.addon && c.status === 'completed' && c.delay > 5 && c.wheelsIn <= END).map(c => {
    const f = x => x > c.schedStart - 240 ? iso(x) : '';     // only shown when close enough to matter
    return [c.id, iso(c.schedStart), iso(c.wheelsIn), c.delay, iso(c.earliest), c.earliest - c.schedStart, c.wheelsIn - c.earliest, c.binding, f(c.tr.room), f(c.tr.surgeon), f(c.tr.anaes), f(c.tr.patient), f(c.tr.equip), c.tr.soft, c.tr.softReason];
  }));
fs.writeFileSync(path.join(GT, 'no_show_model.json'), JSON.stringify({ description: 'True generating model. P(no-show) = logistic(sum of terms below + patient random effect). Early and late cancellations are drawn first with fixed probabilities; the no-show draw applies to appointments that were not cancelled.', coefficients: NS_MODEL }, null, 1) + '\n');
FILES.push({ file: 'ground_truth/no_show_model.json', rows: '', cols: '', bytes: fs.statSync(path.join(GT, 'no_show_model.json')).size });
writeCsv('ground_truth/no_show_truth.csv', ['appointment_id', 'true_no_show_probability', 'patient_random_effect', 'true_final_status', 'after_snapshot'],
  appts.map(a => [a.id, Math.round(a.pNS * 10000) / 10000, Math.round(a.p.nsRE * 1000) / 1000, a.status, a.T > END ? 1 : 0]));
writeCsv('ground_truth/inbox_truth.csv', ['message_id', 'true_priority', 'true_priority_label', 'linked_to_deterioration'],
  msgs.map(m => [m.id, m.prio, ['', 'act within the hour', 'act the same day', 'act within three days', 'no clinical action needed'][m.prio], m.enc && m.enc.det && m.enc.det.sched && m.type !== 'bed_request' && m.type !== 'discharge_planning' && m.prio <= 2 && m.o.inpatient && Math.abs(m.t - m.enc.det.eventT) < 3 * DAY ? 1 : 0]));
writeCsv('ground_truth/censored_outcomes.csv', ['encounter_id', 'patient_id', 'status_at_snapshot', 'true_discharge_time', 'true_length_of_stay_hours', 'true_discharge_disposition', 'true_readmitted_within_30d'],
  inpEncs.filter(e => e.dischargeT == null || e.dischargeT > END || (e.dispo !== 'expired' && e.dischargeT + 30 * DAY > END)).map(e => [e.id, e.p.id, e.dischargeT != null && e.dischargeT <= END ? 'discharged' : 'in_hospital', e.dischargeT != null ? iso(e.dischargeT) : '', e.dischargeT != null ? r1((e.dischargeT - e.admitT) / 60) : '', e.dispo || '', e.dispo === 'expired' ? '' : e.readmTrue]));
writeCsv('ground_truth/length_of_stay_params.csv', ['admitting_diagnosis_group', 'service', 'ward_unit', 'ward_stay_median_days', 'ward_stay_log_sd', 'base_probability_icu_first', 'icu_unit', 'base_mortality', 'readmission_odds_multiplier', 'deterioration_multiplier', 'add_on_procedure_probability'],
  Object.values(DX).map(d => [d.n, d.svc, d.u, d.los, d.sg, d.picu, d.iu || 'icu', d.mort, d.ra, d.det, d.ao ? d.ao[1] : 0]));

// ---- optimised reference schedule for held-out days
(function orReference() {
  const r = new Rng('orref');
  const COST = { wait: 1.0, idle: 0.5, overtime: 2.0 }, TURN = 30, NS = 150;
  const held = []; for (let d = N_DAYS - 1; d >= 0 && held.length < 20; d--) if (isWorkday(d)) held.push(d); held.reverse();
  const sched = [], obj = [];
  const evalSeq = (order, planDur, dur, blockLen, plannedStarts) => { // returns [wait, idle, overtime]
    let wait = 0, idle = 0, prevReady = 0, ps = 0, end = 0;
    for (let k = 0; k < order.length; k++) {
      const i = order[k]; const p = plannedStarts ? plannedStarts[k] : ps;
      const start = Math.max(p, prevReady);
      wait += start - p; if (k > 0) idle += Math.max(0, p - prevReady);
      end = start + dur[i]; prevReady = end + TURN; ps = p + planDur[i] + TURN;
    }
    return [wait, idle, Math.max(0, end - blockLen)];
  };
  const J = c => COST.wait * c[0] + COST.idle * c[1] + COST.overtime * c[2];
  for (const d of held) {
    const tot = { n: 0, be: 0, re: 0, br: 0, rr: 0 };
    for (const room of rooms) {
      const list = (room.lists[d] || []).filter(c => c.status === 'completed'); if (!list.length) continue;
      const b = list[0].block, blockLen = b.end - b.start, bs = d * DAY + b.start, n = list.length;
      // scenario samples from the true model (noise and complications unknown to the planner)
      const samp = []; for (let s = 0; s < NS; s++) samp.push(list.map(c => { const comp = r.bern(DUR_MODEL.complication_base_p + DUR_MODEL.complication_p_per_tier * (c.proc.tier - 1)) ? r.uni(1.35, 2.2) : 1; return r.logn(c.proc.pre, .28) + Math.exp(c.trueMu + c.proc.sg * r.norm()) * comp + r.logn(c.proc.post, .35); }));
      const real = list.map(c => c.wheelsOut - c.wheelsIn);
      const mean = list.map((c, i) => samp.reduce((a, s) => a + s[i], 0) / NS);
      const sd = list.map((c, i) => Math.sqrt(samp.reduce((a, s) => a + (s[i] - mean[i]) ** 2, 0) / NS));
      const qs = list.map((c, i) => samp.map(s => s[i]).sort((x, y) => x - y));
      const expCost = (order, pd, starts) => { let a = 0; for (const s of samp) a += J(evalSeq(order, pd, s, blockLen, starts)); return a / NS; };
      // booked schedule as published
      const bOrder = list.map((c, i) => i), bStarts = list.map(c => c.schedStart - bs), bDur = list.map(c => c.estRoom);
      const bExp = expCost(bOrder, bDur, bStarts), bReal = evalSeq(bOrder, bDur, real, blockLen, bStarts);
      // reference: smallest-variance-first, newsvendor-style planned durations, pairwise-swap local search
      let best = null;
      for (const q of [.4, .5, .6, .7]) {
        const pd = qs.map(a => Math.round(a[Math.floor(q * (NS - 1))] / 5) * 5);
        let order = list.map((c, i) => i).sort((x, y) => sd[x] - sd[y]); let cost = expCost(order, pd, null), improved = true, pass = 0;
        while (improved && pass++ < 4) {
          improved = false;
          for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) { const o2 = order.slice(); o2[i] = order[j]; o2[j] = order[i]; const c2 = expCost(o2, pd, null); if (c2 < cost - 1e-9) { order = o2; cost = c2; improved = true; } }
        }
        if (!best || cost < best.cost) best = { cost, order, pd, q };
      }
      const rReal = evalSeq(best.order, best.pd, real, blockLen, null);
      let ps = 0; const rStart = {}; best.order.forEach((i, k) => { rStart[i] = ps; ps += best.pd[i] + TURN; });
      list.forEach((c, i) => sched.push([dstr(d), room.name, c.id, c.seq, iso(c.schedStart), c.estRoom, best.order.indexOf(i) + 1, iso(bs + rStart[i]), best.pd[i], r1(mean[i]), r1(sd[i]), real[i]]));
      obj.push([dstr(d), room.name, n, blockLen, r1(bExp), r1(best.cost), r1(J(bReal)), r1(J(rReal)), bReal[0], bReal[1], bReal[2], rReal[0], rReal[1], rReal[2], best.q]);
      tot.n += n; tot.be += bExp; tot.re += best.cost; tot.br += J(bReal); tot.rr += J(rReal);
    }
    obj.push([dstr(d), 'ALL ROOMS', tot.n, '', r1(tot.be), r1(tot.re), r1(tot.br), r1(tot.rr), '', '', '', '', '', '', '']);
  }
  writeCsv('ground_truth/or_reference_schedule.csv', ['date', 'room', 'case_id', 'booked_sequence', 'booked_start', 'booked_duration_min', 'reference_sequence', 'reference_start', 'reference_planned_duration_min', 'true_expected_room_min', 'true_sd_room_min', 'realised_room_min'], sched);
  writeCsv('ground_truth/or_reference_objective.csv', ['date', 'room', 'cases', 'block_minutes', 'booked_expected_cost', 'reference_expected_cost', 'booked_realised_cost', 'reference_realised_cost', 'booked_wait_min', 'booked_idle_min', 'booked_overtime_min', 'reference_wait_min', 'reference_idle_min', 'reference_overtime_min', 'reference_planning_quantile'], obj);
  fs.writeFileSync(path.join(GT, 'or_reference_method.json'), JSON.stringify({
    held_out_dates: held.map(dstr),
    problem: 'For each room and held-out day, re-sequence the elective cases that were actually performed (same room, same surgeon) and set planned durations. Cases cannot move between rooms or days.',
    objective: 'cost = 1.0 * minutes cases start after their planned start + 0.5 * minutes the room stands idle waiting for a planned start + 2.0 * minutes the last case finishes after the block end; turnover fixed at 30 minutes; no early starts.',
    method: 'Sample-average approximation with ' + NS + ' duration scenarios drawn from the true (hidden) duration model for each case; start from smallest-variance-first order; planned duration = scenario quantile chosen from {0.4,0.5,0.6,0.7}; improve by pairwise-swap local search on expected cost. Heuristic, not a proven optimum.',
    columns: 'expected cost = mean over scenarios; realised cost = the same replay using the durations that actually occurred. The booked schedule is replayed under the same simplified rules, so its cost differs from the delays recorded in or_cases.csv (which also include patient, equipment, staff and emergency effects).',
  }, null, 1) + '\n');
  FILES.push({ file: 'ground_truth/or_reference_method.json', rows: '', cols: '', bytes: fs.statSync(path.join(GT, 'or_reference_method.json')).size });
})();

// ---- manifest + console summary
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ dataset: 'Northfield Medical Center synthetic operations dataset', synthetic: true, seed: SEED, window_start: iso(0), snapshot: iso(END), files: FILES }, null, 1) + '\n');
let total = 0; for (const f of FILES) total += f.bytes;
console.log('seed ' + SEED + '  events simulated ' + nEvents + '  simulation warnings ' + warnCount + (warnCount ? ' ' + JSON.stringify(WARN) : ''));
for (const f of FILES) console.log(String(f.file).padEnd(52) + String(f.rows).padStart(8) + ' rows ' + String(f.cols).padStart(3) + ' cols ' + (f.bytes / 1048576).toFixed(2).padStart(7) + ' MB');
console.log('TOTAL'.padEnd(52) + ' '.repeat(22) + (total / 1048576).toFixed(2).padStart(7) + ' MB');
