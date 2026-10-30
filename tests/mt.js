const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(700);
  await p.evaluate(() => { window.__T.startQuickBattle(); }); await p.waitForTimeout(300);
  await p.keyboard.press('KeyQ'); await p.waitForTimeout(300);
  console.log('Q', await p.evaluate(() => document.getElementById('mini').className));
  await p.keyboard.press('KeyN'); await p.waitForTimeout(300);
  console.log('N', await p.evaluate(() => document.getElementById('mini').className));
  await p.screenshot({ path: '/tmp/claude-0/t/mt.png' });
  await p.click('#minitog'); await p.waitForTimeout(300);
  console.log('tog', await p.evaluate(() => document.getElementById('mini').className));
  console.log(errs.join('\n')); await b.close();
})();
