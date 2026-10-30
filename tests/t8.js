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
  await p.click('text=Mag renegat');
  for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.waitForTimeout(500);
  // arena
  await p.evaluate(() => { const T = window.__T; const w = window.__game().WORLD; T.arenaFight(w.settlements[0], true, false, 0, 0); });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: 'arena.png' });
  await p.evaluate(() => { const b = window.__battle(); for (let i = 0; i < 3000 && b.phase==='fight'; i++) b.update(0.05); });
  await p.waitForTimeout(2800);
  await p.screenshot({ path: 'arena_end.png' });
  await p.click('text=Dalej').catch(()=>console.log('no dalej'));
  await p.waitForTimeout(400);
  // nocna bitwa z deszczem i umiejętnościami przeciw nieumarłym
  await p.evaluate(() => { const T = window.__T; const g = window.__game(); const w = g.WORLD; const P = w.player; P.learned.push('summon','smite','whirl'); P.abilities=['fireball','summon','curse']; w.rain = true; w.hour = 23; const pp = w.parties.find(x=>x.kind==='player'); pp.troops.push({type:'a_maa',n:20,wounded:0,xp:0}); const u = w.parties.find(x=>x.kind==='undead'); T.launchBattle({kind:'field', enemies:[u], allies:[], title:u.name}); });
  await p.waitForTimeout(800);
  await p.evaluate(() => { const b = window.__battle(); for (let i = 0; i < 300; i++) b.update(0.05); const T = window.__T; const e = b.units.find(u=>u.team===1&&u.active); b.input.mx = e.x - b.cam.x; b.input.my = e.y - b.cam.y; T.castHeroAbility(b, 0); T.castHeroAbility(b, 1); for (let i = 0; i < 8; i++) b.update(0.05); });
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'night.png' });
  console.log(await p.evaluate(() => { const b = window.__battle(); return JSON.stringify({ wolves: b.units.filter(u=>u.key==='x_wolf'||u.key==='x_spirit').length, mana: b.heroCfg.mana, corr: b.heroCfg.corruption, log: b.log.map(l=>l.text) }); }));
  console.log(errs.slice(0, 10).join('\n'));
  await b.close();
})();
