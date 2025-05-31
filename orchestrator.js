// orchestrator.js
const { chromium } = require('playwright');
const { format, parseISO, eachDayOfInterval } = require('date-fns');
const { Worker } = require('worker_threads');
const path = require('path');
const { options } = require('./config');
const { generateCommodityCSVs } = require('./output');

async function runParallelScraper() {
  console.log('🚀 Starting Parallel Multi-Commodity Scraper (Playwright Edition)');
  console.log(`📅 Date Range: ${options.start} to ${options.end}`);
  console.log(`📦 Commodities: ${options.commodities}`);
  console.log(`👷 Workers: ${options.workers}`);
  console.log(`⏱️  Page timeout: ${options.pageTimeout || 30}s`);
  console.log(`🔄 Retry attempts: ${options.retryAttempts || 3}`);
  
  // Generate all dates
  const allDates = eachDayOfInterval({
    start: parseISO(options.start),
    end: parseISO(options.end)
  }).map(date => format(date, 'yyyy-MM-dd'));
  
  console.log(`📊 Total days to process: ${allDates.length}`);
  
  // Optional: Create a shared browser for all workers (more efficient)
  let sharedBrowser = null;
  let browserWSEndpoint = null;
  
  if (allDates.length > 10) { // Use shared browser for larger jobs
    console.log('🌐 Creating shared browser instance for efficiency...');
    sharedBrowser = await chromium.launch({ 
      headless: options.headless !== false,
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    // FIXED: wsEndpoint is a property, not a method in Playwright
    browserWSEndpoint = sharedBrowser.wsEndpoint;
  }
  
  // Split dates among workers
  const workerCount = parseInt(options.workers);
  const datesPerWorker = Math.ceil(allDates.length / workerCount);
  const workers = [];
  const workerPromises = [];
  
  // Create workers
  for (let i = 0; i < workerCount; i++) {
    const startIdx = i * datesPerWorker;
    const endIdx = Math.min(startIdx + datesPerWorker, allDates.length);
    const workerDates = allDates.slice(startIdx, endIdx);
    
    if (workerDates.length === 0) continue;
    
    console.log(`🔧 Worker ${i + 1}: Processing ${workerDates.length} dates`);
    
    const worker = new Worker(path.join(__dirname, 'worker.js'), {
      workerData: {
        dates: workerDates,
        workerId: i + 1,
        config: {
          commodities: options.commodities,
          debug: options.debug,
          headless: options.headless,
          retryAttempts: parseInt(options.retryAttempts) || 3,
          pageTimeout: parseInt(options.pageTimeout) || 30
        },
        browserWSEndpoint
      }
    });
    
    workers.push(worker);
    
    const promise = new Promise((resolve, reject) => {
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
    });
    
    workerPromises.push(promise);
  }
  
  // Wait for all workers to complete
  console.log('\n⏳ Processing... This may take a while.\n');
  
  let workerResults;
  try {
    workerResults = await Promise.all(workerPromises);
  } finally {
    // Clean up shared browser
    if (sharedBrowser) {
      await sharedBrowser.close().catch(console.error);
    }
  }
  
  // Combine all results
  const allResults = [];
  for (const { workerId, results } of workerResults) {
    console.log(`✅ Worker ${workerId} completed with ${results.length} price entries`);
    allResults.push(...results);
  }
  
  // Process results into commodity-specific CSVs
  await generateCommodityCSVs(allResults);
  
  console.log('\n🎉 Scraping complete!');
}

module.exports = { runParallelScraper };