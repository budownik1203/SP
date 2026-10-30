const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  for (const [terrain, fog, rain, mounted] of [['village',false,false,true],['bridge',true,false,false],['ravine',false,true,false],['ruins',false,false,false],['forest',true,false,false]]) {
    await p.evaluate(([terrain, fog, rain, mounted]) => { const T = window.__T; Object.assign(T.QB, { terrain, fog, rain, mounted, size: 60 }); T.startQuickBattle(); }, [terrain, fog, rain, mounted]);
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const B = window.__battle(); B.paused=false; for (const k of Object.keys(B.orders)) B.orders[k].mode='charge'; for (let i=0;i<120;i++) B.update(0.05); return 1; });
    await p.screenshot({ path: `/tmp/claude-0/t/b8_qb_${terrain}.png` });
    const e = await p.evaluate(() => { const B = window.__battle(); for (let i=0;i<9000 && B.phase!=='end';i++) B.update(0.05); return JSON.stringify({ph:B.phase, t:Math.round(B.time), win:B.result?.win}); });
    console.log(terrain, e);
    await p.waitForTimeout(2800);
    await p.click('#ui button:has-text("Menu")').catch(()=>{}); await p.waitForTimeout(300);
  }
  console.log(errs.slice(0,5).join('\n'));
  await b.close();
})();
