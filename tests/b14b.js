const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); await p.waitForTimeout(200);
  for (let i = 0; i < 6; i++) await p.click('#ui button[data-a="look"][data-v="hairStyle:1"]').catch(()=>{});
  await p.click('#ui button[data-a="look"][data-v="scar:1"]'); await p.click('#ui button[data-a="look"][data-v="scar:1"]'); await p.click('#ui button[data-a="look"][data-v="scar:1"]');
  await p.click('#ui button[data-a="look"][data-v="paint:1"]');
  await p.screenshot({ path: '/tmp/claude-0/t/b14_cre0.png' });
  await p.click('#ui button[data-a="next"]'); await p.waitForTimeout(100);
  await p.click('#ui button[data-a="child"][data-v="forest"]'); await p.waitForTimeout(100);
  await p.screenshot({ path: '/tmp/claude-0/t/b14_cre1.png' });
  await p.click('#ui button[data-a="next"]'); await p.click('#ui button[data-a="youth"][data-v="squire"]');
  await p.click('#ui button[data-a="next"]'); await p.click('#ui button[data-a="next"]'); await p.waitForTimeout(100);
  await p.click('#ui button[data-a="cchg"][data-v="wolf"]'); await p.click('#ui button[data-a="cpat"][data-v="quarter"]');
  await p.screenshot({ path: '/tmp/claude-0/t/b14_cre4.png' });
  await p.click('text=Ruszaj w świat'); await p.waitForTimeout(2200);
  console.log('state', await p.evaluate(() => { const B = window.__battle && window.__battle(); return B ? 'battle ' + B.phase + ' tut=' + B.cfg.tutorial : 'nobattle'; }));
  await p.screenshot({ path: '/tmp/claude-0/t/b14_prologue.png' });
  // dograj prolog
  await p.evaluate(() => { const B = window.__battle(); B.startFight(); for (let i = 0; i < 6000 && B.phase !== 'end'; i++) { B.hero.hp = B.hero.maxHp; B.update(0.05); } });
  for (let k = 0; k < 30; k++) { const c = await p.evaluate(() => document.querySelector('#ui .win')?.className || ''); if (c.includes('after')) break; await p.waitForTimeout(200); }
  await p.click('#ui button:has-text("Dalej")').catch(() => {}); await p.waitForTimeout(300);
  console.log('plot', await p.evaluate(() => JSON.stringify(window.__game().WORLD.plot) + ' q=' + window.__game().WORLD.player.quests.map(q => q.kind).join(',') + ' bio=' + !!window.__game().WORLD.player.bio));
  // symulacja polityki
  const sim = await p.evaluate(() => {
    const G = window.__game(), w = G.WORLD; const out = {};
    let defects = 0, camps = 0, allies = 0, plague = 0, votes = 0;
    const before = w.settlements.filter(s => s.faction === 5).length;
    for (let d = 0; d < 150; d++) { for (let h = 0; h < 24; h++) window.__T.worldTick(w, 1); (w.pending || []).splice(0); }
    out.chron = {}; for (const c of w.chronicle) out.chron[c.cat] = (out.chron[c.cat] || 0) + 1;
    out.wars = []; for (const a of [1,2,3,4]) for (const b of [1,2,3,4]) if (a < b && w.factions[a].war[b]) out.wars.push(a + '-' + b);
    out.allies = []; for (const a of [1,2,3,4]) for (const b of [1,2,3,4]) if (a < b && w.factions[a].ally && w.factions[a].ally[b]) out.allies.push(a + '-' + b);
    out.morvath = before + '->' + w.settlements.filter(s => s.faction === 5).length;
    out.camps = w.chronicle.filter(c => /wyprawę/.test(c.text)).length;
    out.defects = w.chronicle.filter(c => /Zdrada:|Bunt!/.test(c.text)).length;
    out.hist = w.factions[1].hist.length;
    out.day = w.day;
    return JSON.stringify(out);
  });
  console.log('sim', sim);
  await p.evaluate(() => window.__T.showFactions()); await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/claude-0/t/b14_fac.png' });
  await p.click('#ui button[data-a="tab"][data-v="lords"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: '/tmp/claude-0/t/b14_lords.png' });
  await p.click('#ui button[data-a="tab"][data-v="dipl"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: '/tmp/claude-0/t/b14_dipl.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  await p.evaluate(() => window.__T.showChronicle()); await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/claude-0/t/b14_chron.png' });
  await p.keyboard.press('Escape');
  // niewola i ucieczka
  await p.evaluate(() => { const w = window.__game().WORLD, P = w.player; P.companions.push(window.__T.makeCompanion('brakk')); const lines = []; window.__T.captivity(1, lines); window.__T.showCaptivity(); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/claude-0/t/b14_capt.png' });
  await p.click('#ui button[data-a="fight"]'); await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/claude-0/t/b14_escape.png' });
  const esc = await p.evaluate(() => { const B = window.__battle(); const n = B.units.filter(u => u.team === 1).length, m = B.units.filter(u => u.team === 0).length; for (let i = 0; i < 6000 && B.phase !== 'end'; i++) { B.hero.hp = B.hero.maxHp; B.update(0.05); } return `guards ${n} mine ${m} win ${B.result && B.result.win}`; });
  await p.waitForTimeout(3000);
  console.log('escape', esc, await p.evaluate(() => 'captive=' + !!window.__game().WORLD.player.captive + ' comps=' + window.__game().WORLD.player.companions.length));
  console.log(errs.slice(0, 8).join('\n'));
  await b.close();
})();
