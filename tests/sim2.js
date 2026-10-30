const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1500);
  const o = await p.evaluate(() => { const w = window.__game().WORLD; const init = w.settlements.filter(s=>s.kind!=='village').map(s => s.name + ':' + s.faction + ':' + s.kind + ':' + s.garrison.reduce((a,t)=>a+t.n,0)).join(' ');
    for (let d = 0; d < 70; d++) { for (let h = 0; h < 24; h++) window.__T.worldTick(w, 1); (w.pending || []).splice(0); }
    return init + '\n' + w.chronicle.filter(c => /pada!|odparty/.test(c.text)).map(c => c.day + ' ' + c.text).join('\n'); });
  console.log(o);
  await b.close();
})();
