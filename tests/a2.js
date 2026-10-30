const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForSelector('button[data-a=quick]'); await p.click('button[data-a=quick]');
  await p.click('button.chip:has-text("Legion")');
  await p.click('text=Do boju'); await p.waitForTimeout(400);
  await p.evaluate(() => { const B = window.__battle(); B.hero.x = -500; for (const k of Object.keys(B.orders)) B.orders[k].mode = 'charge'; for (let i = 0; i < 700; i++) B.update(0.05); });
  for (let i = 0; i < 4; i++) {
    await p.evaluate(() => { const B = window.__battle(); const fighters = B.units.filter(u => u.active && (u.state === 'windup' || u.state === 'strike')); const f = fighters[0] || B.units.find(u=>u.active); B.camFree = true; B.cam.x = f.x - 120; B.cam.y = f.y - 70; for (let k = 0; k < 3; k++) B.update(0.03); });
    await p.waitForTimeout(120);
    const r = await p.evaluate(() => { const c = document.getElementById('game').getBoundingClientRect(); return { x: c.left, y: c.top, w: c.width, h: c.height }; });
    await p.screenshot({ path: `fight${i}.png`, clip: { x: r.x + r.w * 0.1, y: r.y + r.h * 0.05, width: r.w * 0.5, height: r.h * 0.55 } });
  }
  console.log(errs.join('\n'));
  await b.close();
})();
