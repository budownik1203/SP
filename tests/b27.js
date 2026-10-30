const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message); });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  const r = await p.evaluate(() => { const w = window.__game().WORLD, T = window.__T3, P = w.player; P.gold = 20000; P.goods.iron = 50; P.goods.timber = 50; P.goods.ale = 30;
    const inTowns = w.settlements.flatMap(s => s.companions); const newOnes = ['lucjan', 'thrain', 'morkesh', 'wilhelmina'].filter(id => inTowns.includes(id));
    for (const id of ['kasia', 'bogdan', 'dvalin', 'ilse', 'wilhelmina', 'thrain']) P.companions.push(window.__T.makeCompanion(id));
    for (let i = 0; i < 80; i++) { w.day++; T.companionQuestsDaily(w); }
    const pq = P.quests.filter(q => q.comp).map(q => q.comp + ':' + q.kind + ':' + q.target);
    // wykonaj zadania płatności / dostawy
    for (const q of P.quests.filter(q => q.comp && q.kind === 'pquest' && !q.done)) T.pquestDo(w, q.id);
    // odwiedziny: wejdź do osady celu
    for (const q of P.quests.filter(q => q.comp && q.kind === 'letter' && !q.done)) T.enterSettlement(w.settlements[q.target], true);
    const dev = P.companions.filter(c => c.devoted).map(c => c.id);
    const c0 = P.companions[0], a0 = c0.armor; T.gearUp(c0);
    return { newOnes, pq, dev, gear: a0 + '->' + c0.armor }; });
  console.log(JSON.stringify(r));
  // nobilitacja
  const e = await p.evaluate(() => { const w = window.__game().WORLD, T = window.__T3, P = w.player; P.wars.push(2); const town = w.settlements.find(x => x.kind === 'town' && x.faction === 2); T.siegeWon(town, []); const c = P.companions.find(c => c.id === 'bogdan'); c.level = 5; T.ennoble(w, c, town.id); const L = w.lords.find(l => l.name === c.name); return L ? L.title + ' ' + L.name + ' party ' + L.party + ' fief ' + w.settlements.filter(s => s.owner === L.id).length : 'none'; });
  console.log('ennoble', e);
  await p.evaluate(() => window.__T.showParty()); await p.waitForTimeout(300);
  await p.click('#ui button[data-a="tab"][data-v="comp"]').catch(() => console.log('no comp tab'));
  await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/claude-0/t/b27_party.png' });
  console.log('errors', errs.length); await b.close();
})();
