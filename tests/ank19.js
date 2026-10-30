const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///tmp/claude-0/-home-claude/2743adaf-2a67-5c61-b47d-ff2714a8e5db/scratchpad/ank/ankieta20.html'); await p.waitForTimeout(800);
  await p.screenshot({ path: '/tmp/claude-0/t/ank20.png' }); console.log(await p.evaluate(() => document.querySelector('.count')?.textContent), errs); await b.close(); })();
