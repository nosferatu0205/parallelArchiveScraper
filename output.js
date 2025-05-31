// output.js
const fs = require('fs-extra');
const path = require('path');
const { format, parseISO, isValid } = require('date-fns');
const { options } = require('./config');

async function generateCommodityCSVs(results) {
  await fs.ensureDir('output');
  
  // Filter out results with invalid dates
  const validResults = results.filter(result => {
    try {
      return result.date && isValid(parseISO(result.date));
    } catch (e) {
      console.warn(`Skipping result with invalid date: ${result.date}`);
      return false;
    }
  });
  
  if (validResults.length < results.length) {
    console.warn(`Filtered out ${results.length - validResults.length} results with invalid dates`);
  }
  
  // Group results by commodity
  const commodityGroups = {};
  
  for (const result of validResults) {
    if (!commodityGroups[result.commodity]) {
      commodityGroups[result.commodity] = [];
    }
    commodityGroups[result.commodity].push(result);
  }
  
  // Create CSV for each commodity
  for (const [commodity, commodityResults] of Object.entries(commodityGroups)) {
    try {
      // Sort by date
      commodityResults.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Deduplicate by similar prices on the same day
      const uniqueResults = [];
      const seenKeys = new Set();
      
      for (const result of commodityResults) {
        try {
          // Create a key combining date and normalized price
          const day = format(parseISO(result.date), 'yyyy-MM-dd');
          const normalizedPrice = result.price.replace(/\s+/g, '').toLowerCase();
          const key = `${day}-${normalizedPrice}-${result.priceType}`;
          
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueResults.push(result);
          }
        } catch (e) {
          console.warn(`Error during deduplication for ${commodity}: ${e.message}`);
          // Still include the result even if deduplication fails
          uniqueResults.push(result);
        }
      }
      
      // Create CSV - Add URL to the header
      const csvLines = ['Month,Product Name,Price Range,Price Type,Source Date,Article Title,Article URL'];
      
      for (const result of uniqueResults) {
        try {
          const month = format(parseISO(result.date), 'yyyy-MM');
          const sourceDate = format(parseISO(result.date), 'dd MMM yyyy');
          
          // Ensure all fields exist and are properly escaped
          const safeTitle = result.articleTitle ? result.articleTitle.replace(/"/g, '""') : '';
          const safePrice = result.price ? result.price.replace(/"/g, '""') : '';
          const safePriceType = result.priceType || 'Retail'; // Default to Retail if missing
          const safeUrl = result.articleUrl || '';
          
          // Add article title and URL to the CSV row
          csvLines.push(
            `${month},"${commodity}","${safePrice}","${safePriceType}","${sourceDate}","${safeTitle}","${safeUrl}"`
          );
        } catch (e) {
          console.warn(`Error formatting CSV line for ${commodity}: ${e.message}`);
          // Skip this line if formatting fails
        }
      }
      
      // Save CSV
      const filename = `${commodity.replace(/[^\w\s]/g, '').replace(/\s+/g, '_')}_prices.csv`;
      const filepath = path.join('output', filename);
      await fs.writeFile(filepath, csvLines.join('\n'));
      
      console.log(`📁 Created: ${filename} (${uniqueResults.length} entries, deduplicated from ${commodityResults.length})`);
    } catch (e) {
      console.error(`Error processing commodity ${commodity}: ${e.message}`);
    }
  }
  
  try {
    // Also save combined JSON for reference
    const jsonPath = path.join('output', 'all_prices_data.json');
    await fs.writeJson(jsonPath, {
      metadata: {
        dateRange: { start: options.start, end: options.end },
        totalEntries: validResults.length,
        commodities: Object.keys(commodityGroups),
        generatedAt: new Date().toISOString()
      },
      data: validResults
    }, { spaces: 2 });
    
    console.log(`\n📊 Summary: ${validResults.length} total price entries across ${Object.keys(commodityGroups).length} commodities`);
  } catch (e) {
    console.error(`Error saving JSON data: ${e.message}`);
  }
}

module.exports = {
  generateCommodityCSVs
};