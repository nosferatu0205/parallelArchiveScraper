// browser.js

async function loadPageSafely(page, url, workerId) {
  try {
    // Simple goto with reasonable timeout
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 20000 
    });
    
    // Quick check if content exists
    try {
      await page.waitForSelector('div.post-content, article .content, main', { timeout: 3000 });
    } catch (e) {
      // Don't fail if selector not found - content might still be accessible
    }
    
    // Brief pause for JS
    await page.waitForTimeout(500);
    
    return true;
    
  } catch (error) {
    // Log but don't throw - just like original implementation
    console.error(`[Worker ${workerId}] Error loading ${url}: ${error.message}`);
    return false;
  }
}

async function scrollToBottom(page) {
  let previousHeight = 0;
  let currentHeight = await page.evaluate(() => document.body.scrollHeight);
  let attempts = 0;
  
  while (previousHeight !== currentHeight && attempts < 10) { // Reduced max attempts
    previousHeight = currentHeight;
    
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500); // Slightly shorter wait
    
    // Check for end marker
    const hasEndMarker = await page.evaluate(() => {
      return document.querySelector('div.google-auto-placed') !== null ||
             document.querySelector('.no-more-articles') !== null ||
             document.querySelector('.end-of-content') !== null;
    });
    
    if (hasEndMarker) break;
    
    currentHeight = await page.evaluate(() => document.body.scrollHeight);
    attempts++;
  }
  
  // Final wait for any last content
  await page.waitForTimeout(1000);
}

module.exports = {
  loadPageSafely,
  scrollToBottom
};