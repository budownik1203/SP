const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1500);
  for (let r = 0; r < 4; r++) {
    const o = await p.evaluate(() => { const w = window.__game().WORLD; for (let d = 0; d < 60; d++) { for (let h = 0; h < 24; h++) window.__T.worldTick(w, 1); (w.pending || []).splice(0); }
      const cnt = {}; for (const s of w.settlements) cnt[s.faction] = (cnt[s.faction] || 0) + 1;
      const wars = []; for (const a of [1,2,3,4]) for (const b of [1,2,3,4]) if (a < b && w.factions[a].war[b]) wars.push(a + '-' + b);
      const al = []; for (const a of [1,2,3,4]) for (const b of [1,2,3,4]) if (a < b && w.factions[a].ally && w.factions[a].ally[b]) al.push(a + '-' + b);
      return `day ${w.day} owners ${JSON.stringify(cnt)} wars ${wars} allies ${al} camps ${w.chronicle.filter(c => /ogłasza wyprawę/.test(c.text)).length} defects ${w.chronicle.filter(c => /Zdrada:|Bunt!/.test(c.text)).length} plague ${w.chronicle.filter(c => c.cat === 'plague').length} trib ${w.chronicle.filter(c => /trybut/.test(c.text)).length}`; });
    console.log(o);
  }
  await b.close();
})();
