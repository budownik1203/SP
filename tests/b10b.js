const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300); await p.waitForTimeout(500);
  const s0 = await p.evaluate(() => window.__game().WORLD.settlements.find(s=>s.kind==='town').id);
  await p.evaluate((id) => { const g = window.__game(); window.__T.arenaFight(g.WORLD.settlements[id], 'archery', false, 0, 0); }, s0);
  await p.waitForTimeout(200);
  const a = await p.evaluate(() => { const B = window.__battle(); const h = B.hero; for (let k = 0; k < 12; k++) { const t = B.units.find(u => u.key === 'x_dummy' && u.active); if (!t) break; const ty = t.y - 12; h.face = Math.atan2(ty - (h.y - 12), t.x - h.x); h.drawT = 1; B.fire(h, h.face, 260, 50, Math.hypot(t.x-h.x,ty-(h.y-12)), 'arrow'); h.ammo--; for (let i=0;i<40;i++) B.update(0.05); } return B.archery.score + '/' + B.archery.opp + ' ' + B.phase; });
  console.log('archery', a);
  await p.screenshot({ path: '/tmp/claude-0/t/b10_archery.png' });
  for (let k=0;k<30;k++){ const c = await p.evaluate(()=>document.querySelector('#ui .win')?.className||''); if (c.includes('after')) break; await p.waitForTimeout(200); }
  await p.click('#ui button:has-text("Dalej")').catch(()=>{}); await p.waitForTimeout(300);
  await p.evaluate(() => { const g = window.__game(); const w = g.WORLD; const s = w.settlements.find(s=>s.kind==='town'); window.__T.launchBattle({ kind: 'siege', enemies: [], allies: [], settlement: s, enemyTroops: s.garrison, title: 'Szturm' }, { engines: { ram: true } }); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const B = window.__battle(); B.startFight(); for (const u of B.units) if (u.team===1) B.kill(u, B.hero); for (let i=0;i<200 && B.phase!=='end';i++) B.update(0.05); });
  for (let k=0;k<30;k++){ const c = await p.evaluate(()=>document.querySelector('#ui .win')?.className||''); if (c.includes('after')) break; await p.waitForTimeout(200); }
  await p.click('#ui button:has-text("Dalej")').catch(()=>{}); await p.waitForTimeout(400);
  console.log('sack', await p.evaluate(() => document.querySelector('#ui .win h1')?.textContent));
  await p.screenshot({ path: '/tmp/claude-0/t/b10_sack.png' });
  await p.keyboard.press('Digit2'); await p.waitForTimeout(300);
  console.log('gold', await p.evaluate(() => window.__game().WORLD.player.gold));
  console.log(errs.slice(0,5).join('\n'));
  await b.close();
})();
