const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 820 } });
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    const T = window.__T;
    const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;background:#3a342a;z-index:99;padding:6px;font:10px monospace;color:#ddd';
    for (const c of ['aurelia','varus','dwarf','orc','undead']) {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:2px;margin-bottom:4px';
      const list = Object.values(T.UNITS).filter(u => u.culture === c).sort((a,b)=>a.tier-b.tier);
      for (const u of list) { const cell = document.createElement('div'); cell.style.cssText='display:flex;flex-direction:column;align-items:center;width:84px'; const cv = T.unitCanvas(u.key, 0, 0); const im = document.createElement('img'); im.src = cv.toDataURL(); im.style.cssText = `image-rendering:pixelated;width:${cv.width*2}px`; cell.appendChild(im); const t = document.createElement('span'); t.textContent = u.tier + ' ' + u.name; cell.appendChild(t); row.appendChild(cell); }
      d.appendChild(row);
    }
    document.body.appendChild(d);
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'gallery.png' });
  await b.close();
})();
