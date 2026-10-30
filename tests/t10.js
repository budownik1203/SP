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
  await p.click('text=Szlachcic bez ziemi');
  for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.waitForTimeout(500);
  await p.evaluate(() => { const w = window.__game().WORLD; w.player.companions.push(makeC('kasia')); }).catch(()=>{});
  for (const k of ['c','i','p','f','k']) { await p.keyboard.press('Key'+k.toUpperCase()); await p.waitForTimeout(300); await p.screenshot({ path: 'win_'+k+'.png' }); await p.keyboard.press('Key'+k.toUpperCase()); await p.waitForTimeout(150); }
  // miejsce i lord
  await p.evaluate(() => { const T = window.__T; const w = window.__game().WORLD; T.enterPlace(w.places.find(x=>x.kind==='shrine')); });
  await p.waitForTimeout(300); await p.screenshot({ path: 'shrine.png' });
  await p.keyboard.press('Escape');
  await p.evaluate(() => { const T = window.__T; const w = window.__game().WORLD; const l = w.parties.find(x=>x.kind==='lord' && x.faction===1); T.meetParty(l, false); });
  await p.waitForTimeout(300); await p.screenshot({ path: 'lordmeet.png' });
  await p.click('text=Rozmawiaj'); await p.waitForTimeout(300); await p.screenshot({ path: 'lordtalk.png' });
  console.log(errs.join('\n'));
  await b.close();
})();
