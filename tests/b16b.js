const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///home/claude/buildy/Sztandary%20Popio%C5%82u%20B16.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  const runs = JSON.parse(process.argv[2] || '[{"terrain":"plains","season":1,"region":"lush","hour":12,"n":"a"}]');
  for (const r of runs) {
    await p.evaluate((r) => { const w = window.__game().WORLD; w.day = 1 + r.season * 30; w.hour = r.hour; w.rain = !!r.rain; w.fog = false;
      const e = w.parties.find(x => x.kind === 'lord' && x.faction !== w.player.liege) || w.parties.find(x=>x.kind==='bandit');
      w.player.gold = 9999; const pp2 = window.__game().G ? null : null; const P0 = w.parties.find(x=>x.kind==='player') || w.parties[0]; P0.troops = [{type:'a_knight',n:10,wounded:0,xp:0},{type:'a_archer',n:10,wounded:0,xp:0},{type:'a_recruit',n:10,wounded:0,xp:0}];
      window.__T.launchBattle({ kind: 'field', enemies: [e], allies: [], title: 'Test' }, { terrain: r.terrain, season: r.season, region: r.region, hour: r.hour, deploy: false, night: !!r.night, rain: !!r.rain }); }, r);
    await p.waitForTimeout(600);
    await p.click('#ftip button').catch(() => {});
    await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    await p.evaluate(() => { const b = window.__battle(); if (b) { b.phase = 'fight'; for (const o of Object.values(b.orders||{})) if (o) o.mode = 'charge'; } });
    await p.evaluate(() => { const b = window.__battle(); b.hero.maxHp = b.hero.hp = 99999; });
    await p.waitForTimeout(r.wait || 9000);
    await p.evaluate(() => { const b = window.__battle(); const L = b.units.filter(u => u.active && !u.hero); const e = L.filter(u=>u.team===1), f = L.filter(u=>u.team===0); const t = e.length ? e : f; let best=t[0],bn=-1; for (const u of t) { const n = L.filter(v=>Math.hypot(v.x-u.x,v.y-u.y)<60).length; if (n>bn){bn=n;best=u;} } b.hero.x = best.x - 40; b.hero.y = best.y + 30; });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `/tmp/claude-0/t/b16_${r.n}.png` });
    await p.evaluate(() => { const b = window.__battle(); if (b && b.retreat) b.retreat(); });
    await p.waitForTimeout(500);
    await p.evaluate(() => { document.querySelectorAll('#ui button').forEach(x => { if (/Dalej|Zamknij|OK/.test(x.textContent)) x.click(); }); });
    await p.waitForTimeout(500);
  }
  await b.close();
})();
