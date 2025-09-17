const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: true, // Must be headless on Render
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Set a realistic Android user-agent
    await page.setUserAgent(
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
    );

    await page.setRequestInterception(true);

    const networkLogs = [];

    // Capture requests
    page.on('request', request => {
      if (request.url().includes('oll.php')) {
        networkLogs.push({
          type: 'request',
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData() || null,
          timestamp: new Date().toISOString()
        });
      }
      request.continue();
    });

    // Capture responses
    page.on('response', async response => {
      if (response.url().includes('oll.php')) {
        try {
          const responseHeaders = response.headers();
          const status = response.status();
          const url = response.url();
          const contentType = responseHeaders['content-type'] || '';
          
          let bodySnippet = '';
          if (contentType.includes('text') || contentType.includes('json')) {
            bodySnippet = (await response.text()).slice(0, 200); // first 200 chars
          }

          networkLogs.push({
            type: 'response',
            url,
            status,
            contentType,
            headers: responseHeaders,
            bodySnippet,
            timestamp: new Date().toISOString()
          });
        } catch (err) {
          console.error('Error capturing response:', err);
        }
      }
    });

    // Go to the target URL
    await page.goto('https://watch.livecricketsl.xyz/wv/oll.php', {
      waitUntil: 'networkidle2'
    });

    // Wait to ensure all requests finish
    await page.waitForTimeout(10000);

    // Save logs to /tmp (Render ephemeral filesystem)
    const logPath = path.join('/tmp', 'network_logs.json');
    fs.writeFileSync(logPath, JSON.stringify(networkLogs, null, 2), 'utf-8');

    console.log(`✅ Network logs saved at ${logPath}`);
    console.log('Sample:', networkLogs.slice(0, 2));

    await browser.close();
  } catch (err) {
    console.error('❌ Error running Puppeteer:', err);
    process.exit(1);
  }
})();
