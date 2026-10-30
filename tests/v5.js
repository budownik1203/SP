const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForSelector('button[data-a=new]'); await p.click('button[data-a=new]'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300); await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const T = window.__T; const w = window.__game().WORLD; let err = 0, msg = ''; for (let d = 1; d < 400; d++) { w.day = d; for (const s of w.settlements) for (const salt of [0, 7]) { try { T.rumor(s, salt); } catch (e) { err++; msg = e.message; } } } 
    for (const s of w.settlements) for (const tab of ['main','recruit','market','smith','tavern','arena','quest','manage','siege']) { try { T.SET.id = s.id; T.SET.tab = tab; T.renderSettlement(); } catch (e) { err++; msg = tab + ' ' + e.message; } }
    return { err, msg }; });
  console.log(JSON.stringify(r));
  await b.close();
})();
