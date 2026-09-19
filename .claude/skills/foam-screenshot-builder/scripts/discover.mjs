// node discover.mjs [rows.json] <menuId> [...]  — prints the largest FOAM container classes on a
// screen of the "after" server so you can pick `sel` and `marks` without guessing.
import { openApps, launchMenu, readRows, parseArgs } from './lib.mjs';
const { cfgFile, names: menus } = parseArgs();
let cfg; try { cfg = readRows(cfgFile); } catch (e) { console.error(e.message); process.exit(2); }                       // works before rows.json exists
const after = cfg.main;
const { ctx, pages } = await openApps(cfg.profile, { [after]: cfg.servers[after] });
for (const m of menus) {
  await launchMenu(pages[after], m, 3000);
  const rows = await pages[after].evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll('[class]')) {
      const b = el.getBoundingClientRect();
      if (b.width < 60 || b.height < 20) continue;
      for (const c of el.classList) {
        if (!/^(foam|net|com)-/.test(c)) continue;
        out[c] ||= { n: 0, w: Math.round(b.width), h: Math.round(b.height) }; out[c].n++;
      }
    }
    return Object.entries(out).sort((a, b) => b[1].w * b[1].h - a[1].w * a[1].h).slice(0, 40);
  });
  console.log(`\n## ${m}`); for (const [c, v] of rows) console.log(`.${c}  n=${v.n} ${v.w}x${v.h}`);
}
await ctx.close();
