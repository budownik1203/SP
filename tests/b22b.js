const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message); });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  for (const mode of ['streets', 'mine', 'sally', 'capit']) {
    await p.evaluate((mode) => { const w = window.__game().WORLD; const P0 = w.parties.find(x => x.id === w.pid);
      P0.troops = [{ type: 'a_knight', n: 30, wounded: 0, xp: 0 }, { type: 'a_sergeant', n: 40, wounded: 0, xp: 0 }];
      w.player.liege = 1; w.player.status = 'najemnik'; w.player.contractDays = 30;
      const s = w.settlements.find(x => x.kind === 'town' && x.faction === 2 && x.owner !== -2); s.garrison = [{ type: 'v_levy', n: 20, wounded: 0, xp: 0 }]; s.siegeBy = [P0.id]; P0.siege = s.id; s.siegeDays = 30; P0.x = s.cx*8+4; P0.y = s.cy*8+4;
      window.__S = s;
      if (mode === 'streets') window.__T2.launchStreets(s); if (mode === 'mine') window.__T2.mineAssault(s); if (mode === 'sally') window.__T2.sallyAgainstPlayer(s); if (mode === 'capit') window.__T2.showCapitulation(s); }, mode);
    await p.waitForTimeout(1200); await p.click('#ftip button').catch(() => {});
    const st = await p.evaluate(() => { const b = window.__battle(); const g = window.__game().G; return g.state === 'battle' ? b.cfg.terrain + ' night=' + b.cfg.night + ' foes=' + b.units.filter(u => u.team === 1).length : 'scr:' + document.querySelector('#ui h1')?.textContent; });
    console.log(mode, st);
    await p.screenshot({ path: `/tmp/claude-0/t/b22_${mode}.png` });
    if (st.startsWith('scr')) { await p.click('#ui button[data-a="ok"]').catch(() => {}); await p.waitForTimeout(500); console.log(' ->', await p.evaluate(() => document.querySelector('#ui h1')?.textContent)); await p.keyboard.press('Escape'); continue; }
    await p.keyboard.press('Enter');
    await p.evaluate(() => { const b = window.__battle(); b.hero.hp = b.hero.maxHp = 99999; for (const o of Object.values(b.orders || {})) if (o) o.mode = 'charge'; for (let i = 0; i < 9000 && b.phase === 'fight'; i++) b.update(0.05); });
    await p.waitForTimeout(800);
    await p.click('#ui button:has-text("Dalej")').catch(() => {}); await p.waitForTimeout(700);
    console.log(' ->', await p.evaluate(() => (document.querySelector('#ui h1')?.textContent || '') + ' owner=' + window.__S.owner + ' fac=' + window.__S.faction));
    await p.click('#ui button[data-a="spare"]').catch(() => {}); await p.waitForTimeout(300);
  }
  console.log('errors', errs.length);
  await b.close();
})();
