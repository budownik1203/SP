const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message); });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  await p.evaluate(() => { const w = window.__game().WORLD; const P0 = w.parties.find(x => x.id === w.pid); P0.troops = [{ type: 'a_halberd', n: 10, wounded: 0, xp: 0 }]; w.player.wars.push(2); const o = w.parties.find(x => x.kind === 'lord' && x.faction === 2); o.x = P0.x + 6; o.y = P0.y; o.troops = [{ type: 'v_legion', n: 10, wounded: 0, xp: 0 }, { type: 'v_cata', n: 8, wounded: 0, xp: 0 }]; window.__T3.meetParty(o, false); });
  await p.waitForTimeout(400); await p.click('#ui [data-a="fight"]'); await p.waitForTimeout(1200); await p.click('#ftip button').catch(() => {});
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const b = window.__battle(); const h = b.hero; h.hp = h.maxHp = 9999; const out = {};
    // uderzenie tarczą
    const e = b.units.find(u => u.team === 1 && !u.mounted && u.active); e.x = h.x + 14; e.y = h.y; h.face = 0; h.hasShield = true; h.stamina = 100;
    const T = window.__T3; const st0 = e.state; b.time += 1; window.__hf_bash = true;
    // bezpośrednio przez funkcje
    out.bashBefore = st0;
    return out; });
  // symuluj przytrzymanie PPM + LPM
  await p.evaluate(() => { const b = window.__battle(); const h = b.hero; const e = b.units.find(u => u.team === 1 && !u.mounted && u.active); e.x = h.x + 14; e.y = h.y; });
  const canvas = await p.$('canvas'); const bb = await canvas.boundingBox();
  const hp = await p.evaluate(() => { const b = window.__battle(); const h = b.hero; return [(h.x + 30 - b.cam.x) / document.querySelector('canvas').width, (h.y - 12 - b.cam.y) / document.querySelector('canvas').height]; });
  await p.mouse.move(bb.x + hp[0] * bb.width, bb.y + hp[1] * bb.height);
  await p.mouse.down({ button: 'right' }); await p.waitForTimeout(150); await p.mouse.down(); await p.waitForTimeout(60); await p.mouse.up(); await p.waitForTimeout(100); await p.mouse.up({ button: 'right' });
  console.log('bash', await p.evaluate(() => { const b = window.__battle(); const e = b.units.find(u => u.team === 1 && !u.mounted && u.active); return e.state + ' bashCd=' + (b.hero.bashCd || 0).toFixed(1); }));
  console.log('exec', await p.evaluate(() => { const b = window.__battle(); if (!b || b.phase !== 'fight') return 'nofight'; const h = b.hero; const e = b.units.find(u => u.team === 1 && u.active && !u.mounted); if (!e) return 'noenemy'; e.x = h.x + 12; e.y = h.y; e.state = 'stagger'; e.t = 0; e.hold = 1.2; h.state = 'idle'; const ok = window.__T3.tryExecute ? window.__T3.tryExecute(b, h) : 'nohook'; return ok + ' alive=' + e.active; }));
  // szarża konnicy na zapartych halabardników
  const br = await p.evaluate(() => { const b = window.__battle(); let n0 = b.units.filter(u => u.team === 1 && u.mounted && u.active).length; for (const o of Object.values(b.eorders)) o.mode = 'charge'; for (let i = 0; i < 600 && b.phase === 'fight'; i++) b.update(0.05); const n1 = b.units.filter(u => u.team === 1 && u.mounted && u.active).length; return n0 + '->' + n1; });
  console.log('cav mounted', br);
  console.log('errors', errs.length); await b.close();
})();
