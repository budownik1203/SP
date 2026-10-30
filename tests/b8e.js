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
  await p.evaluate(() => { const g = window.__game(); const w = g.WORLD; const s = w.settlements.find(s=>s.kind==='castle'); const bes = w.parties.filter(x=>x.kind==='lord').slice(0,2); window.__T.launchBattle({ kind: 'siege', defend: true, enemies: bes, allies: [], garrisonAlly: s.garrison, settlement: s, title: 'Obrona' }, { siegeDefender: 0, engines: { ram: true, tower: true } }); });
  await p.waitForTimeout(300);
  for (let k = 0; k < 12; k++) {
    const r = await p.evaluate(() => { const B = window.__battle(); B.paused=false; for (let i=0;i<100 && B.phase!=='end';i++) B.update(0.05); const c = (t, f) => B.units.filter(u => u.team === t && u.active && f(u)).length; const W2=B.map.wall; return JSON.stringify({ t: Math.round(B.time), ph: B.phase, win: B.result?.win, gate: Math.round(W2.gateHp), us: c(0, u=>true), usIn: c(0, u => u.x > W2.x0), them: c(1, u=>true), themFlee: c(1, u=>u.fleeing), themIn: c(1, u=>u.x > W2.x0), res: [B.reserves[0].length, B.reserves[1].length], hx: Math.round(B.hero.x), dead0: B.units.filter(u=>u.team===0&&u.state==='dead').length, fled0: B.units.filter(u=>u.team===0&&u.state==='fled').length, flee0: c(0,u=>u.fleeing), mor0: Math.round(B.units.filter(u=>u.team===0&&u.active).reduce((s,u)=>s+u.morale,0)/Math.max(1,c(0,u=>true))), dead1: B.units.filter(u=>u.team===1&&u.state==='dead').length, mor: Math.round(B.units.filter(u=>u.team===1&&u.active).reduce((s,u)=>s+u.morale,0)/Math.max(1,c(1,u=>true))) }); });
    console.log(r); if (k===0) console.log(await p.evaluate(() => { const B = window.__battle(); const cnt = (t) => { const m = {}; for (const u of B.units) if (u.team===t) m[u.key]=(m[u.key]||0)+1; return JSON.stringify(m); }; return cnt(0) + ' VS ' + cnt(1); })); if (r.includes('"end"')) break;
  }
  console.log(errs.slice(0,5).join('\n'));
  await b.close();
})();
