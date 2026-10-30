const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1100,height:900}}); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('file:///tmp/claude-0/-home-claude/2743adaf-2a67-5c61-b47d-ff2714a8e5db/scratchpad/ank/dopracowanie.html'); await p.waitForTimeout(400);
await p.click('.it .sol[data-s="0"]'); await p.click('.it .sol[data-s="2"]'); await p.click('#exportBtn');
console.log(await p.evaluate(() => document.querySelectorAll('.it').length + ' | ' + document.getElementById('out').value.slice(0,260)));
await p.click('#close'); await p.screenshot({path:'/tmp/claude-0/t/dop.png'}); await b.close(); })();
