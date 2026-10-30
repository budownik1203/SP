const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.evaluate(() => { const T = window.__T; Object.assign(T.QB, { terrain: 'plains', mounted: false, size: 50 }); T.startQuickBattle(); });
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const B = window.__battle(), h = B.hero, I = B.input, out = {};
    B.paused = true;
    for (const [name, gx, gy] of [['right', 0, 30], ['left', 0, -30], ['away', 30, 0], ['toward', -30, 0]]) {
      h.face = 0; I.motion.length = 0; I.motion.push({ x: gx, y: gy, t: performance.now() });
      B.updateHero(0.016); out[name] = B.loadDir;
    }
    // parry -> counter
    const U = h.constructor; const e = new U('a_maa', 1, 1, h.x + 14, h.y, 1); B.units.push(e);
    e.face = Math.PI; h.face = 0; h.blocking = true; h.blockStart = B.time; e.dir = 'L'; e.weaponKey = e.weaponKey;
    B.resolveHit(e, h); out.counter = h.counterT > 0;
    // kick vs shield
    h.blocking = false; h.state = 'kick'; h.hitDone = false; e.hasShield = true; e.state = 'idle';
    B.kickHit(h); out.shieldOff = e.shieldOffT > 0;
    // shield wear
    e.state='idle'; out.broke = B.shieldWear(e, 9999); out.has = e.hasShield;
    return out;
  });
  console.log(JSON.stringify(r));
  console.log(errs.slice(0,4).join('\n'));
  await b.close();
})();
