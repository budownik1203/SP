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
  for (let i = 0; i < 3; i++) await p.click('#ui button[data-a="next"]'); await p.click('#ui button[data-a="origin"][data-v="barb"]'); await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.waitForTimeout(500);
  await p.evaluate(() => { window.__game().G.speed = 4; const w = window.__game().WORLD; w.parties.find(x=>x.kind==='player').troops.push({type:'o_warrior',n:20,wounded:0,xp:0}); w.player.goods.grain = 200; w.player.gold = 5000; });
  const log = {};
  for (let step = 0; step < 150; step++) {
    const st = await p.evaluate(() => { const g = window.__game(); const scr = document.querySelector('#ui .win'); return { state: g.G.state, scr: scr ? scr.className : '', day: g.WORLD ? g.WORLD.day : 0, phase: g.G.battle ? g.G.battle.phase : '' }; });
    const key = st.state + '|' + st.scr; log[key] = (log[key] || 0) + 1;
    if (st.state === 'battle') { await p.evaluate(() => { const b = window.__battle(); if (b.phase === 'deploy') b.startFight(); if (b.paused) { b.paused = false; } for (let i = 0; i < 400 && b.phase === 'fight'; i++) b.update(0.05); }); await p.waitForTimeout(300); continue; }
    if (st.scr.includes('dialog-scr') || st.scr.includes('place-scr')) {
      const btn = await p.$('#ui button:has-text("Do ataku!")') || await p.$('#ui button:has-text("Atakuj")') || await p.$('#ui button:has-text("Czekaj dzień")') || await p.$('#ui button:has-text("Odejdź")') || await p.$('#ui button:has-text("Żegnaj")') || await p.$('#ui button:has-text("Dalej")') || await p.$('#ui button.choice:not([disabled])');
      if (btn) await btn.click(); await p.waitForTimeout(100); continue; }
    if (st.scr.includes('after-scr')) { await p.click('#ui button:has-text("Dalej")'); await p.waitForTimeout(100); continue; }
    if (st.scr.includes('settle-scr')) { const tabs = await p.$$('#ui button.tab'); if (tabs.length && Math.random() < 0.7) { await tabs[Math.floor(Math.random()*tabs.length)].click(); } else await p.keyboard.press('Escape'); await p.waitForTimeout(100); const lv = await p.$('#ui button.tab:has-text("Wyjdź")'); if (lv && Math.random()<0.5) await lv.click(); continue; }
    if (st.scr) { await p.keyboard.press('Escape'); await p.waitForTimeout(50); const c = await p.$('#ui button:has-text("Wróć do gry")'); if (c) await c.click(); continue; }
    // mapa: losowy cel
    if (Math.random() < 0.3) await p.evaluate(() => { const g = window.__game(); const w = g.WORLD; const s = w.settlements[Math.floor(Math.random()*w.settlements.length)]; const pp = w.parties.find(x=>x.kind==='player'); g.G.target = {kind:'settlement', id:s.id}; goToT(s); }).catch(()=>{});
    await p.mouse.click(200 + Math.random()*880, 150 + Math.random()*420);
    await p.waitForTimeout(700);
  }
  const fin = await p.evaluate(() => { const g = window.__game(); const w = g.WORLD; return { day: w.day, gold: w.player.gold, lvl: w.player.level, troops: w.parties.find(x=>x.kind==='player').troops.reduce((a,t)=>a+t.n,0), captive: !!w.player.captive, chron: w.chronicle.length }; });
  console.log(JSON.stringify(log)); console.log(JSON.stringify(fin));
  console.log(errs.slice(0,10).join('\n'));
  await b.close();
})();
