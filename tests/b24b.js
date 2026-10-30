const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message); });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  await p.evaluate(() => { const w = window.__game().WORLD, T = window.__T3; w.player.wars.push(2); w.player.gold = 20000; const town = w.settlements.find(x => x.kind === 'town' && x.faction === 2); T.siegeWon(town, []);
    const Ls = w.lords.filter(l => l.faction === 1 && !l.ruler).slice(0, 2); for (const L of Ls) { L.faction = 9; } window.__T3.KG.tab = 'court'; T.showKingdom(); });
  await p.waitForTimeout(300);
  await p.click('#ui [data-a="grant"]'); await p.waitForTimeout(200);
  await p.click('#ui [data-a="feast"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: '/tmp/claude-0/t/b24_court2.png' });
  console.log(await p.evaluate(() => window.__game().WORLD.lords.filter(l => l.faction === 9).map(l => l.title + ' ' + l.name + ' ' + l.loyal).join(' | ')));
  // wasal: nadanie tytułu
  console.log(await p.evaluate(() => { const w = window.__game().WORLD, P = w.player; P.status = 'wasal'; P.liege = 1; P.renown = 500; const c = w.settlements.filter(s => s.kind === 'castle' && s.faction === 1).slice(0, 2); for (const s of c) s.owner = -2; window.__T3.kingdomDaily(w); return P.rank; }));
  console.log('errors', errs.length); await b.close();
})();
