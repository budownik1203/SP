const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForSelector('button[data-a=quick]'); await p.click('button[data-a=quick]');
  await p.click('text=Do boju'); await p.waitForTimeout(500);
  const shots = [['L','windup',0.35],['L','strike',0.5],['O','windup',0.4],['O','strike',0.6],['T','windup',0.4],['T','strike',0.5]];
  for (const [face, fname] of [[Math.PI/2,'down'],[0,'right'],[Math.PI,'left'],[-Math.PI/2,'up']]) {
    await p.evaluate(([face, shots]) => {
      const B = window.__battle(); B.paused = true;
      const keys = ['a_maa','a_champion','a_halberd','a_archer','v_xbow','u_wight'];
      const cx = B.cam.x + 30, cy = B.cam.y + 40;
      // usuń wszystkich poza naszymi wybranymi
      B.units = B.units.slice(0, 1); B.hero = B.units[0]; B.hero.x = -999;
      const U2 = B.units[0].constructor;
      keys.forEach((k, row) => shots.forEach(([dir, st, tk], col) => {
        const u = new U2(k, 0, 1, cx + col * 36, cy + row * 30, 1);
        u.face = face; u.wantFace = face; u.state = st; u.dir = dir; u.t = u.w.windup * tk * (st==='strike'?0.4:1);
        if (k === 'a_archer' || k === 'v_xbow') { u.state = 'idle'; u.target = { x: u.x + 200, y: u.y, active: true }; u.reload = 0.2 + col * 0.15; }
        B.units.push(u);
      }));
      B.phase = 'deploy';
    }, [face, shots]);
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const c = document.getElementById('game').getBoundingClientRect(); return { x: c.left, y: c.top, w: c.width, h: c.height }; });
    await p.screenshot({ path: `pose_${fname}.png`, clip: { x: r.x, y: r.y, width: r.w * 0.55, height: r.h * 0.85 } });
  }
  console.log(errs.join('\n'));
  await b.close();
})();
