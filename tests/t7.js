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
  await p.click('text=Kapłan wojownik');
  for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.waitForTimeout(500);
  // oblężenie
  await p.evaluate(() => { const T = window.__T; const g = window.__game(); const w = g.WORLD; const pp = w.parties.find(x=>x.kind==='player'); pp.troops.push({type:'a_maa',n:40,wounded:0,xp:0},{type:'a_archer',n:20,wounded:0,xp:0}); w.player.abLevels.smite = 2; const s = w.settlements.find(x=>x.faction===2&&x.kind==='castle'); T.launchBattle({kind:'siege', enemies:[], allies:[], settlement:s, enemyTroops:s.garrison, title:'Szturm na '+s.name}); });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'siege1.png' });
  await p.evaluate(() => { const b = window.__battle(); for (let i = 0; i < 900; i++) b.update(0.05); b.cam.x = b.map.wall.x0 - 240; b.cam.y = b.map.wall.gateY - 135; b.camFree = true; });
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'siege2.png' });
  const st = await p.evaluate(() => { const b = window.__battle(); return { t: b.time, gate: b.map.wall.gateHp, a0: b.units.filter(u=>u.team===0&&u.active).length, a1: b.units.filter(u=>u.team===1&&u.active).length, inside: b.units.filter(u=>u.team===0&&u.active&&u.x>b.map.wall.x0).length }; });
  console.log(JSON.stringify(st));
  await p.evaluate(() => { const b = window.__battle(); for (let i = 0; i < 4000 && b.phase==='fight'; i++) b.update(0.05); });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: 'siege3.png' });
  console.log(await p.evaluate(() => { const g = window.__game(); const r = g.G.battle ? g.G.battle.result : null; return JSON.stringify({ state: g.G.state, win: r && r.win, owners: g.WORLD.settlements.filter(s=>s.owner===-2).map(s=>s.name), status: g.WORLD.player.status }); }));
  console.log(errs.slice(0, 10).join('\n'));
  await b.close();
})();
