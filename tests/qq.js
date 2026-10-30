const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///tmp/claude-0/pytania-b8.html'); await p.waitForTimeout(600);
  console.log(await p.textContent('#count'));
  await p.screenshot({ path: 't/qq.png' });
  console.log(errs.join('\n'));
  await b.close();
})();
