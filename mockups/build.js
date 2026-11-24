// Generates the eight static mockup HTML files from one shared content model.
// Usage: node build.js   (writes 01-*.html … 08-*.html beside this file)
const fs = require('fs');
const path = require('path');
const themes = require('./themes.js');

/* ---------- content (identical in every direction) ---------- */
const VIT = [
  { k: 'Temperature', v: '37.4', u: '°C', d: [38.6, 38.5, 38.3, 38.4, 38.1, 37.9, 38.0, 37.8, 37.6, 37.7, 37.5, 37.5, 37.4], rng: '37.4–38.6', from: '38.6', dir: 'down' },
  { k: 'Heart rate', v: '89', u: '/min', d: [112, 110, 108, 109, 104, 101, 99, 97, 96, 93, 92, 90, 89], rng: '89–112', from: '112', dir: 'down' },
  { k: 'Blood pressure', v: '113/63', u: 'mmHg', d: [96, 98, 99, 101, 103, 104, 106, 105, 108, 110, 109, 112, 113], rng: '96–113 sys', from: '96/52', dir: 'up' },
  { k: 'Mean arterial', v: '80', u: 'mmHg', d: [66, 67, 68, 69, 71, 72, 74, 73, 76, 78, 77, 79, 80], rng: '66–80', from: '66', dir: 'up' },
  { k: 'Resp. rate', v: '20', u: '/min', d: [26, 25, 25, 24, 23, 23, 22, 22, 21, 21, 20, 21, 20], rng: '20–26', from: '26', dir: 'down' },
  { k: 'SpO<sub>2</sub>', v: '96', u: '%', d: [91, 92, 92, 93, 93, 94, 94, 95, 95, 95, 96, 96, 96], rng: '91–96', from: '91', dir: 'up', note: 'high-flow' },
];
const DUE = [
  { t: '14:00', n: 'Heparin 5,000 units', s: 'Subcutaneous · every 8 hours', st: 'due', lab: 'Due · +32 min' },
  { t: '14:00', n: 'Ipratropium-albuterol nebuliser', s: 'Inhaled · every 6 hours', st: 'due', lab: 'Due · +32 min' },
  { t: '18:00', n: 'Insulin lispro, correction', s: 'Subcutaneous · per glucose check', st: 'sched', lab: 'In 3 h 28 min' },
  { t: '18:00', n: 'Metformin 500 mg', s: 'Oral · morning dose held', st: 'held', lab: 'Review hold' },
];
const LABS = [
  ['Urea nitrogen', '34', 'H', '41', '−7', 'down', '7–20 mg/dL'],
  ['Creatinine', '1.7', 'H', '2.1', '−0.4', 'down', '0.7–1.3 mg/dL'],
  ['Glucose', '154', 'H', '188', '−34', 'down', '70–99 mg/dL'],
  ['Calcium', '8.2', 'L', '8.0', '+0.2', 'up', '8.6–10.2 mg/dL'],
  ['White cells', '12.8', 'H', '16.4', '−3.6', 'down', '4.0–11.0 ×10<sup>9</sup>/L'],
  ['Haemoglobin', '11.2', 'L', '11.6', '−0.4', 'down', '13.5–17.5 g/dL'],
  ['Platelets', '139', 'L', '128', '+11', 'up', '150–400 ×10<sup>9</sup>/L'],
  ['Procalcitonin', '9.7', 'H', '18.3', '−8.6', 'down', '&lt;0.5 ng/mL', 'crit'],
];
const HOURS = []; for (let h = 6; h <= 22; h++) HOURS.push(h);
const NOWH = 14;
const MEDS = [
  { n: 'Norepinephrine infusion', s: '0.04 mcg/kg/min · central line', inf: '0.04 mcg/kg/min · since 11:00' },
  { n: 'Heparin 5,000 units', s: 'Subcutaneous · every 8 h', c: { 6: 'given', 14: 'due', 22: 'sched' } },
  { n: 'Ipratropium-albuterol', s: 'Nebuliser · every 6 h', c: { 8: 'given', 14: 'due', 20: 'sched' } },
  { n: 'Insulin lispro, correction', s: 'Subcutaneous · with meals', c: { 8: 'given', 12: 'given', 18: 'sched' } },
  { n: 'Insulin glargine 10 units', s: 'Subcutaneous · nightly', c: { 21: 'sched' } },
  { n: 'Metformin 500 mg', s: 'Oral · every 12 h', c: { 8: 'held', 18: 'sched' } },
  { n: 'Pantoprazole 40 mg', s: 'Oral · daily', c: { 8: 'given' } },
  { n: 'Acetaminophen 650 mg', s: 'Oral · as needed, fever', c: { 7: 'given', 13: 'given' } },
];
const TEAM = [
  ['Attending', 'Dr. Imogen Varga', 'ext. 4410'],
  ['Resident', 'Dr. Tae-yang Brandt (PGY-2)', 'ext. 4417'],
  ['Nurse (day)', 'C. Adeyemi-Frost RN', 'ext. 4120'],
  ['Pharmacist', 'Priya Lindqvist, PharmD', 'ext. 4306'],
  ['Respiratory therapist', 'J. Abernathy-Cole RRT', 'ext. 4188'],
];
const PROBLEMS = [
  'Septic shock, weaning vasopressor',
  'Right lower lobe pneumonia with pneumococcal bacteraemia',
  'Acute kidney injury',
  'Type 2 diabetes',
  'COPD',
];
const CTABS = [
  ['summary', 'Summary'], ['review', 'Chart review'], ['results', 'Results', '8'], ['flow', 'Flowsheets'],
  ['meds', 'Medications', '2'], ['orders', 'Orders', '1'], ['notes', 'Notes', '4'], ['history', 'History'],
  ['discharge', 'Discharge'], ['coding', 'Coding'],
];
const NAV = [['Patient lists'], ['Unit board'], ['Operating rooms'], ['Emergency board'], ['Chat', '2'], ['Inbox', '7', 'hot']];
const WS = [
  ['Okonkwo-Reyes, Harlan', 'MICU-12', true],
  ['Thackeray-Mbeki, Odile', '5W-08'],
  ['Lindqvist-Asante, Per', 'CCU-03'],
];

/* ---------- small drawing helpers ---------- */
const ICON = {
  check: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.2 6.4l2.4 2.4 5.2-5.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ring: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="3.4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  dot: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="3.6" fill="currentColor"/></svg>',
  diamond: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 1.2L10.8 6 6 10.8 1.2 6z" fill="currentColor"/></svg>',
  bang: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 2v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="6" cy="10" r="1.1" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M4 2.5v7M8 2.5v7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  slash: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3.2 8.8l5.6-5.6" stroke="currentColor" stroke-width="1.4"/></svg>',
  search: '<svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9.2 9.2l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  // Original mark: a flower spike of three offset petals on a stem.
  logo: '<svg class="logo" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 19V6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M10 1.5l2.6 3L10 7.5 7.4 4.5z" fill="currentColor"/><path d="M10 8.5l4.2-2.2.6 3.9-3.6 1.9z" fill="currentColor" opacity=".8"/><path d="M10 12.500l-4.2-2.2-.6 3.9 3.6 1.9z" fill="currentColor" opacity=".6"/></svg>',
};
const GLYPH_DEFAULT = { given: ICON.check, due: ICON.bang, sched: ICON.ring, held: ICON.pause };

function spark(d, mode) {
  const W = 120, H = 28, p = 3;
  const mn = Math.min(...d), mx = Math.max(...d), sp = mx - mn || 1;
  const X = i => +(p + (i * (W - 2 * p)) / (d.length - 1)).toFixed(1);
  const Y = v => +(H - p - ((v - mn) / sp) * (H - 2 * p)).toFixed(1);
  let inner = '';
  if (mode === 'bars') {
    const bw = (W - 2 * p) / d.length;
    inner = d.map((v, i) => { const y = Y(v) - 1; return `<rect class="sb${i === d.length - 1 ? ' last' : ''}" x="${(p + i * bw).toFixed(1)}" y="${Math.min(y, H - 4).toFixed(1)}" width="${(bw - 1.6).toFixed(1)}" height="${Math.max(H - Math.min(y, H - 4), 3).toFixed(1)}"/>`; }).join('');
  } else {
    let pts;
    if (mode === 'step') { pts = []; d.forEach((v, i) => { if (i) pts.push(`${X(i)},${Y(d[i - 1])}`); pts.push(`${X(i)},${Y(v)}`); }); pts = pts.join(' '); }
    else pts = d.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
    if (mode === 'area') inner += `<polygon class="sa" points="${X(0)},${H} ${pts} ${X(d.length - 1)},${H}"/>`;
    inner += `<polyline class="sl" points="${pts}" fill="none" vector-effect="non-scaling-stroke"/>`;
    inner += `<path class="sd" d="M${X(d.length - 1)} ${Y(d[d.length - 1])}h0" vector-effect="non-scaling-stroke"/>`;
  }
  return `<svg class="spark ${mode}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${inner}</svg>`;
}

/* ---------- page ---------- */
function page(t) {
  const G = Object.assign({}, GLYPH_DEFAULT, t.glyph || {});
  const arrow = dir => `<span class="ar ${dir}">${dir === 'up' ? '↑' : '↓'}</span>`;

  const sys = `<header class="sys">
  <div class="brand">${ICON.logo}<span class="bn">Larkspur <b>Clinical</b></span></div>
  <nav class="nav">${NAV.map(n => `<a>${n[0]}${n[1] ? `<span class="ct ${n[2] || ''}">${n[1]}</span>` : ''}</a>`).join('')}</nav>
  <div class="search">${ICON.search}<span>Search patient or record no.</span><kbd>/</kbd></div>
  <div class="clock"><span class="cd">Tue 17 Nov</span><span class="ctm">14:32</span></div>
  <div class="user"><span class="av">TB</span><span class="un">Dr. T. Brandt<small>Resident · Medical ICU</small></span></div>
</header>`;

  const ws = `<div class="ws">
  <a class="wt home"><span class="wn">Patient lists</span></a>
  ${WS.map(w => `<a class="wt${w[2] ? ' on' : ''}"><span class="wn">${w[0]}</span><span class="wb">${w[1]}</span><span class="x">×</span></a>`).join('\n  ')}
  <span class="ws-right">3 charts open</span>
</div>`;

  const side = `<aside class="side">
  <div class="id">
    <span class="pav">HO</span>
    <div class="idt"><div class="pname">Okonkwo-Reyes, Harlan</div><div class="pdemo">68 M · born 03 Feb 1958</div></div>
  </div>
  <div class="loc"><span class="bed">MICU-12</span><span class="unit">Medical ICU · day 3</span></div>
  <div class="flags">
    <div class="flag crit"><span class="fl">Allergy</span><span class="fv">Penicillin</span></div>
    <div class="flag code"><span class="fl">Code status</span><span class="fv">Full code</span></div>
  </div>
  <dl class="facts">
    <div><dt>Record no.</dt><dd class="num">LX-204471</dd></div>
    <div><dt>Attending</dt><dd>Dr. Imogen Varga</dd></div>
    <div><dt>Admitted</dt><dd class="num">15 Nov 22:40</dd></div>
    <div class="opt"><dt>Weight</dt><dd class="num">86 kg · 178 cm</dd></div>
  </dl>
  <div class="sblock sv">
    <h4>Latest vitals <span class="num">14:00</span></h4>
    <div class="svg">
      <div><span>T</span><b class="num">37.4</b></div>
      <div><span>HR</span><b class="num">89</b></div>
      <div><span>BP</span><b class="num">113/63</b></div>
      <div><span>RR</span><b class="num">20</b></div>
      <div class="wide"><span>SpO<sub>2</sub></span><b class="num">96%</b><em>on high-flow</em></div>
    </div>
  </div>
  <div class="sblock sp">
    <h4>Problems <span class="num">5</span></h4>
    <ol>${PROBLEMS.map(p => `<li>${p}</li>`).join('')}</ol>
  </div>
</aside>`;

  const ctabs = `<nav class="ctabs">${CTABS.map((c, i) => `<a class="ctab ct-${c[0]}${i === 0 ? ' on' : ''}"><span class="cl">${c[1]}</span>${c[2] ? `<span class="cb">${c[2]}</span>` : ''}</a>`).join('')}</nav>`;

  const sub = `<div class="sub"><div class="views"><a class="on">Overview</a><a>Handoff</a><a>Rounding</a><a>Fluid balance</a></div><div class="subr">Septic shock from pneumococcal pneumonia · hospital day 3 · updated <span class="num">14:31</span></div></div>`;

  const pVit = `<section class="panel p-vit from-flow">
  <div class="ph"><h3>Vitals</h3><span class="pm">Last 12 h · charted <span class="num">14:00</span></span><a class="pl">Flowsheets</a></div>
  <div class="pb"><div class="vit ${t.vitals || 'rows'}">
    ${VIT.map(v => `<div class="v"><span class="vl">${v.k}${v.note ? `<i>${v.note}</i>` : ''}</span><span class="vv num">${v.v}<small>${v.u}</small></span><span class="vs">${spark(v.d, t.spark || 'line')}</span><span class="vr num">${arrow(v.dir)} from ${v.from}</span></div>`).join('\n    ')}
  </div></div>
</section>`;

  const pDue = `<section class="panel p-due from-meds">
  <div class="ph"><h3>Work due</h3><span class="pm">2 due · 2 later</span><a class="pl">Medications</a></div>
  <div class="pb"><ul class="wdl">
    ${DUE.map(d => `<li class="wd ${d.st}"><span class="wtm num">${d.t}</span><span class="wm"><b>${d.n}</b><small>${d.s}</small></span><span class="chip ${d.st}">${d.lab}</span></li>`).join('\n    ')}
  </ul></div>
</section>`;

  const pRes = `<section class="panel p-res from-results">
  <div class="ph"><h3>Abnormal results</h3><span class="pm">Collected 17 Nov <span class="num">05:40</span></span><a class="pl">Results</a></div>
  <div class="pb"><table class="res">
    <thead><tr><th>Test</th><th class="r">Result</th><th class="fc"></th><th class="r">Previous</th><th class="r">Change</th><th>Reference</th></tr></thead>
    <tbody>
    ${LABS.map(l => `<tr class="${l[2] === 'H' ? 'hi' : 'lo'}${l[7] ? ' critrow' : ''}"><td class="tn">${l[0]}</td><td class="r num val">${l[1]}</td><td class="fc"><span class="fg ${l[2] === 'H' ? 'hi' : 'lo'}">${l[2]}</span></td><td class="r num prev">${l[3]}</td><td class="r num dl">${arrow(l[5])} ${l[4].replace(/^[+−]/, '')}</td><td class="ref num">${l[6]}</td></tr>`).join('\n    ')}
    </tbody>
  </table></div>
</section>`;

  const medRow = m => {
    if (m.inf) {
      const run = HOURS.filter(h => h <= NOWH).length, plan = HOURS.length - run;
      return `<tr class="infrow"><th class="mn"><b>${m.n}</b><small>${m.s}</small></th><td class="inf run" colspan="${run}"><div class="bar"><span>${m.inf}</span></div></td><td class="inf plan" colspan="${plan}"><div class="bar"></div></td></tr>`;
    }
    return `<tr><th class="mn"><b>${m.n}</b><small>${m.s}</small></th>${HOURS.map(h => { const s = m.c[h]; return `<td class="mc${h === NOWH ? ' now' : ''}${s ? ' ' + s : ''}">${s ? `<span class="g">${G[s]}</span>` : ''}</td>`; }).join('')}</tr>`;
  };
  const pMed = `<section class="panel p-med from-meds">
  <div class="ph"><h3>Medications by hour</h3><span class="pm">Today <span class="num">06:00–22:00</span></span><a class="pl">Medications</a></div>
  <div class="pb"><table class="med">
    <thead><tr><th class="mn">Medicine</th>${HOURS.map(h => `<th class="hh num${h === NOWH ? ' now' : ''}">${String(h).padStart(2, '0')}</th>`).join('')}</tr></thead>
    <tbody>
    ${MEDS.map(medRow).join('\n    ')}
    </tbody>
  </table>
  <div class="legend"><span class="lg given"><span class="g">${G.given}</span>Given</span><span class="lg due"><span class="g">${G.due}</span>Due</span><span class="lg sched"><span class="g">${G.sched}</span>Scheduled</span><span class="lg held"><span class="g">${G.held}</span>Held</span><span class="lg run"><i class="lbar"></i>Infusion running</span></div>
  </div>
</section>`;

  const pTeam = `<section class="panel p-team from-review">
  <div class="ph"><h3>Care team</h3><span class="pm">Day shift</span><a class="pl">Chart review</a></div>
  <div class="pb"><ul class="team">
    ${TEAM.map(m => `<li><span class="tr">${m[0]}</span><span class="tnm">${m[1]}</span><span class="tx num">${m[2]}</span></li>`).join('\n    ')}
  </ul></div>
</section>`;

  const status = t.status || `<footer class="status"><span>Dr. Tae-yang Brandt · Resident (PGY-2)</span><span>Medical ICU</span><span class="grow"></span><span>Practice environment · synthetic patients</span><span class="num">Saved 14:31</span></footer>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1440">
<title>Larkspur Clinical · ${t.no} ${t.name}</title>
<!-- Direction ${t.no}: ${t.name}. ${t.rationale} -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${t.fonts}&display=swap">
<style>
${BASE}
/* ===== Direction ${t.no}: ${t.name} ===== */
${t.css}
</style>
</head>
<body class="d${t.no}">
<div class="app">
${sys}
${ws}
<div class="main">
${side}
<section class="chart">
${ctabs}
${sub}
<div class="body lay-${t.layout || 'A'}">
${pVit}
${pDue}
${pTeam}
${pRes}
${pMed}
${t.filler ? '<div class="filler"><span>Unused space at this density: room for two more panels</span></div>' : ''}
</div>
</section>
</div>
${status}
</div>
</body>
</html>
`;
}

/* ---------- shared structural CSS (themes restyle everything through variables and overrides) ---------- */
const BASE = fs.readFileSync(path.join(__dirname, 'base.css'), 'utf8');

for (const t of themes) {
  const f = path.join(__dirname, `${t.no}-${t.slug}.html`);
  fs.writeFileSync(f, page(t));
  console.log('wrote', f);
}
