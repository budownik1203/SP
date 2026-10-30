const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message); });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  const r = await p.evaluate(() => { const w = window.__game().WORLD, T = window.__T3, P = w.player; P.gold = 5000;
    const m0 = T.perk(P, 'moraleB'); for (let i = 0; i < 6; i++) T.addDeed(P, 'spared'); for (let i = 0; i < 160; i++) T.addDeed(P, 'undead');
    const traits = T.deedTraits(P).map(t => t.name); const m1 = T.perk(P, 'moraleB');
    const lines = []; for (let i = 0; i < 30; i++) T.maybeWound(P, lines);
    T.addBounty(w, 2, 500, 'test'); let hunters = 0; for (let i = 0; i < 80 && !hunters; i++) { w.day++; T.bountyDaily(w); hunters = w.parties.filter(o => o.hunters).length; }
    return { m0, m1, traits, nick: P.nick, wounds: P.pwounds, lines: lines.length, hunters, bounty: P.bounty }; });
  console.log(JSON.stringify(r));
  // straż w bramie: miasto Legionu
  await p.evaluate(() => { const w = window.__game().WORLD, T = window.__T3; const s = w.settlements.find(x => x.kind === 'town' && x.faction === 2); w.player.bounty[2] = 800; let shown = false; for (let i = 0; i < 20 && !document.querySelector('#ui [data-a="bribe"]'); i++) { w.day += 3; T.enterSettlement(s); } });
  await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/claude-0/t/b26_guards.png' });
  console.log('guards', await p.evaluate(() => document.querySelector('#ui h1')?.textContent));
  await p.click('#ui [data-a="pay"]'); await p.waitForTimeout(500);
  console.log('after pay', await p.evaluate(() => JSON.stringify(window.__game().WORLD.player.bounty) + ' ' + document.querySelector('#ui h1')?.textContent));
  await p.click('#ui button[data-a="tab"][data-v="main"]').catch(() => {}); await p.waitForTimeout(300);
  await p.click('#ui [data-a="bCure"]').catch(() => console.log('no cure'));
  await p.click('#ui [data-a="bBeard"][data-v="2"]').catch(() => console.log('no beard'));
  await p.screenshot({ path: '/tmp/claude-0/t/b26_barber.png', fullPage: true });
  await p.evaluate(() => window.__T.showCharacter()); await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/claude-0/t/b26_char.png' });
  console.log('errors', errs.length); await b.close();
})();
