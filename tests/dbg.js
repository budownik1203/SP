const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  await p.click('text=Nowa gra'); for (let i = 0; i < 4; i++) await p.click('#ui button[data-a="next"]'); await p.uncheck('#ui input[data-in="prologue"]'); await p.click('text=Ruszaj w świat'); await p.waitForTimeout(1300);
  await p.click('#ftip button').catch(() => {});
  await p.evaluate(() => { const w = window.__game().WORLD; const e = w.parties.find(x => x.kind === 'lord');
    window.__T.launchBattle({ kind: 'field', enemies: [e], allies: [], title: 'Test' }, { terrain: 'forest', season: 1, region: 'grass', hour: 12, deploy: false }); });
  await p.waitForTimeout(800); await p.click('#ftip button').catch(() => {}); await p.keyboard.press('Enter'); await p.waitForTimeout(1000);
  const avg = async (lab) => { const c = await p.evaluate(() => { const cv = document.querySelector('canvas'); const g = cv.getContext('2d'); const d = g.getImageData(0,0,cv.width,cv.height).data; let r=0,gg=0,bb=0; for (let i=0;i<d.length;i+=4){r+=d[i];gg+=d[i+1];bb+=d[i+2];} const n=d.length/4; return [r/n|0,gg/n|0,bb/n|0]; }); console.log(lab, c); };
  await avg('base');
  await p.evaluate(() => { const b = window.__battle(); b.hero.hp = b.hero.maxHp = 99999; for (const o of Object.values(b.orders||{})) if (o) o.mode = 'charge'; });
  for (let k = 0; k < 6; k++) { await p.waitForTimeout(2000); await avg('t'+k); const x = await p.evaluate(() => { const b = window.__battle(); return [b.hurtFlash, b.focusT, b.castFlash && b.castFlash.t, b.corpses.length, b.parts.length]; }); console.log(x); }
  await p.evaluate(() => { const b = window.__battle(); b.map.ground.getContext('2d').fillStyle='#000'; }); 
  const info = await p.evaluate(() => { const b = window.__battle(); const g = b.map.ground.getContext('2d'); const d = g.getImageData(700,400,200,200).data; let r=0,gg=0,bb=0; for (let i=0;i<d.length;i+=4){r+=d[i];gg+=d[i+1];bb+=d[i+2];} const n=d.length/4; return [r/n|0,gg/n|0,bb/n|0, b.dg.globalAlpha, b.parts.length]; });
  console.log('ground', info);
  await b.close();
})();
