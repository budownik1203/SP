const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 800 } });
 p.on('pageerror', e => console.log('ERR', e.message));
 await p.goto('file:///tmp/claude-0/-home-claude/2743adaf-2a67-5c61-b47d-ff2714a8e5db/scratchpad/ank/ankieta18.html'); await p.waitForTimeout(500);
 await p.click('.opt'); await p.waitForTimeout(600); console.log(await p.textContent('#qnum'), await p.textContent('#count'));
 const sw = await p.evaluate(() => document.documentElement.scrollWidth); console.log('sw', sw);
 await b.close(); })();
