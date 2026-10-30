const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message); });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  await p.evaluate(() => { const w = window.__game().WORLD; const P0 = w.parties.find(x => x.id === w.pid); P0.troops = [{ type: 'a_maa', n: 6, wounded: 0, xp: 0 }]; w.player.wars.push(2); const o = w.parties.find(x => x.kind === 'lord' && x.faction === 2); o.x = P0.x + 6; o.y = P0.y; o.troops = [{ type: 'v_legion', n: 12, wounded: 0, xp: 0 }]; window.__T3.meetParty(o, false); });
  await p.waitForTimeout(400); await p.click('#ui [data-a="fight"]'); await p.waitForTimeout(1200); await p.click('#ftip button').catch(() => {});
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  // postaw wroga przed bohaterem
  const pos = await p.evaluate(() => { const b = window.__battle(); const h = b.hero; h.hp = h.maxHp = 9999; const e = b.units.find(u => u.team === 1 && u.active && !u.commander); for (const u of b.units) if (u.team === 1 && u !== e) { u.x = h.x + 400; } e.x = h.x + 18; e.y = h.y; e.vx = e.vy = 0; b.camFree = false; return { sx: e.x - b.cam.x, sy: e.y - 10 - b.cam.y, W: window.innerWidth }; });
  const canvas = await p.$('canvas'); const bb = await canvas.boundingBox();
  const cw = await p.evaluate(() => [document.querySelector('canvas').width, document.querySelector('canvas').height]);
  const mx = bb.x + pos.sx / cw[0] * bb.width, my = bb.y + pos.sy / cw[1] * bb.height;
  await p.mouse.move(mx, my);
  const log = [];
  for (let i = 0; i < 9; i++) { await p.mouse.down(); await p.waitForTimeout(40); await p.mouse.up(); await p.waitForTimeout(170); log.push(await p.evaluate(() => { const h = window.__battle().hero; return h.state + ':' + h.dir + ':' + (h.comboI || 0); })); }
  console.log(log.join(' '));
  console.log('hud', await p.evaluate(() => document.getElementById('dir')?.textContent));
  await p.keyboard.press('KeyR'); await p.waitForTimeout(100);
  console.log('hudR', await p.evaluate(() => document.getElementById('dir')?.textContent));
  await p.screenshot({ path: '/tmp/claude-0/t/b29.png' });
  console.log('enemyHp', await p.evaluate(() => { const b = window.__battle(); return b.units.filter(u => u.team === 1 && !u.active).length; }));
  console.log('errors', errs.length); await b.close();
})();
