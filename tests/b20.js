const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message); });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  await p.evaluate(() => { const w = window.__game().WORLD; w.player.gold = 5000; w.player.goods.iron = 20; w.player.mats = { leather: 10, steel: 8 }; w.player.items.push('w_sword'); const s = w.settlements[0]; window.__T.enterSettlement(s); });
  await p.waitForTimeout(500); await p.click('#ftip button').catch(() => {});
  await p.click('#ui button[data-a="tab"][data-v="smith"]'); await p.waitForTimeout(400); await p.click('#ftip button').catch(() => {});
  await p.screenshot({ path: '/tmp/claude-0/t/b20_smith.png', fullPage: true });
  // rozbierz miecz
  const di = await p.$$('#ui button[data-a="dism"]'); console.log('dism buttons', di.length);
  if (di.length) { await di[di.length - 1].click(); await p.waitForTimeout(300); }
  console.log('patterns', await p.evaluate(() => window.__game().WORLD.player.patterns.join(',')));
  await p.click('#ui button[data-a="forgeOpen"]'); await p.waitForTimeout(400);
  await p.click('#ui button[data-a="fp"][data-v="w_sword"]').catch(e => console.log('no sword pat')); await p.waitForTimeout(200);
  await p.click('#ui button[data-a="fm"][data-v="steel"]').catch(e => console.log('no steel')); await p.waitForTimeout(200);
  await p.fill('#fname', 'Kieł Świtu');
  await p.screenshot({ path: '/tmp/claude-0/t/b20_forge.png' });
  await p.click('#ui button[data-a="forge"]'); await p.waitForTimeout(300);
  await p.evaluate(() => { window.__game().G.speed = 8; });
  await p.waitForTimeout(6000);
  console.log('result', await p.evaluate(() => document.querySelector('#ui h1')?.textContent + ' | ' + document.querySelector('#ui .tip')?.textContent));
  const it = await p.evaluate(() => { const P = window.__game().WORLD.player; const id = P.items[P.items.length - 1]; return { id, crafted: P.crafted?.length, steel: P.mats.steel }; });
  console.log('item', JSON.stringify(it));
  // zapis i wczytanie zachowuje wykuty przedmiot
  const sl = await p.evaluate(() => { const T = window.__T, g = window.__game(); const js = T.serializeWorld(g.WORLD); const w2 = T.deserializeWorld(js); const id = w2.player.crafted[0].id; return id + ' ' + !!w2.player.crafted[0].item.name; });
  console.log('saveload', sl);
  // barwy
  await p.evaluate(() => { const P = window.__game().WORLD.player; P.squadPaint = { 1: { main: '#5f636a', trim: '#a2822f', charge: 'wolf' } }; });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.evaluate(() => window.__T.showParty()); await p.waitForTimeout(300);
  await p.click('#ui button[data-a="tab"][data-v="paint"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/claude-0/t/b20_paint.png' });
  // legenda + perk
  const lg = await p.evaluate(() => { const P = window.__game().WORLD.player; P.equip.weapon = 'l_widow'; return window.__T.perk ? 0 : JSON.stringify({ name: 1 }); });
  console.log('errors', errs.length);
  await b.close();
})();
