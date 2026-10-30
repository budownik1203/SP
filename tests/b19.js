const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message); });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  // dodaj kompanów
  await p.evaluate(() => { const w = window.__game().WORLD, T = window.__T; for (const id of ['kasia', 'wojmir', 'brakk', 'bogdan']) w.player.companions.push(T.makeCompanion(id)); w.player.goods.grain = 30; });
  // marsz: zmęczenie
  const r1 = await p.evaluate(() => { const w = window.__game().WORLD, G = window.__game().G; const pp = w.parties.find(x => x.id === w.pid); const t = w.settlements.find(s => s.kind === 'town' && s.id !== 0); window.__T.goTo ? 0 : 0; return { f0: w.player.fatigue || 0 }; });
  // przejdź przez czas w marszu
  await p.mouse.click(900, 600); await p.waitForTimeout(200);
  await p.evaluate(() => { const G = window.__game().G; G.speed = 8; });
  await p.waitForTimeout(6000);
  const r2 = await p.evaluate(() => { const w = window.__game().WORLD, G = window.__game().G; return { f: Math.round(w.player.fatigue || 0), hour: w.hour, camping: G.camping, day: w.day }; });
  console.log('march', JSON.stringify(r1), JSON.stringify(r2));
  // ekran obozu
  await p.evaluate(() => { const w = window.__game().WORLD, G = window.__game().G; const pp = w.parties.find(x => x.id === w.pid); pp.path = []; G.target = null; });
  await p.keyboard.press('Space'); await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/claude-0/t/b19_camp.png' });
  const cls = await p.evaluate(() => document.querySelector('#ui .win')?.className + ' ' + !!document.querySelector('.camp-scr'));
  console.log('camp screen', cls);
  await p.click('#ui button[data-a="talk"]').catch(e => console.log('no talk', e.message)); await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/claude-0/t/b19_talk.png' });
  await p.click('#ui button[data-a="c0"]').catch(() => {}); await p.waitForTimeout(400);
  await p.click('#ui button[data-a="r8"]').catch(e => console.log('no r8', e.message)); await p.waitForTimeout(5000);
  const r3 = await p.evaluate(() => { const w = window.__game().WORLD, G = window.__game().G; return { f: Math.round(w.player.fatigue || 0), camping: G.camping, meat: w.player.goods.meat, herbs: w.player.herbs, acc: w.player.camp.acc, hour: w.hour }; });
  console.log('rest', JSON.stringify(r3));
  // choroba + dzienne
  const r4 = await p.evaluate(() => { const w = window.__game().WORLD; w.player.sick = [{ kind: 'fever', n: 4 }]; window.__T.worldTick(w, 24); return { sick: w.player.sick, wounded: w.parties.find(x => x.id === w.pid).troops.map(t => t.wounded) }; });
  console.log('sick', JSON.stringify(r4));
  // pobojowisko
  await p.evaluate(() => { const w = window.__game().WORLD, G = window.__game().G; G.camping = false; const pp = w.parties.find(x => x.id === w.pid); (w.scars ||= []).push({ x: pp.x + 5, y: pp.y, day: w.day, kind: 'battle', size: 1, f1: 1, f2: 2 }); pp.path = [pp.path[0] || 0]; });
  await p.mouse.click(700, 500); await p.waitForTimeout(1500);
  const bf = await p.evaluate(() => document.querySelector('#ui h1')?.textContent);
  console.log('battlefield', bf);
  await p.screenshot({ path: '/tmp/claude-0/t/b19_bf.png' });
  await p.click('#ui button[data-a="s"]').catch(() => {}); await p.waitForTimeout(600);
  console.log('after search', await p.evaluate(() => document.querySelector('#ui h1')?.textContent + ' | ' + (document.querySelector('#ui ul')?.textContent || '')));
  // echo
  const ec = await p.evaluate(() => { const w = window.__game().WORLD; w.echoes = [{ kind: 'saved', day: w.day, data: {} }]; return 1; });
  console.log('errors', errs.length);
  await b.close();
})();
