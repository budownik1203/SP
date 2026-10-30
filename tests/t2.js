const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errs.push(m.text()); });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.click('text=Nowa gra');
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'creator.png' });
  const t0 = Date.now();
  for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.waitForTimeout(500);
  console.log('gen ms', Date.now() - t0);
  await p.screenshot({ path: 'map1.png' });
  const info = await p.evaluate(() => { const g = window.__game(); const w = g.WORLD; return { sets: w.settlements.length, parties: w.parties.length, lords: w.lords.length, places: w.places.length, kinds: w.parties.map(p=>p.kind).join(',') }; });
  console.log(JSON.stringify(info));
  // fps test on map
  const fps = await p.evaluate(() => new Promise(r => { let n = 0; const t = performance.now(); function f() { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else r(n / 2); } requestAnimationFrame(f); }));
  console.log('fps', fps);
  // walk to some point
  await p.mouse.click(900, 300);
  await p.waitForTimeout(5000);
  await p.screenshot({ path: 'map2.png' });
  const info2 = await p.evaluate(() => { const g = window.__game(); const w = g.WORLD; return { day: w.day, hour: w.hour, chron: w.chronicle.map(c=>c.text).slice(-5), state: g.G.state }; });
  console.log(JSON.stringify(info2));
  console.log(errs.slice(0, 10).join('\n'));
  await b.close();
})();
