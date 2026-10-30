const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 850 } });
  p.on('pageerror', e => console.log('ERR', e.message, e.stack.split('\n')[1]));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1500);
  await p.click('#ftip button').catch(() => {});
  console.log(await p.evaluate(() => { const w = window.__game().WORLD, T = window.__T; const out = [];
    const before = w.parties.filter(x => x.kind === 'bandit').length;
    let offers = 0; for (const s of w.settlements) { if (T.offerQuest(s)) offers++; }
    const after = w.parties.filter(x => x.kind === 'bandit').length;
    out.push(`oferty ${offers}, bandy przed ${before} po ${after}`);
    const town = w.settlements.find(s => s.kind === 'town' && s.faction === 1);
    let q = null; for (let d = 0; d < 40 && !(q && q.kind === 'escort'); d++) { w.day++; q = T.offerQuest(town); }
    if (q && q.kind === 'escort') { const ok = T.acceptQuest(q); const c = w.parties.find(x => x.id === q.target); out.push(`eskorta ok=${ok} karawana=${!!c} do ${w.settlements[q.amount].name}`); } else out.push('brak eskorty');
    const L = w.lords.find(l => l.faction === 1 && !l.ruler && l.alive); const kinds = {};
    for (let d = 0; d < 60; d++) { w.day++; const lq = T.offerLordQuest(L); if (lq) kinds[lq.kind] = (kinds[lq.kind] || 0) + 1; }
    out.push('zadania lorda ' + JSON.stringify(kinds));
    // wątek główny
    const ruins = w.places.filter(x => x.kind === 'ruins');
    w.plot.stage = 1; w.plot.relics = 2; const lines = []; T.plotRuins(w, ruins[0], lines);
    out.push('relikwie: ' + lines.join(' | ') + ' pending=' + (w.pending || []).map(e => e.kind).join(','));
    return out.join('\n'); }));
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/claude-0/t/b16_choice.png' });
  await p.click('#ui button[data-a="cr"][data-v="3"]').catch(e => console.log('nocr', e.message));
  await p.waitForTimeout(300);
  console.log(await p.evaluate(() => { const w = window.__game().WORLD; return 'plot ' + JSON.stringify(w.plot) + ' q=' + w.player.quests.find(q => q.kind === 'plot').text; }));
  await p.evaluate(() => { const w = window.__game().WORLD; const cap = w.settlements[w.player.quests.find(q => q.kind === 'plot').target]; window.__T.enterSettlement(cap); });
  await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/claude-0/t/b16_crusade.png' });
  console.log(await p.evaluate(() => { const w = window.__game().WORLD; return 'stage ' + w.plot.stage + ' items ' + w.player.items.slice(-1) + ' camp3=' + JSON.stringify(w.factions[3].camp); }));
  // bunt
  await p.evaluate(() => { const w = window.__game().WORLD; window.__T.closeScreen && 0; document.querySelector('#ui .win')?.remove(); });
  console.log(await p.evaluate(() => { const w = window.__game().WORLD; const L = w.lords.find(l => l.faction === 2 && !l.ruler && w.settlements.some(s => s.owner === l.id && s.kind !== 'village')); window.__T.startRebellion(w, L); return 'bunt: ' + (w.rebels || []).map(r => r.id + ' ' + window.__game().WORLD.factions[r.id].name).join(',') + ' osady ' + w.settlements.filter(s => s.faction === 12).length; }));
  await b.close();
})();
