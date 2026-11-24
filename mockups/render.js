// Renders every NN-slug.html to PNG (1440x900 @2x), reports layout problems, then builds the contact sheet.
// Usage: node render.js [only-number ...]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const themes = require('./themes.js');
const dir = __dirname;
const only = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  for (const t of themes) {
    if (only.length && !only.includes(t.no)) continue;
    const page = await ctx.newPage();
    const errs = [];
    page.on('requestfailed', r => errs.push('request failed: ' + r.url()));
    await page.goto('file://' + path.join(dir, `${t.no}-${t.slug}.html`), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const report = await page.evaluate(() => {
      const out = [];
      const d = document.documentElement;
      if (d.scrollWidth > 1440 || d.scrollHeight > 900) out.push(`page scrolls: ${d.scrollWidth}x${d.scrollHeight}`);
      const fam = getComputedStyle(document.body).fontFamily.split(',')[0].replace(/"/g, '').trim();
      if (!document.fonts.check(`13px "${fam}"`)) out.push('font not loaded: ' + fam);
      const tag = e => e.tagName.toLowerCase() + (e.className && e.className.baseVal === undefined ? '.' + String(e.className).trim().replace(/\s+/g, '.') : '') + ' "' + (e.textContent || '').trim().slice(0, 28) + '"';
      for (const e of document.querySelectorAll('.app *')) {
        if (e.closest('svg')) continue;
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.display === 'inline') continue;
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (e.scrollWidth > e.clientWidth + 1 && cs.overflowX !== 'visible') out.push('clipped-x ' + tag(e) + ` ${e.scrollWidth}>${e.clientWidth}`);
        if (e.scrollHeight > e.clientHeight + 1 && cs.overflowY !== 'visible') out.push('clipped-y ' + tag(e) + ` ${e.scrollHeight}>${e.clientHeight}`);
        if (r.right > 1440.5 || r.bottom > 900.5) out.push('off-screen ' + tag(e));
        const p = e.parentElement.getBoundingClientRect();
        if (e.parentElement.closest('.app') && (r.right > p.right + 1.5 || r.bottom > p.bottom + 1.5 || r.left < p.left - 1.5 || r.top < p.top - 1.5)) out.push('escapes parent ' + tag(e) + ` by r${Math.round(r.right - p.right)} b${Math.round(r.bottom - p.bottom)}`);
      }
      return out;
    });
    await page.screenshot({ path: path.join(dir, `${t.no}-${t.slug}.png`) });
    console.log(`${t.no} ${t.name}: ${report.concat(errs).length ? '\n  ' + report.concat(errs).slice(0, 25).join('\n  ') : 'clean'}`);
    await page.close();
  }

  // contact sheet: 4 x 2, 2880 px wide
  const cells = themes.map(t => `<figure><img src="${t.no}-${t.slug}.png"><figcaption><b>${t.no}</b><span><strong>${t.name}</strong><em>${t.rationale}</em></span></figcaption></figure>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}body{width:2880px;background:#17191c;color:#f2f3f5;font:22px/1.3 system-ui,sans-serif;padding:40px}
h1{font-size:34px;font-weight:650;margin-bottom:6px}p{color:#a9afb8;margin-bottom:30px;font-size:22px}
.g{display:grid;grid-template-columns:repeat(4,1fr);gap:36px 28px}
img{display:block;width:100%;border:1px solid #3a3f46}
figcaption{display:flex;gap:16px;align-items:flex-start;padding-top:14px}
figcaption b{flex:none;font-size:34px;line-height:1;font-weight:700;color:#8f96a0;font-variant-numeric:tabular-nums}
figcaption strong{display:block;font-size:26px;font-weight:650}
figcaption em{display:block;font-style:normal;color:#a9afb8;font-size:19px;margin-top:3px}
</style><h1>Larkspur Clinical · eight visual directions</h1><p>Same Summary screen and content in every direction · 1440 × 900 · full-size files are 01 to 08 in this folder</p><div class="g">${cells}</div>`;
  const tmp = path.join(dir, '_sheet.html');
  fs.writeFileSync(tmp, html);
  const sp = await browser.newPage({ viewport: { width: 2880, height: 1000 }, deviceScaleFactor: 1 });
  await sp.goto('file://' + tmp, { waitUntil: 'load' });
  await sp.screenshot({ path: path.join(dir, '00-contact-sheet.png'), fullPage: true });
  fs.unlinkSync(tmp);
  await browser.close();
})();
