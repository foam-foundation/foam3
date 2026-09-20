/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
// node compose.mjs [rows.json] [rowName ...]
// For every row × mode with shots on disk, renders before|after with callout boxes,
// numbered badges, short arrows and a legend as an HTML page and screenshots it.
// Output: out/<name>/<mode>-compose.png. Only dependency: playwright.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { readRows, parseArgs } from './lib.mjs';

const { cfgFile, names } = parseArgs();
let cfg; try { cfg = readRows(cfgFile); } catch (e) { console.error(e.message); process.exit(2); }
const only = new Set(names);
const DPR = 2, ACCENT = '#FF6D00';

const pngSize = f => { const b = fs.readFileSync(f); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };
const side = (png, k) => {
  if (!fs.existsSync(png)) return null;
  const { width, height } = pngSize(png);
  const marks = fs.existsSync(png + '.json') ? JSON.parse(fs.readFileSync(png + '.json')) : [];
  return { k, src: 'data:image/png;base64,' + fs.readFileSync(png).toString('base64'), w: width / DPR, h: height / DPR, marks };
};

function panel(s) {
  const boxes = s.marks.map(m => {
    const x = m.x / DPR - 5, y = m.y / DPR - 5, w = m.w / DPR + 10, h = m.h / DPR + 10;
    if (y > s.h || x > s.w) return '';
    // Arrow and badge scale with the target: 60% of its longer side, clamped, so a
    // small icon gets a small pointer and a table row does not get a giant one.
    const len = Math.max(16, Math.min(40, Math.max(w, h) * 0.6));
    const bd = Math.max(16, Math.min(26, len * 0.65)), fs = Math.round(bd * 0.55);
    const ax2 = x + w, ay2 = y + h, ax1 = ax2 + len * 0.8, ay1 = ay2 + len * 0.6;
    return `<div class="box" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>
      <svg class="arrow" style="width:${s.w}px;height:${s.h}px"><line x1="${ax1}" y1="${ay1}" x2="${ax2 + 2}" y2="${ay2 + 2}" marker-end="url(#head)"/></svg>
      <div class="badge" style="left:${ax1 - bd / 2}px;top:${ay1 - bd / 2}px;width:${bd}px;height:${bd}px;font-size:${fs}px">${m.label}</div>`;
  }).join('');
  return `<figure><figcaption>${s.k}</figcaption><div class="wrap" style="width:${s.w}px;height:${s.h}px"><img src="${s.src}" style="width:${s.w}px;height:${s.h}px">${boxes}</div></figure>`;
}

function html(sides, stack) {
  const notes = new Map();
  for (const s of sides) for (const m of s.marks) if (m.note && !notes.has(m.label)) notes.set(m.label, m.note);
  const legend = [...notes].map(([k, v]) => `<li><span class="badge inline">${k}</span>${v}</li>`).join('');
  const maxW = Math.max(...sides.map(s => s.w));
  return `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#fff;font:14px/1.4 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111}
  #root{display:inline-flex;flex-wrap:wrap;max-width:1800px;flex-direction:${stack ? 'column' : 'row'};gap:16px;padding:16px 16px 0 16px}
  figure{margin:0 48px 48px 0}figcaption{background:#e5e5e5;text-align:center;padding:5px 0;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#333}
  .wrap{position:relative;overflow:visible;box-shadow:0 0 0 1px #ccc}img{display:block}
  .box{position:absolute;border:2px solid ${ACCENT};border-radius:6px;box-shadow:0 0 0 2px rgba(255,255,255,.55)}
  .arrow{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}.arrow line{stroke:${ACCENT};stroke-width:2}
  .badge{position:absolute;border-radius:50%;background:${ACCENT};color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.4)}
  .badge.inline{position:static;display:inline-flex;width:22px;height:22px;font-size:12px;margin-right:8px}
  ul{list-style:none;margin:0;padding:0 16px 16px;display:flex;gap:24px;flex-wrap:wrap;max-width:${maxW * (stack ? 1 : 2) + 60}px}li{display:flex;align-items:center}
</style><svg width="0" height="0"><defs><marker id="head" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="${ACCENT}"/></marker></defs></svg>
<div id="all" style="display:inline-block"><div id="root">${sides.map(panel).join('')}</div>${legend ? `<ul>${legend}</ul>` : ''}</div>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: DPR, viewport: { width: 4000, height: 3000 } });
for (const r of cfg.rows) {
  if (only.size && !only.has(r.name)) continue;
  for (const mode of r.modes || ['light']) {
    const dir = `${cfg.out}/${r.name}`;
    let sides;
    if (r.steps) {                                   // step strip: one panel per step + result
      const k = (r.servers || [cfg.main])[0];
      sides = r.steps.map((_, i) => side(`${dir}/${mode}-${k}-step${i + 1}.png`, `step ${i + 1}`))
        .concat(side(`${dir}/${mode}-${k}-step${r.steps.length + 1}.png`, 'result')).filter(Boolean);
    } else {
      sides = Object.keys(cfg.servers).map(k => side(`${dir}/${mode}-${k}.png`, k)).filter(Boolean);
    }
    if (!sides.length) continue;
    const stack = r.layout ? r.layout === 'stack' : (r.steps ? sides[0].w > 700 : sides[0].w > 2.5 * sides[0].h);
    await page.setContent(html(sides, stack));
    const out = `${dir}/${mode}-compose.png`;
    await page.locator('#all').screenshot({ path: out });
    console.log(out);
  }
}
await browser.close();
