const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.waitForSelector('button[data-a=quick]'); await p.click('button[data-a=quick]'); await p.waitForTimeout(200);
  await p.click('button.chip:has-text("Las")');
  await p.click('text=Do boju'); await p.waitForTimeout(500);
  const r = await p.evaluate(() => { const b = window.__battle(); const hidden = b.units.filter(u=>u.team===1&&u.hidden).length;
    // zabij wszystkich widocznych, ukrytych zostaw
    for (const u of b.units) if (u.team===1 && !u.hidden) b.kill(u, null);
    let t = 0; while (b.phase === 'fight' && t < 4000) { b.update(0.05); t++; }
    return { hidden, steps: t, phase: b.phase, time: b.time, win: b.result && b.result.win }; });
  console.log(JSON.stringify(r));
  console.log(errs.join('\n'));
  await b.close();
})();
