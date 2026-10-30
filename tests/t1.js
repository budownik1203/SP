const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: '/tmp/claude-0/t/title.png' });
  // szybka bitwa
  await p.click('text=Szybka bitwa');
  await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/claude-0/t/quick.png' });
  await p.click('text=Do boju');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: '/tmp/claude-0/t/battle1.png' });
  await p.keyboard.down('KeyD'); await p.waitForTimeout(3000); await p.keyboard.up('KeyD');
  await p.waitForTimeout(6000);
  await p.screenshot({ path: '/tmp/claude-0/t/battle2.png' });
  const st = await p.evaluate(() => { const b = window.__battle(); return { t: b.time, units: b.units.length, a0: b.units.filter(u=>u.team===0&&u.active).length, a1: b.units.filter(u=>u.team===1&&u.active).length, phase: b.phase }; });
  console.log(JSON.stringify(st));
  console.log(errs.slice(0, 10).join('\n'));
  await b.close();
})();
