const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message); });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  // wrogi lord blisko
  const lid = await p.evaluate(() => { const w = window.__game().WORLD; const P0 = w.parties.find(x => x.id === w.pid);
    P0.troops = [{ type: 'a_knight', n: 20, wounded: 0, xp: 0 }, { type: 'a_archer', n: 20, wounded: 0, xp: 0 }, { type: 'a_sergeant', n: 30, wounded: 0, xp: 0 }];
    const o = w.parties.find(x => x.kind === 'lord' && x.faction === 2); o.x = P0.x + 6; o.y = P0.y; w.player.hp = 999; window.__game().G.encounterCooldown = 0;
    w.player.wars.push(2); window.__T3.meetParty(o, true); return o.id; });
  await p.waitForTimeout(500);
  const ch = await p.evaluate(() => [...document.querySelectorAll('#ui .choice')].map(x => x.textContent.trim()));
  console.log('choices', ch.join(' | '));
  await p.click('#ui [data-a="duel"]'); await p.waitForTimeout(800);
  console.log('duel', await p.evaluate(() => { const b = window.__battle(); return JSON.stringify({ t: b.cfg.title, n: b.units.length, foe: b.units.find(u => u.team === 1)?.name }); }));
  await p.screenshot({ path: '/tmp/claude-0/t/b23_duel.png' });
  await p.evaluate(() => { const b = window.__battle(); b.hero.hp = b.hero.maxHp = 99999; for (let i = 0; i < 6000 && b.phase === 'fight'; i++) { const f = b.units.find(u => u.team === 1 && u.active); if (f && i % 20 === 0) b.damage(f, 30, b.hero, false, 'cut', true); b.update(0.05); } });
  await p.waitForTimeout(2500); await p.click('#ftip button').catch(() => {});
  console.log('main', await p.evaluate(() => { const b = window.__battle(); if (!b) return 'none ' + window.__game().G.state; const m = b.units.filter(u => u.team === 1 && !u.hero); return JSON.stringify({ ph: b.phase, def: b.cfg.defensive, em: Math.round(m.reduce((s, u) => s + u.morale, 0) / m.length), traps: window.__T3.trapsAllowed(b) }); }));
  // pułapki w rozstawieniu
  console.log('traps', await p.evaluate(() => { const b = window.__battle(); if (b.phase !== 'deploy') return 'nodeploy'; for (let i = 0; i < 3; i++) window.__T3.placeTrap(b, 'stakes', b.mw * 0.35, b.mh / 2 - 100 + i * 80); window.__T3.placeTrap(b, 'ditch', b.mw * 0.3, b.mh / 2); return b.traps.length; }));
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  // pauza taktyczna
  await p.keyboard.press('KeyP'); await p.waitForTimeout(300);
  const t1 = await p.evaluate(() => window.__battle().time); await p.waitForTimeout(600); const t2 = await p.evaluate(() => window.__battle().time);
  console.log('pause', await p.evaluate(() => window.__battle().tacPause), t1 === t2);
  await p.keyboard.press('KeyY'); await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/claude-0/t/b23_pause.png' });
  await p.keyboard.press('KeyP'); await p.keyboard.press('KeyY'); await p.waitForTimeout(300);
  // zsiadanie + ogień
  console.log('dismount', await p.evaluate(() => { const b = window.__battle(); const sq = b.units.find(u => u.team === 0 && u.mounted && !u.hero).squad; window.__T3.orderDismount(b, [sq]); const a = b.squadUnits(sq).filter(u => u.mounted).length; window.__T3.orderDismount(b, [sq]); return a + '/' + b.squadUnits(sq).filter(u => u.mounted).length; }));
  await p.evaluate(() => { const b = window.__battle(); b.cfg.rain = false; window.__T3.igniteAt(b, b.mw / 2, b.mh / 2, 2); for (let i = 0; i < 200; i++) b.update(0.05); });
  console.log('fire', await p.evaluate(() => { const b = window.__battle(); return (b.flames || []).length + ' burnt ' + (b.burnt ? b.burnt.size : 0); }));
  await p.evaluate(() => { const b = window.__battle(); b.cam.x = b.mw / 2 - 300; b.cam.y = b.mh / 2 - 200; b.camFree = true; });
  await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/claude-0/t/b23_fire.png' });
  await p.evaluate(() => { const b = window.__battle(); b.hero.hp = b.hero.maxHp = 99999; for (const o of Object.values(b.orders || {})) if (o) o.mode = 'charge'; for (let i = 0; i < 9000 && b.phase === 'fight'; i++) b.update(0.05); });
  await p.waitForTimeout(3000);
  console.log('after', await p.evaluate(() => (document.querySelector('#ui h1')?.textContent || '') + ' | wq=' + !!document.querySelector('#ui .woundedq')));
  const hb = await p.evaluate(() => window.__game().WORLD.player.honor);
  await p.click('#ui [data-a="wKill"]').catch(e => console.log('no wKill'));
  await p.waitForTimeout(300);
  console.log('kill', hb, await p.evaluate(() => window.__game().WORLD.player.honor + ' pris ' + window.__game().WORLD.parties.find(x => x.id === window.__game().WORLD.pid).prisoners.length + ' wq=' + !!document.querySelector('#ui .woundedq')));
  await p.screenshot({ path: '/tmp/claude-0/t/b23_after.png' });
  console.log('errors', errs.length);
  await b.close();
})();
