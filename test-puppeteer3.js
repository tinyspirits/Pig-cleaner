const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 2000));
  
  // Set petType to dog
  await page.evaluate(() => {
    // Open settings and change pet type
    document.dispatchEvent(new CustomEvent('keydown', { key: 's' })); // not how settings opens but let's try something else
    // Wait... window.pigAPI is mocked if not in Electron?
  });

  await browser.close();
})();
