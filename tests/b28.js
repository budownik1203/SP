const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message); });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  await p.evaluate(() => { const w = window.__game().WORLD; w.hour = 6; w.fog = true; });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: '/tmp/claude-0/t/b28_map.png' });
  console.log('errors', errs.length); await b.close();
})();
