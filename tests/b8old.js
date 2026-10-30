const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file:///tmp/claude-0/b29wt/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300); await p.waitForTimeout(500);
  await p.evaluate(() => { const w = window.__game().WORLD; const pp = w.parties.find(x=>x.kind==='player'); pp.troops.push({type:'a_maa',n:25,wounded:0,xp:900},{type:'a_archer',n:15,wounded:0,xp:0}); w.player.gold = 5000; });
  const sim = async (kill) => p.evaluate((kill) => { const B = window.__battle(); if (B.phase === 'deploy') B.startFight(); B.paused = false; let i = 0; for (; i < 8000 && B.phase !== 'end'; i++) { if (kill && i % 20 === 0 && i > 40) { const e = B.units.find(u => u.team === 1 && u.active); if (e) B.kill(e, B.hero); } if (B.hero) B.hero.hp = B.hero.maxHp; B.update(0.05); } return { phase: B.phase, i, t: Math.round(B.time||0), units: B.units.filter(u=>u.active).length, eng: B.engines ? B.engines.map(e=>e.kind+':'+Math.round(e.x)) : null }; }, kill);
  const waitAfter = async () => { for (let k = 0; k < 40; k++) { const c = await p.evaluate(() => { const s = document.querySelector('#ui .win'); return s ? s.className : ''; }); if (c.includes('after-scr')) return c; await p.waitForTimeout(150); } return 'NOAFTER'; };
  const s0 = await p.evaluate(() => window.__game().WORLD.settlements.find(s=>s.kind==='town').id);
  for (const mode of ['duel','team3','team5','waves','joust','death']) {
    await p.evaluate(([id, mode]) => { const g = window.__game(); window.__T.arenaFight(g.WORLD.settlements[id], mode, false, 0, 0); }, [s0, mode]);
    await p.waitForTimeout(200);
    const info = await p.evaluate(() => { const B = window.__battle(); return { foes: B.units.filter(u=>u.team===1).length + B.reserves[1].length, ours: B.units.filter(u=>u.team===0).length, horse: B.hero.mounted, w: B.hero.weaponKey }; });
    if (mode === 'joust') await p.screenshot({ path: '/tmp/claude-0/t/b8_joust.png' });
    const r = await sim(mode !== 'duel');
    const a = await waitAfter();
    console.log(mode, JSON.stringify(info), JSON.stringify(r), a);
    if (mode === 'waves') await p.screenshot({ path: '/tmp/claude-0/t/b8_after.png' });
    await p.click('#ui button:has-text("Dalej")').catch(()=>{}); await p.waitForTimeout(200);
  }
  // turniej
  await p.evaluate((id) => { const g = window.__game(); window.__T.startTourney(g.WORLD.settlements[id], 0); }, s0);
  await p.waitForTimeout(300); await p.screenshot({ path: '/tmp/claude-0/t/b8_bracket.png' });
  for (let r = 0; r < 3; r++) {
    await p.click('#ui button:has-text("Do walki!")'); await p.waitForTimeout(200);
    const res = await sim(true); const a = await waitAfter(); console.log('tour', r, JSON.stringify(res), a);
    await p.click('#ui button:has-text("Dalej")'); await p.waitForTimeout(300);
    if (r === 1) await p.screenshot({ path: '/tmp/claude-0/t/b8_bracket2.png' });
  }
  console.log('gold', await p.evaluate(() => window.__game().WORLD.player.gold));
  // szturm z machinami
  await p.keyboard.press('Escape').catch(()=>{});
  await p.evaluate(() => { const g = window.__game(); const w = g.WORLD; const s = w.settlements.find(s=>s.kind==='castle'); window.__T.launchBattle({ kind: 'siege', enemies: [], allies: [], settlement: s, enemyTroops: s.garrison, title: 'Szturm' }, { engines: { ram: true, tower: true, trebuchet: true } }); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const B = window.__battle(); if (B.phase === 'deploy') B.startFight(); B.paused=false; for (let i=0;i<500;i++) B.update(0.05); });
  await p.keyboard.down('q'); await p.keyboard.up('q'); await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/claude-0/t/b8_siege_q.png' });
  await p.keyboard.press('q'); await p.waitForTimeout(200);
  await p.screenshot({ path: '/tmp/claude-0/t/b8_siege.png' });
  console.log('siege', JSON.stringify(await sim(false)), await waitAfter());
  await p.screenshot({ path: '/tmp/claude-0/t/b8_siege_after.png' });
  await p.click('#ui button:has-text("Dalej")').catch(()=>{}); await p.waitForTimeout(300);
  // obrona
  await p.evaluate(() => { const g = window.__game(); const w = g.WORLD; const s = w.settlements.find(s=>s.kind==='castle'); const bes = w.parties.filter(x=>x.kind==='lord').slice(0,2); window.__T.launchBattle({ kind: 'siege', defend: true, enemies: bes, allies: [], garrisonAlly: s.garrison, settlement: s, title: 'Obrona' }, { siegeDefender: 0, engines: { ram: true, tower: true } }); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const B = window.__battle(); B.paused=false; for (let i=0;i<400;i++) B.update(0.05); });
  await p.screenshot({ path: '/tmp/claude-0/t/b8_defend.png' });
  console.log('defend', JSON.stringify(await sim(false)), await waitAfter());
  await p.click('#ui button:has-text("Dalej")').catch(()=>{}); await p.waitForTimeout(300);
  // autoresolve
  const ar = await p.evaluate(() => { const g = window.__game(); const w = g.WORLD; const e = w.parties.find(x=>x.kind==='bandit'); if (!e) return 'nobandit'; window.__T.autoResolve({ kind: 'field', enemies: [e], allies: [], title: 'Auto' }); const s = document.querySelector('#ui .win'); return s ? s.className : ''; });
  console.log('auto', ar);
  console.log(errs.slice(0, 8).join('\n'));
  await b.close();
})();
