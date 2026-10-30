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
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'creator.png' });
  for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.waitForTimeout(500);
  // idź do najbliższego miasta (start) -> wejdź
  const r = await p.evaluate(() => { const g = window.__game(); const w = g.WORLD; const pp = w.parties.find(x=>x.kind==='player'); const s = w.settlements.slice().sort((a,b)=>Math.hypot(a.cx*8-pp.x,a.cy*8-pp.y)-Math.hypot(b.cx*8-pp.x,b.cy*8-pp.y))[0]; g.G.target={kind:'settlement',id:s.id}; return s.name; });
  console.log('to', r);
  await p.waitForTimeout(1000);
  await p.screenshot({ path: 'settle.png' });
  for (const tab of ['Rekrutacja','Targ','Kowal','Karczma','Arena','Rada miejska']) {
    const ok = await p.$(`button.tab:has-text("${tab}")`);
    if (ok) { await ok.click(); await p.waitForTimeout(200); await p.screenshot({ path: `tab_${tab.replace(' ','_')}.png` }); }
  }
  console.log(errs.slice(0, 10).join('\n'));
  await b.close();
})();
