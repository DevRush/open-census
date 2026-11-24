/* fhir-map.js — maps one native practice-chart patient object to a FHIR R4 Bundle.
 *
 * Dependency-free. Works in Node (module.exports) and in a browser (global FHIRMAP).
 *
 *   FHIRMAP.toBundle(patient[, opts])   -> Bundle (type "collection")
 *   FHIRMAP.resourceTypes(bundle)       -> { Patient: 1, Observation: 412, ... }
 *   FHIRMAP.toTransaction(bundle)       -> same resources as a "transaction" Bundle (PUT Type/id)
 *
 * opts: { tz: '-05:00', base: 'https://example.org/...', now: Date }  (all optional)
 *
 * The answer key (`key`), ordering alerts (`alerts`) and app state (`pending`) are never mapped.
 * Codes: only LOINC / ICD-10-CM / SNOMED CT / HL7 codes from the small built-in tables below are
 * emitted. Anything not matched confidently is a text-only CodeableConcept. No codes are invented.
 * All data are synthetic.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FHIRMAP = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CONFIG = {
    tz: '-05:00', // wall-clock offset attached to every timestamp (fictional US Eastern hospital, November)
    base: 'https://example.org/open-census/fhir',
    mrnSystem: 'https://example.org/open-census/mrn',
    orgId: 'org-northfield',
    orgName: 'Northfield Medical Center (fictional, synthetic data)'
  };

  var SYS = {
    loinc: 'http://loinc.org',
    icd: 'http://hl7.org/fhir/sid/icd-10-cm',
    sct: 'http://snomed.info/sct',
    ucum: 'http://unitsofmeasure.org',
    obsCat: 'http://terminology.hl7.org/CodeSystem/observation-category',
    interp: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
    actCode: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    actReason: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
    condClin: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
    condCat: 'http://terminology.hl7.org/CodeSystem/condition-category',
    allergyClin: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
    v2_0074: 'http://terminology.hl7.org/CodeSystem/v2-0074',
    v2_0203: 'http://terminology.hl7.org/CodeSystem/v2-0203',
    locType: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
    medReqCat: 'http://terminology.hl7.org/CodeSystem/medicationrequest-category',
    docCat: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category'
  };

  /* ---------------- built-in code tables (conservative) ---------------- */

  // Vitals group rows, by row key `k`.
  var VITAL_LOINC = {
    temp: ['8310-5', 'Body temperature'],
    hr: ['8867-4', 'Heart rate'],
    rr: ['9279-1', 'Respiratory rate'],
    bp: ['85354-9', 'Blood pressure panel with all children optional'],
    map: ['8478-0', 'Mean blood pressure'],
    spo2: ['59408-5', 'Oxygen saturation in Arterial blood by Pulse oximetry'],
    pain: ['72514-3', 'Pain severity - 0-10 verbal numeric rating [Score] - Reported']
  };
  var BP_SYS = ['8480-6', 'Systolic blood pressure'];
  var BP_DIA = ['8462-4', 'Diastolic blood pressure'];
  var WEIGHT = ['29463-7', 'Body weight'];
  var HEIGHT = ['8302-2', 'Body height'];

  // Other flowsheet rows: label regex + required unit -> LOINC. Label must match from the start.
  var FLOW_LOINC = [
    [/^weight$/i, 'kg', WEIGHT],
    [/^heart rate$/i, '/min', VITAL_LOINC.hr],
    [/^respiratory rate$/i, '/min', VITAL_LOINC.rr],
    [/^glasgow coma scale$/i, null, ['9269-2', 'Glasgow coma score total']],
    [/^(blood glucose \(bedside\)|bedside glucose)$/i, 'mg/dL', ['41653-7', 'Glucose [Mass/volume] in Capillary blood by Glucometer']],
    [/^oxygen flow$/i, 'L/min', ['3151-8', 'Inhaled oxygen flow rate']]
  ];

  // Labs: exact (lower-cased) test name + exact unit -> LOINC. Blood/serum tests only; rows from
  // panels that look like urine or body-fluid panels are never matched against this table.
  var LAB_LOINC = [
    ['sodium', 'mmol/L', '2951-2', 'Sodium [Moles/volume] in Serum or Plasma'],
    ['potassium', 'mmol/L', '2823-3', 'Potassium [Moles/volume] in Serum or Plasma'],
    ['chloride', 'mmol/L', '2075-0', 'Chloride [Moles/volume] in Serum or Plasma'],
    ['bicarbonate', 'mmol/L', '1963-8', 'Bicarbonate [Moles/volume] in Serum or Plasma'],
    ['urea nitrogen', 'mg/dL', '3094-0', 'Urea nitrogen [Mass/volume] in Serum or Plasma'],
    ['creatinine', 'mg/dL', '2160-0', 'Creatinine [Mass/volume] in Serum or Plasma'],
    ['glucose', 'mg/dL', '2345-7', 'Glucose [Mass/volume] in Serum or Plasma'],
    ['calcium', 'mg/dL', '17861-6', 'Calcium [Mass/volume] in Serum or Plasma'],
    ['magnesium', 'mg/dL', '19123-9', 'Magnesium [Mass/volume] in Serum or Plasma'],
    ['phosphate', 'mg/dL', '2777-1', 'Phosphate [Mass/volume] in Serum or Plasma'],
    ['albumin', 'g/dL', '1751-7', 'Albumin [Mass/volume] in Serum or Plasma'],
    ['total protein', 'g/dL', '2885-2', 'Protein [Mass/volume] in Serum or Plasma'],
    ['bilirubin, total', 'mg/dL', '1975-2', 'Bilirubin.total [Mass/volume] in Serum or Plasma'],
    ['total bilirubin', 'mg/dL', '1975-2', 'Bilirubin.total [Mass/volume] in Serum or Plasma'],
    ['aspartate aminotransferase', 'U/L', '1920-8', 'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma'],
    ['ast', 'U/L', '1920-8', 'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma'],
    ['alanine aminotransferase', 'U/L', '1742-6', 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma'],
    ['alt', 'U/L', '1742-6', 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma'],
    ['alkaline phosphatase', 'U/L', '6768-6', 'Alkaline phosphatase [Enzymatic activity/volume] in Serum or Plasma'],
    ['lactate dehydrogenase', 'U/L', '2532-0', 'Lactate dehydrogenase [Enzymatic activity/volume] in Serum or Plasma'],
    ['ldh', 'U/L', '2532-0', 'Lactate dehydrogenase [Enzymatic activity/volume] in Serum or Plasma'],
    ['lipase', 'U/L', '3040-3', 'Lipase [Enzymatic activity/volume] in Serum or Plasma'],
    ['creatine kinase', 'U/L', '2157-6', 'Creatine kinase [Enzymatic activity/volume] in Serum or Plasma'],
    ['uric acid', 'mg/dL', '3084-1', 'Urate [Mass/volume] in Serum or Plasma'],
    ['lactate', 'mmol/L', '2524-7', 'Lactate [Moles/volume] in Serum or Plasma'],
    ['anion gap (computed)', 'mmol/L', '33037-3', 'Anion gap in Serum or Plasma'],
    ['anion gap', 'mmol/L', '33037-3', 'Anion gap in Serum or Plasma'],
    ['c-reactive protein', 'mg/L', '1988-5', 'C reactive protein [Mass/volume] in Serum or Plasma'],
    ['procalcitonin', 'ng/mL', '33959-8', 'Procalcitonin [Mass/volume] in Serum or Plasma'],
    ['b-type natriuretic peptide', 'pg/mL', '30934-4', 'Natriuretic peptide B [Mass/volume] in Serum or Plasma'],
    ['troponin t, high sensitivity', 'ng/L', '67151-1', 'Troponin T.cardiac [Mass/volume] in Serum or Plasma by High sensitivity method'],
    ['carcinoembryonic antigen', 'ng/mL', '2039-6', 'Carcinoembryonic Ag [Mass/volume] in Serum or Plasma'],
    ['thyroid stimulating hormone', 'mIU/L', '3016-3', 'Thyrotropin [Units/volume] in Serum or Plasma'],
    ['haemoglobin a1c', '%', '4548-4', 'Hemoglobin A1c/Hemoglobin.total in Blood'],
    ['vitamin b12', 'pg/mL', '2132-9', 'Cobalamin (Vitamin B12) [Mass/volume] in Serum or Plasma'],
    ['ethanol', 'mg/dL', '5643-2', 'Ethanol [Mass/volume] in Serum or Plasma'],
    ['white cells', '×10⁹/L', '6690-2', 'Leukocytes [#/volume] in Blood by Automated count'],
    ['haemoglobin', 'g/dL', '718-7', 'Hemoglobin [Mass/volume] in Blood'],
    ['haematocrit', '%', '4544-3', 'Hematocrit [Volume Fraction] of Blood by Automated count'],
    ['platelets', '×10⁹/L', '777-3', 'Platelets [#/volume] in Blood by Automated count'],
    ['mean cell volume', 'fL', '787-2', 'MCV [Entitic volume] by Automated count'],
    ['neutrophils', '×10⁹/L', '751-8', 'Neutrophils [#/volume] in Blood by Automated count'],
    ['absolute neutrophils', '×10⁹/L', '751-8', 'Neutrophils [#/volume] in Blood by Automated count'],
    ['lymphocytes', '×10⁹/L', '731-0', 'Lymphocytes [#/volume] in Blood by Automated count'],
    ['eosinophils', '×10⁹/L', '711-2', 'Eosinophils [#/volume] in Blood by Automated count'],
    ['inr', '', '6301-6', 'INR in Platelet poor plasma by Coagulation assay'],
    ['inr', 'ratio', '6301-6', 'INR in Platelet poor plasma by Coagulation assay'],
    ['prothrombin time', 's', '5902-2', 'Prothrombin time (PT)'],
    ['partial thromboplastin time', 's', '14979-9', 'aPTT in Platelet poor plasma by Coagulation assay'],
    ['prothrombin time', 'seconds', '5902-2', 'Prothrombin time (PT)'],
    ['partial thromboplastin time', 'seconds', '14979-9', 'aPTT in Platelet poor plasma by Coagulation assay'],
    ['activated partial thromboplastin time', 's', '14979-9', 'aPTT in Platelet poor plasma by Coagulation assay'],
    ['activated partial thromboplastin time', 'seconds', '14979-9', 'aPTT in Platelet poor plasma by Coagulation assay'],
    ['nt-probnp', 'pg/mL', '33762-6', 'Natriuretic peptide.B prohormone N-Terminal [Mass/volume] in Serum or Plasma'],
    ['free thyroxine', 'ng/dL', '3024-7', 'Thyroxine (T4) free [Mass/volume] in Serum or Plasma'],
    ['lithium', 'mmol/L', '14334-7', 'Lithium [Moles/volume] in Serum or Plasma'],
    ['vancomycin trough', 'mcg/mL', '4092-3', 'Vancomycin [Mass/volume] in Serum or Plasma --trough'],
    ['fibrinogen', 'mg/dL', '3255-7', 'Fibrinogen [Mass/volume] in Platelet poor plasma by Coagulation assay'],
    ['arterial ph', '', '2744-1', 'pH of Arterial blood'],
    ['arterial pco2', 'mmHg', '2019-8', 'Carbon dioxide [Partial pressure] in Arterial blood'],
    ['arterial po2', 'mmHg', '2703-7', 'Oxygen [Partial pressure] in Arterial blood']
  ];
  var NON_BLOOD_PANEL = /urin|fluid|ascit|drain|pleural|periton|cerebrospinal|csf|stool|sputum|swab|tap\b/i;

  // UCUM codes for the units used in the charts. Units not listed are emitted as plain `unit` text.
  var UCUM = {
    '°C': 'Cel', '/min': '/min', 'mmHg': 'mm[Hg]', '%': '%', 'mg/dL': 'mg/dL', 'g/dL': 'g/dL',
    'mmol/L': 'mmol/L', 'ng/mL': 'ng/mL', 'pg/mL': 'pg/mL', 'ng/L': 'ng/L', 'U/L': 'U/L', 's': 's',
    'mL': 'mL', 'mL/h': 'mL/h', 'kg': 'kg', 'cm': 'cm', 'L/min': 'L/min', 'fL': 'fL', 'mg/L': 'mg/L',
    'mIU/L': 'm[IU]/L', '×10⁹/L': '10*9/L', 'µmol/L': 'umol/L', 'cells/µL': '/uL', 'g/hour': 'g/h',
    'mcg/kg/min': 'ug/kg/min', 'g/g': 'g/g', 'mg/mg': 'mg/mg', 'mEq/L': 'meq/L', 'g': 'g', 'mg': 'mg',
    'seconds': 's', 'mcg/mL': 'ug/mL', 'ng/dL': 'ng/dL', 'IU/L': '[IU]/L', 'IU/mL': '[IU]/mL', 'U/mL': 'U/mL', 'mm/h': 'mm/h', '/µL': '/uL'
  };

  // Problem text -> ICD-10-CM. First match wins. Entries are deliberately general ("unspecified")
  // codes; problems that need details the text does not give are left as text only.
  var ICD_SKIP = /^(history of|previous|prior|past|resolved|risk of|rule out|possible|suspected|family history)\b|\((history|resolved)\)|, resolved\b/i;
  var ICD10 = [
    [/^septic shock\b/i, 'R65.21', 'Severe sepsis with septic shock'],
    [/pneumonia (with|due to|from) streptococcus pneumoniae|^pneumococcal pneumonia/i, 'J13', 'Pneumonia due to Streptococcus pneumoniae'],
    [/^acute hypox(a)?emic respiratory failure\b/i, 'J96.01', 'Acute respiratory failure with hypoxia'],
    [/^acute kidney injury\b/i, 'N17.9', 'Acute kidney failure, unspecified'],
    [/^end-stage kidney disease\b/i, 'N18.6', 'End stage renal disease'],
    [/^type 2 diabetes( mellitus)?( \(|$)/i, 'E11.9', 'Type 2 diabetes mellitus without complications'],
    [/^copd\b|^chronic obstructive pulmonary disease\b/i, 'J44.9', 'Chronic obstructive pulmonary disease, unspecified'],
    [/^(essential )?hypertension( \(|$)/i, 'I10', 'Essential (primary) hypertension'],
    [/^hypothyroidism( \(|$)/i, 'E03.9', 'Hypothyroidism, unspecified'],
    [/^hyperlipid(a)?emia( \(|$)/i, 'E78.5', 'Hyperlipidemia, unspecified'],
    [/^permanent atrial fibrillation\b/i, 'I48.21', 'Permanent atrial fibrillation'],
    [/^(new )?atrial fibrillation\b/i, 'I48.91', 'Unspecified atrial fibrillation'],
    [/^acute decompensated heart failure\b/i, 'I50.9', 'Heart failure, unspecified'],
    [/^(low potassium|hypokal(a)?emia)\b/i, 'E87.6', 'Hypokalemia'],
    [/^((mild )?low sodium|hyponatr(a)?emia)\b/i, 'E87.1', 'Hypo-osmolality and hyponatremia'],
    [/^(low magnesium|hypomagnes(a)?emia)\b/i, 'E83.42', 'Hypomagnesemia'],
    [/^(high potassium|hyperkal(a)?emia)\b/i, 'E87.5', 'Hyperkalemia'],
    [/^constipation\b(?!.*(opioid|drug|medic))/i, 'K59.00', 'Constipation, unspecified'],
    [/^acute blood loss an(a)?emia\b/i, 'D62', 'Acute posthemorrhagic anemia'],
    [/^iron deficiency an(a)?emia\b/i, 'D50.9', 'Iron deficiency anemia, unspecified'],
    [/^hepatic encephalopathy\b/i, 'K76.82', 'Hepatic encephalopathy'],
    [/^chronic low back pain\b/i, 'M54.50', 'Low back pain, unspecified'],
    [/^migraine with aura\b/i, 'G43.109', 'Migraine with aura, not intractable, without status migrainosus'],
    [/^acute myeloid leuk(a)?emia\b/i, 'C92.00', 'Acute myeloblastic leukemia, not having achieved remission'],
    [/^dysphagia\b/i, 'R13.10', 'Dysphagia, unspecified'],
    [/^viral gastroenteritis\b/i, 'A08.4', 'Viral intestinal infection, unspecified'],
    [/^severe asthma exacerbation\b|^asthma exacerbation\b/i, 'J45.901', 'Unspecified asthma with (acute) exacerbation'],
    [/^osteoporosis\b(?!.*(current|pathological) fracture)/i, 'M81.0', 'Age-related osteoporosis without current pathological fracture'],
    [/^(gastro-?o?esophageal reflux( disease)?|gerd)\b/i, 'K21.9', 'Gastro-esophageal reflux disease without esophagitis'],
    [/^obstructive sleep apn(o)?ea\b/i, 'G47.33', 'Obstructive sleep apnea (adult) (pediatric)'],
    [/^gout( \(|$)/i, 'M10.9', 'Gout, unspecified'],
    [/^urinary tract infection\b/i, 'N39.0', 'Urinary tract infection, site not specified'],
    [/^obesity( \(|$)/i, 'E66.9', 'Obesity, unspecified']
  ];

  // Note type -> LOINC document type.
  var NOTE_LOINC = {
    'Progress note': ['11506-3', 'Progress note'],
    'History and physical': ['34117-2', 'History and physical note'],
    'Consult': ['11488-4', 'Consult note'],
    'Procedure note': ['28570-0', 'Procedure note'],
    'Operative note': ['11504-8', 'Surgical operation note'],
    'Nursing note': ['34746-8', 'Nurse Note'],
    'Emergency note': ['34111-5', 'Emergency department Note']
  };

  // Route word (first segment of `sig`) -> SNOMED CT route.
  var ROUTES = {
    'oral': ['26643006', 'Oral route'],
    'intravenous': ['47625008', 'Intravenous route'],
    'subcutaneous': ['34206005', 'Subcutaneous route'],
    'intramuscular': ['78421000', 'Intramuscular route'],
    'rectal': ['37161004', 'Rectal route']
  };
  var ROUTE_WORDS = /^(oral|intravenous|subcutaneous|intramuscular|rectal|inhaled|nasogastric tube|topical|sublingual|ophthalmic|transdermal|nebulised|intranasal|epidural|intrathecal|buccal|vaginal|mouth rinse.*|nerve-plane catheter)$/i;

  var ENC_CLASS = {
    'Clinic visit': ['AMB', 'ambulatory'],
    'Emergency visit': ['EMER', 'emergency'],
    'Admission': ['IMP', 'inpatient encounter'],
    'Procedure': ['AMB', 'ambulatory'],
    'Telephone': ['VR', 'virtual']
  };

  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  /* ---------------- small helpers ---------------- */

  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function str(x) { return x == null ? '' : String(x); }

  // Wall-clock parts of a Date (local getters) or of an ISO-like string (digits taken as written).
  function parts(d) {
    if (d == null || d === '') return null;
    if (d instanceof Date) {
      if (isNaN(d)) return null;
      return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()];
    }
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(d));
    if (!m) return null;
    return [+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)];
  }
  function isoDate(d) { var p = parts(d); return p ? p[0] + '-' + p2(p[1]) + '-' + p2(p[2]) : undefined; }
  function isoLocal(d) { var p = parts(d); return p ? p[0] + '-' + p2(p[1]) + '-' + p2(p[2]) + 'T' + p2(p[3]) + ':' + p2(p[4]) + ':' + p2(p[5]) : undefined; }
  function mkIso(tz) { return function (d) { var s = isoLocal(d); return s ? s + tz : undefined; }; }
  // Date-only when the value sits exactly at midnight (prior encounters are stored as dates).
  function isoDateOrTime(d, iso) { var p = parts(d); if (!p) return undefined; return (p[3] === 0 && p[4] === 0 && p[5] === 0) ? isoDate(d) : iso(d); }

  function hash(s) { // FNV-1a 32-bit, hex
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function slug(s, max) {
    var raw = str(s);
    var t = raw.normalize ? raw.normalize('NFKD') : raw;
    t = t.replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    max = max || 40;
    if (!t) return 'x' + hash(raw);
    if (t.length > max) t = t.slice(0, max).replace(/-+$/, '') + '-' + hash(raw).slice(0, 6);
    return t;
  }
  function safeId(s) { var t = str(s).replace(/[^A-Za-z0-9.\-]/g, '-'); return t.length > 64 ? t.slice(0, 55) + '-' + hash(t) : (t || 'x'); }

  function utf8Bytes(s) {
    var out = [], i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        var d = s.charCodeAt(i + 1);
        if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function base64(s) {
    var b = utf8Bytes(str(s)), o = '', i, n;
    for (i = 0; i < b.length; i += 3) {
      n = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0);
      o += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
    }
    return o;
  }
  function xhtml(s) {
    var e = str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\r?\n/g, '<br/>');
    return '<div xmlns="http://www.w3.org/1999/xhtml">' + e + '</div>';
  }

  function cc(text, system, code, display) {
    var o = {};
    if (system && code) o.coding = [{ system: system, code: code, display: display }];
    if (text != null && text !== '') o.text = String(text);
    return o;
  }
  function ref(type, id, display) { var r = { reference: type + '/' + id }; if (display) r.display = display; return r; }
  function clean(o) { // drop undefined / null / '' / empty arrays (shallow + nested)
    if (Array.isArray(o)) { var a = o.map(clean).filter(function (x) { return x !== undefined; }); return a.length ? a : undefined; }
    if (o && typeof o === 'object') {
      var r = {}, n = 0;
      Object.keys(o).forEach(function (k) { var v = clean(o[k]); if (v !== undefined) { r[k] = v; n++; } });
      return n ? r : undefined;
    }
    if (o === undefined || o === null || o === '') return undefined;
    return o;
  }

  // '1,110', '+540', '−620', '82.4' -> number; anything else -> null
  function num(x) {
    if (typeof x === 'number') return isFinite(x) ? x : null;
    if (typeof x !== 'string') return null;
    var s = x.trim().replace(/−/g, '-').replace(/^\+/, '');
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : null;
  }
  // "Units" that are really scale ranges or captions ('0–10', 'of 12', 'count') are not units of measure.
  var NOT_A_UNIT = /^(\d+\s*[–-]\s*\d+|of .+|count|ratio|FiO2)$/;
  function quantity(v, unit) {
    var q = { value: v };
    if (unit && !NOT_A_UNIT.test(unit)) { q.unit = unit; if (UCUM[unit]) { q.system = SYS.ucum; q.code = UCUM[unit]; } }
    return q;
  }
  function flag(v, lo, hi) {
    if (typeof v !== 'number') return '';
    if (typeof hi === 'number' && v > hi) return 'H';
    if (typeof lo === 'number' && v < lo) return 'L';
    return '';
  }
  function interp(f) {
    if (!f) return undefined;
    return [{ coding: [{ system: SYS.interp, code: f, display: f === 'H' ? 'High' : 'Low' }] }];
  }
  // Flowsheet limits use sentinels (lo below 0, hi 999 or more) to mean "no limit on this side".
  function refRange(lo, hi, unit, sentinels) {
    var r = {};
    if (typeof lo === 'number' && !(sentinels && lo < 0)) r.low = quantity(lo, unit);
    if (typeof hi === 'number' && !(sentinels && hi >= 999)) r.high = quantity(hi, unit);
    return (r.low || r.high) ? [r] : undefined;
  }

  function parseDob(s) {
    var m = /^\s*(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})\s*$/.exec(str(s));
    if (!m) return undefined;
    var mo = MONTHS.indexOf(m[2].toLowerCase());
    return mo < 0 ? undefined : m[3] + '-' + p2(mo + 1) + '-' + p2(+m[1]);
  }
  function parseName(s) {
    var t = str(s), i = t.indexOf(',');
    if (i < 0) return { text: t };
    var given = t.slice(i + 1).trim().split(/\s+/).filter(Boolean);
    return { use: 'official', text: (given.join(' ') + ' ' + t.slice(0, i).trim()).trim(), family: t.slice(0, i).trim(), given: given };
  }
  function leadingNumber(s) { var m = /^\s*(\d+(?:\.\d+)?)\s*(kg|cm|g|m)\b/.exec(str(s)); return m ? { v: parseFloat(m[1]), u: m[2] } : null; }

  // Column labels of shift-based groups ("16 Nov 08:00", "16 Nov night (19–07)", "17 Nov 06:10–10:00").
  // Returns {dateTime} or {period:{start,end}} or {date} or null. Year is taken from the admission.
  function parseCol(label, year, iso) {
    var s = str(label);
    var m = /(\d{1,2})(?:\s*[–-]\s*\d{1,2})?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*/i.exec(s);
    if (!m || !year) return null;
    var day = +m[1], mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    var rest = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
    function at(dayOffset, h, mi) { return iso(new Date(year, mo, day + dayOffset, h, mi || 0)); }
    var r = /(\d{1,2})(?::(\d{2}))?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?/.exec(rest);
    if (r && +r[1] < 24 && +r[3] <= 24) {
      var a = +r[1] * 60 + +(r[2] || 0), b = +r[3] * 60 + +(r[4] || 0);
      return { period: { start: at(0, +r[1], +(r[2] || 0)), end: at(b <= a ? 1 : 0, +r[3], +(r[4] || 0)) } };
    }
    var t = /(\d{1,2}):(\d{2})/.exec(rest);
    if (t && +t[1] < 24) return { dateTime: at(0, +t[1], +t[2]) };
    return { date: year + '-' + p2(mo + 1) + '-' + p2(day) };
  }

  function icdFor(text) {
    var t = str(text).trim();
    if (!t || ICD_SKIP.test(t)) return null;
    for (var i = 0; i < ICD10.length; i++) if (ICD10[i][0].test(t)) return { code: ICD10[i][1], display: ICD10[i][2] };
    return null;
  }
  function labLoinc(panel, name, unit) {
    if (NON_BLOOD_PANEL.test(str(panel)) || NON_BLOOD_PANEL.test(str(name))) return null;
    var n = str(name).trim().toLowerCase(), u = str(unit);
    for (var i = 0; i < LAB_LOINC.length; i++) if (LAB_LOINC[i][0] === n && LAB_LOINC[i][1] === u) return { code: LAB_LOINC[i][2], display: LAB_LOINC[i][3] };
    return null;
  }
  function flowLoinc(label, unit) {
    for (var i = 0; i < FLOW_LOINC.length; i++) {
      if (FLOW_LOINC[i][0].test(str(label).trim()) && (FLOW_LOINC[i][1] == null || FLOW_LOINC[i][1] === unit)) return { code: FLOW_LOINC[i][2][0], display: FLOW_LOINC[i][2][1] };
    }
    return null;
  }
  function routeOf(sig) {
    var first = str(sig).split('·')[0].trim();
    if (!ROUTE_WORDS.test(first)) return null;
    var r = ROUTES[first.toLowerCase()];
    return r ? cc(first, SYS.sct, r[0], r[1]) : cc(first);
  }
  function frequencyOf(sig) { var a = str(sig).split('·'); return a.length > 1 ? a.slice(1).join('·').trim() : ''; }

  // Orders arrive either as [category, text, status, Date] or as {id, cat, text, st, t, by}.
  function normOrder(o) {
    if (Array.isArray(o)) return { cat: o[0], text: o[1], st: o[2], t: o[3], by: '' };
    o = o || {};
    return { cat: o.cat, text: o.text, st: o.st, t: o.t, by: o.by || '', id: o.id };
  }
  // The chart app copies each medicine into `orders` as "name · sig"; those copies are not mapped twice.
  function isMedCopy(o, meds) {
    if (o.cat !== 'Medication') return false;
    for (var i = 0; i < meds.length; i++) if (o.text === meds[i].name + ' · ' + meds[i].sig) return true;
    return false;
  }
  var ORDER_STATUS = { 'Active': 'active', 'Pending': 'active', 'Completed': 'completed', 'On hold': 'on-hold', 'Discontinued': 'revoked', 'Cancelled': 'revoked' };

  function impression(body) {
    var m = /(?:^|\n)\s*(?:Impression|Conclusion|Diagnosis|Final diagnosis|Interpretation|Summary)\s*:\s*([\s\S]*)$/i.exec(str(body));
    return m && m[1].trim() ? m[1].trim() : str(body);
  }
  function reportCategory(kind, title) {
    var t = str(title);
    if (kind === 'micro') return cc('Microbiology', SYS.v2_0074, 'MB', 'Microbiology');
    if (kind === 'imaging') {
      if (/\bECG\b|electrocardiogram/i.test(t)) return cc('Electrocardiogram', SYS.v2_0074, 'EC', 'Electrocardiac (e.g., EKG, EEC, Holter)');
      if (/echocardiogram/i.test(t)) return cc('Cardiac ultrasound', SYS.v2_0074, 'CUS', 'Cardiac Ultrasound');
      if (/x-ray|\bCT\b|\bMRI?\b|ultrasound|angiogram|fluoroscop|mammogra/i.test(t)) return cc('Imaging', SYS.v2_0074, 'RAD', 'Radiology');
      return cc('Imaging and diagnostic tests');
    }
    if (/blood bank|transfusion/i.test(t)) return cc('Blood bank', SYS.v2_0074, 'BLB', 'Blood Bank');
    if (/surgical pathology/i.test(t)) return cc('Pathology', SYS.v2_0074, 'SP', 'Surgical Pathology');
    return cc('Pathology');
  }

  /* ---------------- id scheme (shared with export.js) ---------------- */
  var ID = {
    patient: function (pid) { return safeId(pid); },
    encounter: function (pid) { return safeId(pid + '-enc'); },
    priorEncounter: function (pid, i) { return safeId(pid + '-enc-prior-' + i); },
    unit: function (unit) { return safeId('loc-' + slug(unit)); },
    bed: function (unit, bed) { return safeId('loc-' + slug(unit, 24) + '-bed-' + slug(bed, 20)); },
    practitioner: function (name) { return safeId('prac-' + slug(name, 48)); },
    careTeam: function (pid) { return safeId(pid + '-careteam'); },
    allergy: function (pid, i) { return safeId(pid + '-allergy-' + i); },
    problem: function (pid, i) { return safeId(pid + '-problem-' + i); },
    mainDx: function (pid) { return safeId(pid + '-dx'); },
    vital: function (pid, k, ti) { return safeId(pid + '-vs-' + k + '-' + ti); },
    flow: function (pid, gi, ri, ci) { return safeId(pid + '-fl-' + gi + '-' + ri + '-' + ci); },
    lab: function (pid, li, ri, ti) { return safeId(pid + '-lab-' + li + '-' + ri + '-' + ti); },
    body: function (pid, what) { return safeId(pid + '-' + what); },
    med: function (pid, i) { return safeId(pid + '-med-' + i); },
    medAdmin: function (pid, i, j) { return safeId(pid + '-med-' + i + '-dose-' + j); },
    order: function (pid, i) { return safeId(pid + '-order-' + i); },
    report: function (pid, kind, i) { return safeId(pid + '-' + kind + '-' + i); },
    note: function (pid, i) { return safeId(pid + '-note-' + i); },
    noteProcedure: function (pid, i) { return safeId(pid + '-proc-note-' + i); },
    pastProcedure: function (pid, i) { return safeId(pid + '-proc-past-' + i); },
    encProcedure: function (pid, i) { return safeId(pid + '-proc-enc-' + i); },
    homeMed: function (pid, i) { return safeId(pid + '-homemed-' + i); }
  };

  /* ---------------- the mapping ---------------- */

  function toBundle(p, opts) {
    if (!p || !p.id) throw new Error('FHIRMAP.toBundle: patient object with an id is required');
    opts = opts || {};
    var tz = opts.tz || CONFIG.tz, base = (opts.base || CONFIG.base).replace(/\/+$/, '');
    var iso = mkIso(tz);
    var pid = String(p.id), out = [];
    function add(r) { r = clean(r); out.push(r); return r; }

    var patRef = ref('Patient', ID.patient(pid), p.name);
    var encId = ID.encounter(pid), encRef = ref('Encounter', encId);
    var admitParts = parts(p.admit), year = admitParts ? admitParts[0] : null;
    var meds = arr(p.meds), hx = p.hx || {};

    /* Organization */
    add({ resourceType: 'Organization', id: CONFIG.orgId, name: CONFIG.orgName });
    var orgRef = ref('Organization', CONFIG.orgId);

    /* Patient */
    var name = parseName(p.name), birth = parseDob(p.dob);
    add({
      resourceType: 'Patient', id: ID.patient(pid),
      meta: { tag: [{ system: SYS.actReason, code: 'HTEST', display: 'test health data' }] },
      identifier: p.mrn ? [{ use: 'usual', type: cc('Medical record number', SYS.v2_0203, 'MR', 'Medical record number'), system: CONFIG.mrnSystem, value: String(p.mrn) }] : undefined,
      active: true, name: [name],
      gender: p.sex === 'M' ? 'male' : p.sex === 'F' ? 'female' : 'unknown',
      birthDate: birth, managingOrganization: orgRef
    });

    /* Location: unit and bed */
    var unitRef, bedRef;
    if (p.unit) {
      var uid = ID.unit(p.unit);
      add({ resourceType: 'Location', id: uid, status: 'active', name: String(p.unit), mode: 'instance', physicalType: cc('Ward', SYS.locType, 'wa', 'Ward'), managingOrganization: orgRef });
      unitRef = ref('Location', uid, String(p.unit));
      if (p.bed) {
        var bid = ID.bed(p.unit, p.bed);
        add({ resourceType: 'Location', id: bid, status: 'active', name: String(p.bed), mode: 'instance', physicalType: cc('Bed', SYS.locType, 'bd', 'Bed'), partOf: unitRef });
        bedRef = ref('Location', bid, String(p.bed));
      }
    }

    /* Practitioners and CareTeam */
    var pracSeen = {};
    function practitioner(nm) {
      nm = str(nm).trim();
      if (!nm) return undefined;
      var id = ID.practitioner(nm);
      if (!pracSeen[id]) {
        pracSeen[id] = 1;
        add({ resourceType: 'Practitioner', id: id, active: true, name: [{ text: nm, prefix: /^Dr\.?\s/.test(nm) ? ['Dr.'] : undefined }] });
      }
      return ref('Practitioner', id, nm);
    }
    var attendingRef = practitioner(p.attending);
    var team = arr(p.team).filter(function (t) { return Array.isArray(t) && t[1]; });
    if (team.length) {
      add({
        resourceType: 'CareTeam', id: ID.careTeam(pid), status: 'active', name: 'Inpatient care team', subject: patRef, encounter: encRef,
        participant: team.map(function (t) { return { role: [cc(t[0])], member: practitioner(t[1]) }; }),
        managingOrganization: [orgRef]
      });
    }

    /* Main problem as the encounter diagnosis */
    var dxRef;
    if (p.dx) {
      var dxIcd = icdFor(p.dx);
      add({
        resourceType: 'Condition', id: ID.mainDx(pid),
        clinicalStatus: cc(null, SYS.condClin, 'active', 'Active'),
        category: [cc('Encounter diagnosis', SYS.condCat, 'encounter-diagnosis', 'Encounter Diagnosis')],
        code: dxIcd ? cc(p.dx, SYS.icd, dxIcd.code, dxIcd.display) : cc(p.dx),
        subject: patRef, encounter: encRef, recordedDate: iso(p.admit)
      });
      dxRef = ref('Condition', ID.mainDx(pid));
    }

    /* Encounter: current admission */
    var isEd = p.unitKey === 'ed' || /^emergency/i.test(str(p.unit));
    add({
      resourceType: 'Encounter', id: encId, status: 'in-progress',
      class: { system: SYS.actCode, code: isEd ? 'EMER' : 'IMP', display: isEd ? 'emergency' : 'inpatient encounter' },
      serviceType: p.service ? cc(p.service) : undefined,
      subject: patRef,
      participant: attendingRef ? [{ type: [cc('Attending', 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', 'ATND', 'attender')], individual: attendingRef }] : undefined,
      period: { start: iso(p.admit) },
      reasonCode: p.dx ? [cc(p.dx)] : undefined,
      diagnosis: dxRef ? [{ condition: dxRef, rank: 1 }] : undefined,
      location: (bedRef || unitRef) ? [unitRef ? { location: unitRef, status: 'active' } : undefined, bedRef ? { location: bedRef, status: 'active' } : undefined] : undefined,
      serviceProvider: orgRef
    });

    /* Encounter: earlier contacts */
    arr(p.encounters).forEach(function (e, i) {
      if (!e) return;
      var cls = ENC_CLASS[e.kind];
      var id = ID.priorEncounter(pid, i);
      add({
        resourceType: 'Encounter', id: id, status: 'finished',
        class: cls ? { system: SYS.actCode, code: cls[0], display: cls[1] } : { system: 'http://terminology.hl7.org/CodeSystem/data-absent-reason', code: 'unknown', display: 'Unknown' },
        type: [cc([e.kind, e.title].filter(Boolean).join(': '))],
        serviceType: e.dept ? cc(e.dept) : undefined,
        subject: patRef,
        period: { start: isoDateOrTime(e.t, iso) },
        reasonCode: e.summary ? [cc(e.summary)] : undefined,
        serviceProvider: orgRef
      });
      if (e.kind === 'Procedure' && e.title) {
        add({ resourceType: 'Procedure', id: ID.encProcedure(pid, i), status: 'completed', code: cc(e.title), subject: patRef, encounter: ref('Encounter', id), performedDateTime: isoDateOrTime(e.t, iso), note: e.summary ? [{ text: e.summary }] : undefined });
      }
    });

    /* AllergyIntolerance */
    arr(p.allergies).forEach(function (a, i) {
      if (!Array.isArray(a) || !a[0]) return;
      var nka = /^no known (drug )?allerg/i.test(a[0]);
      add({
        resourceType: 'AllergyIntolerance', id: ID.allergy(pid, i),
        clinicalStatus: cc(null, SYS.allergyClin, 'active', 'Active'),
        code: cc(a[0]),
        patient: patRef, encounter: encRef,
        reaction: (!nka && a[1]) ? [{ manifestation: [cc(a[1])] }] : undefined
      });
    });

    /* Condition: problem list */
    arr(p.problems).forEach(function (t, i) {
      if (!t) return;
      var icd = icdFor(t);
      add({
        resourceType: 'Condition', id: ID.problem(pid, i),
        clinicalStatus: cc(null, SYS.condClin, 'active', 'Active'),
        category: [cc('Problem list item', SYS.condCat, 'problem-list-item', 'Problem List Item')],
        code: icd ? cc(t, SYS.icd, icd.code, icd.display) : cc(t),
        subject: patRef, encounter: encRef, recordedDate: iso(p.admit)
      });
    });

    /* Observation: weight and height from the banner */
    var VS = [cc('Vital signs', SYS.obsCat, 'vital-signs', 'Vital Signs')];
    var LABCAT = [cc('Laboratory', SYS.obsCat, 'laboratory', 'Laboratory')];
    [['wt', WEIGHT, 'weight', 'kg'], ['ht', HEIGHT, 'height', 'cm']].forEach(function (d) {
      var q = leadingNumber(p[d[0]]);
      if (!q || q.u !== d[3]) return;
      add({
        resourceType: 'Observation', id: ID.body(pid, d[2]), status: 'final', category: VS,
        code: cc(d[1][1], SYS.loinc, d[1][0], d[1][1]), subject: patRef, encounter: encRef,
        effectiveDateTime: iso(p.admit), valueQuantity: quantity(q.v, q.u),
        note: [{ text: 'From the chart banner ("' + p[d[0]] + '"); time of measurement not recorded, admission time used.' }]
      });
    });

    /* Observation: flowsheets */
    arr(p.flows).forEach(function (g, gi) {
      if (!g || !Array.isArray(g.rows)) return;
      var isVitals = g.name === 'Vitals';
      var times = Array.isArray(g.times) ? g.times : null, cols = Array.isArray(g.cols) ? g.cols : null;
      var n = times ? times.length : cols ? cols.length : 0;
      var groupCat = isVitals ? VS : [cc(g.name)];
      function when(ci) {
        if (times) return { effectiveDateTime: iso(times[ci]) };
        var c = parseCol(cols[ci], year, iso), o = { note: [{ text: 'Charted column: ' + cols[ci] }] };
        if (c && c.period) o.effectivePeriod = c.period;
        else if (c && c.dateTime) o.effectiveDateTime = c.dateTime;
        else if (c && c.date) o.effectiveDateTime = c.date;
        return o;
      }
      function obs(id, ci, code, extra) {
        var w = when(ci), o = { resourceType: 'Observation', id: id, status: 'final', category: groupCat, code: code, subject: patRef, encounter: encRef };
        Object.keys(w).forEach(function (k) { o[k] = w[k]; });
        Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
        return add(o);
      }
      g.rows.forEach(function (r, ri) {
        if (!r) return;
        var label = r.l || r.k || ('Row ' + (ri + 1));
        var idOf = function (ci, k) { return isVitals && r.k ? ID.vital(pid, k || r.k, ci) : ID.flow(pid, gi, ri, ci); };
        if (r.type === 'bp') {
          for (var c = 0; c < n; c++) {
            var s = num(arr(r.s)[c]), d = num(arr(r.d)[c]);
            if (s == null && d == null) continue;
            obs(idOf(c), c, cc(label, SYS.loinc, VITAL_LOINC.bp[0], VITAL_LOINC.bp[1]), {
              component: [
                s != null ? { code: cc('Systolic blood pressure', SYS.loinc, BP_SYS[0], BP_SYS[1]), valueQuantity: quantity(s, 'mmHg') } : undefined,
                d != null ? { code: cc('Diastolic blood pressure', SYS.loinc, BP_DIA[0], BP_DIA[1]), valueQuantity: quantity(d, 'mmHg') } : undefined]
            });
          }
          return;
        }
        if (r.type === 'map') { // not stored: computed from the blood pressure row, as the chart does
          var bp = g.rows.filter(function (x) { return x && x.type === 'bp'; })[0];
          if (!bp) return;
          for (var c2 = 0; c2 < n; c2++) {
            var s2 = num(arr(bp.s)[c2]), d2 = num(arr(bp.d)[c2]);
            if (s2 == null || d2 == null) continue;
            var mv = Math.round((s2 + 2 * d2) / 3);
            obs(idOf(c2), c2, cc(label, SYS.loinc, VITAL_LOINC.map[0], VITAL_LOINC.map[1]), {
              valueQuantity: quantity(mv, r.u || 'mmHg'), interpretation: interp(flag(mv, r.lo, r.hi)),
              referenceRange: refRange(r.lo, r.hi, r.u || 'mmHg', true),
              derivedFrom: [ref('Observation', isVitals && bp.k ? ID.vital(pid, bp.k, c2) : ID.flow(pid, gi, g.rows.indexOf(bp), c2))]
            });
          }
          return;
        }
        var unit = r.u || g.unit || '';
        var vl = isVitals && r.k && VITAL_LOINC[r.k] ? { code: VITAL_LOINC[r.k][0], display: VITAL_LOINC[r.k][1] } : (!isVitals ? flowLoinc(label, unit) : null);
        var code = vl ? cc(label, SYS.loinc, vl.code, vl.display) : cc(label);
        var numericRow = !!unit || typeof r.lo === 'number' || typeof r.hi === 'number';
        arr(r.v).forEach(function (v, ci) {
          if (ci >= n || v == null || v === '') return;
          var nv = typeof v === 'number' ? v : (numericRow || /^[+−-]/.test(str(v)) ? num(v) : null);
          if (nv != null) {
            obs(idOf(ci), ci, code, { valueQuantity: quantity(nv, unit), interpretation: interp(flag(nv, r.lo, r.hi)), referenceRange: refRange(r.lo, r.hi, unit, true) });
          } else {
            obs(idOf(ci), ci, code, { valueString: String(v) });
          }
        });
      });
    });

    /* Observation: laboratory results */
    arr(p.labs).forEach(function (L, li) {
      if (!L || !Array.isArray(L.rows)) return;
      L.rows.forEach(function (r, ri) {
        if (!Array.isArray(r)) return;
        var nm = r[0], unit = r[1] || '', lo = r[2], hi = r[3];
        var lc = labLoinc(L.panel, nm, unit);
        arr(r[4]).forEach(function (v, ti) {
          if (v == null || v === '') return;
          var o = {
            resourceType: 'Observation', id: ID.lab(pid, li, ri, ti), status: 'final', category: LABCAT,
            code: lc ? cc(nm, SYS.loinc, lc.code, lc.display) : cc(nm),
            subject: patRef, encounter: encRef, effectiveDateTime: iso(arr(L.times)[ti]),
            referenceRange: refRange(lo, hi, unit, false),
            note: L.panel ? [{ text: 'Panel: ' + L.panel }] : undefined
          };
          if (typeof v === 'number') { o.valueQuantity = quantity(v, unit); o.interpretation = interp(flag(v, lo, hi)); }
          else o.valueString = String(v);
          add(o);
        });
      });
    });

    /* MedicationRequest + MedicationAdministration */
    var ADMIN_STATUS = { given: 'completed', held: 'not-done' };
    meds.forEach(function (m, i) {
      if (!m || !m.name) return;
      var mid = ID.med(pid, i), medCC = cc(m.name);
      var doses = arr(m.a), due = doses.filter(function (a) { return a && a.st === 'due' && parts(a.t); });
      var freq = frequencyOf(m.sig);
      add({
        resourceType: 'MedicationRequest', id: mid, status: 'active', intent: 'order',
        category: [cc('Inpatient', SYS.medReqCat, 'inpatient', 'Inpatient')],
        medicationCodeableConcept: medCC, subject: patRef, encounter: encRef, authoredOn: iso(m.ordered),
        dosageInstruction: [{
          text: [m.sig, m.type === 'inf' && m.rate ? 'Rate: ' + m.rate : ''].filter(Boolean).join(' · '),
          timing: (freq || due.length) ? { event: due.length ? due.map(function (a) { return iso(a.t); }) : undefined, code: freq ? cc(freq) : undefined } : undefined,
          asNeededBoolean: m.type === 'prn' ? true : undefined,
          route: routeOf(m.sig) || undefined
        }],
        note: m.note ? [{ text: m.note }] : undefined
      });
      doses.forEach(function (a, j) {
        if (!a || !ADMIN_STATUS[a.st]) return; // 'due' doses are scheduled, not administered: see timing.event above
        add({
          resourceType: 'MedicationAdministration', id: ID.medAdmin(pid, i, j), status: ADMIN_STATUS[a.st],
          statusReason: a.st === 'held' && a.note ? [cc(a.note)] : undefined,
          medicationCodeableConcept: medCC, subject: patRef, context: encRef, effectiveDateTime: iso(a.t),
          performer: a.by ? [{ actor: { display: String(a.by) } }] : undefined,
          request: ref('MedicationRequest', mid),
          note: a.note ? [{ text: a.note }] : undefined
        });
      });
    });

    /* Orders: ServiceRequest (non-medicine) and MedicationRequest (one-off / held medicine orders) */
    arr(p.orders).forEach(function (raw, i) {
      var o = normOrder(raw);
      if (!o.text || isMedCopy(o, meds)) return;
      var id = ID.order(pid, i), status = ORDER_STATUS[o.st] || 'unknown';
      var noteTxt = 'Chart status: ' + (o.st || 'not recorded');
      var requester = o.by ? { display: String(o.by) } : undefined;
      if (o.cat === 'Medication') {
        add({
          resourceType: 'MedicationRequest', id: id, status: status, intent: 'order',
          category: [cc('Inpatient', SYS.medReqCat, 'inpatient', 'Inpatient')],
          medicationCodeableConcept: cc(o.text), subject: patRef, encounter: encRef, authoredOn: iso(o.t), requester: requester,
          dosageInstruction: [{ text: o.text }], note: [{ text: noteTxt + '. Free-text order from the orders list (one-off, held or completed).' }]
        });
      } else {
        add({
          resourceType: 'ServiceRequest', id: id, status: status, intent: 'order',
          category: o.cat ? [cc(o.cat)] : undefined, code: cc(o.text), subject: patRef, encounter: encRef, authoredOn: iso(o.t), requester: requester,
          note: [{ text: noteTxt }]
        });
      }
    });

    /* DiagnosticReport: microbiology, imaging, pathology */
    [['micro', 'micro'], ['imaging', 'img'], ['path', 'path']].forEach(function (k) {
      arr(p[k[0]]).forEach(function (x, i) {
        if (!x) return;
        var body = str(x.body);
        add({
          resourceType: 'DiagnosticReport', id: ID.report(pid, k[1], i),
          text: body ? { status: 'additional', div: xhtml(body) } : undefined,
          status: /^final$/i.test(str(x.status)) ? 'final' : /^prelim/i.test(str(x.status)) ? 'preliminary' : 'unknown',
          category: [reportCategory(k[0], x.title)], code: cc(x.title || 'Report'),
          subject: patRef, encounter: encRef, effectiveDateTime: iso(x.t), issued: iso(x.t),
          performer: x.by ? [{ display: String(x.by) }] : undefined,
          conclusion: body ? impression(body) : undefined,
          presentedForm: body ? [{ contentType: 'text/plain; charset=utf-8', language: 'en', data: base64(body), title: x.title }] : undefined
        });
      });
    });

    /* DocumentReference: every note; Procedure for operative and procedure notes */
    arr(p.notes).forEach(function (nt, i) {
      if (!nt) return;
      var id = ID.note(pid, i), body = str(nt.body), lc = NOTE_LOINC[nt.type];
      add({
        resourceType: 'DocumentReference', id: id,
        text: { status: 'additional', div: xhtml(body) },
        status: 'current', docStatus: 'final',
        type: lc ? cc(nt.type, SYS.loinc, lc[0], lc[1]) : cc(nt.type || 'Clinical note'),
        category: [cc('Clinical note', SYS.docCat, 'clinical-note', 'Clinical Note')],
        subject: patRef, date: iso(nt.t),
        author: nt.by ? [{ display: String(nt.by) }] : undefined,
        description: nt.title,
        content: [{ attachment: { contentType: 'text/plain; charset=utf-8', language: 'en', data: base64(body), title: nt.title, creation: iso(nt.t) } }],
        context: { encounter: [encRef], period: { start: iso(nt.t) } }
      });
      if ((nt.type === 'Operative note' || nt.type === 'Procedure note') && nt.title) {
        add({
          resourceType: 'Procedure', id: ID.noteProcedure(pid, i), status: 'completed',
          code: cc(str(nt.title).replace(/^(operative|procedure) (note|report)\s*:\s*/i, '')),
          subject: patRef, encounter: encRef, performedDateTime: iso(nt.t),
          performer: nt.by ? [{ actor: { display: String(nt.by) } }] : undefined,
          report: [ref('DocumentReference', id)],
          note: [{ text: 'Derived from the ' + nt.type.toLowerCase() + '; the time is when the note was written.' }]
        });
      }
    });

    /* Procedure: past surgical history */
    arr(hx.psh).forEach(function (t, i) {
      if (!t || /^(none|nil|no )/i.test(t)) return;
      var years = str(t).match(/\b(19|20)\d{2}\b/g);
      add({
        resourceType: 'Procedure', id: ID.pastProcedure(pid, i), status: 'completed', code: cc(t), subject: patRef,
        performedDateTime: years && years.length === 1 ? years[0] : undefined,
        note: [{ text: 'From past surgical history.' }]
      });
    });

    /* MedicationStatement: home medication list */
    arr(hx.home).forEach(function (t, i) {
      if (!t || /^(none|nil|no regular)/i.test(t)) return;
      add({
        resourceType: 'MedicationStatement', id: ID.homeMed(pid, i), status: 'unknown',
        category: cc('Community', 'http://terminology.hl7.org/CodeSystem/medication-statement-category', 'community', 'Community'),
        medicationCodeableConcept: cc(t), subject: patRef, context: encRef, dateAsserted: iso(p.admit),
        dosage: [{ text: String(t) }]
      });
    });

    return {
      resourceType: 'Bundle', id: safeId('bundle-' + pid),
      meta: { tag: [{ system: SYS.actReason, code: 'HTEST', display: 'test health data' }] },
      type: 'collection',
      timestamp: opts.now ? iso(opts.now) : undefined,
      entry: out.map(function (r) { return { fullUrl: base + '/' + r.resourceType + '/' + r.id, resource: r }; })
    };
  }

  function resourceTypes(bundle) {
    var c = {};
    arr(bundle && bundle.entry).forEach(function (e) { var t = e && e.resource && e.resource.resourceType; if (t) c[t] = (c[t] || 0) + 1; });
    var sorted = {};
    Object.keys(c).sort().forEach(function (k) { sorted[k] = c[k]; });
    return sorted;
  }

  function toTransaction(bundle) {
    return {
      resourceType: 'Bundle', id: bundle.id ? safeId(bundle.id + '-tx') : undefined, type: 'transaction',
      entry: arr(bundle.entry).map(function (e) {
        return { fullUrl: e.fullUrl, resource: e.resource, request: { method: 'PUT', url: e.resource.resourceType + '/' + e.resource.id } };
      })
    };
  }

  return {
    version: '1.0.0',
    config: CONFIG,
    toBundle: toBundle,
    resourceTypes: resourceTypes,
    toTransaction: toTransaction,
    ids: ID,
    // exposed so export.js (and anyone curious) can reuse exactly the same lookups
    lookup: { icd10: icdFor, labLoinc: labLoinc, flowLoinc: flowLoinc, vitalLoinc: VITAL_LOINC, noteLoinc: NOTE_LOINC, ucum: UCUM },
    util: { isoLocal: isoLocal, isoDate: isoDate, mkIso: mkIso, num: num, flag: flag, parseCol: parseCol, parseDob: parseDob, parseName: parseName, routeOf: routeOf, frequencyOf: frequencyOf, normOrder: normOrder, isMedCopy: isMedCopy, base64: base64, slug: slug }
  };
});
