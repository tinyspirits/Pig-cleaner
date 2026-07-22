const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
  page.on('response', response => {
    if (!response.ok()) {
      console.log('RESPONSE NOT OK:', response.url(), response.status());
    }
  });

  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
