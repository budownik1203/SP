const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message); });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  await p.evaluate(() => window.__T.showCharacter()); await p.waitForTimeout(400); await p.click('#ftip button').catch(() => {});
  const tabs = await p.$$eval('#ui button', (bs) => bs.map(b => b.textContent).filter(t => /Kowalstwo/.test(t)));
  console.log('tabs', tabs);
  await p.click('#ui button:has-text("Kowalstwo")').catch(e => console.log('no tab'));
  await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/claude-0/t/b20_tree.png' });
  // legenda w bitwie
  const r = await p.evaluate(() => { const w = window.__game().WORLD; const P = w.player; P.items.push('l_widow'); P.equip.weapon = 'l_widow'; P.trophies = [{ id: 1, kind: 'banner', name: 'x', faction: 2, lord: 7, day: 1 }]; const e = w.parties.find(x => x.kind === 'bandit'); window.__T.launchBattle({ kind: 'field', enemies: [e], allies: [], title: 'T' }, { deploy: false }); const bt = window.__battle(); return { ls: bt.pk.lifeSteal, heal: bt.pk.heal, morale: bt.pk.moraleB }; });
  console.log('battle pk', JSON.stringify(r));
  console.log('errors', errs.length);
  await b.close();
})();
