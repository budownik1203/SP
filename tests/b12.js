const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + e.stack));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300); await p.waitForTimeout(600);
  await p.evaluate(() => { const w = window.__game().WORLD; w.player.gold = 20000; w.player.goods.iron = 20; w.player.items.push(window.__T.qid('w_greataxe', 0)); window.__T.ensureItem(window.__T.qid('w_greataxe', 0)); });
  const town = await p.evaluate(() => window.__game().WORLD.settlements.find(s=>s.kind==='town').id);
  const shot = async (tab, name) => { await p.evaluate(([id, tab]) => { const g = window.__game(); window.__T.enterSettlement(g.WORLD.settlements[id]); window.__T.SET.tab = tab; window.__T.renderSettlement(); }, [town, tab]); await p.waitForTimeout(250); await p.screenshot({ path: `/tmp/claude-0/t/b12_${name}.png` }); };
  await shot('main', 'main'); await shot('smith', 'smith');
  const up = await p.$('#ui button[data-a="up"]'); if (up) { await up.click(); await p.waitForTimeout(150); }
  console.log('items', await p.evaluate(() => window.__game().WORLD.player.items.join(',')));
  const ord = await p.$('#ui button[data-a="order"]'); if (ord) { await ord.click(); await p.waitForTimeout(150); }
  console.log('orders', await p.evaluate(() => JSON.stringify(window.__game().WORLD.player.orders)));
  await shot('market', 'market');
  const src = await p.$('#ui .mrow[data-drag^="buy:"]'), dst = await p.$('#ui .mcol[data-drop="buy"]');
  if (src && dst) await p.dragAndDrop('#ui .mrow[data-drag^="buy:"]', '#ui .mcol[data-drop="buy"]');
  console.log('goods', await p.evaluate(() => JSON.stringify(window.__game().WORLD.player.goods)));
  const car = await p.$('#ui button[data-a="car"]'); if (car) await car.click();
  console.log('caravans', await p.evaluate(() => JSON.stringify(window.__game().WORLD.player.caravans)));
  await shot('tavern', 'tavern');
  const dice = await p.$('#ui button[data-a="dice"]'); if (dice) { await dice.click(); await p.waitForTimeout(200); await p.screenshot({ path: '/tmp/claude-0/t/b12_dice.png' }); await p.click('#ui button[data-a="raise"]'); await p.waitForTimeout(200); }
  const comp = await p.$('#ui button[data-a="comp"]'); if (comp) { await comp.click(); await p.waitForTimeout(150); }
  const hire = await p.$('#ui button[data-a="hire"]'); if (hire) { await hire.click(); await p.waitForTimeout(200); await p.click('#ui button[data-a="others"]'); await p.waitForTimeout(800); await p.screenshot({ path: '/tmp/claude-0/t/b12_hire.png' }); await p.click('#ui button[data-a="hire"]'); await p.waitForTimeout(200); }
  console.log('comps', await p.evaluate(() => window.__game().WORLD.player.companions.map(c=>c.id).join(',')));
  const castle = await p.evaluate(() => window.__game().WORLD.settlements.find(s=>s.kind==='castle').id);
  for (const tab of ['throne','armory','dungeon']) { await p.evaluate(([id, tab]) => { const g = window.__game(); window.__T.enterSettlement(g.WORLD.settlements[id]); window.__T.SET.tab = tab; window.__T.renderSettlement(); }, [castle, tab]); await p.waitForTimeout(200); }
  await p.screenshot({ path: '/tmp/claude-0/t/b12_castle.png' });
  await p.evaluate((id) => { const g = window.__game(); const s = g.WORLD.settlements[id]; s.owner = -2; window.__T.enterSettlement(s); window.__T.SET.tab = 'rule'; window.__T.renderSettlement(); }, castle);
  await p.waitForTimeout(200); const bld = await p.$('#ui button[data-a="build"]'); if (bld) await bld.click(); await p.waitForTimeout(150);
  await p.screenshot({ path: '/tmp/claude-0/t/b12_rule.png' });
  const qs = await p.evaluate(() => { const g = window.__game(), w = g.WORLD; const v = w.settlements.filter(s=>s.kind==='village'); const out = []; for (const s of v.slice(0, 12)) { const q = window.__T.offerQuest(s); if (q) { out.push(q.kind); w.player.quests.push(q); } } const L = w.lords.find(l=>l.alive && !l.ruler); const lq = window.__T.offerLordQuest(L, false); if (lq) { w.player.quests.push(lq); out.push('L:' + lq.kind); } const lq2 = window.__T.offerLordQuest(L, true); if (lq2) out.push('T:' + lq2.kind + (lq2.item||'')); return out.join(','); });
  console.log('quests', qs);
  await p.evaluate(() => { window.__T.SET && 0; }); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  await p.evaluate(() => window.__T.showQuests()); await p.waitForTimeout(200); await p.screenshot({ path: '/tmp/claude-0/t/b12_quests.png' });
  await p.keyboard.press('Escape');
  await p.evaluate(() => { const w = window.__game().WORLD; for (let i=0;i<24*10;i++) window.__T.worldTick(w, 1); });
  console.log('after days', await p.evaluate(() => { const w = window.__game().WORLD; return JSON.stringify({ gold: w.player.gold, car: (w.player.caravans||[]).length, q: w.player.quests.filter(q=>!q.done).length }); }));
  const ok = await p.evaluate(() => { const w = window.__game().WORLD; const js = window.__T.serializeWorld(w); const w2 = window.__T.deserializeWorld(js); return w2.player.items.every(id => !!window.__T.ensureItem(id)); });
  console.log('saveload', ok);
  console.log(errs.slice(0,8).join('\n'));
  await b.close();
})();
