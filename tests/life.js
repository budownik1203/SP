const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('ERR', e.message, e.stack.split('\n')[1]));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1500);
  for (let r = 0; r < 4; r++) {
    const o = await p.evaluate(() => { const w = window.__game().WORLD; const t0 = performance.now(); for (let d = 0; d < 15; d++) { for (let h = 0; h < 24; h++) window.__T.worldTick(w, 1); (w.pending || []).splice(0); }
      const k = {}; for (const x of w.parties) k[x.kind] = (k[x.kind] || 0) + 1;
      const ret = w.parties.filter(x => x.kind === 'villagers' && x.state === 'return').length;
      const towns = w.settlements.filter(s => s.kind === 'town'); const food = Math.round(towns.reduce((a, s) => a + s.stock.grain, 0) / towns.length);
      const vill = w.settlements.filter(s => s.kind === 'village'); const vg = Math.round(vill.reduce((a, s) => a + s.stock.grain, 0) / vill.length);
      return `day ${w.day} ms/day ${Math.round((performance.now() - t0) / 15)} parties ${JSON.stringify(k)} returning ${ret} townGrain ${food} villGrain ${vg} prosp ${Math.round(towns.reduce((a,s)=>a+s.prosperity,0)/towns.length)}`; });
    console.log(o);
  }
  await p.evaluate(() => { const g = window.__game(); g.G.view.cam.x = 700; g.G.view.cam.y = 500; });
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/claude-0/t/life.png' });
  await b.close();
})();
