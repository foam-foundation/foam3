// node export-recording.mjs [rows.json] <rowName> [--server after] > flow.json
// Emits a Chrome DevTools Recorder flow (import via Recorder → Import) that replays a row's
// `prep`/`steps` in the human's own logged-in Chrome. The menu is opened through the app's
// menuDAO (a deep-hash navigate can boot blank), each click is preceded by a waitForElement,
// and a step with "emphasize": true gets an orange outline plus a pause before it runs.
import { readRows, stepTarget, parseArgs } from './lib.mjs';
const { cfgFile, names, flags } = parseArgs();
let cfg; try { cfg = readRows(cfgFile); } catch (e) { console.error(e.message); process.exit(2); }
const row = cfg.rows.find(r => r.name === names[0]);
if (!row) { console.error(`no row "${names[0] ?? ''}" — have: ${cfg.rows.map(r => r.name).join(', ')}`); process.exit(2); }
const url = cfg.servers[flags.server || cfg.main];
if (!url) { console.error(`unknown server "${flags.server}" — have: ${Object.keys(cfg.servers).join(', ')}`); process.exit(2); }

// Playwright selector → Recorder alternative (array of chained parts). Unknown dialects dropped.
const toRecorder = sel => { const parts = sel.split(' >> ').map(toRecorder1); return parts.every(Boolean) ? parts : null; };
const toRecorder1 = part => {
  let m;
  if (/^(nth|internal):/.test(part)) return null;
  // Recorder matches aria/ and text/ names exactly; a /regex/i name would silently never match.
  if (/^(role|text)=.*\/.*\//.test(part)) throw new Error(`cannot export a regex selector to Recorder: ${part}\n  give this step a plain css or text= selector in rows.json`);
  if ((m = part.match(/^role=(\w+)\[name=(?:"([^"]*)"|\/(.*)\/i?)\]$/))) return `aria/${m[2] ?? m[3]}[role="${m[1]}"]`;
  if ((m = part.match(/^role=(\w+)$/))) return `aria/[role="${m[1]}"]`;
  if ((m = part.match(/^text=(?:"([^"]*)"|(.*))$/))) return `text/${m[1] ?? m[2]}`;
  if (part.startsWith('xpath=')) return 'xpath/' + part.slice(6);
  return part;
};
const selectors = sel => (Array.isArray(sel) ? sel : [sel]).map(toRecorder).filter(Boolean);

const pause = ms => ({ type: 'waitForExpression', expression: `new Promise(r => setTimeout(() => r(true), ${ms}))` });
// Outlines the step's target for 4s. Tries every recorded candidate (css and xpath) the way
// waitForElement does, so a flow still highlights when only the xpath alternative matches.
const highlight = cands => ({ type: 'waitForExpression', expression:
  `(() => { const find = s => { if (s.startsWith('xpath/')) return document.evaluate(s.slice(6), document, null, 9, null).singleNodeValue;
      try { return document.querySelector(s); } catch { return null; } };
    for (const s of ${JSON.stringify(cands)}) { const el = find(s); if (el) { el.style.outline = '3px solid #FF6D00'; el.style.outlineOffset = '2px';
      setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 4000); return true; } }
    return false; })()` });
// Polled by waitForFunction: first poll starts the launch, later polls return true once
// the launch promise resolved (a failed launch clears the flag so the next poll retries).
const openMenu = id => ({ type: 'waitForExpression', timeout: 30000, expression:
  `(() => { const id = ${JSON.stringify(id)}; const w = window; if (w.__shotsMenu === 'done:' + id) return true;
    if (w.__shotsMenu !== 'pending:' + id) { w.__shotsMenu = 'pending:' + id;
      ctrl.__subContext__.menuDAO.find(id).then(m => m.launch(ctrl.__subContext__)).then(() => { w.__shotsMenu = 'done:' + id; }, () => { w.__shotsMenu = null; }); }
    return false; })()` });

const steps = [
  { type: 'setViewport', width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false, isLandscape: false },
  { type: 'navigate', url, assertedEvents: [{ type: 'navigation', url, title: '' }] },
  { type: 'waitForExpression', timeout: 30000, expression: '!!(window.ctrl && ctrl.loginSuccess && ctrl.__subContext__ && ctrl.__subContext__.menuDAO)' }, // 30000 = schema max,
  openMenu(row.menu), pause(2500)
];
if (row.modes?.[0] === 'dark') steps.push({ type: 'waitForExpression', expression: "(ctrl.theme.activeVariants = { color: 'dark' }, foam.u2.CSS.reloadStyles(ctrl.__subContext__), true)" }, pause(800));

for (const [n, s] of [...(row.prep || []), ...(row.steps || [])].entries()) { try {
  const target = stepTarget(s);
  if (target) {
    const sels = selectors(target);
    if (!sels.length) { console.error('skipped step, no Recorder-compatible selector:', JSON.stringify(target)); continue; }
    steps.push({ type: 'waitForElement', selectors: sels, visible: true, timeout: 10000 });
    if (s.emphasize) { steps.push(highlight(sels.map(a => a.join(' ')).filter(a => !/^(aria|text)\//.test(a))), pause(s.pause ?? 2000)); }
    if (s.click) steps.push({ type: 'click', target: 'main', selectors: sels, offsetX: 5, offsetY: 5 });
    else if (s.dblclick) steps.push({ type: 'doubleClick', target: 'main', selectors: sels, offsetX: 5, offsetY: 5 });
    else if (s.hover) steps.push({ type: 'hover', target: 'main', selectors: sels });
    else if (s.check || s.uncheck) steps.push({ type: 'click', target: 'main', selectors: sels, offsetX: 5, offsetY: 5 });
    else if (s.fill) steps.push({ type: 'change', target: 'main', selectors: sels, value: s.fill[1] });
  } else if (s.press) steps.push({ type: 'keyDown', target: 'main', key: s.press }, { type: 'keyUp', target: 'main', key: s.press });
  else if (s.js) steps.push({ type: 'waitForExpression', expression: `((0, eval)(${JSON.stringify(s.js)}), true)` });
  if (s.wait) steps.push(pause(s.wait));
  } catch (e) { console.error(`step ${n + 1}: ${e.message}`); process.exit(2); }
}
try { console.log(JSON.stringify({ title: `foam-screenshot-builder: ${row.name}`, steps }, null, 2)); }
finally { if (!steps.some(s => s.type === 'click' || s.type === 'change')) console.error('warning: flow has no click or change steps'); }
