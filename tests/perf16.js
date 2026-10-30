const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///home/claude/buildy/Sztandary%20Popio%C5%82u%20B16.html'); await p.waitForTimeout(800);
  const t0 = Date.now();
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat');
  await p.waitForFunction(() => window.__game && window.__game().WORLD);
  await p.waitForTimeout(200);
  console.log('newgame ms', Date.now() - t0);
  const fps = await p.evaluate(() => new Promise(r => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
  console.log('map fps', fps);
  await b.close();
})();
