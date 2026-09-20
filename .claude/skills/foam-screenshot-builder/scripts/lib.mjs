/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const DPR = 2;

// One persistent Chromium profile per checkout: the session a human creates by logging in
// survives later runs. Runs headless whenever every server already has a session; a window
// appears only when a login is missing, because the script never types a password.
export async function openBrowser(profile = 'profile', headless = true) {
  return chromium.launchPersistentContext(path.resolve(profile), {
    headless, viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR, colorScheme: 'light'
  });
}

// Open every server; if any lacks a session, switch to a headed window, wait for the human
// to log in there, then come back headless. Returns { name: page }.
export async function openApps(profile, servers) {
  let ctx = await openBrowser(profile, true);
  let pages = await openAll(ctx, servers);
  const missing = Object.entries(pages).filter(([, p]) => !p.loggedIn).map(([k]) => k);
  if (missing.length) {
    await ctx.close();
    ctx = await openBrowser(profile, false);
    const headed = await openAll(ctx, Object.fromEntries(missing.map(k => [k, servers[k]])));
    for (const [k, p] of Object.entries(headed)) {
      if (p.loggedIn) continue;
      console.log(`LOGIN NEEDED at ${servers[k]} — log in in the browser window; waiting`);
      await p.page.waitForFunction(() => window.ctrl && ctrl.loginSuccess, null, { timeout: 0 });
      await sleep(1500);
    }
    await ctx.close();
    ctx = await openBrowser(profile, true);
    pages = await openAll(ctx, servers);
  }
  return { ctx, pages: Object.fromEntries(Object.entries(pages).map(([k, p]) => [k, p.page])) };
}

async function openAll(ctx, servers) {
  const out = {};
  for (const [k, url] of Object.entries(servers)) {
    const page = await ctx.newPage();
    await clearCache(page);                                // before the first load: a reload on
    try { await page.goto(url, { waitUntil: 'domcontentloaded' }); }  // the #sign-in hash boots blank
    catch (e) { throw new Error(`server "${k}" at ${url} did not answer — start it with ./build.sh -N<name> -Jdemo -W<port>`); }
    await page.waitForFunction(() => window.ctrl && ctrl.__subContext__, null, { timeout: 120000 });
    let loggedIn = false;
    for (let i = 0; i < 3 && !loggedIn; i++) {           // loginSuccess flips a beat after boot
      loggedIn = await page.evaluate(() => !!ctrl.loginSuccess).catch(() => false);
      if (!loggedIn) await sleep(1000);
    }
    if (loggedIn) await sleep(1000);
    out[k] = { page, loggedIn };
  }
  return out;
}

// FOAM serves JS with Cache-Control: immutable, so a source edit is invisible until the
// cache is dropped. CDP clears it; then reload and wait for the app controller.
export async function clearCache(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');
  await cdp.detach();
}

export async function ensureApp(page) {
  try {
    await page.waitForFunction(() => window.ctrl && ctrl.__subContext__ && ctrl.theme && ctrl.loginSuccess, null, { timeout: 60000 });
  } catch (e) { throw new Error(`app not ready at ${page.url()}: ${e.message.split('\n')[0]}`); }
}

// activeVariants drives token variants; reloadStyles is called by hand because the
// automatic listener only exists when the theme has useVariants on.
export async function setMode(page, mode) {
  await ensureApp(page);
  await page.evaluate(mode => {
    ctrl.theme.activeVariants = mode === 'dark' ? { color: 'dark' } : {};
    foam.u2.CSS.reloadStyles(ctrl.__subContext__);
  }, mode);
  await sleep(900);
}

export async function launchMenu(page, menuId, wait = 2500) {
  await ensureApp(page);
  await page.evaluate(async id => {
    const m = await ctrl.__subContext__.menuDAO.find(id);
    if (!m) throw new Error('no menu ' + id);
    await m.launch(ctrl.__subContext__);
  }, menuId);
  await sleep(wait);
}

// A selector may be a string or a list of candidates (Chrome Recorder exports several per
// step); the first candidate that matches at least one element wins.
export async function pick(page, sel) {
  const cands = Array.isArray(sel) ? sel : [sel];
  for (const c of cands) {
    const l = page.locator(c);
    if (await l.count().catch(() => 0)) return l.first();
  }
  throw new Error('no element for ' + JSON.stringify(cands));
}

// prep steps from rows.json: {click}, {dblclick}, {hover}, {check}, {uncheck},
// {fill: [sel, text]}, {press: key}, {js}; each may carry {wait: ms}
export async function runPrep(page, steps = []) {
  for (const s of steps) {
    if (s.click) await (await pick(page, s.click)).click();
    else if (s.dblclick) await (await pick(page, s.dblclick)).dblclick();
    else if (s.hover) await (await pick(page, s.hover)).hover();
    else if (s.uncheck) await (await pick(page, s.uncheck)).uncheck();
    else if (s.check) await (await pick(page, s.check)).check();
    else if (s.fill) await (await pick(page, s.fill[0])).fill(s.fill[1]);
    else if (s.press) await page.keyboard.press(s.press);
    else if (s.js) await page.evaluate(code => (0, eval)(code), s.js);
    await sleep(s.wait ?? 1200);
  }
}

// The element a prep step acted on, for auto-marking step strips.
export function stepTarget(s) { return s.click || s.dblclick || s.hover || s.check || s.uncheck || (s.fill && s.fill[0]) || null; }

// Screenshot the first match of `sel` plus padding; write a sidecar of mark boxes in
// image pixels so compose.mjs can draw callouts without touching the app again.
export async function shot(page, sel, file, { pad = 12, nth = 0, maxH = 900, marks = [], timeout = 15000 } = {}) {
  const loc = page.locator(sel).nth(nth);
  await loc.waitFor({ state: 'visible', timeout });
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (!b) throw new Error('no box for ' + sel);
  const vp = page.viewportSize();
  const clip = { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + 2 * pad, height: Math.min(maxH, b.height + 2 * pad) };
  clip.width = Math.min(clip.width, vp.width - clip.x);
  clip.height = Math.min(clip.height, vp.height - clip.y);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, clip });
  const boxes = [];
  for (const [i, m] of marks.entries()) {
    let el, mb;
    try { el = m.nth ? page.locator(m.sel).nth(m.nth) : await pick(page, m.sel); mb = await el.boundingBox(); } catch {}
    if (!mb) { console.log('  mark not found:', JSON.stringify(m.sel)); continue; }
    boxes.push({ label: m.label || String(i + 1), note: m.note || '', x: (mb.x - clip.x) * DPR, y: (mb.y - clip.y) * DPR, w: mb.width * DPR, h: mb.height * DPR });
  }
  fs.writeFileSync(file + '.json', JSON.stringify(boxes));
  return file;
}

// Config paths are resolved against the rows file's own folder (and the scripts folder when
// there is no rows file yet), so every script works from any working directory.
const HERE = path.dirname(fileURLToPath(import.meta.url));

export function readRows(file) {
  const rowsFile = path.resolve(file || path.join(HERE, 'rows.json'));
  const base = path.dirname(rowsFile);
  const cfg = fs.existsSync(rowsFile) ? JSON.parse(fs.readFileSync(rowsFile, 'utf8')) : {};   // discover runs before rows exist
  cfg.servers ||= { before: 'http://localhost:9092/', after: 'http://localhost:9091/' };
  cfg.out = path.resolve(base, cfg.out || 'out');
  cfg.profile = path.resolve(base, cfg.profile || 'profile');
  cfg.rows ||= [];
  cfg.main ||= Object.keys(cfg.servers).at(-1);          // the branch side: strips and exports use it
  for (const r of cfg.rows) for (const k of r.servers || []) {
    if (!cfg.servers[k]) throw new Error(`row "${r.name}": unknown server "${k}" (have ${Object.keys(cfg.servers).join(', ')})`);
  }
  return cfg;
}

// node <script>.mjs [rows.json] [--flag value] [name ...]
export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {}, names = [];
  let cfgFile = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const v = argv[i + 1]; if (v && !v.startsWith('--')) { flags[a.slice(2)] = v; i++; } else flags[a.slice(2)] = true; }
    else if (a.endsWith('.json') && !cfgFile) cfgFile = a;
    else names.push(a);
  }
  return { cfgFile, names, flags };
}
