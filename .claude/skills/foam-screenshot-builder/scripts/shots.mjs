/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
// node shots.mjs [rows.json] [rowName ...]   — re-shoots every (row × server × mode); pass
// row names to re-shoot only those. No skip-if-exists: every run overwrites what it shoots.
import { openApps, launchMenu, setMode, runPrep, shot, readRows, stepTarget, parseArgs } from './lib.mjs';

const { cfgFile, names } = parseArgs();
const only = new Set(names);
let cfg; try { cfg = readRows(cfgFile); } catch (e) { console.error(e.message); process.exit(2); }

const { ctx, pages } = await openApps(cfg.profile, cfg.servers);

const failures = [];
for (const r of cfg.rows) {
  if (only.size && !only.has(r.name)) continue;
  // A step strip (from --strip / a Recorder import) defaults to the "after" server only.
  const servers = r.servers || (r.steps ? [cfg.main] : Object.keys(cfg.servers));
  for (const k of servers) {
    const p = pages[k];
    for (const mode of r.modes || ['light']) {
      const base = `${cfg.out}/${r.name}/${mode}-${k}`;
      try {
        await launchMenu(p, r.menu, r.wait);
        await setMode(p, mode);
        await runPrep(p, r.prep);
        const opts = { pad: r.pad ?? 12, nth: r.nth ?? 0, maxH: r.maxH ?? 900 };
        if (r.steps) {
          // Shot i shows the screen BEFORE step i with its target marked ("click here"),
          // then the step runs; a last unmarked shot shows the result.
          // A step may open another view where the row's crop selector no longer exists;
          // a step's own `sel` wins, then the row's, then the stack content area.
          const CONTENT = '.foam-core-u2-navigation-NavigationController-stack-view';
          const stepShot = async (s, file, marks) => {
            for (const sel of [...new Set([s?.sel, r.sel, r.stepSel || CONTENT].filter(Boolean))]) {
              try { return await shot(p, sel, file, { ...opts, marks, timeout: 4000 }); } catch (e) { if (!/waitFor|no box/.test(e.message)) throw e; }
            }
            throw new Error('no crop target visible for ' + file);
          };
          for (const [i, s] of r.steps.entries()) {
            const target = stepTarget(s);
            await stepShot(s, `${base}-step${i + 1}.png`, target ? [{ sel: target, label: String(i + 1), note: s.note || '' }] : []);
            await runPrep(p, [s]);
          }
          await stepShot(null, `${base}-step${r.steps.length + 1}.png`, []);
        } else {
          await shot(p, r.sel, `${base}.png`, { ...opts, marks: r.marks || [] });
        }
        console.log('ok', base);
      } catch (e) { const msg = e.message.split('\n')[0]; failures.push(`${base}: ${msg}`); console.log('FAIL', base, msg); }
      try { await setMode(p, 'light'); } catch {}
    }
  }
}
if (failures.length) { console.log('\nFAILURES\n' + failures.join('\n')); process.exitCode = 1; }
await ctx.close();
