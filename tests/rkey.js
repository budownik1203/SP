const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  await p.evaluate(() => { const w = window.__game().WORLD; const e = w.parties.find(x => x.kind === 'bandit') || w.parties.find(x=>x.kind==='lord'); window.__T.launchBattle({ kind: 'field', enemies: [e], allies: [], title: 'T' }, { terrain: 'plains', deploy: false }); });
  await p.waitForTimeout(800); await p.click('#ftip button').catch(() => {}); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  const st = async () => p.evaluate(() => { const b = window.__battle(); return [b.thrustMode, b.hero.state, b.hero.dir, document.getElementById('dir')?.textContent]; });
  await p.mouse.move(800, 300); await p.keyboard.press('KeyR'); await p.waitForTimeout(100); console.log('after R', await st());
  await p.mouse.down(); await p.waitForTimeout(150); console.log('swing', await st()); await p.mouse.up(); await p.waitForTimeout(800);
  await p.keyboard.press('KeyR'); await p.waitForTimeout(100); console.log('after R2', await st());
  await p.mouse.down(); await p.waitForTimeout(150); console.log('swing2', await st()); await p.mouse.up();
  await b.close();
})();
