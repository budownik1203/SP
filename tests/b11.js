const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300); await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/claude-0/t/b11_map.png' });
  // night + winter + fog + travel route
  await p.evaluate(() => { const g = window.__game(), w = g.WORLD; w.hour = 20.5; w.day = 95; w.fog = true; w.player.skills.tracking = 3; const pp = w.parties.find(x=>x.kind==='player'); const s = w.settlements.find(s=>s.kind==='castle'); window.__game().G.camping = false; });
  await p.evaluate(() => { const g = window.__game(), w = g.WORLD, pp = w.parties.find(x=>x.kind==='player'); for (let i=0;i<30;i++) window.__T.worldTick(w, 1); });
  await p.evaluate(() => { const ui = document.querySelector('#ui .win'); if (ui) window.__game(); }); await p.mouse.click(900, 300); await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/claude-0/t/b11_night.png' });
  // zoom out smoothly
  for (let i=0;i<4;i++) { await p.mouse.wheel(0, 100); await p.waitForTimeout(60); }
  await p.waitForTimeout(600);
  console.log('W', await p.evaluate(() => document.getElementById('game').width));
  await p.screenshot({ path: '/tmp/claude-0/t/b11_zoom.png' });
  await p.keyboard.press('Tab'); await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/claude-0/t/b11_overview.png' });
  await p.mouse.click(640, 360); await p.waitForTimeout(300);
  console.log('ov', await p.evaluate(() => window.__game().G.view.overview));
  // camp
  await p.evaluate(() => { const g = window.__game(); g.G.camping = true; g.WORLD.parties.find(x=>x.kind==='player').state = 'camp'; g.WORLD.hour = 12; g.WORLD.day = 40; });
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/claude-0/t/b11_camp.png' });
  const cm = await p.$('button[data-sp="cm:train"]'); console.log('campbtn', !!cm); if (cm) await cm.click();
  // travel event forced
  await p.evaluate(() => { const g = window.__game(); g.G.camping = false; g.WORLD.evCd = 0; });
  const ev = await p.evaluate(() => { for (let i=0;i<400;i++) { window.__T.maybeTravelEvent(1); if (document.querySelector('#ui .dialog-scr')) return document.querySelector('#ui h1').textContent; } return 'none'; });
  console.log('event', ev);
  await p.screenshot({ path: '/tmp/claude-0/t/b11_event.png' });
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  console.log('after event', await p.evaluate(() => !!document.querySelector('#ui .dialog-scr')));
  // bandit dialog
  await p.evaluate(() => { const w = window.__game().WORLD; const bnd = w.parties.find(x=>x.kind==='bandit'); window.__meet(bnd); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/claude-0/t/b11_bandit.png' });
  console.log('choices', await p.evaluate(() => [...document.querySelectorAll('#ui button.choice')].map(b=>b.textContent.slice(0,30)).join(' | ')));
  const it = await p.$('#ui button.choice[data-a="intim"]'); if (it) { await it.click(); await p.waitForTimeout(1200); }
  await p.keyboard.press('Escape');
  // lord talk
  await p.evaluate(() => { const w = window.__game().WORLD; const lp = w.parties.find(x=>x.kind==='lord'); window.__meet(lp); });
  await p.waitForTimeout(300);
  const tk = await p.$('#ui button.choice[data-a="talk"]'); if (tk) { await tk.click(); await p.waitForTimeout(300); }
  const wr = await p.$('#ui button.choice[data-a="war"]'); if (wr) { await wr.click(); await p.waitForTimeout(1200); }
  await p.screenshot({ path: '/tmp/claude-0/t/b11_lord.png' });
  console.log(errs.slice(0,6).join('\n'));
  await b.close();
})();
