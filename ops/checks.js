#!/usr/bin/env node
/*
 * Consistency checks for the Northfield Medical Center synthetic operations dataset.
 * Reads the CSV files in ./data (never the generator's memory) and verifies the rules the simulation promises.
 *   node checks.js          exit code 0 = every check passed
 */
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, 'data');

// ---------------------------------------------------------------- helpers
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (q) { if (c === 34) { if (text.charCodeAt(i + 1) === 34) { cur += '"'; i++; } else q = false; } else cur += text[i]; }
    else if (c === 34) q = true;
    else if (c === 44) { row.push(cur); cur = ''; }
    else if (c === 10) { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== 13) cur += text[i];
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const SIZE = {};
function load(rel) {
  const f = path.join(DIR, rel); const text = fs.readFileSync(f, 'utf8'); SIZE[rel] = fs.statSync(f).size;
  const rows = parseCsv(text), head = rows.shift();
  const out = rows.map(r => { const o = {}; for (let i = 0; i < head.length; i++) o[head[i]] = r[i]; return o; });
  out.head = head; out.rel = rel;
  for (const r of rows) if (r.length !== head.length) throw new Error(rel + ': ragged row');
  return out;
}
const EPOCH = Date.UTC(2026, 4, 22);
const tm = s => s ? (Date.parse(s + ':00Z') - EPOCH) / 60000 : null;     // minutes since 2026-05-22T00:00
const END = 180 * 1440;
const num = s => s === '' || s == null ? null : Number(s);
let failed = 0; const results = [];
function check(name, bad, detail, info) {
  const ok = bad === 0; if (!ok) failed++;
  results.push((ok ? 'PASS  ' : 'FAIL  ') + name + (info ? '  [' + info + ']' : '') + (ok ? '' : '  -> ' + bad + ' violation(s)' + (detail ? ', e.g. ' + detail : '')));
}
function counter() { let n = 0, ex = ''; return { hit(s) { if (!n) ex = s; n++; }, get n() { return n; }, get ex() { return ex; } }; }
function overlaps(items, key, start, end, label) { // items grouped by key must not overlap in time
  const g = new Map(); for (const it of items) { const k = key(it); if (!k) continue; if (!g.has(k)) g.set(k, []); g.get(k).push(it); }
  const c = counter(); let pairs = 0;
  for (const [k, list] of g) { list.sort((a, b) => start(a) - start(b)); for (let i = 1; i < list.length; i++) { pairs++; const pe = end(list[i - 1]); if (pe == null || start(list[i]) < pe) c.hit(label + ' ' + k + ' at ' + start(list[i])); } }
  return [c, pairs];
}

// ---------------------------------------------------------------- load
const T = {};
for (const f of ['patients', 'staff', 'or_staff', 'beds', 'encounters', 'adt_events', 'bed_census_hourly', 'ed_visits', 'or_blocks', 'or_block_days', 'or_cases', 'clinic_appointments', 'staffing_shifts', 'inbox_messages', 'vitals_ward_sample']) T[f] = load(f + '.csv');
const G = {};
for (const f of ['vitals_deterioration_truth', 'case_duration_procedure_params', 'case_duration_surgeon_effects', 'case_duration_surgeon_procedure_effects', 'case_duration_case_truth', 'or_delay_truth', 'no_show_truth', 'inbox_truth', 'censored_outcomes', 'length_of_stay_params', 'or_reference_schedule', 'or_reference_objective']) G[f] = load('ground_truth/' + f + '.csv');
for (const f of ['case_duration_model.json', 'no_show_model.json', 'or_reference_method.json']) { JSON.parse(fs.readFileSync(path.join(DIR, 'ground_truth', f), 'utf8')); SIZE['ground_truth/' + f] = fs.statSync(path.join(DIR, 'ground_truth', f)).size; }

// ---------------------------------------------------------------- 1. keys and referential integrity
const setOf = (t, col) => new Set(t.map(r => r[col]));
const uniq = (t, col) => { const s = new Set(); let d = 0; for (const r of t) { if (s.has(r[col])) d++; s.add(r[col]); } return d; };
check('primary keys are unique', uniq(T.patients, 'patient_id') + uniq(T.patients, 'record_number') + uniq(T.staff, 'staff_id') + uniq(T.beds, 'bed_id') + uniq(T.encounters, 'encounter_id') + uniq(T.adt_events, 'event_id') + uniq(T.ed_visits, 'visit_id') + uniq(T.or_cases, 'case_id') + uniq(T.or_blocks, 'block_id') + uniq(T.clinic_appointments, 'appointment_id') + uniq(T.inbox_messages, 'message_id') + uniq(T.staffing_shifts, 'shift_id'));
{
  const c = counter();
  for (const p of T.patients) { if (!/^OPS-\d{6}$/.test(p.patient_id)) c.hit(p.patient_id); if (!/^LX-\d{6}$/.test(p.record_number)) c.hit(p.record_number); }
  check('patient ids look like OPS-000001 and record numbers like LX-123456', c.n, c.ex);
}
const S = { pat: setOf(T.patients, 'patient_id'), staff: setOf(T.staff, 'staff_id'), orstaff: setOf(T.or_staff, 'staff_id'), bed: setOf(T.beds, 'bed_id'), enc: setOf(T.encounters, 'encounter_id'), kase: setOf(T.or_cases, 'case_id'), block: setOf(T.or_blocks, 'block_id'), appt: setOf(T.clinic_appointments, 'appointment_id'), msg: setOf(T.inbox_messages, 'message_id'), unit: setOf(T.beds, 'unit') };
{
  const refs = [
    [T.encounters, 'patient_id', S.pat], [T.encounters, 'linked_encounter_id', S.enc], [T.adt_events, 'encounter_id', S.enc], [T.adt_events, 'patient_id', S.pat], [T.adt_events, 'from_bed', S.bed], [T.adt_events, 'to_bed', S.bed],
    [T.bed_census_hourly, 'unit', S.unit], [T.ed_visits, 'encounter_id', S.enc], [T.ed_visits, 'patient_id', S.pat], [T.ed_visits, 'ed_space', S.bed], [T.ed_visits, 'admitted_encounter_id', S.enc],
    [T.or_blocks, 'surgeon_id', S.orstaff], [T.or_block_days, 'block_id', S.block], [T.or_block_days, 'surgeon_id', S.orstaff], [T.or_cases, 'block_id', S.block], [T.or_cases, 'surgeon_id', S.orstaff], [T.or_cases, 'anaesthetist_id', S.orstaff], [T.or_cases, 'circulating_nurse_id', S.orstaff], [T.or_cases, 'scrub_practitioner_id', S.orstaff],
    [T.or_cases, 'patient_id', S.pat], [T.or_cases, 'encounter_id', S.enc], [T.or_staff, 'staff_id', S.staff],
    [T.clinic_appointments, 'patient_id', S.pat], [T.clinic_appointments, 'clinician_id', S.staff], [T.clinic_appointments, 'encounter_id', S.enc], [T.clinic_appointments, 'follow_up_of_encounter_id', S.enc], [T.clinic_appointments, 'pre_op_for_case_id', S.kase],
    [T.staffing_shifts, 'unit', S.unit], [T.staffing_shifts, 'charge_nurse_id', S.staff], [T.inbox_messages, 'patient_id', S.pat], [T.inbox_messages, 'encounter_id', S.enc], [T.inbox_messages, 'sender_staff_id', S.staff], [T.inbox_messages, 'recipient_staff_id', S.staff],
    [T.vitals_ward_sample, 'encounter_id', S.enc], [T.vitals_ward_sample, 'patient_id', S.pat], [T.vitals_ward_sample, 'bed_id', S.bed],
    [G.vitals_deterioration_truth, 'encounter_id', S.enc], [G.case_duration_case_truth, 'case_id', S.kase], [G.or_delay_truth, 'case_id', S.kase], [G.no_show_truth, 'appointment_id', S.appt], [G.inbox_truth, 'message_id', S.msg], [G.censored_outcomes, 'encounter_id', S.enc],
    [G.or_reference_schedule, 'case_id', S.kase], [G.case_duration_surgeon_effects, 'surgeon_id', S.orstaff],
  ];
  const c = counter(); let n = 0;
  for (const [t, col, set] of refs) for (const r of t) { const v = r[col]; if (v === undefined) throw new Error('missing column ' + col + ' in ' + t.rel); if (v === '') continue; n++; if (!set.has(v)) c.hit(t.rel + '.' + col + '=' + v); }
  check('referential integrity (patients, encounters, beds, staff, blocks, cases, appointments, messages)', c.n, c.ex, n + ' references');
}
const encById = new Map(T.encounters.map(e => [e.encounter_id, e]));
{
  const c = counter();
  for (const a of T.adt_events) if (encById.get(a.encounter_id).patient_id !== a.patient_id || encById.get(a.encounter_id).encounter_type !== 'inpatient') c.hit(a.event_id);
  for (const v of T.ed_visits) { const e = encById.get(v.encounter_id); if (e.patient_id !== v.patient_id || e.encounter_type !== 'emergency') c.hit(v.visit_id); if (v.admitted_encounter_id) { const i = encById.get(v.admitted_encounter_id); if (i.patient_id !== v.patient_id || i.encounter_type !== 'inpatient' || i.linked_encounter_id !== v.encounter_id) c.hit(v.visit_id + ' link'); } }
  for (const k of T.or_cases) if (k.encounter_id && encById.get(k.encounter_id).patient_id !== k.patient_id) c.hit(k.case_id);
  for (const a of T.clinic_appointments) if (a.encounter_id && (encById.get(a.encounter_id).patient_id !== a.patient_id || encById.get(a.encounter_id).encounter_type !== 'outpatient')) c.hit(a.appointment_id);
  for (const v of T.vitals_ward_sample) if (encById.get(v.encounter_id).patient_id !== v.patient_id) c.hit(v.encounter_id);
  for (const m of T.inbox_messages) if (m.encounter_id && m.patient_id !== encById.get(m.encounter_id).patient_id) c.hit(m.message_id);
  check('the same patient id is used wherever an encounter is referenced', c.n, c.ex);
}
{
  const c = counter(); const lim = '2026-11-18T00:00';
  const cols = { encounters: ['admit_time', 'discharge_time', 'medically_ready_time', 'discharge_order_time'], adt_events: ['request_time', 'bed_assigned_time', 'actual_time', 'vacated_bed_clean_end'], ed_visits: ['arrival_time', 'triage_time', 'roomed_time', 'doctor_seen_time', 'disposition_decision_time', 'departure_time'], or_cases: ['wheels_in', 'incision', 'closure', 'wheels_out', 'cancellation_time', 'add_on_request_time', 'recovery_out'], clinic_appointments: ['booked_time', 'cancellation_time', 'check_in_time', 'checkout_time'], inbox_messages: ['created_time', 'read_time', 'actioned_time'], vitals_ward_sample: ['observation_time'], bed_census_hourly: ['timestamp'] };
  for (const t in cols) for (const r of T[t]) for (const k of cols[t]) if (r[k] && r[k] > lim) c.hit(t + '.' + k + ' ' + r[k]);
  const first = T.bed_census_hourly[0].timestamp, last = T.bed_census_hourly[T.bed_census_hourly.length - 1].timestamp;
  if (first !== '2026-05-22T00:00' || last !== '2026-11-17T23:00') c.hit('census range ' + first + '..' + last);
  check('nothing is recorded after the snapshot (2026-11-18T00:00); census covers 180 days ending Tue 17 Nov 2026', c.n, c.ex);
}

// ---------------------------------------------------------------- 2. beds: no double occupancy, cleaning respected, ADT sequences coherent
const stays = [];           // {bed, unit, enc, tin, tout, cleanEnd, assign}
{
  const byEnc = new Map(); for (const a of T.adt_events) { if (!byEnc.has(a.encounter_id)) byEnc.set(a.encounter_id, []); byEnc.get(a.encounter_id).push(a); }
  const c = counter(), c2 = counter();
  const unitOfBed = new Map(T.beds.map(b => [b.bed_id, b.unit]));
  for (const [id, list] of byEnc) {
    const done = list.filter(a => a.status === 'completed').sort((x, y) => tm(x.actual_time) - tm(y.actual_time) || (x.event_type === 'discharge' ? 1 : -1));
    let cur = null; const e = encById.get(id);
    done.forEach((a, i) => {
      const t = tm(a.actual_time);
      if (a.request_time && tm(a.request_time) > t) c.hit(a.event_id + ' request after actual');
      if (a.bed_assigned_time && (tm(a.bed_assigned_time) > t || tm(a.bed_assigned_time) < tm(a.request_time))) c.hit(a.event_id + ' assignment order');
      if (a.event_type === 'admit') { if (i !== 0 || cur) c.hit(a.event_id + ' admit not first'); }
      else { if (!cur || cur.bed !== a.from_bed) c.hit(a.event_id + ' from_bed does not match current bed'); else { cur.tout = t; cur.cleanEnd = tm(a.vacated_bed_clean_end); if (a.vacated_bed_clean_start && tm(a.vacated_bed_clean_start) < t) c.hit(a.event_id + ' cleaning before vacated'); } }
      if (a.event_type === 'discharge') { cur = null; if (i !== done.length - 1) c.hit(a.event_id + ' event after discharge'); }
      else { if (unitOfBed.get(a.to_bed) !== a.to_unit) c.hit(a.event_id + ' unit/bed mismatch'); cur = { bed: a.to_bed, unit: a.to_unit, enc: id, tin: t, tout: null, cleanEnd: null, assign: tm(a.bed_assigned_time) }; stays.push(cur); }
    });
    // encounter table agrees with its events
    const dis = done.find(a => a.event_type === 'discharge');
    if ((dis ? dis.actual_time : '') !== e.discharge_time) c2.hit(id + ' discharge time');
    const first = done.find(a => a.event_type !== 'discharge');
    if (first && e.first_unit !== first.to_unit) c2.hit(id + ' first unit');
    if (e.status === 'completed' && !dis) c2.hit(id + ' completed without discharge event');
    if (e.status === 'in_progress' && (dis || !cur)) c2.hit(id + ' in progress but no current bed');
  }
  for (const e of T.encounters) if (e.encounter_type === 'inpatient' && e.status !== 'awaiting_bed' && !byEnc.has(e.encounter_id)) c2.hit(e.encounter_id + ' has no ADT events');
  check('each stay is admit -> transfers -> discharge, every move leaves from the bed the patient was in', c.n, c.ex, byEnc.size + ' inpatient encounters');
  check('encounters.csv agrees with adt_events.csv (discharge time, first unit, status)', c2.n, c2.ex);
  const [o, pairs] = overlaps(stays, s => s.bed, s => s.tin, s => s.tout, 'bed');
  check('a bed is never double-occupied', o.n, o.ex, stays.length + ' bed stays, ' + pairs + ' consecutive pairs');
  const g = new Map(); for (const s of stays) { if (!g.has(s.bed)) g.set(s.bed, []); g.get(s.bed).push(s); }
  const cc = counter(); let np = 0;
  for (const list of g.values()) { list.sort((a, b) => a.tin - b.tin); for (let i = 1; i < list.length; i++) { np++; const p = list[i - 1]; if (p.cleanEnd == null || list[i].tin < p.cleanEnd || (list[i].assign != null && list[i].assign < p.cleanEnd)) cc.hit('bed ' + p.bed + ' reused at ' + list[i].tin + ' before clean end ' + p.cleanEnd); } }
  check('a bed is not assigned or re-occupied until its cleaning has finished', cc.n, cc.ex, np + ' turnovers');
}

// ---------------------------------------------------------------- 3. census equals ADT-derived occupancy (and ED visits for the ED)
const NH = 180 * 24; const cenIdx = new Map();
{
  const units = [...S.unit]; const occ = {}; for (const u of units) occ[u] = new Int32Array(NH + 1);
  const add = (u, a, b) => { let ha = Math.ceil(a / 60), hb = b == null ? NH : Math.ceil(b / 60); if (hb <= 0 || ha >= NH) return; if (ha < 0) ha = 0; if (hb > NH) hb = NH; if (hb <= ha) return; occ[u][ha]++; occ[u][hb]--; };
  for (const s of stays) add(s.unit, s.tin, s.tout);
  for (const v of T.ed_visits) if (v.roomed_time) add('ed', tm(v.roomed_time), tm(v.departure_time));
  for (const u of units) { let s = 0; for (let h = 0; h < NH; h++) { s += occ[u][h]; occ[u][h] = s; } }
  const nBeds = {}; for (const b of T.beds) nBeds[b.unit] = (nBeds[b.unit] || 0) + 1;
  const c = counter(), c2 = counter();
  for (const r of T.bed_census_hourly) {
    const h = tm(r.timestamp) / 60; cenIdx.set(r.unit + '|' + r.timestamp, r);
    if (Number(r.occupied) !== occ[r.unit][h]) c.hit(r.unit + ' ' + r.timestamp + ' census ' + r.occupied + ' vs derived ' + occ[r.unit][h]);
    const tot = Number(r.beds_total);
    if (tot !== nBeds[r.unit] || Number(r.occupied) > tot || Number(r.beds_available) < 0 || Number(r.occupied) + Number(r.beds_being_cleaned) + Number(r.beds_reserved) + Number(r.beds_available) !== tot) c2.hit(r.unit + ' ' + r.timestamp);
  }
  check('hourly census equals occupancy rebuilt from ADT events (inpatient units) and from ED visits (ED)', c.n, c.ex, T.bed_census_hourly.length + ' unit-hours');
  check('census never exceeds capacity; occupied + cleaning + reserved + available = beds in beds.csv', c2.n, c2.ex);
}

// ---------------------------------------------------------------- 4. waiting for a bed happens only when the requested unit has no free bed
{
  // a bed is unavailable from the moment it is assigned to a patient until cleaning after that patient has finished
  const ev = {}, nBeds = {}; for (const b of T.beds) nBeds[b.unit] = (nBeds[b.unit] || 0) + 1;
  const pend = T.adt_events.filter(a => a.status === 'bed_assigned');
  const push = (u, a, b) => { (ev[u] = ev[u] || []).push([a, 1]); if (b != null) ev[u].push([b, -1]); };
  for (const s of stays) push(s.unit, s.assign != null ? s.assign : s.tin, s.tout == null ? null : (s.cleanEnd != null ? s.cleanEnd : null));
  for (const a of pend) push(a.to_unit, tm(a.bed_assigned_time), null);
  const q = T.adt_events.filter(a => a.event_type !== 'discharge' && a.request_time && tm(a.request_time) >= 360 && ((a.bed_assigned_time ? tm(a.bed_assigned_time) : END) - tm(a.request_time) >= 2));
  const c = counter(); const byU = {}; for (const a of q) (byU[a.requested_unit] = byU[a.requested_unit] || []).push(a);
  for (const u in byU) {
    const e = (ev[u] || []).sort((x, y) => x[0] - y[0] || y[1] - x[1]); const list = byU[u].sort((x, y) => tm(x.request_time) - tm(y.request_time)); let i = 0, act = 0;
    for (const a of list) { const t = tm(a.request_time); while (i < e.length && e[i][0] <= t) { act += e[i][1]; i++; } if (nBeds[u] - act > 0) c.hit(a.event_id + ' waited although ' + (nBeds[u] - act) + ' bed(s) free in ' + u); }
  }
  const edWait = q.filter(a => a.reason === 'ed_admission').length;
  check('patients wait for a bed only when the requested unit has no clean, unreserved bed (ED boarders board because beds are full)', c.n, c.ex, q.length + ' waits checked, ' + edWait + ' of them ED boarders');
  const cb = counter(); let nb = 0;
  const adm = new Map(T.adt_events.filter(a => a.event_type === 'admit').map(a => [a.encounter_id, a]));
  for (const v of T.ed_visits) {
    if (v.boarding_hours !== '' && v.disposition === 'admitted') { nb++; if (Math.abs(Number(v.boarding_hours) - (tm(v.departure_time) - tm(v.disposition_decision_time)) / 60) > .011) cb.hit(v.visit_id + ' boarding hours'); const e = encById.get(v.admitted_encounter_id); if (e.admit_time !== v.disposition_decision_time) cb.hit(v.visit_id + ' admit time'); const a = adm.get(v.admitted_encounter_id); if (a && a.status === 'completed' && v.went_direct_to_procedure === '0' && (a.from_bed !== v.ed_space || tm(a.actual_time) < tm(v.departure_time))) cb.hit(v.visit_id + ' handover'); }
  }
  check('ED boarding hours = decision-to-departure; the inpatient encounter starts at the admit decision; the patient leaves the ED space for the bed', cb.n, cb.ex, nb + ' admitted visits');
}

// ---------------------------------------------------------------- 5. emergency department
{
  const c = counter();
  for (const v of T.ed_visits) {
    const a = tm(v.arrival_time), r = tm(v.roomed_time), d = tm(v.doctor_seen_time), x = tm(v.disposition_decision_time), dep = tm(v.departure_time);
    const seq = [a, r, d, x, dep].filter(z => z != null); for (let i = 1; i < seq.length; i++) if (seq[i] < seq[i - 1]) { c.hit(v.visit_id + ' time order'); break; }
    if (v.disposition === 'left_without_being_seen' && (v.roomed_time || v.left_without_being_seen !== '1')) c.hit(v.visit_id + ' lwbs');
    if (v.door_to_doctor_min !== '' && Number(v.door_to_doctor_min) !== d - a) c.hit(v.visit_id + ' door to doctor');
    if (!(Number(v.urgency_level) >= 1 && Number(v.urgency_level) <= 5)) c.hit(v.visit_id + ' level');
  }
  check('ED visit times are ordered (arrival <= roomed <= doctor <= decision <= departure) and derived fields agree', c.n, c.ex, T.ed_visits.length + ' visits');
  const [o, pairs] = overlaps(T.ed_visits.filter(v => v.roomed_time), v => v.ed_space, v => tm(v.roomed_time), v => tm(v.departure_time), 'ED space');
  check('an ED treatment space never holds two patients at once', o.n, o.ex, pairs + ' consecutive pairs');
}

// ---------------------------------------------------------------- 6. operating rooms
{
  const run = T.or_cases.filter(k => k.wheels_in);
  const c = counter();
  for (const k of T.or_cases) {
    const t = ['wheels_in', 'anaesthesia_ready', 'incision', 'closure', 'wheels_out'].map(x => tm(k[x]));
    if (k.status === 'completed') { if (t.some(x => x == null)) c.hit(k.case_id + ' missing times'); for (let i = 1; i < 5; i++) if (t[i] < t[i - 1]) c.hit(k.case_id + ' order'); if (Number(k.actual_room_min) !== t[4] - t[0] || Number(k.actual_procedure_min) !== t[3] - t[2]) c.hit(k.case_id + ' durations'); }
    if (k.status.startsWith('cancelled') && (k.wheels_in || !k.cancellation_reason)) c.hit(k.case_id + ' cancelled case with actual times or no reason');
    if (k.add_on === '0') { if (Number(k.scheduled_duration_min) !== tm(k.scheduled_end) - tm(k.scheduled_start)) c.hit(k.case_id + ' scheduled duration'); if (k.wheels_in && Number(k.start_delay_min) !== t[0] - tm(k.scheduled_start)) c.hit(k.case_id + ' delay'); if (k.wheels_in && k.on_time_start !== (Number(k.start_delay_min) <= 5 ? '1' : '0')) c.hit(k.case_id + ' on-time flag'); if (k.wheels_in && Number(k.start_delay_min) > 5 && !k.delay_reason) c.hit(k.case_id + ' delayed without reason'); }
  }
  check('case timelines are ordered (wheels-in <= ready <= incision <= closure <= wheels-out); cancelled cases have no actual times', c.n, c.ex, T.or_cases.length + ' cases');
  const [o1, p1] = overlaps(run, k => k.room, k => tm(k.wheels_in), k => tm(k.wheels_out), 'room');
  check('an operating room never has overlapping cases', o1.n, o1.ex, p1 + ' consecutive pairs');
  const [o2, p2] = overlaps(run, k => k.surgeon_id, k => tm(k.wheels_in), k => tm(k.wheels_out), 'surgeon');
  check('a surgeon is never in two rooms at once', o2.n, o2.ex, p2 + ' consecutive pairs');
  const [o3, p3] = overlaps(run, k => k.anaesthetist_id, k => tm(k.wheels_in), k => tm(k.wheels_out), 'anaesthetist');
  check('an anaesthetist is never in two rooms at once', o3.n, o3.ex, p3 + ' consecutive pairs');
  // knock-on delays
  const byRoom = new Map(); for (const k of run) { if (!byRoom.has(k.room)) byRoom.set(k.room, []); byRoom.get(k.room).push(k); }
  const cc = counter(); let nCasc = 0, nFollow = 0;
  for (const list of byRoom.values()) {
    list.sort((a, b) => tm(a.wheels_in) - tm(b.wheels_in));
    for (let i = 1; i < list.length; i++) {
      const k = list[i], p = list[i - 1]; if (!p.wheels_out) continue; nFollow++;
      const ready = tm(p.wheels_out) + Number(p.turnover_after_min);
      if (tm(k.wheels_in) < ready) cc.hit(k.case_id + ' started before the room was turned over');
      if (k.delay_reason === 'Previous case ran over' || k.delay_reason === 'Bumped by emergency case' || k.delay_reason === 'Slow room turnover') { nCasc++; if (ready <= tm(k.scheduled_start)) cc.hit(k.case_id + ' blamed on the previous case but the room was ready on time'); if (k.delay_reason === 'Bumped by emergency case' && p.add_on !== '1') cc.hit(k.case_id + ' bump without add-on'); }
    }
  }
  check('a delayed case delays the next case in that room (no case starts before previous wheels-out + turnover; knock-on reasons are true)', cc.n, cc.ex, nFollow + ' follow-on starts, ' + nCasc + ' knock-on delays');
  const kById = new Map(T.or_cases.map(k => [k.case_id, k])); const cd = counter();
  for (const d of G.or_delay_truth) { const k = kById.get(d.case_id); if (d.actual_start !== k.wheels_in || tm(d.earliest_feasible_start) > tm(k.wheels_in) || tm(d.earliest_feasible_start) < tm(k.scheduled_start) || Number(d.unavoidable_delay_min) + Number(d.avoidable_delay_min) !== Number(k.start_delay_min)) cd.hit(d.case_id); }
  const nDel = T.or_cases.filter(k => k.add_on === '0' && k.wheels_in && Number(k.start_delay_min) > 5).length;
  if (nDel !== G.or_delay_truth.length) cd.hit('delayed cases ' + nDel + ' vs truth rows ' + G.or_delay_truth.length);
  check('ground truth: every delayed elective case has an earliest feasible start with scheduled <= earliest feasible <= actual', cd.n, cd.ex, G.or_delay_truth.length + ' delayed cases');
  // blocks
  const blk = new Map(T.or_blocks.map(b => [b.block_id, b])); const cb = counter();
  for (const k of T.or_cases) if (k.block_id) { const b = blk.get(k.block_id); if (b.room !== k.room || b.surgeon_id !== k.surgeon_id || k.scheduled_start.slice(11) < b.start_time) cb.hit(k.case_id); }
  check('elective cases sit in their surgeon\'s block (room, surgeon, start time)', cb.n, cb.ex);
  // surgery vs bed: post-op admission happens after the operation
  const adm = new Map(T.adt_events.filter(a => a.event_type === 'admit' && a.status === 'completed').map(a => [a.encounter_id, a])); const cp = counter(); let n = 0;
  for (const k of run) if (k.patient_class === 'same_day_admission' && k.wheels_out && adm.has(k.encounter_id)) { n++; const a = adm.get(k.encounter_id); if (tm(a.actual_time) < tm(k.wheels_out) || a.from_unit !== 'periop') cp.hit(k.case_id); }
  check('same-day surgical admissions reach their first bed only after wheels-out', cp.n, cp.ex, n + ' cases');
  // surgeons: clinic vs operating room
  const cl = T.clinic_appointments.filter(a => a.doctor_in_time).map(a => ({ who: a.clinician_id, s: tm(a.doctor_in_time), e: tm(a.doctor_out_time) })).concat(run.filter(k => k.wheels_out).map(k => ({ who: k.surgeon_id, s: tm(k.wheels_in), e: tm(k.wheels_out) })));
  const [o4, p4] = overlaps(cl, x => x.who, x => x.s, x => x.e, 'clinician');
  check('a clinician is never with two clinic patients at once, and a surgeon is never in clinic and in an operation at once', o4.n, o4.ex, p4 + ' consecutive pairs');
}

// ---------------------------------------------------------------- 7. patients are in one place at a time
{
  const iv = [];
  for (const e of T.encounters) { if (!e.admit_time) continue; iv.push({ p: e.patient_id, s: tm(e.admit_time), e: e.discharge_time ? tm(e.discharge_time) : END + 1, id: e.encounter_id, link: e.linked_encounter_id, type: e.encounter_type }); }
  const g = new Map(); for (const x of iv) { if (!g.has(x.p)) g.set(x.p, []); g.get(x.p).push(x); }
  const c = counter(); let n = 0;
  for (const list of g.values()) { if (list.length < 2) continue; list.sort((a, b) => a.s - b.s); let maxEnd = list[0]; for (let i = 1; i < list.length; i++) { n++; const x = list[i]; if (x.s < maxEnd.e && !(x.link === maxEnd.id || maxEnd.link === x.id)) c.hit(x.p + ' ' + maxEnd.id + ' overlaps ' + x.id); if (x.e > maxEnd.e) maxEnd = x; } }
  check('a patient is never in two encounters at once (ED -> inpatient handover excepted)', c.n, c.ex, n + ' consecutive encounter pairs');
  const c2 = counter();
  for (const e of T.encounters) { if (e.admit_time && e.discharge_time) { const los = (tm(e.discharge_time) - tm(e.admit_time)) / 60; if (los < 0 || Math.abs(los - Number(e.length_of_stay_hours)) > .011) c2.hit(e.encounter_id); } if (e.is_readmission_30d === '1' && !(Number(e.days_since_last_discharge) <= 30)) c2.hit(e.encounter_id + ' readmission flag'); }
  // recompute readmission flags from the table itself
  const inp = T.encounters.filter(e => e.encounter_type === 'inpatient' && e.admit_time); const gp = new Map(); for (const e of inp) { if (!gp.has(e.patient_id)) gp.set(e.patient_id, []); gp.get(e.patient_id).push(e); }
  let nr = 0;
  for (const list of gp.values()) { list.sort((a, b) => tm(a.admit_time) - tm(b.admit_time)); for (let i = 1; i < list.length; i++) { const p = list[i - 1], e = list[i]; if (!p.discharge_time) continue; const within = tm(e.admit_time) - tm(p.discharge_time) <= 30 * 1440; if (within) nr++; if ((e.is_readmission_30d === '1') !== within) c2.hit(e.encounter_id + ' is_readmission'); if (p.discharge_disposition !== 'expired' && p.readmitted_within_30d !== '' && (p.readmitted_within_30d === '1') !== within) c2.hit(p.encounter_id + ' readmitted_within_30d'); } }
  check('length of stay and readmission flags agree with the encounter dates', c2.n, c2.ex, nr + ' readmissions within 30 days');
}

// ---------------------------------------------------------------- 8. clinics
{
  const c = counter();
  for (const a of T.clinic_appointments) {
    const at = tm(a.appointment_time);
    if (tm(a.booked_time) > at) c.hit(a.appointment_id + ' booked after appointment');
    if (Math.abs(Number(a.lead_time_days) - (at - tm(a.booked_time)) / 1440) > .06) c.hit(a.appointment_id + ' lead time');
    if ((a.status === 'scheduled') !== (at > END) && !(at > END && a.status.startsWith('cancelled'))) c.hit(a.appointment_id + ' status vs date');
    if (a.status === 'completed') { const s = [tm(a.check_in_time), a.roomed_time ? tm(a.roomed_time) : tm(a.check_in_time), tm(a.doctor_in_time), tm(a.doctor_out_time), tm(a.checkout_time)]; for (let i = 1; i < 5; i++) if (s[i] < s[i - 1]) { c.hit(a.appointment_id + ' flow order'); break; } if (!a.encounter_id) c.hit(a.appointment_id + ' no encounter'); }
    else if (a.check_in_time || a.encounter_id) c.hit(a.appointment_id + ' not completed but has visit data');
  }
  check('clinic appointments: booked before the visit, lead time correct, flow times ordered, status matches the date', c.n, c.ex, T.clinic_appointments.length + ' appointments');
  const [o, pairs] = overlaps(T.clinic_appointments.filter(a => a.status === 'completed' || a.status === 'no_show'), a => a.patient_id + '|' + a.appointment_time.slice(0, 10), a => tm(a.appointment_time), a => tm(a.appointment_time) + 1, 'patient-day');
  check('a patient has at most one attended or missed clinic appointment per day', pairs, o.ex);
}

// ---------------------------------------------------------------- 9. staffing
{
  const c = counter();
  for (const s of T.staffing_shifts) {
    const cen = cenIdx.get(s.unit + '|' + s.shift_start);
    if (!cen || cen.occupied !== s.census_at_start) c.hit(s.shift_id + ' census at start');
    if (Math.abs(Number(s.patients_per_nurse) - Number(s.average_census) / Number(s.nurses_actual)) > .011) c.hit(s.shift_id + ' ratio');
    if (Number(s.nurses_actual) !== Number(s.nurses_scheduled) - Number(s.sick_calls) + Number(s.float_pool_in) + Number(s.agency_nurses) + Number(s.overtime_nurses) - Number(s.floated_out)) c.hit(s.shift_id + ' headcount');
    if ((s.below_required === '1') !== (Number(s.nurses_actual) < Number(s.nurses_required))) c.hit(s.shift_id + ' flag');
  }
  check('staffing shifts: census at start matches the hourly census, patients-per-nurse and headcount arithmetic hold', c.n, c.ex, T.staffing_shifts.length + ' unit-shifts');
}

// ---------------------------------------------------------------- 10. inbox and vitals
{
  const c = counter();
  for (const m of T.inbox_messages) { if (m.read_time && tm(m.read_time) < tm(m.created_time)) c.hit(m.message_id); if (m.actioned_time && (!m.read_time || tm(m.actioned_time) < tm(m.read_time))) c.hit(m.message_id); if (!m.text) c.hit(m.message_id + ' empty'); }
  if (T.inbox_messages.length < 20000) c.hit('only ' + T.inbox_messages.length + ' messages');
  if (G.inbox_truth.length !== T.inbox_messages.length) c.hit('truth rows');
  check('inbox: at least 20,000 messages, created <= read <= actioned, one truth row per message', c.n, c.ex, T.inbox_messages.length + ' messages');
  const byEnc = new Map(); for (const s of stays) { if (!byEnc.has(s.enc)) byEnc.set(s.enc, []); byEnc.get(s.enc).push(s); }
  const cv = counter(); const seen = new Set();
  const ews = o => { let s = 0; const rr = +o.resp_rate, sp = +o.spo2_pct, t = +o.temperature_c, bp = +o.systolic_bp, hr = +o.heart_rate; s += rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3; s += sp <= 91 ? 3 : sp <= 93 ? 2 : sp <= 95 ? 1 : 0; if (o.supplemental_oxygen === '1') s += 2; s += t <= 35 ? 3 : t <= 36 ? 1 : t <= 38 ? 0 : t <= 39 ? 1 : 2; s += bp <= 90 ? 3 : bp <= 100 ? 2 : bp <= 110 ? 1 : bp <= 219 ? 0 : 3; s += hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3; if (o.consciousness !== 'A') s += 3; return s; };
  let nE = 0;
  for (const v of T.vitals_ward_sample) {
    seen.add(v.encounter_id); const t = tm(v.observation_time); const st = (byEnc.get(v.encounter_id) || []).find(s => s.tin <= t && (s.tout == null || t <= s.tout));
    if (!st || st.bed !== v.bed_id || st.unit !== v.unit) cv.hit(v.encounter_id + ' ' + v.observation_time + ' not in that bed');
    if (v.heart_rate && v.resp_rate && v.systolic_bp && v.temperature_c && v.spo2_pct) { nE++; if (ews(v) !== Number(v.early_warning_score)) cv.hit(v.encounter_id + ' ' + v.observation_time + ' score'); }
  }
  const tr = new Set(G.vitals_deterioration_truth.map(r => r.encounter_id));
  if (tr.size !== seen.size || [...seen].some(x => !tr.has(x))) cv.hit('truth rows do not match sampled stays');
  for (const r of G.vitals_deterioration_truth) if (r.deteriorated === '1' && !(tm(r.onset_time) < tm(r.recognition_time))) cv.hit(r.encounter_id + ' onset order');
  // ICU-transfer outcomes exist in ADT
  for (const r of G.vitals_deterioration_truth) if (r.outcome === 'icu_transfer' && r.icu_arrival_time && r.icu_arrival_time <= '2026-11-18T00:00') { const ok = T.adt_events.some(a => a.encounter_id === r.encounter_id && a.event_type === 'transfer' && a.actual_time === r.icu_arrival_time && a.reason === 'deterioration'); if (!ok) cv.hit(r.encounter_id + ' ICU transfer missing in ADT'); }
  check('vital signs: every observation was taken in the bed the patient occupied; early warning score recomputes; truth matches sample and ADT', cv.n, cv.ex, T.vitals_ward_sample.length + ' observations, ' + seen.size + ' stays, ' + nE + ' scores recomputed');
}

// ---------------------------------------------------------------- 11. reference schedule
{
  const c = counter(); let better = 0, n = 0, sb = 0, sr = 0;
  for (const r of G.or_reference_objective) { if (r.room === 'ALL ROOMS') { n++; sb += Number(r.booked_expected_cost); sr += Number(r.reference_expected_cost); if (Number(r.reference_expected_cost) <= Number(r.booked_expected_cost)) better++; } }
  const g = new Map(); for (const r of G.or_reference_schedule) { const k = r.date + '|' + r.room; if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
  for (const [k, list] of g) { const seq = list.map(r => Number(r.reference_sequence)).sort((a, b) => a - b); if (seq.some((x, i) => x !== i + 1)) c.hit(k + ' sequence'); list.sort((a, b) => a.reference_sequence - b.reference_sequence); for (let i = 1; i < list.length; i++) if (tm(list[i].reference_start) < tm(list[i - 1].reference_start) + Number(list[i - 1].reference_planned_duration_min) + 30) c.hit(k + ' reference overlap'); }
  if (n < 10) c.hit('only ' + n + ' held-out days');
  check('reference OR schedule: a valid non-overlapping sequence per room for each held-out day', c.n, c.ex, n + ' held-out days; expected cost ' + Math.round(sr) + ' vs booked ' + Math.round(sb) + ' (better on ' + better + ' days)');
}

// ---------------------------------------------------------------- summary
const pct = (a, b) => (100 * a / b).toFixed(1) + '%';
const med = a => { a = a.filter(x => x != null && !isNaN(x)).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : NaN; };
const q = (a, p) => { a = a.filter(x => x != null && !isNaN(x)).sort((x, y) => x - y); return a.length ? a[Math.floor(p * (a.length - 1))] : NaN; };
console.log('Northfield Medical Center - synthetic operations dataset: consistency checks');
console.log('-----------------------------------------------------------------------------------');
for (const r of results) console.log(r);
console.log('\nTables');
let total = 0;
for (const k of Object.keys(SIZE)) { total += SIZE[k]; const t = T[k.replace('.csv', '')] || G[k.replace('ground_truth/', '').replace('.csv', '')]; console.log('  ' + k.padEnd(54) + String(t ? t.length : '').padStart(8) + (t ? ' rows ' + String(t.head.length).padStart(3) + ' cols' : '               ') + (SIZE[k] / 1048576).toFixed(2).padStart(8) + ' MB'); }
console.log('  ' + 'TOTAL'.padEnd(54) + ' '.repeat(23) + (total / 1048576).toFixed(2).padStart(8) + ' MB');
console.log('\nHeadline statistics (window 2026-05-22 .. 2026-11-17)');
{
  const E = T.encounters, by = {}; for (const e of E) by[e.encounter_type] = (by[e.encounter_type] || 0) + 1;
  console.log('  encounters by type: ' + Object.keys(by).map(k => k + ' ' + by[k]).join(', '));
  const inp = E.filter(e => e.encounter_type === 'inpatient' && e.status === 'completed' && e.carry_in === '0');
  const los = inp.map(e => Number(e.length_of_stay_hours) / 24);
  console.log('  inpatient stays (admitted and discharged in window): ' + inp.length + '; length of stay median ' + med(los).toFixed(1) + ' d, mean ' + (los.reduce((a, b) => a + b, 0) / los.length).toFixed(1) + ' d, 90th pct ' + q(los, .9).toFixed(1) + ' d');
  const alive = inp.filter(e => e.discharge_disposition !== 'expired');
  console.log('  discharged before noon ' + pct(alive.filter(e => e.discharged_before_noon === '1').length, alive.length) + '; in-hospital deaths ' + pct(inp.length - alive.length, inp.length) + '; 30-day readmission (where known) ' + pct(alive.filter(e => e.readmitted_within_30d === '1').length, alive.filter(e => e.readmitted_within_30d !== '').length));
  const occ = {}; for (const r of T.bed_census_hourly) { const o = occ[r.unit] = occ[r.unit] || [0, 0]; o[0] += Number(r.occupied); o[1] += Number(r.beds_total); }
  console.log('  mean occupancy: ' + Object.keys(occ).map(u => u + ' ' + pct(occ[u][0], occ[u][1])).join(', '));
  const V = T.ed_visits.filter(v => v.status === 'departed');
  const adm = V.filter(v => v.disposition === 'admitted');
  console.log('  ED: ' + (T.ed_visits.length / 180).toFixed(0) + ' visits/day; admitted ' + pct(adm.length, V.length) + '; left without being seen ' + pct(V.filter(v => v.left_without_being_seen === '1').length, V.length) + '; door-to-doctor median ' + med(V.map(v => num(v.door_to_doctor_min))) + ' min; boarding median ' + med(adm.map(v => Number(v.boarding_hours))).toFixed(1) + ' h, 90th pct ' + q(adm.map(v => Number(v.boarding_hours)), .9).toFixed(1) + ' h');
  const lv = [0, 0, 0, 0, 0, 0]; for (const v of T.ed_visits) lv[Number(v.urgency_level)]++; console.log('  ED urgency mix 1..5: ' + lv.slice(1).map(x => pct(x, T.ed_visits.length)).join(' / '));
  const K = T.or_cases, el = K.filter(k => k.add_on === '0'), done = K.filter(k => k.status === 'completed');
  const fc = el.filter(k => k.first_case_of_day === '1');
  console.log('  OR: ' + K.length + ' cases (' + K.filter(k => k.add_on === '1').length + ' add-on); elective cancelled on the day ' + pct(el.filter(k => k.status === 'cancelled_day_of').length, el.length) + ', before the day ' + pct(el.filter(k => k.status === 'cancelled_before_day').length, el.length) + '; first-case on-time starts ' + pct(fc.filter(k => k.on_time_start === '1').length, fc.length) + '; turnover median ' + med(done.map(k => num(k.turnover_after_min))) + ' min');
  const ratio = done.filter(k => k.estimated_procedure_min && k.actual_procedure_min).map(k => Number(k.actual_procedure_min) / Number(k.estimated_procedure_min));
  console.log('  case duration: actual/estimated procedure time median ' + med(ratio).toFixed(2) + ', 90th pct ' + q(ratio, .9).toFixed(2) + '; block utilisation median ' + med(T.or_block_days.filter(b => b.block_status === 'active').map(b => Number(b.block_utilisation_pct))).toFixed(0) + '%');
  const A = T.clinic_appointments.filter(a => a.status !== 'scheduled' && a.appointment_time <= '2026-11-18T00:00'), nc = A.filter(a => !a.status.startsWith('cancelled'));
  console.log('  clinics: ' + A.length + ' past appointments; no-show ' + pct(nc.filter(a => a.status === 'no_show').length, nc.length) + ' of uncancelled; late cancellation ' + pct(A.filter(a => a.status === 'cancelled_late').length, A.length) + '; ' + T.clinic_appointments.filter(a => a.status === 'scheduled').length + ' future appointments');
  const S2 = T.staffing_shifts; console.log('  staffing: ' + pct(S2.filter(s => s.below_required === '1').length, S2.length) + ' of unit-shifts below required nurses');
  const D2 = G.vitals_deterioration_truth; console.log('  vitals sample: ' + D2.length + ' stays, ' + D2.filter(r => r.deteriorated === '1').length + ' with a hidden deterioration (' + D2.filter(r => r.outcome === 'icu_transfer').length + ' ICU transfers, ' + D2.filter(r => r.outcome === 'death_on_ward').length + ' ward deaths)');
}
console.log('\n' + (failed ? failed + ' CHECK(S) FAILED' : 'ALL ' + results.length + ' CHECKS PASSED'));
process.exit(failed ? 1 : 0);
