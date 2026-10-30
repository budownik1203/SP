const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1500);
  await p.click('#ftip button').catch(() => {});

  const shots = JSON.parse(process.argv[2] || '[["dwarf","castle",1],["orc","town",1],["undead","town",3]]');
  let n = 0;
  for (const [cul, kind, sea] of shots) {
    await p.evaluate(([cul, kind, sea]) => { const g = window.__game(); const w = g.WORLD; w.rain = false; w.fog = false; w.hour = 12; w.day = 1 + sea * 30 + 3; w.explored.fill(1); (w.pending||[]).splice(0);
      const s = w.settlements.find(s => s.culture === cul && s.kind === kind); const pp = w.parties.find(x => x.id === w.pid); pp.x = s.cx * 8 + 60; pp.y = s.cy * 8 + 30; pp.path = [];
      window.__T.addScar ? 0 : 0; (w.scars ||= []).push({ x: s.cx*8+40, y: s.cy*8+40, day: w.day, kind: 'battle', size: 1.5 }, { x: s.cx*8-40, y: s.cy*8+30, day: w.day, kind: 'burn', size: 1.3 });
      g.G.view.cam.x = s.cx * 8 - 260; g.G.view.cam.y = s.cy * 8 - 160; g.G.view.follow = false; }, [cul, kind, sea]);
    await p.waitForTimeout(700);
    await p.screenshot({ path: `/tmp/claude-0/t/m17_${n++}.png` });
  }
  await b.close();
})();
