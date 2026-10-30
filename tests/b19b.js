const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  await p.evaluate(() => { const w = window.__game().WORLD; w.hour = 20.6; w.player.fatigue = 50; });
  await p.mouse.click(300, 200); await p.waitForTimeout(300); await p.evaluate(() => { window.__game().G.speed = 4; });
  await p.waitForTimeout(3000);
  console.log('auto', JSON.stringify(await p.evaluate(() => { const w = window.__game().WORLD, G = window.__game().G; return { hour: w.hour, camping: G.camping, wait: G.waitHours }; })));
  // fort battle
  await p.evaluate(() => { const w = window.__game().WORLD, G = window.__game().G; G.camping = true; w.player.camp.fort = true; const e = w.parties.find(x => x.kind === 'bandit'); window.__T.launchBattle({ kind: 'field', enemies: [e], allies: [], title: 'Napad' }, { terrain: 'plains', deploy: false, night: false }); });
  await p.waitForTimeout(1500); await p.click('#ftip button').catch(() => {});
  const n = await p.evaluate(() => { const b = window.__battle(); b.cam && 0; return b.map.obstacles.filter(o => o.cover).length; });
  console.log('fences', n);
  await p.screenshot({ path: '/tmp/claude-0/t/b19_fort.png' });
  await b.close();
})();
