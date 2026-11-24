// The eight visual directions. Each one sets design tokens and then restyles the shared markup.
const rep = (n, k) => Array(k).fill(n).join(' ');
const ICONS = {
  dotS: '<svg viewBox="0 0 12 12" width="12" height="12"><circle cx="6" cy="6" r="3.2" fill="currentColor"/></svg>',
  sq: '<svg viewBox="0 0 12 12" width="12" height="12"><rect x="2.5" y="2.5" width="7" height="7" fill="currentColor"/></svg>',
  ring: '<svg viewBox="0 0 12 12" width="12" height="12"><circle cx="6" cy="6" r="3.2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
  slash: '<svg viewBox="0 0 12 12" width="12" height="12"><circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3.5 8.5l5-5" stroke="currentColor" stroke-width="1.2"/></svg>',
};

module.exports = [
/* ------------------------------------------------------------------ 01 */
{
  no: '01', slug: 'ward-standard', name: 'Ward Standard',
  rationale: 'Classic clinical workstation: light neutral chrome, compact rows, and colour reserved almost entirely for status.',
  typefaces: 'Source Sans 3 (400/600/700), tabular figures',
  palette: 'Chrome grey #D5D9DE · canvas #E4E7EA · surface #FFFFFF · ink #1A1F24 · accent petrol #0D5C63 · critical #B3261E · warning #8A5A00 · ok #1E6B3A · low #2D50A8',
  fonts: 'family=Source+Sans+3:wght@400;600;700',
  layout: 'A', vitals: 'rows', spark: 'line', filler: true,
  css: `
:root{--font:"Source Sans 3",system-ui,sans-serif;--fs:13px;
--bg:#e4e7ea;--surface:#fff;--surface2:#eceff1;--line:#b4bcc4;--line2:#e1e5e9;--ink:#1a1f24;--ink2:#434c55;--ink3:#626c76;
--accent:#0d5c63;--accent-ink:#fff;--accent-soft:#d8ebec;--chrome:#d5d9de;--chrome-ink:#1a1f24;--field:#fff;--field-ink:#59626c;--field-line:#aab2bb;
--ws:#c6ccd3;--ws-ink:#2a323a;--crit:#b3261e;--crit-soft:#fbe4e1;--warn:#8a5a00;--warn-soft:#fdefc8;--ok:#1e6b3a;--ok-soft:#dbeede;--low:#2d50a8;--low-soft:#e1e8f9;
--r:2px;--sys-h:34px;--ws-h:30px;--ct-h:31px;--sub-h:28px;--st-h:22px;--side-w:240px;--pad:8px;--gap:8px;--rh:26px;--ph:26px;--side:#f5f6f7;--phbg:#e9ecef;--ctbg:#d5d9de;--badge:#b9c0c8}
.sys{border-bottom:1px solid #aab2bb}
.brand{color:var(--accent)} .brand .bn{color:var(--ink)}
.nav a{border-left:1px solid transparent;border-right:1px solid transparent}
.user .av{border-radius:2px}
.ws{padding-left:6px}
.wt{background:#d7dce1;border-color:#aab2bb}
.wt.on{border-top:2px solid var(--accent)}
.ctabs{gap:1px;padding-left:6px}
.ctab{background:#e6e9ec;border:1px solid var(--line);border-bottom:0;border-radius:2px 2px 0 0;height:25px;color:var(--ink)}
.ctab.on{background:#fff;color:var(--ink);border-top:2px solid var(--accent);height:28px;margin-bottom:-1px}
.cb{background:#c9cfd6;color:var(--ink)}
.sub{background:#fff}
.ph h3{text-transform:none}
.body{grid-template-rows:auto auto minmax(0,1fr);grid-template-areas:
 "${rep('vit', 10)} ${rep('due', 8)} ${rep('team', 6)}"
 "${rep('res', 10)} ${rep('med', 14)}"
 "${rep('fill', 24)}"}
.vit.rows{flex:none;grid-auto-rows:30px}.wdl{flex:none;grid-auto-rows:45px}.team{flex:none;grid-auto-rows:36px}
.res,.med{flex:none}
.res tbody tr:nth-child(even),.med tbody tr:nth-child(even){background:#f6f7f8}
.pb{padding-bottom:4px}
.legend{margin-top:6px}
.chip{border-radius:2px}
.filler{background:transparent;border-color:#aab2bb}
`,
},
/* ------------------------------------------------------------------ 02 */
{
  no: '02', slug: 'casebook', name: 'Casebook',
  rationale: 'Warm paper and ink: off-white stock, serif headings and ruled sections, so a long shift reads like a well-kept case file.',
  typefaces: 'Newsreader (headings, patient name) with Public Sans (data and labels)',
  palette: 'Paper #EFE9DC · page #FAF6EC · ink #2A2520 · rule #CFC5B0 · accent ink-blue #2B3F6C · critical #A4281F · warning #86560A · ok #2F6B3D · low violet #5B3A8C',
  fonts: 'family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Public+Sans:wght@400;500;600;700',
  layout: 'H', vitals: 'rows', spark: 'line',
  css: `
:root{--font:"Public Sans",system-ui,sans-serif;--hfont:"Newsreader",Georgia,serif;--fs:12.5px;
--bg:#faf6ec;--surface:#faf6ec;--surface2:#efe9dc;--line:#cfc5b0;--line2:#e4dccb;--ink:#2a2520;--ink2:#574d43;--ink3:#73675a;
--accent:#2b3f6c;--accent-ink:#faf6ec;--accent-soft:#dfe3ee;--chrome:#2a2520;--chrome-ink:#f3ecdc;--field:#3d362f;--field-ink:#d9cfbc;
--ws:#efe9dc;--ws-ink:#574d43;--crit:#a4281f;--crit-soft:#f6ded6;--warn:#86560a;--warn-soft:#f5e5bd;--ok:#2f6b3d;--ok-soft:#dde9d3;--low:#5b3a8c;--low-soft:#e9e0f0;
--r:2px;--sys-h:38px;--ws-h:32px;--ct-h:38px;--sub-h:30px;--st-h:22px;--side-w:252px;--pad:16px;--gap:20px;--rh:27px;--ph:34px;--pp:0px;--side:#efe9dc;--side-pad:16px;--side-gap:12px;--badge:#51483f;--stbg:#efe9dc}
.brand{font-family:var(--hfont);font-size:17px;font-weight:500;letter-spacing:.01em}.brand b{font-weight:600}
.brand .logo{color:#d9b56a}
.nav a{opacity:.86}
.user .av{background:#d9b56a;color:#2a2520}
.wt.on{background:var(--bg)}
.side{border-right:1px solid var(--line)}
.pav{border-radius:50%;background:transparent;color:var(--ink);border:1.5px solid var(--ink);font-family:var(--hfont);font-size:15px}
.pname{font-size:19px;font-weight:600;line-height:1.1}
.flag{border-radius:0;border-width:0 0 0 3px;border-color:var(--ink2);background:#e6dfcf;padding:5px 9px}
.flag.crit{border-color:var(--crit)}
.sblock h4{font-family:var(--hfont);text-transform:none;letter-spacing:0;font-size:14.5px;font-weight:600;color:var(--ink);border-bottom:1px solid var(--ink)}
.sblock h4 span{font-family:var(--font);font-size:12px;color:var(--ink3)}
.ctabs{gap:6px;background:var(--bg)}
.ctab{font-family:var(--hfont);font-size:15.5px;font-weight:500;padding:0 9px;color:var(--ink2)}
.ctab.on{color:var(--ink);font-weight:600;border-bottom:3px solid var(--accent)}
.cb{font-family:var(--font);background:var(--surface2)}
.sub{border-bottom:0}
.views a.on{background:transparent;border-bottom:1.5px solid var(--accent);border-radius:0;padding-left:2px;padding-right:2px;margin-right:10px}
.subr{font-family:var(--hfont);font-style:italic;font-size:13.5px;color:var(--ink2)}
.panel{border:0;border-top:3px double var(--ink);border-radius:0;background:transparent}
.ph{border-bottom:1px solid var(--line)}
.ph h3{font-size:17px;font-weight:600}
.ph .pm{font-style:italic;font-family:var(--hfont);font-size:13px}
.pb{padding:2px 0 0}
.spark .sl{stroke:var(--ink);stroke-width:1.2}.spark .sd{stroke:var(--accent)}
.vv{font-family:var(--hfont);font-size:18px;font-weight:600}
.vv small{font-family:var(--font);font-size:11px}
.wd{grid-template-columns:auto minmax(0,1fr);gap:1px 10px;align-content:center}
.wd .chip{grid-column:2;justify-self:start;margin-top:3px}
.wtm{font-family:var(--hfont);font-size:16px;font-weight:600;align-self:start}
.chip{border-radius:2px}
.fg{border-radius:50%;width:18px;height:18px}
.g{border-radius:50%}
.med .now{background:#efe7d3}
.inf .bar,.lbar{border-radius:8px}
.ph{gap:8px}.ph .pm{padding-right:3px;font-size:12.5px}
.status{font-family:var(--hfont);font-style:italic;font-size:13px}
`,
},
/* ------------------------------------------------------------------ 03 */
{
  no: '03', slug: 'night-watch', name: 'Night Watch',
  rationale: 'High-contrast dark for night shifts and the ICU: near-black surfaces, large legible numerals and solid status blocks that read across the room.',
  typefaces: 'Atkinson Hyperlegible (400/700)',
  palette: 'Canvas #07090B · surface #11151A · line #2C353F · ink #F3F6F8 · accent periwinkle #A9B8FF · critical #FF7A70 · warning #FFC145 · ok #6FDC8C · low #7FD0FF',
  fonts: 'family=Atkinson+Hyperlegible:wght@400;700',
  layout: 'D', vitals: 'tiles', spark: 'area',
  css: `
:root{--font:"Atkinson Hyperlegible",system-ui,sans-serif;--fs:13px;
--bg:#07090b;--surface:#11151a;--surface2:#1c232b;--line:#2f3944;--line2:#212931;--ink:#f3f6f8;--ink2:#bcc6d0;--ink3:#93a0ad;
--accent:#a9b8ff;--accent-ink:#0b1030;--accent-soft:#222a55;--chrome:#000;--chrome-ink:#e8edf2;--field:#161b21;--field-ink:#aab5c0;--field-line:#2f3944;
--ws:#07090b;--ws-ink:#bcc6d0;--crit:#ff7a70;--crit-soft:#3f1512;--crit-ink:#200402;--warn:#ffc145;--warn-soft:#3b2b06;--warn-ink:#221600;--ok:#6fdc8c;--ok-soft:#10331d;--low:#7fd0ff;--low-soft:#0c2d42;
--held:#d6c2ff;--held-soft:#2c2146;
--r:4px;--sys-h:40px;--ws-h:32px;--ct-h:38px;--sub-h:26px;--st-h:22px;--side-w:248px;--pad:10px;--gap:10px;--rh:25px;--ph:30px;--vcols:6;--tile:#161b21;--now:#1b2140;--stbg:#000;--badge:#2f3944;--side:#0c0f13}
.sys{border-bottom:1px solid var(--line)}
.brand .logo{color:var(--accent)}
.brand{font-size:14.5px;font-weight:700}.brand b{color:var(--accent)}
.wt{border-color:var(--line);background:#0e1216}
.wt.on{background:var(--surface);border-top:2px solid var(--accent);color:#fff}
.pav{background:var(--accent);color:var(--accent-ink)}
.pname{font-size:16px;color:#fff}
.loc .bed{background:#fff;color:#000;padding:0 6px;border-radius:3px}
.flag.crit{background:var(--crit);color:var(--crit-ink);border-color:var(--crit)}
.flag.code{border-color:var(--ok);color:var(--ok)}.flag.code .fl{color:var(--ink2)}
.svg b{color:#fff;font-size:15px}
.ctabs{gap:4px;align-items:center;background:var(--bg)}
.ctab{height:28px;border:1px solid var(--line);border-radius:4px;color:var(--ink2);padding:0 12px}
.ctab.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.ctab.on .cb{background:var(--accent-ink);color:var(--accent)}
.cb{background:var(--surface2);color:var(--ink)}
.sub{border-bottom:0}
.views a.on{color:var(--accent)}
.ph h3{font-size:14px;color:#fff}
.pb{padding:6px 10px 8px}
.vit.tiles{grid-auto-rows:76px}
.vit.tiles .v{grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto;border-color:var(--line);padding:7px 10px 6px;gap:0 10px}
.vit.tiles .vl{color:var(--ink2);font-size:12px}
.vit.tiles .vv{font-size:25px;line-height:1.05;color:#fff;grid-row:2/4;align-self:center}
.vit.tiles .vv small{font-size:11px}
.vit.tiles .vs{grid-column:2;grid-row:2;margin:0;max-height:none;min-height:0}
.vit.tiles .vr{grid-column:2;grid-row:3;padding:0;font-size:11.5px;color:var(--ink2)}
.spark .sl{stroke-width:2}.spark .sa{opacity:.22}
.wtm{font-size:15px}
.wd.due .wtm{color:var(--warn)}
.chip.due{background:var(--warn);color:var(--warn-ink)}
.res .val{font-size:14.5px}
.fg.hi{background:var(--crit-soft);border:1px solid var(--crit)}.fg.lo{background:var(--low-soft);border:1px solid var(--low)}
.critrow .fg.hi{background:var(--crit);color:var(--crit-ink)}
.critrow td{background:#1e0f0e}
.given .g{background:var(--ok);color:#05230f}
.sched .g{color:var(--ink2)}
.held .g{border:1px solid var(--held)}
.inf .bar{background:var(--ok);color:#05230f;font-weight:700}
.inf.plan .bar{background:repeating-linear-gradient(90deg,#1f6b38 0 6px,transparent 6px 10px)}
.lbar{background:var(--ok)}
.med .mc.now,.med th.now{box-shadow:inset 1px 0 0 var(--accent),inset -1px 0 0 var(--accent)}
.body{grid-template-areas:
 "vit vit vit vit vit vit vit vit vit vit vit vit vit vit vit vit vit vit vit vit vit vit vit vit"
 "due due due due due due due due due res res res res res res res res res team team team team team team"
 "med med med med med med med med med med med med med med med med med med med med med med med med"}
.vit.tiles{grid-template-columns:1fr 1fr 1.3fr 1fr 1fr 1fr;grid-auto-rows:72px}
.med{--mnw:330px}
.med tbody .mn b,.med tbody .mn small{display:inline}.med tbody .mn small{margin-left:9px}
.status{color:var(--ink3)}
`,
},
/* ------------------------------------------------------------------ 04 */
{
  no: '04', slug: 'bedside-soft', name: 'Bedside Soft',
  rationale: 'Soft, modern, consumer-grade: roomy cards, rounded shapes and friendly type that feel approachable to new staff and students.',
  typefaces: 'Plus Jakarta Sans (400/500/600/700)',
  palette: 'Canvas lavender-grey #F2F3FB · cards #FFFFFF · ink #1F2340 · accent indigo #4F55D6 · critical #C8324A · warning #9A5B00 · ok #1D7A54 · low #2B6CB8',
  fonts: 'family=Plus+Jakarta+Sans:wght@400;500;600;700',
  layout: 'A', vitals: 'tiles', spark: 'area',
  css: `
:root{--font:"Plus Jakarta Sans",system-ui,sans-serif;--fs:13px;
--bg:#f2f3fb;--surface:#fff;--surface2:#eff0fa;--line:#e2e4f1;--line2:#eceef7;--ink:#1f2340;--ink2:#535877;--ink3:#6c7191;
--accent:#4f55d6;--accent-ink:#fff;--accent-soft:#e7e8fc;--chrome:#fff;--chrome-ink:#1f2340;--field:#f0f1fa;--field-ink:#6c7191;
--ws:#f2f3fb;--ws-ink:#535877;--crit:#c8324a;--crit-soft:#fde6ea;--warn:#9a5b00;--warn-soft:#fdefd3;--ok:#1d7a54;--ok-soft:#dcf3e8;--low:#2b6cb8;--low-soft:#e2eefb;
--r:12px;--sys-h:54px;--ws-h:44px;--ct-h:46px;--sub-h:0px;--st-h:0px;--side-w:276px;--pad:14px;--gap:14px;--rh:30px;--ph:40px;--pp:16px;--vcols:3;--tile:#f7f7fd;--tgap:10px;--side-pad:16px;--side-gap:12px;--badge:#e7e8fc;--badge-ink:#4f55d6;--ctbg:transparent}
.sys{padding:0 20px;gap:16px;box-shadow:0 1px 0 var(--line)}
.brand{font-size:16px;font-weight:600}.brand .logo{width:28px;height:28px;padding:5px;border-radius:9px;background:var(--accent);color:#fff}
.nav a{align-self:center;height:34px;border-radius:17px;padding:0 12px;font-weight:500;color:var(--ink2)}
.search{border-radius:18px;height:36px;max-height:36px;padding:0 14px}
.search kbd{border-radius:6px}
.user .av{width:32px;height:32px}
.ws{align-items:center;border-bottom:0;gap:8px;padding:0 20px}
.wt{height:30px;border:0;border-radius:15px;background:#e6e8f5;padding:0 14px}
.wt.on{height:30px;margin:0;background:var(--accent);color:#fff;border:0}
.wt.on .wb{opacity:.85}
.main{padding:0 14px 14px 20px;gap:0}
.side{border:0;border-radius:18px;box-shadow:0 1px 2px rgba(31,35,64,.06),0 8px 24px rgba(31,35,64,.06)}
.pav{width:44px;height:44px;border-radius:50%;font-size:15px;background:var(--accent-soft);color:var(--accent)}
.pname{font-size:15.5px}
.loc .bed{background:var(--accent-soft);color:var(--accent);padding:2px 9px;border-radius:10px}
.flag{border:0;border-radius:10px;padding:7px 12px;background:var(--surface2)}
.flag.crit{background:var(--crit-soft)}
.flag.code{background:var(--ok-soft);color:var(--ok)}.flag.code .fl{color:inherit}
.sblock h4{text-transform:none;letter-spacing:0;font-size:13px;color:var(--ink);border-bottom:0;margin-bottom:3px;padding-bottom:0}
.sv .svg{background:var(--tile);border-radius:10px;padding:8px 12px}
.chart{grid-template-rows:var(--ct-h) minmax(0,1fr);background:transparent}
.sub{display:none}
.ctabs{align-items:center;border-bottom:0;gap:4px}
.ctab{height:32px;border:0;border-radius:16px;padding:0 13px;font-weight:500}
.ctab.on{background:var(--surface);color:var(--accent);border:0;box-shadow:0 1px 2px rgba(31,35,64,.08),0 4px 12px rgba(31,35,64,.06)}
.cb{background:var(--accent-soft);color:var(--accent);height:17px}
.body{padding-top:2px;padding-bottom:0;padding-right:6px}
.panel{border:0;border-radius:18px;box-shadow:0 1px 2px rgba(31,35,64,.06),0 8px 24px rgba(31,35,64,.05)}
.ph{border-bottom:0}
.ph h3{font-size:14.5px}
.pb{padding:0 16px 14px}
.vit.tiles .v{border:0;border-radius:12px;padding:9px 12px}
.vit.tiles .vv{font-size:21px}
.wd{border-bottom:0;background:var(--tile);border-radius:12px;padding:0 12px}
.wdl{gap:8px}
.wd.due{background:var(--warn-soft)}
.wd.due .chip{background:#fff}
.chip{height:22px;border-radius:11px}
.res th,.res td,.med th,.med td{border-bottom-color:var(--line2)}
.res thead th,.med thead th{border-bottom-color:var(--line)}
.fg{border-radius:9px;width:20px;height:18px}
.g{border-radius:50%;width:22px;height:22px}
.med .mc{border-left:0}
.med .now{background:var(--accent-soft)}
.med thead th.now{border-radius:8px 8px 0 0}
.inf{border-left:0}.inf .bar{height:20px;border-radius:10px 0 0 10px}.inf.plan .bar{border-radius:0 10px 10px 0}
.legend{border-top:0}
.lbar{border-radius:5px}
.team li{border-bottom:0}
.team li{gap:0 4px}.team .tx{font-size:11.5px}.team .tnm{letter-spacing:-.01em}
.body{grid-template-areas:
 "vit vit vit vit vit vit vit vit vit due due due due due due due due due team team team team team team"
 "res res res res res res res res res res med med med med med med med med med med med med med med"}
.vit.tiles .v{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr) auto}
.vit.tiles .vv{font-size:19px}.vit.tiles .vv small{font-size:11px;margin-left:2px}
.vit.tiles .vr{text-align:left;padding:2px 0 0}
.wd{gap:8px}
.status{display:none}
`,
},
/* ------------------------------------------------------------------ 05 */
{
  no: '05', slug: 'spectrum', name: 'Spectrum',
  rationale: 'Colour-coded by activity: every chart tab owns a hue that follows its data into the Summary panels, so you always know where a number lives.',
  typefaces: 'Figtree (400/500/600/700)',
  palette: 'Chrome charcoal #20242B · canvas #F3F4F6 · activity hues: Summary slate #4A5568, Chart review violet #6D4FC9, Results teal #0A7C93, Flowsheets magenta #B3347F, Medications blue #2460C4, Orders olive #66740F, Notes umber #8A5A3C, History sage #3D7A6A, Discharge rose #C0496B, Coding steel #5D6B8A · critical #C02A1F · warning #8F5A00 · ok #1B7340',
  fonts: 'family=Figtree:wght@400;500;600;700',
  layout: 'C', vitals: 'rows', spark: 'area',
  css: `
:root{--font:"Figtree",system-ui,sans-serif;--fs:13px;
--bg:#f3f4f6;--surface:#fff;--surface2:#eef0f3;--line:#d3d7dd;--line2:#e7eaee;--ink:#1b1f26;--ink2:#474e5a;--ink3:#646c79;
--accent:#4a5568;--accent-ink:#fff;--accent-soft:#e6e9ee;--chrome:#20242b;--chrome-ink:#eef0f3;--field:#343a44;--field-ink:#c3c9d2;
--ws:#e3e6ea;--ws-ink:#474e5a;--crit:#c02a1f;--crit-soft:#fbe3e0;--warn:#8f5a00;--warn-soft:#fcecc6;--ok:#1b7340;--ok-soft:#dcefe1;--low:#3a4fb5;--low-soft:#e3e7f8;
--r:6px;--sys-h:38px;--ws-h:32px;--ct-h:40px;--sub-h:30px;--st-h:22px;--side-w:244px;--pad:10px;--gap:10px;--rh:28px;--ph:32px;--pp:12px;--badge:#454c58;
--h-summary:#4a5568;--h-review:#6d4fc9;--h-results:#0a7c93;--h-flow:#b3347f;--h-meds:#2460c4;--h-orders:#66740f;--h-notes:#8a5a3c;--h-history:#3d7a6a;--h-discharge:#c0496b;--h-coding:#5d6b8a}
.ct-summary{--h:var(--h-summary)}.ct-review,.from-review{--h:var(--h-review)}.ct-results,.from-results{--h:var(--h-results)}.ct-flow,.from-flow{--h:var(--h-flow)}.ct-meds,.from-meds{--h:var(--h-meds)}.ct-orders{--h:var(--h-orders)}.ct-notes{--h:var(--h-notes)}.ct-history{--h:var(--h-history)}.ct-discharge{--h:var(--h-discharge)}.ct-coding{--h:var(--h-coding)}
.brand .logo{color:#fff}
.user .av{background:#eef0f3;color:#20242b}
.wt.on{border-top:0}
.pav{background:var(--h-summary);border-radius:8px}
.ctabs{gap:3px;align-items:flex-end;background:var(--surface);border-bottom:3px solid var(--h-summary);padding-top:6px}
.ctab{height:30px;border:0;border-top:3px solid var(--h);border-radius:5px 5px 0 0;background:color-mix(in srgb,var(--h) 11%,#fff);color:color-mix(in srgb,var(--h) 78%,#000);font-weight:600;padding:0 11px}
.ctab.on{background:var(--h);color:#fff;height:34px;border-bottom:0}
.cb{background:var(--h);color:#fff}
.sub{background:color-mix(in srgb,var(--h-summary) 9%,#fff);border-bottom:1px solid var(--line)}
.views a.on{background:var(--h-summary);color:#fff}
.panel{border-color:color-mix(in srgb,var(--h) 35%,#fff);border-left:4px solid var(--h);--spark:var(--h)}
.ph{background:color-mix(in srgb,var(--h) 10%,#fff);border-bottom-color:color-mix(in srgb,var(--h) 30%,#fff)}
.ph h3{color:color-mix(in srgb,var(--h) 80%,#000);font-size:13.5px}
.ph .pl{color:#fff;background:var(--h);padding:2px 9px;border-radius:10px;font-size:11.5px}
.ph .pl::after{content:" ›"}
.pb{padding:4px 12px 8px}
.med .now{background:color-mix(in srgb,var(--h) 10%,#fff)}
.med th.now{color:var(--h)}
.g{border-radius:50%}
`,
},
/* ------------------------------------------------------------------ 06 */
{
  no: '06', slug: 'teletype', name: 'Teletype',
  rationale: 'Dense, data-first monospace: everything on a strict character grid with inverse-video headers and letter codes, built for keyboard-driven speed.',
  typefaces: 'JetBrains Mono (400/500/700)',
  palette: 'Paper grey-green #E9EBE4 · surface #F6F7F1 · ink #151814 (also the inverse-video accent) · critical #B00020 · warning #8A4B00 · ok #1B6B2F · low #1D4FA3',
  fonts: 'family=JetBrains+Mono:wght@400;500;700',
  layout: 'A', vitals: 'rows', spark: 'bars', filler: true,
  glyph: { given: 'G', due: 'D', sched: 'S', held: 'H' },
  status: '<footer class="status"><span><b>F1</b>Help</span><span><b>F2</b>Orders</span><span><b>F3</b>Results</span><span><b>F4</b>Notes</span><span><b>F5</b>Refresh</span><span><b>F8</b>Sign</span><span><b>/</b>Find patient</span><span class="grow"></span><span>BRANDT T · RESIDENT · MICU</span><span>PRACTICE ENVIRONMENT · SYNTHETIC PATIENTS</span></footer>',
  css: `
:root{--font:"JetBrains Mono",ui-monospace,monospace;--fs:12px;
--bg:#e9ebe4;--surface:#f6f7f1;--surface2:#dfe2d7;--line:#151814;--line2:#c6cabd;--ink:#151814;--ink2:#373d35;--ink3:#565d52;
--accent:#151814;--accent-ink:#f6f7f1;--accent-soft:#dfe2d7;--chrome:#151814;--chrome-ink:#e9ebe4;--field:#f6f7f1;--field-ink:#373d35;
--ws:#e9ebe4;--ws-ink:#373d35;--crit:#b00020;--crit-soft:#f5d6da;--warn:#8a4b00;--warn-soft:#f1dfb8;--ok:#1b6b2f;--ok-soft:#d3e7d1;--low:#1d4fa3;--low-soft:#d7e0f2;
--r:0px;--sys-h:28px;--ws-h:27px;--ct-h:27px;--sub-h:24px;--st-h:24px;--side-w:240px;--pad:6px;--gap:6px;--rh:23px;--ph:23px;--pp:8px;--mnw:204px;--side-pad:8px;--side-gap:8px;--spark:#151814;--now:#dfe2d7;--stbg:#151814;--stink:#e9ebe4;--badge:#e9ebe4;--badge-ink:#151814}
body{line-height:1.3}
.brand{text-transform:uppercase;letter-spacing:.06em;font-weight:700}.brand b{font-weight:700}
.nav a{padding:0 8px}
.nav a::before{content:"["}.nav a::after{content:"]"}
.nav a{gap:0}.nav .ct{margin-left:6px;border-radius:0;height:15px;min-width:0}
.search{border-radius:0;height:20px;width:280px}
.search kbd{border-radius:0}
.user .av{display:none}.user small{display:none}
.ws{gap:0;padding:0 6px}
.wt{border:1px solid var(--line);border-bottom:0;margin-right:-1px;height:22px;background:var(--surface2)}
.wt.on{height:23px;background:var(--surface);font-weight:700}
.side{border-right:1px solid var(--line)}
.id{gap:0}.pav{display:none}
.pname{text-transform:uppercase;font-size:12.5px}
.loc .bed{background:var(--ink);color:var(--accent-ink);padding:0 5px}
.flag{padding:2px 6px;border-color:var(--line)}
.flag.crit{background:var(--crit);color:#fff;border-color:var(--crit)}
.flag .fl{text-transform:uppercase;font-size:10.5px}
.sblock h4{background:var(--ink);color:var(--accent-ink);padding:2px 6px;border-bottom:0;font-size:10.5px}
.sblock h4 span{color:inherit}
.ctabs{counter-reset:t;gap:0;align-items:stretch;padding:0;border-bottom:1px solid var(--line);background:var(--surface2)}
.ctab{counter-increment:t;height:auto;border:0;border-right:1px solid var(--line);padding:0 9px;color:var(--ink);gap:5px}
.ctab::before{content:counter(t);font-weight:700;color:var(--ink3)}
.ctab:nth-child(10)::before{content:"0"}
.ctab.on{background:var(--ink);color:var(--accent-ink);border-bottom:0}
.ctab.on::before{color:#b9bfb0}
.cb{border-radius:0;background:transparent;color:inherit;min-width:0;padding:0}
.cb::before{content:"("}.cb::after{content:")"}
.sub{border-bottom:1px solid var(--line2)}
.views a{padding:0 6px}.views a.on{background:transparent;color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.body{grid-template-rows:auto auto minmax(0,1fr);grid-template-areas:
 "${rep('vit', 9)} ${rep('due', 9)} ${rep('team', 6)}"
 "${rep('res', 10)} ${rep('med', 14)}"
 "${rep('fill', 24)}"}
.vit.rows{flex:none;grid-auto-rows:25px}.wdl{flex:none;grid-auto-rows:37.5px}.team{flex:none;grid-auto-rows:30px}
.res,.med{flex:none}
.ph{background:var(--ink);color:var(--accent-ink);border-bottom:0}
.ph h3{text-transform:uppercase;letter-spacing:.06em;font-size:11px}
.ph .pm{color:#c3c8ba}.ph .pl{color:var(--accent-ink);font-weight:500}
.ph .pl::before{content:"→ "}.ph .pl::after{content:""}
.pb{padding:2px 8px 4px}
.vv{font-size:13px}.vv small{font-size:10.5px}
.vit.rows .v{grid-template-columns:118px 92px minmax(70px,1fr) 100px}
.vs{height:16px}
.spark .sb{opacity:.38}
.chip{border-radius:0;height:17px;padding:0 5px;text-transform:uppercase;font-size:10.5px}
.chip.due{background:var(--warn);color:#fff}
.fg{border-radius:0}
.g{border-radius:0;width:17px;height:16px;font-size:11px}
.sched .g{border:1px solid var(--line2);color:var(--ink3);font-weight:500}
.inf .bar{border-radius:0;height:14px}.inf.plan .bar{border-radius:0}
.lbar{border-radius:0}
.legend{margin-top:4px;padding-top:4px;border-top-color:var(--line2)}
.status{gap:14px;border-top:0}
.status b{background:var(--accent-ink);color:var(--ink);padding:0 4px;margin-right:5px}
.filler{border-color:var(--ink3)}
`,
},
/* ------------------------------------------------------------------ 07 */
{
  no: '07', slug: 'flagship', name: 'Flagship',
  rationale: 'Bold institutional: a strong mulberry brand bar, heavy uppercase headings and square edges that say "this is the hospital\'s system".',
  typefaces: 'Archivo (400/600/700/800) with Archivo Narrow (labels)',
  palette: 'Brand mulberry #5B1647 · deep brand #3A0D2D · canvas #F1EFF0 · surface #FFFFFF · ink #17121A · critical #C9301C · warning #8F5A00 · ok #17703E · low #1F58B5',
  fonts: 'family=Archivo:wght@400;600;700;800&family=Archivo+Narrow:wght@500;600;700',
  layout: 'K', vitals: 'tiles', spark: 'step',
  css: `
:root{--font:"Archivo",system-ui,sans-serif;--hfont:"Archivo",system-ui,sans-serif;--fs:13px;
--bg:#f1eff0;--surface:#fff;--surface2:#ece8ea;--line:#cbc4c8;--line2:#e6e1e4;--ink:#17121a;--ink2:#4a424c;--ink3:#685f6a;
--accent:#5b1647;--accent-ink:#fff;--accent-soft:#f1e2ec;--chrome:#5b1647;--chrome-ink:#fff;--field:#fff;--field-ink:#685f6a;
--ws:#3a0d2d;--ws-ink:#e9d5e2;--crit:#c9301c;--crit-soft:#fbe3de;--warn:#8f5a00;--warn-soft:#fbedc9;--ok:#17703e;--ok-soft:#dcefe1;--low:#1f58b5;--low-soft:#dfe8f8;
--r:0px;--sys-h:52px;--ws-h:32px;--ct-h:42px;--sub-h:28px;--st-h:22px;--side-w:256px;--pad:12px;--gap:12px;--rh:27px;--ph:36px;--pp:12px;--vcols:2;--tgap:0px;--badge:rgba(255,255,255,.22);--side-pad:0px;--side-gap:0px;--stbg:#17121a;--stink:#d9d2d7}
.sys{padding:0 18px;gap:16px}
.brand{font-size:19px;font-weight:800;text-transform:uppercase;letter-spacing:.02em;gap:10px}.brand b{font-weight:400}
.brand .logo{width:26px;height:26px}
.nav{margin-left:14px;gap:0}
.nav a{font-family:"Archivo Narrow",sans-serif;font-weight:600;font-size:14px;text-transform:uppercase;letter-spacing:.04em;padding:0 9px}
.ct.hot{background:#fff;color:var(--accent)}
.search{height:32px;max-height:32px;width:230px}
.clock{font-weight:600}
.user .av{background:#fff;color:var(--accent);border-radius:0;width:28px;height:28px}
.ws{border-bottom:0;padding:0 18px;gap:0}
.wt{border:0;height:27px;font-family:"Archivo Narrow",sans-serif;font-size:13.5px;font-weight:600;padding:0 14px}
.wt.on{background:var(--bg);height:27px;margin:0;border:0;color:var(--ink);font-weight:700}
.side{border-right:1px solid var(--line)}
.id{background:var(--ink);color:#fff;padding:14px 16px 12px;gap:12px}
.pav{background:#fff;color:var(--ink);width:40px;height:40px;font-weight:800;font-size:15px}
.pname{font-weight:800;font-size:16px;line-height:1.15}
.pdemo{color:#cfc6cd}
.loc{background:var(--accent);color:#fff;padding:6px 16px}
.loc .bed{font-weight:800;font-size:15px}.loc .unit{color:#ecd6e5}
.flags{padding:12px 16px 0;gap:6px}
.flag{border-width:0 0 0 5px;border-color:var(--ink);background:var(--surface2);padding:5px 10px}
.flag .fl{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;font-weight:600;letter-spacing:.04em}
.flag.crit{border-color:var(--crit)}
.facts{padding:12px 16px 0}
.sblock{padding:14px 16px 0}
.sblock h4{font-weight:800;font-size:12px;color:var(--ink);border-bottom:2px solid var(--ink);letter-spacing:.06em}
.ctabs{gap:0;border-bottom:2px solid var(--ink);background:var(--surface)}
.ctab{font-family:"Archivo Narrow",sans-serif;font-size:14.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--ink2);height:40px;padding:0 13px;border-bottom:0}
.ctab.on{background:var(--ink);color:#fff;border-bottom:0}
.cb{background:var(--accent);color:#fff;border-radius:0}
.sub{background:var(--surface)}
.views a.on{background:var(--accent);color:#fff}
.panel{border:0;border-top:4px solid var(--accent)}
.ph{border-bottom:1px solid var(--line)}
.ph h3{font-weight:800;font-size:14px;text-transform:uppercase;letter-spacing:.04em}
.ph .pl{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;letter-spacing:.04em;font-size:12.5px;font-weight:700}
.pb{padding:4px 12px 8px}
.p-vit .pb{padding:0}
.vit.tiles .v{border:0;border-right:1px solid var(--line2);border-bottom:1px solid var(--line2);padding:8px 12px}
.vit.tiles .v:nth-child(2n){border-right:0}.vit.tiles .v:nth-last-child(-n+2){border-bottom:0}
.vit.tiles .vl{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;font-weight:600;letter-spacing:.04em;font-size:12px}
.vit.tiles .vv{font-weight:800;font-size:24px}
.vit.tiles .vr{font-size:11.5px}
.vl i{text-transform:none;letter-spacing:0}
.spark .sl{stroke-width:2}
.res thead th,.med thead th{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--ink2);border-bottom:2px solid var(--ink)}
.wtm{font-weight:800;font-size:15px}
.chip{border-radius:0;font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;letter-spacing:.04em;font-weight:700}
.chip.due{background:var(--warn);color:#fff}
.fg{border-radius:0}
.g{border-radius:0}
.given .g{background:var(--ok);color:#fff}
.inf .bar{border-radius:0;background:var(--ok);color:#fff}.inf.plan .bar{border-radius:0;background:repeating-linear-gradient(90deg,#9ccbb0 0 6px,transparent 6px 10px)}
.lbar{background:var(--ok);border-radius:0}
.team .tr{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;letter-spacing:.04em;font-weight:600}
.body{grid-template-rows:minmax(0,1fr) minmax(0,1fr);grid-template-areas:
 "${rep('vit', 7)} ${rep('res', 10)} ${rep('due', 7)}"
 "${rep('team', 6)} ${rep('med', 18)}"}
.vit.tiles .v{grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto minmax(0,1fr)}
.vit.tiles .vv{grid-column:1/-1;font-size:22px}.vit.tiles .vv small{font-size:11.5px}
.vit.tiles .vs{grid-column:1;grid-row:3;margin-top:2px}
.vit.tiles .vr{grid-column:2;grid-row:3;align-self:end;padding:0 0 2px}
.p-vit .pm{font-family:"Archivo Narrow",sans-serif}
.wd{grid-template-columns:auto minmax(0,1fr);gap:1px 10px;align-content:center}
.wd .chip{grid-column:2;justify-self:start;margin-top:4px}
.wtm{align-self:start}
.user small{display:none}
.status{border-top:0}
`,
},
/* ------------------------------------------------------------------ 08 */
{
  no: '08', slug: 'hairline', name: 'Hairline',
  rationale: 'Quiet monochrome: white space, hairline rules and one cobalt accent, so the only colour on screen is selection and clinical status.',
  typefaces: 'Inter (400/500/600), tabular figures',
  palette: 'White #FFFFFF · ink #111111 · greys #555555 / #707070 · hairline #D9D9D9 · single accent cobalt #1D3FD0 · status marks only: critical #C22121, warning #A15C00, ok #1A7340, low #6B3FA0',
  fonts: 'family=Inter:wght@400;500;600',
  layout: 'A', vitals: 'rows', spark: 'line',
  glyph: { given: ICONS.dotS, due: ICONS.sq, sched: ICONS.ring, held: ICONS.slash },
  css: `
:root{--font:"Inter",system-ui,sans-serif;--fs:12.5px;
--bg:#fff;--surface:#fff;--surface2:#f3f3f3;--line:#d9d9d9;--line2:#ececec;--ink:#111;--ink2:#505050;--ink3:#6e6e6e;
--accent:#1d3fd0;--accent-ink:#fff;--accent-soft:#eef1fd;--chrome:#fff;--chrome-ink:#111;--field:#fff;--field-ink:#6e6e6e;--field-line:#d9d9d9;
--ws:#fff;--ws-ink:#505050;--crit:#c22121;--crit-soft:transparent;--warn:#a15c00;--warn-soft:transparent;--ok:#1a7340;--ok-soft:transparent;--low:#6b3fa0;--low-soft:transparent;
--r:0px;--sys-h:42px;--ws-h:34px;--ct-h:40px;--sub-h:32px;--st-h:24px;--side-w:248px;--pad:22px;--gap:26px;--rh:27px;--ph:28px;--pp:0px;--side-pad:20px;--side-gap:14px;--spark:#111;--now:#f4f6fe;--stbg:#fff;--badge:#111;--badge-ink:#fff}
body{letter-spacing:-.003em}
.sys{border-bottom:1px solid var(--line);padding:0 20px;gap:18px}
.brand{font-weight:500;letter-spacing:-.01em;font-size:14px}.brand b{font-weight:600}
.nav a{color:var(--ink2);padding:0 9px}
.ct{background:transparent;color:var(--ink2);border:1px solid var(--line);font-weight:600}
.ct.hot{background:var(--accent);border-color:var(--accent);color:#fff}
.search{border-width:0 0 1px;padding:0 2px}
.user .av{background:transparent;color:var(--ink);border:1px solid var(--ink);font-weight:600}
.ws{align-items:stretch;gap:22px;padding:0 20px}
.wt{height:auto;border:0;padding:0;border-bottom:2px solid transparent}
.wt.on{height:auto;margin:0;border:0;border-bottom:2px solid var(--accent);background:transparent;margin-bottom:-1px}
.pav{background:transparent;color:var(--ink);border:1px solid var(--ink);border-radius:50%;font-weight:500}
.pname{font-weight:600;font-size:14.5px;letter-spacing:-.01em}
.loc .bed{font-weight:600}
.flag{border:0;border-top:1px solid var(--line);padding:5px 0 0;background:transparent}
.flag.crit{background:transparent;border-color:var(--crit)}
.flags{gap:6px}
.sblock h4{font-size:10.5px;font-weight:600;letter-spacing:.09em;border-bottom:0;border-top:1px solid var(--ink);padding:6px 0 2px;color:var(--ink)}
.sblock h4 span{color:var(--ink3)}
.ctabs{gap:22px;border-bottom:1px solid var(--line)}
.ctab{padding:0;font-weight:500;color:var(--ink2)}
.ctab.on{font-weight:600;color:var(--ink);border-bottom-color:var(--accent)}
.cb{background:transparent;color:var(--ink3);min-width:0;padding:0;font-weight:500}
.sub{border-bottom:0}
.views{gap:16px}.views a{padding:0}.views a.on{background:transparent;color:var(--accent)}
.panel{border:0;border-top:1px solid var(--ink)}
.ph{border-bottom:0;align-items:flex-end;padding-bottom:4px}
.ph h3{font-size:10.5px;font-weight:600;letter-spacing:.09em;text-transform:uppercase}
.ph .pm{font-size:11.5px}.ph .pl{font-weight:500;font-size:11.5px}
.pb{padding:0}
.vv{font-weight:600;font-size:15px;letter-spacing:-.01em}
.spark .sl{stroke-width:1.1}.spark .sd{stroke:var(--accent);stroke-width:5}
.chip{background:transparent;padding:0;height:auto;font-weight:500;color:var(--ink3)}
.chip::before{content:"";width:7px;height:7px;margin-right:6px;background:currentColor;border-radius:50%}
.chip.due{background:transparent;color:var(--warn)}
.chip.due::before{border-radius:0}
.chip.sched::before{background:transparent;border:1px solid currentColor}
.chip.held{background:transparent}
.wtm{font-weight:600}
.res .val{font-weight:600}
.fg{background:transparent!important;width:auto;height:auto;font-weight:600}
.critrow .fg.hi{background:var(--crit)!important;color:#fff;width:17px;height:16px;border-radius:50%}
.g{background:transparent!important;width:16px;height:16px}
.given .g{color:var(--ok)}.due .g{color:var(--warn)}.held .g{color:var(--ink2)}
.med .mc{border-left:0}
.med th.now{box-shadow:inset 0 -2px 0 var(--accent)}
.inf{border-left:0}
.inf .bar{background:transparent;color:var(--ok);height:16px;border-radius:0;box-shadow:inset 0 -2px 0 var(--ok);padding-left:0}
.inf.plan .bar{background:repeating-linear-gradient(90deg,var(--ok) 0 5px,transparent 5px 9px) bottom/100% 2px no-repeat;box-shadow:none}
.lbar{height:2px;border:0;background:var(--ok)}
.legend{border-top:0}
.status{border-top:1px solid var(--line);padding:0 20px}
`,
},
];
