// parallelArchiveScraper.js
// npm install puppeteer date-fns fs-extra commander

const puppeteer = require('puppeteer');
const { format, parseISO, eachDayOfInterval } = require('date-fns');
const fs = require('fs-extra');
const path = require('path');
const { program } = require('commander');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

/* CLI SETUP - Only parse in main thread */
let options = {};
if (isMainThread) {
  program
    .requiredOption('--start <date>', 'Start date YYYY-MM-DD')
    .requiredOption('--end <date>', 'End date YYYY-MM-DD')
    .option('--workers <number>', 'Number of parallel workers', '4')
    .option('--commodities <items>', 'Comma-separated list of commodities', 
      'Sugar,Rice,Broiler Chicken,Hilsa Fish,Pangas Fish,Potato,Onion,Soybean Oil,Palm Oil,Eggs,Green Chillies')
    .option('--debug', 'Enable debug logging');

  program.parse();
  options = program.opts();
}

/* CONFIG */
const ARCHIVE_URL_BASE = 'https://www.newagebd.net/archive?date=';

// Product variants for flexible matching
const PRODUCT_VARIANTS = {
  'Sugar': ['sugar', 'refined sugar', 'white sugar', 'packaged sugar', 'চিনি'],
  'Rice': ['rice', 'chal', 'চাল', 'miniket', 'najirshail', 'coarse rice', 'fine rice'],
  'Broiler Chicken': ['broiler', 'chicken', 'murgi', 'মুরগি', 'farm chicken', 'poultry'],
  'Hilsa Fish': ['hilsa', 'ilish', 'ইলিশ', 'hilsha'],
  'Pangas Fish': ['pangas', 'পাঙ্গাস', 'pangash'],
  'Potato': ['potato', 'alu', 'আলু', 'potatoes'],
  'Onion': ['onion', 'peyaj', 'পেঁয়াজ', 'onions'],
  'Soybean Oil': ['soybean oil', 'soyabean oil', 'soya oil', 'সয়াবিন তেল'],
  'Palm Oil': ['palm oil', 'palm', 'পাম তেল'],
  'Eggs': ['egg', 'eggs', 'dim', 'ডিম', 'hali'],
  'Green Chillies': ['green chilli', 'green chillies', 'kacha morich', 'কাঁচা মরিচ', 'chilli', 'chillies'],
  'Garlic': ['garlic', 'roshun', 'রসুন'],
  'Ginger': ['ginger', 'ada', 'আদা'],
  'Tomato': ['tomato', 'tomatoes', 'টমেটো'],
  'Beef': ['beef', 'গরুর মাংস', 'cow meat'],
  'Mutton': ['mutton', 'খাসির মাংস', 'goat meat'],
  'Katla Fish': ['katla', 'কাতলা'],
  'Rohita Fish': ['rohita', 'rui', 'রুই'],
  'Tilapia Fish': ['tilapia', 'তেলাপিয়া'],
  'Lentils': ['lentils', 'dal', 'ডাল', 'mosur', 'মসুর'],
  'Milk': ['milk', 'dudh', 'দুধ'],
  'Aubergine': ['aubergine', 'brinjal', 'begun', 'বেগুন', 'eggplant'],
  'Papaya': ['papaya', 'pepe', 'পেঁপে'],
  'Bitter Gourd': ['bitter gourd', 'korola', 'করলা', 'uchche'],
  'Pointed Gourd': ['pointed gourd', 'potol', 'পটল'],
  'Okra': ['okra', 'bhindi', 'ঢেঁড়স', 'dherosh'],
  'String Beans': ['string beans', 'sheem', 'শিম', 'beans'],
  'Teasel Gourd': ['teasel gourd', 'kakrol', 'কাঁকরোল'],
  'Ridge Gourd': ['ridge gourd', 'jhinge', 'ঝিঙে'],
  'Snake Gourd': ['snake gourd', 'chichinga', 'চিচিঙ্গা']
};

// Broader keywords for initial filtering
const PRICE_KEYWORDS = [
  'price', 'prices', 'Tk', 'taka', 'market', 'commodity', 'commodities',
  'rises', 'rise', 'falls', 'fall', 'increase', 'decrease', 'up', 'down',
  'wholesale', 'retail', 'essentials', 'kitchen', 'bazaar', 'bazar',
  'per kg', 'per kilogram', 'per litre', 'per hali', 'cost', 'rate',
  'টাকা', 'দাম', 'মূল্য', 'বাজার'
];

// Enhanced price patterns
const PRICE_PATTERNS = [
  // Tk X-Y per unit
  /((?:Tk|TK|Taka|৳)\s*\d+[\d,.]*\s*(?:-|–|to|থেকে)\s*\d+[\d,.]*\s*(?:per|প্রতি|a|each|\/)?s*(?:kg|kilo|kilogram|কেজি|liter|litre|l|L|লিটার|piece|pcs|unit|hali|হালি))/ig,
  
  // Single price with unit
  /((?:Tk|TK|Taka|৳)\s*\d+[\d,.]*\s*(?:per|প্রতি|a|each|\/)?s*(?:kg|kilo|kilogram|কেজি|liter|litre|l|L|লিটার|piece|pcs|unit|hali|হালি))/ig,
  
  // Price before unit (120 taka per kg)
  /(\d+[\d,.]*\s*(?:taka|Taka|tk|Tk|টাকা)\s*(?:per|প্রতি|a|each|\/)?s*(?:kg|kilo|kilogram|কেজি|liter|litre|l|L|লিটার|piece|pcs|unit|hali|হালি))/ig,
  
  // Hali specific pattern (4 pieces)
  /((?:Tk|TK|Taka|৳)\s*\d+[\d,.]*\s*(?:-|–|to|থেকে)?\s*\d*[\d,.]*?\s*(?:per|প্রতি)?\s*hali\s*\(?(?:4\s*(?:pcs|pieces))?\)?)/ig,
  
  // Container patterns (5L, 1L bottle, etc)
  /((?:Tk|TK|Taka|৳)\s*\d+[\d,.]*\s*(?:-|–|to|থেকে)?\s*\d*[\d,.]*?\s*(?:per|প্রতি)?\s*\d+\s*(?:L|l|litre|liter|লিটার)\s*(?:bottle|container|pack)?)/ig,
  
  // General price
  /((?:Tk|TK|Taka|৳)\s*\d+[\d,.]*)/ig
];

/* HELPERS */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function hasRelevantKeywords(title) {
  const lowerTitle = title.toLowerCase();
  return PRICE_KEYWORDS.some(keyword => lowerTitle.includes(keyword.toLowerCase()));
}

function findCommodityMatches(text, commoditiesList) {
  const textLower = text.toLowerCase();
  const matches = [];
  
  // Get commodities from the passed list or options
  const commoditiesToFind = commoditiesList 
    ? commoditiesList.split(',').map(c => c.trim())
    : options.commodities.split(',').map(c => c.trim());
  
  for (const commodity of commoditiesToFind) {
    const variants = PRODUCT_VARIANTS[commodity] || [commodity.toLowerCase()];
    
    for (const variant of variants) {
      if (textLower.includes(variant)) {
        matches.push(commodity);
        break; // Found this commodity, move to next
      }
    }
  }
  
  return [...new Set(matches)]; // Remove duplicates
}

function extractPricesForCommodity(text, commodity) {
  const prices = [];
  const seen = new Set();
  
  // Find all prices in text
  for (const pattern of PRICE_PATTERNS) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const price = match[0].trim();
      if (!seen.has(price)) {
        seen.add(price);
        
        // Check if this price is near the commodity mention (within ~100 words)
        const priceIndex = text.indexOf(match[0]);
        const contextStart = Math.max(0, priceIndex - 500);
        const contextEnd = Math.min(text.length, priceIndex + 500);
        const context = text.substring(contextStart, contextEnd).toLowerCase();
        
        // Check if commodity is mentioned in context
        const variants = PRODUCT_VARIANTS[commodity] || [commodity.toLowerCase()];
        const isRelevant = variants.some(variant => context.includes(variant));
        
        if (isRelevant) {
          prices.push({
            price: price,
            priceType: determinePriceType(context)
          });
        }
      }
    }
  }
  
  return prices;
}

function determinePriceType(context) {
  const contextLower = context.toLowerCase();
  if (contextLower.includes('wholesale') || contextLower.includes('পাইকারি')) {
    return 'Wholesale';
  }
  return 'Retail'; // Default to retail
}

/* WORKER THREAD CODE */
if (!isMainThread) {
  // This code runs in worker threads
  (async () => {
    const { dates, workerId, config } = workerData;
    const results = [];
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    
    for (const date of dates) {
      try {
        console.log(`[Worker ${workerId}] Processing ${date}`);
        
        // Load archive page
        const url = `${ARCHIVE_URL_BASE}${date}`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Scroll to load all articles
        await scrollToBottom(page);
        
        // Get all articles
        const articles = await page.evaluate(() => {
          const articleElements = document.querySelectorAll('article.card.card-full');
          return Array.from(articleElements).map(article => {
            const titleElement = article.querySelector('h2.card-title a');
            const timeElement = article.querySelector('time');
            
            return {
              title: titleElement ? titleElement.textContent.trim() : '',
              url: titleElement ? titleElement.href : '',
              date: timeElement ? timeElement.getAttribute('datetime') : ''
            };
          }).filter(a => a.title && a.url);
        });
        
        console.log(`[Worker ${workerId}] Found ${articles.length} articles for ${date}`);
        
        // Filter and process relevant articles
        const relevantArticles = articles.filter(article => hasRelevantKeywords(article.title));
        console.log(`[Worker ${workerId}] ${relevantArticles.length} articles with price keywords`);
        
        // Process each article
        for (const article of relevantArticles) {
          try {
            await page.goto(article.url, { waitUntil: 'networkidle2', timeout: 20000 });
            
            // Extract content
            const content = await page.evaluate(() => {
              const contentDiv = document.querySelector('div.post-content');
              if (!contentDiv) return '';
              
              const paragraphs = contentDiv.querySelectorAll('p');
              return Array.from(paragraphs)
                .map(p => p.textContent.trim())
                .filter(text => text.length > 0)
                .join(' ');
            });
            
            if (!content) continue;
            
            // Find all commodities mentioned - use config passed from main thread
            const commoditiesFound = findCommodityMatches(content, config.commodities);
            
            // Extract prices for each commodity
            for (const commodity of commoditiesFound) {
              const pricesData = extractPricesForCommodity(content, commodity);
              
              if (pricesData.length > 0) {
                for (const priceData of pricesData) {
                  results.push({
                    date: article.date,
                    commodity: commodity,
                    price: priceData.price,
                    priceType: priceData.priceType,
                    articleTitle: article.title,
                    articleUrl: article.url
                  });
                }
              }
            }
            
            await delay(1000 + Math.random() * 500);
            
          } catch (error) {
            console.error(`[Worker ${workerId}] Error processing article: ${error.message}`);
          }
        }
        
        await delay(2000 + Math.random() * 1000);
        
      } catch (error) {
        console.error(`[Worker ${workerId}] Failed to process ${date}: ${error.message}`);
      }
    }
    
    await browser.close();
    
    // Send results back to main thread
    parentPort.postMessage({ workerId, results });
  })();
}

/* MAIN THREAD CODE */
async function scrollToBottom(page) {
  let previousHeight = 0;
  let currentHeight = await page.evaluate(() => document.body.scrollHeight);
  let attempts = 0;
  
  while (previousHeight !== currentHeight && attempts < 20) {
    previousHeight = currentHeight;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await delay(2000);
    
    const hasEndMarker = await page.evaluate(() => {
      return document.querySelector('div.google-auto-placed') !== null;
    });
    
    if (hasEndMarker) break;
    
    currentHeight = await page.evaluate(() => document.body.scrollHeight);
    attempts++;
  }
}

async function runParallelScraper() {
  console.log('🚀 Starting Parallel Multi-Commodity Scraper');
  console.log(`📅 Date Range: ${options.start} to ${options.end}`);
  console.log(`📦 Commodities: ${options.commodities}`);
  console.log(`👷 Workers: ${options.workers}`);
  
  // Generate all dates
  const allDates = eachDayOfInterval({
    start: parseISO(options.start),
    end: parseISO(options.end)
  }).map(date => format(date, 'yyyy-MM-dd'));
  
  console.log(`📊 Total days to process: ${allDates.length}`);
  
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
    
    const worker = new Worker(__filename, {
      workerData: {
        dates: workerDates,
        workerId: i + 1,
        config: {
          commodities: options.commodities,
          debug: options.debug
        }
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
  const workerResults = await Promise.all(workerPromises);
  
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

async function generateCommodityCSVs(results) {
  await fs.ensureDir('output');
  
  // Group results by commodity
  const commodityGroups = {};
  
  for (const result of results) {
    if (!commodityGroups[result.commodity]) {
      commodityGroups[result.commodity] = [];
    }
    commodityGroups[result.commodity].push(result);
  }
  
  // Create CSV for each commodity
  for (const [commodity, commodityResults] of Object.entries(commodityGroups)) {
    // Sort by date
    commodityResults.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Create CSV
    const csvLines = ['Month,Product Name,Price Range,Price Type,Source Date'];
    
    for (const result of commodityResults) {
      const month = format(parseISO(result.date), 'yyyy-MM');
      const sourceDate = format(parseISO(result.date), 'dd MMM yyyy');
      
      csvLines.push(
        `${month},"${commodity}","${result.price}","${result.priceType}","${sourceDate}"`
      );
    }
    
    // Save CSV
    const filename = `${commodity.replace(/[^\w\s]/g, '').replace(/\s+/g, '_')}_prices.csv`;
    const filepath = path.join('output', filename);
    await fs.writeFile(filepath, csvLines.join('\n'));
    
    console.log(`📁 Created: ${filename} (${commodityResults.length} entries)`);
  }
  
  // Also save combined JSON for reference
  const jsonPath = path.join('output', 'all_prices_data.json');
  await fs.writeJson(jsonPath, {
    metadata: {
      dateRange: { start: options.start, end: options.end },
      totalEntries: results.length,
      commodities: Object.keys(commodityGroups),
      generatedAt: new Date().toISOString()
    },
    data: results
  }, { spaces: 2 });
  
  console.log(`\n📊 Summary: ${results.length} total price entries across ${Object.keys(commodityGroups).length} commodities`);
}

// Run the scraper if main thread
if (isMainThread) {
  runParallelScraper().catch(console.error);
}