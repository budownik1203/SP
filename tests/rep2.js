const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300); await p.waitForTimeout(500);
  const st = async (l) => console.log(l, await Promise.race([p.evaluate(() => { const g = window.__game(); const s = document.querySelector('#ui .win'); return JSON.stringify({ st: g.G.state, scr: s ? s.className : '', hud: !document.getElementById('maphud').hidden, path: g.WORLD.parties.find(x=>x.kind==='player').path.length, tgt: g.G.target, wait: g.G.waitHours, camp: g.G.camping }); }), new Promise(r => setTimeout(() => r('HUNG'), 3000))]));
  await p.evaluate(() => { const g = window.__game(); const w = g.WORLD; const pp = w.parties.find(x=>x.kind==='player'); const s = w.settlements[0]; pp.x = s.cx*8+4; pp.y = s.cy*8+4; window.__T.enterSettlement(s); });
  await st('in');
  await p.click('button.tab:has-text("Arena")'); await p.click('text=Walcz (nagroda 40)');
  await p.waitForTimeout(800); await st('arena');
  await p.evaluate(() => { const b = window.__battle(); for (let i = 0; i < 3000 && b.phase==='fight'; i++) b.update(0.05); });
  await p.waitForTimeout(3000); await st('after');
  await p.click('text=Dalej'); await p.waitForTimeout(300); await st('back in town');
  await p.click('button.tab:has-text("Wyjdź")'); await p.waitForTimeout(300); await st('left');
  await p.click('button.tab:has-text("Odpocznij")').catch(()=>{});
  // klik na miasto
  const pos = await p.evaluate(() => { const g = window.__game(); const w = g.WORLD; const s = w.settlements[0]; const c = document.getElementById('game').getBoundingClientRect(); const W = document.getElementById('game').width; const sc = c.width / W; return { x: c.left + (s.cx*8+4 - g.G.view.cam.x)*sc, y: c.top + (s.cy*8 - g.G.view.cam.y)*sc }; });
  await p.mouse.move(pos.x, pos.y); await p.waitForTimeout(100); await p.mouse.click(pos.x, pos.y); await p.waitForTimeout(1500); await st('reenter');
  await p.mouse.click(pos.x, pos.y); await p.waitForTimeout(1500); await st('reenter2');
  console.log(errs.join('\n'));
  await b.close();
})();
