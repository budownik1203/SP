const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.click('text=Nowa gra');
  for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.waitForTimeout(500);
  await p.evaluate(() => { const T = window.__T; T.captivity(2, []); T.showCaptivity(); });
  await p.waitForTimeout(300); await p.screenshot({ path: 'captive.png' });
  for (let i = 0; i < 10; i++) { const w = await p.$('#ui button:has-text("Czekaj dzień")'); if (!w) break; await w.click(); await p.waitForTimeout(150); }
  console.log(await p.evaluate(() => JSON.stringify({ cap: window.__game().WORLD.player.captive, day: window.__game().WORLD.day })));
  // zapis i wczytanie
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('text=Zapisz grę'); await p.waitForTimeout(200);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('text=Menu główne'); await p.waitForTimeout(300);
  await p.click('text=Wczytaj zapis'); await p.waitForTimeout(1500);
  console.log(await p.evaluate(() => JSON.stringify({ st: window.__game().G.state, day: window.__game().WORLD.day })));
  await p.screenshot({ path: 'loaded.png' });
  console.log(errs.join('\n'));
  await b.close();
})();
