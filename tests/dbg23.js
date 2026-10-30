const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  console.log(await p.evaluate(() => { const w = window.__game().WORLD; const P0 = w.parties.find(x => x.id === w.pid); return JSON.stringify({ plot: w.plot, lords: w.parties.filter(x => x.kind === 'lord').slice(0,40).map(o => o.faction + ':' + o.lord).join(','), liege: w.player.liege }); }));
  await b.close();
})();
