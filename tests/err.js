const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message, e.stack.split('\n').slice(0,3).join(' | '))); await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(1500); await b.close(); })();
