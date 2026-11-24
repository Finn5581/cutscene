// Recon: load the Waitwhile booking page headless and log JSON/XHR traffic.
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.argv[2] || 'https://waitwhile.com/locations/chromeheartsmiami/time?registration=booking';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const log = [];
  page.on('response', async (res) => {
    const req = res.request();
    const type = req.resourceType();
    if (!['xhr', 'fetch', 'document', 'websocket'].includes(type)) return;
    let body = null;
    try { body = (await res.text()).slice(0, 4000); } catch (e) { body = `<<${e.message}>>`; }
    log.push({ type, method: req.method(), url: req.url(), status: res.status(),
      reqHeaders: req.headers(), postData: req.postData(), resHeaders: res.headers(), body });
  });
  page.on('websocket', ws => log.push({ type: 'ws-open', url: ws.url() }));
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) { console.error('goto:', e.message); }
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'page.png', fullPage: true });
  fs.writeFileSync('page.txt', await page.innerText('body').catch(() => ''));
  fs.writeFileSync('traffic.json', JSON.stringify(log, null, 2));
  console.log(log.map(l => `${l.status ?? ''} ${l.method ?? ''} ${l.type} ${l.url}`).join('\n'));
  await browser.close();
})();
