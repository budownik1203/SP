const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errs.push(m.text()); });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.click('text=Nowa gra');
  for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const T = window.__T; const g = window.__game(); const w = g.WORLD;
    const t0 = performance.now();
    const stats = [];
    for (let d = 0; d < 90; d++) { for (let h = 0; h < 12; h++) T.worldTick(w, 2); if (d % 15 === 0) stats.push({ d: w.day, parties: w.parties.length, kinds: ['lord','bandit','monster','undead','caravan','villagers'].map(k=>w.parties.filter(p=>p.kind===k).length).join('/'), owners: [1,2,3,4,5].map(f=>w.settlements.filter(s=>s.faction===f).length).join('/') }); }
    const ms = performance.now() - t0;
    const json = T.serializeWorld(w);
    const w2 = T.deserializeWorld(json);
    return { ms, stats, chron: w.chronicle.slice(-25).map(c => c.day + ': ' + c.text), saveKB: Math.round(json.length / 1024), same: w2.settlements.length === w.settlements.length && w2.day === w.day, wars: JSON.stringify(Object.fromEntries([1,2,3,4,5].map(f=>[f,Object.keys(w.factions[f].war).filter(k=>w.factions[f].war[k])]))) };
  }).catch(e => 'ERR ' + e.message + e.stack);
  console.log(JSON.stringify(r, null, 1));
  console.log(errs.slice(0, 10).join('\n'));
  await b.close();
})();
