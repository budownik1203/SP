const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1500);
  await p.click('#ftip button').catch(() => {});
  await p.evaluate(() => { const w = window.__game().WORLD; w.explored.fill(1); for (let h = 0; h < 72; h++) window.__T.worldTick(w, 1); (w.pending||[]).splice(0); });
  await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/claude-0/t/vis1.png' });
  for (let i = 0; i < 4; i++) { await p.mouse.move(640, 400); await p.mouse.wheel(0, 300); await p.waitForTimeout(150); }
  await p.waitForTimeout(800);
  await p.screenshot({ path: '/tmp/claude-0/t/vis2.png' });
  await p.keyboard.press('Tab'); await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/claude-0/t/vis3.png' });
  await b.close();
})();
