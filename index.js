// index.js (formerly parallelArchiveScraperPlaywright.js)
const { runParallelScraper } = require('./orchestrator');

// Export for use in other modules (like node-cron integration)
module.exports = { runParallelScraper };

// Run the scraper if called directly
if (require.main === module) {
  runParallelScraper().catch(console.error);
}