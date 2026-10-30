const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300); await p.waitForTimeout(500);
  await p.evaluate(() => { const w = window.__game().WORLD; const pp = w.parties.find(x=>x.kind==='player'); pp.troops.push({type:'a_maa',n:25,wounded:0,xp:900},{type:'a_archer',n:15,wounded:0,xp:0}); });
  await p.evaluate(() => { const g = window.__game(); const w = g.WORLD; const s = w.settlements.find(s=>s.kind==='castle'); window.__T.launchBattle({ kind: 'siege', enemies: [], allies: [], settlement: s, enemyTroops: s.garrison, title: 'Szturm' }, { engines: { ram: true, tower: true, trebuchet: true } }); });
  await p.waitForTimeout(300);
  for (let k = 0; k < 9; k++) {
    const r = await p.evaluate(() => { const B = window.__battle(); B.paused=false; for (let i=0;i<1000 && B.phase!=='end';i++) B.update(0.05); const W2 = B.map.wall; return JSON.stringify({ t: Math.round(B.time), ph: B.phase, gate: Math.round(W2.gateHp), broken: W2.broken, wall: [W2.x0, W2.x1, W2.gateY], eng: B.engines.map(e => ({k:e.kind, x:Math.round(e.x), y: Math.round(e.y), done: e.done, hp: e.hp})), act: B.units.filter(u=>u.active).map(u => [u.team, u.key, Math.round(u.x), Math.round(u.y), u.state, u.fleeing?1:0, u.onWall?1:0, u.squad]) }); });
    console.log(r.slice(0, 1600));
    if (r.includes('"ph":"end"')) break;
  }
  await p.screenshot({ path: '/tmp/claude-0/t/b8_siege2.png' });
  console.log(errs.slice(0,5).join('\n'));
  await b.close();
})();
