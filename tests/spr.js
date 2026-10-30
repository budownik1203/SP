const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file:///home/claude/sztandary/dist/sztandary.html'); await p.waitForTimeout(800);
  const keys = (process.argv[2]||'a_recruit,a_knight,a_archer,v_legion,v_praetor,d_axe,d_ironguard,o_grunt,o_berserk,b_bandit,u_skel,u_necro,m_sword').split(',');
  const url = await p.evaluate((k) => window.__T.spriteSheet(k, 3), keys);
  require('fs').writeFileSync('/tmp/claude-0/t/sheet.png', Buffer.from(url.split(',')[1], 'base64'));
  await b.close();
})();
