const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message); });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  const tr = await p.evaluate(() => { const w = window.__game().WORLD; const P0 = w.parties.find(x => x.id === w.pid); P0.troops = [{ type: 'a_maa', n: 20, wounded: 0, xp: 0 }]; w.player.wars.push(2); const o = w.parties.find(x => x.kind === 'lord' && x.faction === 2); const L = w.lords.find(l => l.id === o.lord); L.personality = 'honorowy'; o.x = P0.x + 6; o.y = P0.y; window.__T3.meetParty(o, false); return L.personality; });
  await p.waitForTimeout(400); await p.click('#ui [data-a="fight"]'); await p.waitForTimeout(1200); await p.click('#ftip button').catch(() => {});
  console.log('setup', await p.evaluate(() => { const b = window.__battle(); const c = b.commanders[0]; return JSON.stringify({ trait: b.cfg.lordTrait, big: !!c?.big, guards: b.units.filter(u => u.guard).length, bearer: b.units.filter(u => u.guard && u.bearer).length, mode: b.eorders[5]?.mode }); }));
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await p.evaluate(() => { const b = window.__battle(); const h = b.hero; h.hp = h.maxHp = 99999; const c = b.commanders[0]; h.x = c.x - 100; h.y = c.y; for (let i = 0; i < 60; i++) b.update(0.05); b.camFree = true; b.cam.x = c.x - 300; b.cam.y = c.y - 200; });
  await p.waitForTimeout(400);
  console.log('duel', await p.evaluate(() => { const b = window.__battle(); return JSON.stringify({ duelT: Math.round((b.duelT || 0) - b.time), tgt: b.commanders[0].target === b.hero, guardsOnHero: b.units.filter(u => u.guard && u.target === b.hero).length }); }));
  await p.screenshot({ path: '/tmp/claude-0/t/b32.png' });
  await p.evaluate(() => { const b = window.__battle(); for (const o of Object.values(b.orders)) o.mode = 'charge'; for (let i = 0; i < 6000 && b.phase === 'fight'; i++) b.update(0.05); });
  console.log('end', await p.evaluate(() => window.__battle()?.phase));
  console.log('errors', errs.length); await b.close();
})();
