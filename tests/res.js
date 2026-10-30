const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 940 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(1500);
  await p.screenshot({ path: '/tmp/claude-0/t/res0.png' });
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1800);
  await p.click('#ftip button').catch(() => {});
  await p.screenshot({ path: '/tmp/claude-0/t/res1.png' });
  console.log(await p.evaluate(() => { const c = document.getElementById('game'); const r = c.getBoundingClientRect(); return c.width + 'x' + c.height + ' css ' + Math.round(r.width) + 'x' + Math.round(r.height); }));
  await p.evaluate(() => { const w = window.__game().WORLD; const e = w.parties.find(x => x.kind === 'bandit'); window.__T.launchBattle({ kind: 'field', enemies: [e], allies: [], title: 'T' }); });
  await p.waitForTimeout(800);
  await p.screenshot({ path: '/tmp/claude-0/t/res2.png' });
  console.log(await p.evaluate(() => { const c = document.getElementById('game'); return c.width + 'x' + c.height; }));
  await b.close();
})();
