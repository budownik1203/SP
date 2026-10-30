const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(process.argv[2]); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  await p.evaluate(() => { const w = window.__game().WORLD; const P0 = w.parties.find(x=>x.id===w.pid); P0.troops = [{type:'a_knight',n:30,wounded:0,xp:0},{type:'a_archer',n:40,wounded:0,xp:0},{type:'a_recruit',n:40,wounded:0,xp:0}];
    const e = w.parties.find(x => x.kind === 'lord' && x.faction === 4) || w.parties.find(x=>x.kind==='lord'); e.troops = [{type:'o_grunt',n:60,wounded:0,xp:0},{type:'o_warrior',n:50,wounded:0,xp:0}];
    window.__T.launchBattle({ kind: 'field', enemies: [e], allies: [], title: 'Test' }, { terrain: 'plains', deploy: false }); });
  await p.waitForTimeout(800); await p.click('#ftip button').catch(() => {}); await p.keyboard.press('Enter');
  await p.evaluate(() => { const b = window.__battle(); b.hero.hp = b.hero.maxHp = 99999; for (const o of Object.values(b.orders||{})) if (o) o.mode = 'charge'; });
  await p.waitForTimeout(12000);
  const fps = await p.evaluate(() => new Promise(r => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 3000) requestAnimationFrame(f); else r(n / 3); }; requestAnimationFrame(f); }));
  const info = await p.evaluate(() => { const b = window.__battle(); return { units: b.units.filter(u=>u.active).length, parts: b.parts.length, corpses: b.corpses.length }; });
  console.log('battle fps', fps, JSON.stringify(info));
  await b.close();
})();
