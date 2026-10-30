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
  await p.evaluate((id) => { const g = window.__game(); window.__T.arenaFight(g.WORLD.settlements[id], 'joust', false, 0, 0); }, s0);
  await p.waitForTimeout(300);
  console.log(await p.evaluate(() => { const B = window.__battle(); const e = B.units.find(u=>u.team===1); const log=[]; const oa=B.updateAI.bind(B), om=B.mountedAI.bind(B), orr=B.ride.bind(B); B.updateAI=(u,dt)=>{ if(u===e) log.push('ai'); return oa(u,dt); }; B.mountedAI=(u,t,en,dt)=>{ if(u===e) log.push('m:'+en+':'+u.maxRide); return om(u,t,en,dt); }; B.ride=(u,x,y,w,dt)=>{ if(u===e) log.push('r:'+Math.round(w)+':'+Math.round(x)+','+Math.round(y)); return orr(u,x,y,w,dt); }; B.paused=false; for(let i=0;i<5;i++) B.update(0.05); return log.join(' '); }));
  for (let k=0;k<6;k++) { const r = await p.evaluate(() => { const B = window.__battle(); B.paused=false; for (let i=0;i<200 && B.phase!=='end';i++) B.update(0.05); const e = B.units.find(u=>u.team===1); const h=B.hero; return JSON.stringify({t:Math.round(B.time), ph:B.phase, h:[Math.round(h.hp), Math.round(h.x), Math.round(h.y), h.mounted, h.state], e:[e.key, Math.round(e.hp), Math.round(e.x), Math.round(e.y), e.mounted, e.state, e.couched, Math.round(e.rspeed||0), e.weaponKey, e.squad, !!e.target, JSON.stringify(B.eorders[e.squad]||null), JSON.stringify(e.wheelTo), e.heading, e.moving, e.vx, e.vy]}); }); console.log(r); }
  await p.screenshot({ path: '/tmp/claude-0/t/b8_joust2.png' });
  console.log(errs.slice(0,5).join('\n'));
  await b.close();
})();
