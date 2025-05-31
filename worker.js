// worker.js
const { chromium } = require("playwright");
const { isMainThread, parentPort, workerData } = require("worker_threads");
const {
  ARCHIVE_URL_BASE,
  PRICE_KEYWORDS,
  PRODUCT_VARIANTS,
} = require("./config");
const utils = require("./utils");
const { loadPageSafely, scrollToBottom } = require("./browser");

// Fallback implementations for critical functions in case of import issues
function hasRelevantKeywords(title) {
  if (typeof utils.hasRelevantKeywords === "function") {
    return utils.hasRelevantKeywords(title);
  }
  const lowerTitle = title.toLowerCase();
  return PRICE_KEYWORDS.some((keyword) =>
    lowerTitle.includes(keyword.toLowerCase())
  );
}

if (!isMainThread) {
  // This code runs in worker threads
  (async () => {
    const { dates, workerId, config, browserWSEndpoint } = workerData;
    const results = [];

    let browser;
    let context;
    let page;

    try {
      // Connect to existing browser or create new one
      if (browserWSEndpoint) {
        browser = await chromium.connect({ wsEndpoint: browserWSEndpoint });
      } else {
        browser = await chromium.launch({
          headless: config.headless !== false,
          args: [
            "--disable-blink-features=AutomationControlled",
            "--disable-features=IsolateOrigins,site-per-process",
            "--disable-web-security",
            "--disable-setuid-sandbox",
            "--no-sandbox",
          ],
        });
      }

      // Create a context with anti-detection measures
      context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        hasTouch: false,
        javascriptEnabled: true,
      });

      // Set additional headers
      await context.setExtraHTTPHeaders({
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      });

      page = await context.newPage();

      // Add stealth behaviors
      await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
      });

      for (const date of dates) {
        try {
          console.log(`[Worker ${workerId}] Processing ${date}`);

          // Load archive page
          const url = `${ARCHIVE_URL_BASE}${date}`;
          const loaded = await loadPageSafely(page, url, workerId);
          if (!loaded) {
            console.log(
              `[Worker ${workerId}] Skipping ${date} due to load failure`
            );
            continue;
          }

          // Scroll to load all articles
          await scrollToBottom(page);

          // Get all articles
          const articles = await page.evaluate(() => {
            const articleElements = document.querySelectorAll(
              "article.card.card-full"
            );
            return Array.from(articleElements)
              .map((article) => {
                const titleElement = article.querySelector("h2.card-title a");
                const timeElement = article.querySelector("time");

                return {
                  title: titleElement ? titleElement.textContent.trim() : "",
                  url: titleElement ? titleElement.href : "",
                  date: timeElement ? timeElement.getAttribute("datetime") : "",
                };
              })
              .filter((a) => a.title && a.url);
          });

          console.log(
            `[Worker ${workerId}] Found ${articles.length} articles for ${date}`
          );

          // Filter and process relevant articles
          const relevantArticles = articles.filter((article) =>
            hasRelevantKeywords(article.title)
          );

          console.log(
            `[Worker ${workerId}] ${relevantArticles.length} articles with price keywords`
          );

          // Process each article
          let processedCount = 0;
          let failedCount = 0;

          for (const article of relevantArticles) {
            try {
              // Load article page
              const loaded = await loadPageSafely(page, article.url, workerId);
              if (!loaded) {
                failedCount++;
                continue; // Skip this article
              }

              // Extract content with multiple selectors
              const content = await page.evaluate(() => {
                // Try multiple possible content selectors
                const selectors = [
                  "div.post-content",
                  "article .content",
                  "main .article-body",
                  ".news-content",
                ];

                for (const selector of selectors) {
                  const contentDiv = document.querySelector(selector);
                  if (contentDiv) {
                    const paragraphs = contentDiv.querySelectorAll("p");
                    const text = Array.from(paragraphs)
                      .map((p) => p.textContent.trim())
                      .filter((text) => text.length > 0)
                      .join(" ");

                    if (text.length > 0) return text;
                  }
                }

                // Fallback: get all text from body
                const bodyText =
                  document.body.innerText || document.body.textContent || "";
                return bodyText.trim();
              });

              if (!content || content.length < 50) {
                console.log(
                  `[Worker ${workerId}] Skipping article with insufficient content: ${article.title}`
                );
                continue;
              }

              // Find all commodities mentioned
              const commoditiesFound = utils.findCommodityMatches(
                content,
                config.commodities
              );

              // Extract prices for each commodity
              // In worker.js where the results are processed
              for (const commodity of commoditiesFound) {
                try {
                  const pricesData = utils.extractPricesForCommodity(
                    content,
                    commodity
                  );

                  if (pricesData && pricesData.length > 0) {
                    // Keep track of unique prices for each commodity per article
                    const uniquePrices = new Set();

                    for (const priceData of pricesData) {
                      // Only add if we haven't seen this price for this commodity in this article
                      // Create a simplified price key for deduplication
                      const priceKey =
                        `${priceData.price}-${priceData.priceType}`.toLowerCase();

                      if (!uniquePrices.has(priceKey)) {
                        uniquePrices.add(priceKey);

                        results.push({
                          date: article.date,
                          commodity: commodity,
                          price: priceData.price,
                          priceType: priceData.priceType,
                          articleTitle: article.title,
                          articleUrl: article.url,
                          context: priceData.context, // Include some context for verification
                        });
                      }
                    }
                  }
                } catch (error) {
                  console.error(
                    `[Worker ${workerId}] Error extracting prices for ${commodity}: ${error.message}`
                  );
                  // Continue with next commodity
                }
              }

              processedCount++;

              // Shorter delay between articles
              await utils.delay(500 + Math.random() * 500);
            } catch (error) {
              console.error(
                `[Worker ${workerId}] Error processing article "${article.title}": ${error.message}`
              );
              failedCount++;

              // Don't let too many failures stop the entire process
              if (failedCount > relevantArticles.length * 0.5) {
                console.error(
                  `[Worker ${workerId}] Too many failures, moving to next date`
                );
                break;
              }
            }
          }

          console.log(
            `[Worker ${workerId}] Processed ${processedCount}/${relevantArticles.length} articles for ${date}`
          );

          // Delay between dates
          await utils.delay(1000 + Math.random() * 1000);
        } catch (error) {
          console.error(
            `[Worker ${workerId}] Failed to process ${date}: ${error.message}`
          );
        }
      }
    } catch (error) {
      console.error(`[Worker ${workerId}] Fatal error: ${error.message}`);
    } finally {
      // Cleanup
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
      if (browser && !browserWSEndpoint) await browser.close().catch(() => {});
    }

    // Send results back to main thread
    parentPort.postMessage({ workerId, results });
  })();
}
