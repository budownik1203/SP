const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300); await p.waitForTimeout(500);
  const clickTown = async () => {
    const pos = await p.evaluate(() => { const g = window.__game(); const w = g.WORLD; const pp = w.parties.find(x=>x.kind==='player'); const s = w.settlements.slice().sort((a,b)=>Math.hypot(a.cx*8-pp.x,a.cy*8-pp.y)-Math.hypot(b.cx*8-pp.x,b.cy*8-pp.y))[0]; const c = document.getElementById('game').getBoundingClientRect(); const W = document.getElementById('game').width; const sc = c.width / W; return { x: c.left + (s.cx*8+4 - g.G.view.cam.x)*sc, y: c.top + (s.cy*8 - g.G.view.cam.y)*sc }; });
    await p.mouse.move(pos.x, pos.y); await p.waitForTimeout(100); await p.mouse.click(pos.x, pos.y);
  };
  for (let round = 0; round < 4; round++) {
    await clickTown(); await p.waitForTimeout(2500);
    const open = await p.evaluate(() => { const s = document.querySelector('#ui .win'); return s ? s.className : 'none'; });
    console.log('round', round, open);
    for (const t of ['Rekrutacja','Karczma','Arena','Rada miejska','Plac']) { const e = await p.$(`button.tab:has-text("${t}")`); if (e) { await e.click(); await p.waitForTimeout(150); } }
    const r = await Promise.race([p.evaluate(() => 'alive'), new Promise(r => setTimeout(() => r('HUNG'), 3000))]);
    console.log(r);
    if (r === 'HUNG') break;
    const lv = await p.$('button.tab:has-text("Wyjdź")'); if (lv) await lv.click();
    await p.waitForTimeout(300);
    await p.mouse.click(700, 500); await p.waitForTimeout(1500);
  }
  console.log(errs.join('\n'));
  await b.close();
})();
