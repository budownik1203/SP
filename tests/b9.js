const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.evaluate(() => { const T = window.__T; Object.assign(T.QB, { terrain: 'plains', fog: false, rain: false, mounted: true, size: 50 }); T.startQuickBattle(); });
  await p.waitForTimeout(400);
  const st = () => p.evaluate(() => { const B = window.__battle(), h = B.hero; return { m: h.mounted, x: Math.round(h.x), st: h.state, stam: Math.round(h.stamina), dodge: h.dodgeT > 0, loose: B.looseHorses.length, ld: B.loadDir, mode: B.atkMode() }; });
  console.log('start', JSON.stringify(await st()));
  await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
  console.log('after E', JSON.stringify(await st()));
  await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
  console.log('after E2', JSON.stringify(await st()));
  await p.keyboard.press('KeyE'); await p.waitForTimeout(200);
  await p.keyboard.down('KeyD'); await p.keyboard.press('Space'); await p.waitForTimeout(80);
  console.log('dodge', JSON.stringify(await st())); await p.keyboard.up('KeyD');
  // mouse gesture: move mouse sideways then click
  const c = await p.evaluate(() => { const r = document.getElementById('game').getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; });
  await p.mouse.move(c.x + 200, c.y); await p.waitForTimeout(100);
  await p.mouse.move(c.x + 200, c.y - 80, { steps: 5 });
  console.log('gesture', JSON.stringify(await st()));
  await p.mouse.down(); await p.waitForTimeout(600); await p.mouse.up(); await p.waitForTimeout(400);
  // advance fight
  await p.evaluate(() => { const B = window.__battle(); for (const k of Object.keys(B.orders)) B.orders[k].mode='charge'; for (let i=0;i<500;i++) { B.hero.hp = B.hero.maxHp; B.update(0.05); } });
  await p.screenshot({ path: '/tmp/claude-0/t/b9_fight.png' });
  await p.keyboard.press('KeyQ'); await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/claude-0/t/b9_q.png' });
  const mb = await p.evaluate(() => { const r = document.getElementById('mini').getBoundingClientRect(); return { x: r.left + r.width*0.7, y: r.top + r.height*0.5, w: r.width }; });
  console.log('elem', await p.evaluate(([x,y]) => { const e = document.elementFromPoint(x,y); return e.id + ' ' + e.className + ' big=' + document.getElementById('mini').className + ' cmd=' + window.__battle().cmdOpen; }, [mb.x, mb.y]));
  await p.mouse.click(mb.x, mb.y); await p.waitForTimeout(200);
  console.log('order', await p.evaluate(() => JSON.stringify(window.__battle().orders[1])));
  await p.keyboard.press('KeyQ');
  await p.evaluate(() => { const B = window.__battle(); for (let i=0;i<9000 && B.phase!=='end';i++) B.update(0.05); });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: '/tmp/claude-0/t/b9_end.png' });
  // campaign aftermath
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300); await p.waitForTimeout(500);
  await p.evaluate(() => { const w = window.__game().WORLD; const pp = w.parties.find(x=>x.kind==='player'); pp.troops.push({type:'a_recruit',n:20,wounded:0,xp:2000},{type:'a_militia',n:10,wounded:0,xp:2000}); w.player.gold = 3000; const e = w.parties.find(x=>x.kind==='bandit'); e.troops = [{type:'a_maa',n:30,wounded:0,xp:0}]; window.__T.launchBattle({ kind: 'field', enemies: [e], allies: [], title: 'Test' }); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const B = window.__battle(); for (const k of Object.keys(B.orders)) B.orders[k].mode='charge'; for (let i=0;i<9000 && B.phase!=='end';i++) { B.hero.hp = B.hero.maxHp; B.update(0.05); } });
  for (let k=0;k<30;k++){ const c2 = await p.evaluate(()=>document.querySelector('#ui .win')?.className||''); if (c2.includes('after')) break; await p.waitForTimeout(200); }
  await p.screenshot({ path: '/tmp/claude-0/t/b9_after.png', fullPage: true });
  const pr = await p.$('#ui button:has-text("Awansuj wszystkich")'); if (pr) { await pr.click(); await p.waitForTimeout(300); }
  console.log('troops', await p.evaluate(() => JSON.stringify(window.__game().WORLD.parties.find(x=>x.kind==='player').troops.map(t=>t.type+':'+t.n))));
  await p.screenshot({ path: '/tmp/claude-0/t/b9_after2.png' });
  await p.click('#ui button:has-text("Dalej")'); await p.waitForTimeout(300);
  console.log('items', await p.evaluate(() => window.__game().WORLD.player.items.length));
  console.log(errs.slice(0,6).join('\n'));
  await b.close();
})();
