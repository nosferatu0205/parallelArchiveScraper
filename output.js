// output.js
const fs = require('fs-extra');
const path = require('path');
const { format, parseISO } = require('date-fns');
const { options } = require('./config');

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

module.exports = {
  generateCommodityCSVs
};