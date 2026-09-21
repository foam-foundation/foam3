/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
// node import-recording.mjs <chrome-recorder.json> [--name n] [--strip]
// Turns a Chrome DevTools Recorder export into a rows.json row: `menu` from the first
// app hash, `prep` from click/change/Enter steps (--strip: `steps` instead, one shot per step).
// Selector dialects are mapped to Playwright; every recorded alternative is kept as a candidate.
import fs from 'node:fs';
const [file, ...rest] = process.argv.slice(2);
const opt = k => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
const strip = rest.includes('--strip');
const rec = JSON.parse(fs.readFileSync(file, 'utf8'));

const conv = part => {
  if (part.startsWith('aria/')) {
    const m = part.slice(5).match(/^(.*?)(?:\[role="(\w+)"\])?$/);
    const name = m[1].trim(), role = m[2];
    if (!name) return role ? `role=${role}` : null;
    return role ? `role=${role}[name=${JSON.stringify(name)}]` : `text=${JSON.stringify(name)}`;
  }
  if (part.startsWith('xpath/')) return 'xpath=' + part.slice(6);
  if (part.startsWith('text/')) return 'text=' + JSON.stringify(part.slice(5));
  if (part.startsWith('pierce/')) return part.slice(7);
  return part;                                            // plain css
};
const selectors = s => {
  const out = [];
  for (const alt of s.selectors || []) {
    const parts = alt.map(conv).filter(Boolean);
    if (parts.length) out.push(parts.join(' >> '));
  }
  return [...new Set(out)];                               // css first, pierce dup dropped
};

let menu = null; const steps = [];
for (const s of rec.steps) {
  if (s.type === 'navigate') { const m = s.url.match(/#([\w.-]+)/); if (m && !menu && m[1] !== 'welcome') menu = m[1]; continue; }
  if (s.type === 'click') { steps.push({ click: selectors(s) }); continue; }
  if (s.type === 'doubleClick') { steps.push({ dblclick: selectors(s) }); continue; }
  if (s.type === 'change') {
    const sel = selectors(s), prev = steps.at(-1);
    if (prev?.click && JSON.stringify(prev.click) === JSON.stringify(sel)) steps.pop();   // click-to-focus, then type
    steps.push({ fill: [sel, s.value] }); continue;
  }
  if (s.type === 'keyDown' && ['Enter', 'Tab', 'Escape'].includes(s.key)) { steps.push({ press: s.key }); continue; }
  // setViewport, keyUp, modifier keys, scroll: dropped
}
const row = { name: opt('--name') || rec.title.replace(/[^\w.-]+/g, '-').toLowerCase(), menu, sel: '<crop selector>', modes: ['light'] };
row[strip ? 'steps' : 'prep'] = steps;
console.log(JSON.stringify(row, null, 2));
