const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('PAGEERR ' + e.message + e.stack));
  p.on('console', m => console.log('C', m.type(), m.text().slice(0,300)));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'v4.png' });
  await b.close();
})();
