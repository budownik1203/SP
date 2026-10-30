const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/pytania-mech.html'); await p.waitForTimeout(600);
  console.log(await p.textContent('#count'), await p.evaluate(()=>document.getElementById('modal').hidden));
  await p.keyboard.press('1'); await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/claude-0/t/qm.png' });
  console.log(errs.join('\n')); await b.close();
})();
