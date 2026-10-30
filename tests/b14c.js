const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1500);
  // wasal Aurelii z dużą sławą
  const r = await p.evaluate(() => {
    const w = window.__game().WORLD, P = w.player, T = window.__T;
    P.liege = 1; P.status = 'wasal'; P.renown = 500; P.wars = [];
    const tgt = w.settlements.find(s => s.kind !== 'village' && s.faction === 2);
    if (!w.factions[1].war[2]) { w.factions[1].war[2] = true; w.factions[2].war[1] = true; }
    T.showFactions(); return tgt.id;
  });
  await p.click('#ui button[data-a="tab"][data-v="dipl"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: '/tmp/claude-0/t/b14_dipl2.png' });
  await p.click('#ui button[data-a="campStart"]'); await p.waitForTimeout(200);
  const follow = await p.evaluate(() => { const w = window.__game().WORLD; for (let h = 0; h < 30; h++) window.__T.worldTick(w, 1); const pp = w.parties.find(x => x.kind === 'player'); return w.parties.filter(x => x.kind === 'lord' && x.faction === 1).map(x => Math.round(Math.hypot(x.x - pp.x, x.y - pp.y)) + ':' + x.state).join(' ') + ' camp=' + JSON.stringify(w.factions[1].camp); });
  console.log('follow', follow);
  // głosowanie
  await p.evaluate(() => { const w = window.__game().WORLD; const s = w.settlements.find(s => s.kind === 'castle' && s.faction === 2); const L = w.lords.find(l => l.faction === 1 && !l.ruler); window.__T.closeScreen && 0; document.querySelector('#ui .win')?.remove(); window.__game().SCREEN = null; });
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  const v = await p.evaluate(() => { const w = window.__game().WORLD; const s = w.settlements.find(s => s.kind === 'castle' && s.faction === 2); const L = w.lords.find(l => l.faction === 1 && !l.ruler); window.__T.captureSettlementX ? 0 : 0; return s.id + ':' + L.id; });
  await p.evaluate((v) => { const [sid, lid] = v.split(':').map(Number); const w = window.__game().WORLD; const s = w.settlements[sid]; s.faction = 1; s.owner = lid; w.pending = w.pending || []; w.pending.push({ kind: 'vote', f: 1, s: sid, cands: [lid, w.lords.filter(l=>l.faction===1&&!l.ruler)[1].id, -2], day: w.day }); }, v);
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/claude-0/t/b14_vote.png' });
  await p.click('#ui button[data-a="v"][data-v="-2"]').catch(e => console.log('novote', e.message)); await p.waitForTimeout(300);
  console.log('vote', await p.evaluate((v) => { const w = window.__game().WORLD; const s = w.settlements[Number(v.split(':')[0])]; return s.owner + ' ' + w.chronicle.slice(-2).map(c=>c.text).join(' | '); }, v));
  // okup jeńca
  await p.evaluate(() => { const w = window.__game().WORLD; const L = w.lords.find(l => l.faction === 2 && !l.ruler); L.captive = 9; w.pending.push({ kind: 'ransomOffer', f: 2, lord: L.id, gold: 700, day: w.day }); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/claude-0/t/b14_ransom.png' });
  await p.click('#ui button[data-a="yes"]').catch(e => console.log('noransom', e.message)); await p.waitForTimeout(300);
  // przesłuchanie
  await p.evaluate(() => { const w = window.__game().WORLD; const pp = w.parties.find(x => x.kind === 'player'); pp.prisoners.push({ type: 'v_levy', n: 3, wounded: 0 }); window.__T.showParty(); });
  await p.click('#ui button[data-a="tab"][data-v="pris"]'); await p.waitForTimeout(150);
  await p.click('#ui button[data-a="ask"]').catch(e => console.log('noask', e.message)); await p.waitForTimeout(200);
  await p.screenshot({ path: '/tmp/claude-0/t/b14_ask.png' });
  console.log('ask', await p.evaluate(() => document.getElementById('askres')?.innerText));
  console.log(errs.slice(0, 6).join('\n'));
  await b.close();
})();
