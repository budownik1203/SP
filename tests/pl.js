const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1500);
  console.log(await p.evaluate(() => { const w = window.__game().WORLD; const k = {}; for (const x of w.places) k[x.kind] = (k[x.kind] || 0) + 1; const b = w.parties.filter(x => x.kind === 'bandit').length; return JSON.stringify(k) + ' bandits0=' + b; }));
  await b.close();
})();
