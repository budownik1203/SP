const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300); await p.waitForTimeout(500);
  await p.evaluate(() => { const w = window.__game().WORLD; const pp = w.parties.find(x=>x.kind==='player'); pp.troops.push({type:'a_maa',n:25,wounded:0,xp:0},{type:'a_archer',n:15,wounded:0,xp:0}); w.player.gold = 9000; });
  const sim = async (kill, maxI = 8000) => p.evaluate(([kill, maxI]) => { const B = window.__battle(); if (B.phase === 'deploy') B.startFight(); B.paused = false; let i = 0; for (; i < maxI && B.phase !== 'end'; i++) { if (kill && i % 20 === 0 && i > 40) { const e = B.units.find(u => u.team === 1 && u.active); if (e) B.kill(e, B.hero); } if (B.hero) B.hero.hp = B.hero.maxHp; B.update(0.05); } return { phase: B.phase, t: Math.round(B.time), win: B.result?.win, j: B.joust ? B.joust.p.join(':') : '', a: B.archery ? B.archery.score + '/' + B.archery.opp : '', units: B.units.filter(u=>u.active).length }; }, [kill, maxI]);
  const waitAfter = async () => { for (let k = 0; k < 40; k++) { const c = await p.evaluate(() => { const s = document.querySelector('#ui .win'); return s ? s.className : ''; }); if (c.includes('after-scr') || c.includes('dialog-scr')) return c; await p.waitForTimeout(150); } return 'NOAFTER'; };
  const s0 = await p.evaluate(() => window.__game().WORLD.settlements.find(s=>s.kind==='town').id);
  // arena pane screenshot
  await p.evaluate((id) => { const g = window.__game(); window.__T.enterSettlement(g.WORLD.settlements[id]); window.__T.SET.tab = 'arena'; window.__T.renderSettlement(); }, s0);
  await p.waitForTimeout(300); await p.screenshot({ path: '/tmp/claude-0/t/b10_arena.png' });
  for (const [mode, kill] of [['beasts',true],['archery',false],['joust',false],['waves',true],['duel',true]]) {
    await p.evaluate(([id, mode]) => { const g = window.__game(); window.__T.SET.kit = 2; window.__T.arenaFight(g.WORLD.settlements[id], mode, false, 0, 50); }, [s0, mode]);
    await p.waitForTimeout(200);
    if (mode === 'archery') {
      // shoot at targets: aim the hero
      await p.evaluate(() => { const B = window.__battle(); const h = B.hero; for (let k = 0; k < 12; k++) { const t = B.units.find(u => u.key === 'x_dummy' && u.active); if (!t) break; h.face = Math.atan2(t.y - (h.y - 12), t.x - h.x); h.drawT = 1; B.fire(h, h.face, 260, 50, Math.hypot(t.x-h.x,t.y-h.y), 'arrow'); h.ammo--; for (let i=0;i<40;i++) B.update(0.05); } });
      await p.screenshot({ path: '/tmp/claude-0/t/b10_archery.png' });
    }
    if (mode === 'joust') { await p.evaluate(() => { const B = window.__battle(); for (let i=0;i<60;i++) B.update(0.05); }); await p.screenshot({ path: '/tmp/claude-0/t/b10_joust.png' }); }
    const r = await sim(kill, 4000); const a = await waitAfter();
    console.log(mode, JSON.stringify(r), a, await p.evaluate(() => document.querySelector('#ui .win p:last-of-type')?.textContent?.slice(0,100)));
    await p.click('#ui button:has-text("Dalej")').catch(()=>{}); await p.waitForTimeout(200);
  }
  // tournament 16
  await p.evaluate((id) => { const g = window.__game(); window.__T.startTourney(g.WORLD.settlements[id], 0); }, s0);
  await p.waitForTimeout(300); await p.screenshot({ path: '/tmp/claude-0/t/b10_bracket.png' });
  for (let r = 0; r < 4; r++) {
    const bb = await p.$('#ui button.mini[data-a="bet"]:not([disabled])'); if (bb) await bb.click();
    await p.click('#ui button:has-text("Do walki!")'); await p.waitForTimeout(200);
    const md = await p.evaluate(() => { const B = window.__battle(); return B.cfg.arena; });
    if (md.archery) await p.evaluate(() => { const B = window.__battle(); B.archery.opp = 0; for (const u of B.units) if (u.key==='x_dummy') B.kill(u, B.hero); });
    if (md.joust) await p.evaluate(() => { const B = window.__battle(); B.joust.p = [3,0]; });
    const res = await sim(!md.archery && !md.joust, 4000); const a = await waitAfter(); console.log('tour', r, JSON.stringify(md), JSON.stringify(res), a);
    await p.click('#ui button:has-text("Dalej")'); await p.waitForTimeout(300);
    if (r === 1) await p.screenshot({ path: '/tmp/claude-0/t/b10_bracket2.png' });
  }
  // field battle with deploy
  await p.evaluate(() => { const w = window.__game().WORLD; const e = w.parties.find(x=>x.kind==='bandit'); e.troops=[{type:'o_warrior',n:30,wounded:0,xp:0}]; window.__T.launchBattle({ kind: 'field', enemies: [e], allies: [], title: 'Test' }); });
  await p.waitForTimeout(400);
  console.log('deploy', await p.evaluate(() => window.__battle().phase), await p.evaluate(() => !document.getElementById('startfight').hidden));
  await p.screenshot({ path: '/tmp/claude-0/t/b10_deploy.png' });
  await p.keyboard.press('Digit1'); await p.mouse.move(500, 400); await p.mouse.down({ button: 'right' }); await p.mouse.move(640, 420, { steps: 5 }); await p.screenshot({ path: '/tmp/claude-0/t/b10_drag.png' }); await p.mouse.up({ button: 'right' });
  await p.click('#startfight'); await p.waitForTimeout(200);
  console.log('after start', await p.evaluate(() => window.__battle().phase));
  await p.keyboard.press('F5'); await p.waitForTimeout(100);
  console.log('volley', await p.evaluate(() => JSON.stringify(Object.values(window.__battle().orders).map(o=>o.volley))));
  await p.keyboard.press('F5'); await p.keyboard.press('F3'); await p.keyboard.press('KeyG');
  console.log('field', JSON.stringify(await sim(false)), await waitAfter());
  await p.click('#ui button:has-text("Dalej")').catch(()=>{}); await p.waitForTimeout(300);
  // siege assault: ladders + sack
  await p.evaluate(() => { const g = window.__game(); const w = g.WORLD; const s = w.settlements.find(s=>s.kind==='town'); window.__T.launchBattle({ kind: 'siege', enemies: [], allies: [], settlement: s, enemyTroops: s.garrison, title: 'Szturm' }, { engines: { ram: true, tower: true, trebuchet: true } }); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const B = window.__battle(); B.startFight(); for (let i=0;i<500;i++) { B.hero.hp=B.hero.maxHp; B.update(0.05); } });
  console.log('ladders', await p.evaluate(() => JSON.stringify(window.__battle().map.wall.placed)));
  await p.screenshot({ path: '/tmp/claude-0/t/b10_siege.png' });
  console.log('siege', JSON.stringify(await sim(false)), await waitAfter());
  await p.click('#ui button:has-text("Dalej")').catch(()=>{}); await p.waitForTimeout(400);
  console.log('sack', await p.evaluate(() => document.querySelector('#ui .win')?.textContent?.slice(0,80)));
  await p.screenshot({ path: '/tmp/claude-0/t/b10_sack.png' });
  const lb = await p.$('#ui button.choice[data-a="loot"]'); if (lb) await lb.click();
  // grain quest exploit
  const gq = await p.evaluate(() => { const g = window.__game(), w = g.WORLD, P = w.player; const v = w.settlements.find(s=>s.kind==='village'); v.stock.grain = 2; P.quests.push({ id: 999, kind: 'grain', giver: v.id, target: v.id, amount: 8, reward: 100, days: 10, text: 't', done: false }); window.__T.enterSettlement(v); window.__T.SET.tab='market'; window.__T.renderSettlement(); const before = P.goods.grain||0; const btn = [...document.querySelectorAll('#ui button')].find(b=>b.dataset.v==='grain:5'); btn && btn.click(); return { before, after: P.goods.grain||0, tip: document.getElementById('tip').hidden }; });
  console.log('grain', JSON.stringify(gq));
  console.log(errs.slice(0,8).join('\n'));
  await b.close();
})();
