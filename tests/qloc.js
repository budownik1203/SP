const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1500);
  console.log(await p.evaluate(() => { const w = window.__game().WORLD, T = window.__T; const out = []; let far = 0, foreign = 0, n = 0;
    for (let d = 0; d < 6; d++) { for (let h = 0; h < 24; h++) T.worldTick(w, 1); (w.pending||[]).splice(0);
      for (const s of w.settlements) { const q = T.offerQuest(s); if (!q) continue; n++;
        let x, y; if (q.kind === 'bandits' || q.kind === 'defend') { const pp = w.parties.find(o => o.id === q.target); if (!pp) continue; x = pp.x; y = pp.y; } else if (q.kind === 'wolves') { const pl = w.places[q.target]; x = pl.cx * 8; y = pl.cy * 8; } else if (q.kind === 'letter') { const t = w.settlements[q.target]; x = t.cx*8; y = t.cy*8; } else continue;
        const dd = Math.round(Math.hypot(x - s.cx * 8, y - s.cy * 8) / 8); const own = w.settlements[w.nearest[Math.floor(y/8)*427+Math.floor(x/8)]].faction === s.faction;
        if (q.kind !== 'letter') { if (dd > 45) far++; if (!own) foreign++; }
        if (out.length < 12) out.push(`${s.name}: ${q.kind} ${dd} pól ${own ? 'swoje' : 'OBCE'} | ${q.text.slice(0, 60)}`);
      } }
    return out.join('\n') + `\nzadań ${n}, dalekich (>45 pól) ${far}, na obcych ziemiach ${foreign}`; }));
  await b.close();
})();
