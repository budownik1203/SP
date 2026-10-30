const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1500);
  await p.click('#ftip button').catch(() => {});
  await p.evaluate(() => { const w = window.__game().WORLD; w.hour = 21; w.player.grime = 0.8; w.player.gore = 0.5; w.player.battlesWon = 20; w.player.hp = 30; const s = w.settlements.find(s => s.kind === 'town' && s.culture === 'aurelia'); s.prosperity = 80; window.__T.enterSettlement(s); });
  await p.waitForTimeout(900); await p.click('#ftip button').catch(() => {});
  await p.screenshot({ path: '/tmp/claude-0/t/u17_town.png' });
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/claude-0/t/u17_town2.png', clip: { x: 0, y: 0, width: 1280, height: 420 } });
  await p.evaluate(() => { document.querySelectorAll('#ui button').forEach(x => { if (/Wyjdź/.test(x.textContent)) x.click(); }); });
  await p.waitForTimeout(300);
  await p.evaluate(() => window.__T.showCharacter());
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/claude-0/t/u17_char.png' });
  await b.close();
})();
