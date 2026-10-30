const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('file:///tmp/claude-0/-home-claude/2743adaf-2a67-5c61-b47d-ff2714a8e5db/scratchpad/ank/ankieta.html'); await p.waitForTimeout(500);
console.log(await p.evaluate(() => document.getElementById('count').textContent)); await b.close(); })();
