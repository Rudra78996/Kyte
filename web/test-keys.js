const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  
  await page.goto('http://localhost:3002/sign-in');
  console.log('Page loaded');
  
  // Wait for React to render
  await page.waitForTimeout(2000);
  
  // Inject a script to evaluate window.Clerk.client.signIn
  const keys = await page.evaluate(() => {
    if (window.Clerk && window.Clerk.client && window.Clerk.client.signIn) {
      return Object.keys(window.Clerk.client.signIn);
    }
    return null;
  });
  console.log('SignIn keys:', keys);
  
  await browser.close();
})();
