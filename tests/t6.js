const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.click('text=Nowa gra');
  for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const T = window.__T; const g = window.__game(); const w = g.WORLD;
    const t0 = performance.now();
    const st = {};
    for (let d = 0; d < 60; d++) { for (let h = 0; h < 24; h++) { T.worldTick(w, 1); for (const p of w.parties) if (p.kind==='lord') st[p.state] = (st[p.state]||0)+1; } }
    const ms = performance.now() - t0;
    const lords = w.parties.filter(p=>p.kind==='lord').map(p=>({n:p.name, t: T.troopCount(p.troops), pw: Math.round(T.partyPower(w,p)), st: p.state}));
    const gar = w.settlements.filter(s=>s.kind!=='village').map(s=>s.name+':'+s.garrison.reduce((a,t)=>a+t.n,0)+(s.siegeBy.length?'*':''));
    return { ms, st, lords, gar, sieges: w.chronicle.filter(c=>/oblega|pada|Szturm/.test(c.text)).map(c=>c.day+': '+c.text) };
  }).catch(e => 'ERR ' + e.message + e.stack);
  console.log(JSON.stringify(r));
  console.log(errs.slice(0, 10).join('\n'));
  await b.close();
})();
