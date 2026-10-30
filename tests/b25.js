const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message); });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  await p.evaluate(() => { const w = window.__game().WORLD, T = window.__T3; w.player.wars.push(2); w.player.gold = 30000; const town = w.settlements.find(x => x.kind === 'town' && x.faction === 2); T.siegeWon(town, []); for (const s of w.settlements) w.explored[s.cy * 427 + s.cx] = 1; T.KG.tab = 'intel'; T.showKingdom(); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/claude-0/t/b25_intel.png' });
  await p.click('#ui [data-a="spyGo"]'); await p.waitForTimeout(200);
  await p.click('#ui [data-a="intr"]'); await p.waitForTimeout(200);
  await p.click('#ui [data-a="itrib"][data-v="100"]'); await p.waitForTimeout(200);
  await p.check('#ihost'); await p.waitForTimeout(200);
  await p.click('#ui [data-a="treaty"]'); await p.waitForTimeout(200);
  await p.click('#ui [data-a="emb"][data-v="3"]'); await p.waitForTimeout(200);
  const r = await p.evaluate(() => { const w = window.__game().WORLD, T = window.__T3; const out = {}; out.spies = T.spies(w).length; w.factions[2].relation[9] = 80;
    const sp = T.spies(w)[0]; for (let i = 0; i < 8; i++) { w.day++; T.intelDaily(w); T.treatyDaily(w); }
    out.spyAlive = T.spies(w).length; if (T.spies(w)[0]) { T.spyAct(w, T.spies(w)[0], 'sabotage'); out.cover = T.spies(w)[0]?.cover; }
    for (let k = 0; k < 10 && !T.treaties(w).length; k++) { T.sendTreaty(w, 2, 100, true, -1); for (let i = 0; i < 5; i++) { w.day++; T.treatyDaily(w); } } out.treaties = JSON.stringify(T.treaties(w)); out.hostage = w.lords.filter(l => l.captive === 9).map(l => l.name).join(','); out.war2 = !!w.factions[9].war[2];
    // AI nie może wypowiedzieć wojny przy zakładniku
    T.setWar(w, 2, 9, true); out.warAfterAI = !!w.factions[9].war[2];
    out.gold3 = w.factions[3].gold; return out; });
  console.log(JSON.stringify(r));
  await p.evaluate(() => window.__T3.showKingdom()); await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/claude-0/t/b25_intel2.png' });
  // kompania
  const c = await p.evaluate(() => { const w = window.__game().WORLD, T = window.__T3; const P0 = w.parties.find(x => x.id === w.pid); let s = null, wk = Math.floor(w.day / 7); for (const t of w.settlements.filter(x => x.kind === 'town')) if (T.mercCompany(t, wk)) { s = t; break; } const mc = T.mercCompany(s, wk); const before = P0.troops.reduce((a, t) => a + t.n, 0); T.hireCompany(w, s, wk); const after = P0.troops.reduce((a, t) => a + t.n, 0); for (let i = 0; i < 31; i++) { w.day++; T.intelDaily(w); } const end = P0.troops.reduce((a, t) => a + t.n, 0); return mc.name + ' ' + before + '->' + after + '->' + end; });
  console.log('company', c);
  console.log('errors', errs.length); await b.close();
})();
