const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // Run in headful mode to mimic real user
    defaultViewport: null,
    args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Set a realistic user-agent
  await page.setUserAgent(
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
  );

  // Enable request interception
  await page.setRequestInterception(true);

  const networkLogs = [];

  // Capture request details
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

  // Capture response details
  page.on('response', async response => {
    if (response.url().includes('oll.php')) {
      try {
        const request = response.request();
        const responseHeaders = response.headers();
        const status = response.status();
        const url = response.url();
        const contentType = responseHeaders['content-type'] || '';
        
        let bodySnippet = '';
        if (contentType.includes('text') || contentType.includes('json')) {
          bodySnippet = (await response.text()).slice(0, 200); // store first 200 chars only
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

  // Wait to capture all requests
  await page.waitForTimeout(10000);

  // Save captured network data to JSON file (API sheet)
  fs.writeFileSync('network_logs.json', JSON.stringify(networkLogs, null, 2), 'utf-8');

  console.log('✅ Network details saved to network_logs.json');

  await browser.close();
})();
