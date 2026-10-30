const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1500);
  console.log(await p.evaluate(() => { const w = window.__game().WORLD; for (let d = 0; d < 10; d++) for (let h = 0; h < 24; h++) window.__T.worldTick(w, 1);
    const v = w.settlements.filter(s => s.kind === 'village');
    const alive = new Set(w.parties.map(p => p.id));
    return v.slice(0, 15).map(s => `${s.name} trip=${s.trip} vp=${s.vparty}${alive.has(s.vparty) ? '*' : ''} food=${['grain','meat','ale'].map(k=>Math.round(s.stock[k])).join('/')} raid=${s.raided} bound=${s.bound}`).join('\n') + '\nchron:' + w.chronicle.filter(c => /chłop|Chłopi/i.test(c.text)).length; }));
  await b.close();
})();
