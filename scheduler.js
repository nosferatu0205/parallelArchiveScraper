// scheduler.js
const cron = require('node-cron');
const { runParallelScraper } = require('./orchestrator');
const { format, subDays } = require('date-fns');
const fs = require('fs-extra');
const path = require('path');

// Configuration
const config = {
  // Run daily at 2:00 AM (adjust as needed)
  cronSchedule: '0 2 * * *',
  
  // How many days of data to scrape (default: yesterday only)
  daysToScrape: 1,
  
  // Default commodities to scrape
  commodities: 'Sugar,Rice,Broiler Chicken,Hilsa Fish,Pangas Fish,Potato,Onion,Soybean Oil,Palm Oil,Eggs,Green Chillies',
  
  // Worker count
  workers: 4,
  
  // Log file path
  logPath: path.join(__dirname, 'logs'),
  
  // Whether to run in headless mode
  headless: true
};

// Function to run the scraper with date calculations
async function runScheduledScrape() {
  try {
    // Calculate date range (yesterday to N days before)
    const endDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), config.daysToScrape), 'yyyy-MM-dd');
    
    console.log(`🕒 Starting scheduled scrape for ${startDate} to ${endDate}`);
    
    // Prepare command line arguments
    process.argv = [
      'node',
      'scheduler.js',
      '--start', startDate,
      '--end', endDate,
      '--commodities', config.commodities,
      '--workers', config.workers.toString(),
      '--headless', config.headless.toString()
    ];
    
    // Log the run
    await logScheduledRun('Started', { startDate, endDate });
    
    // Run the scraper
    await runParallelScraper();
    
    // Log success
    await logScheduledRun('Completed', { startDate, endDate });
    
    console.log(`✅ Scheduled scrape completed successfully`);
  } catch (error) {
    console.error(`❌ Scheduled scrape failed: ${error.message}`);
    
    // Log error
    await logScheduledRun('Failed', { error: error.message });
  }
}

// Function to log scheduled runs
async function logScheduledRun(status, details) {
  try {
    // Ensure log directory exists
    await fs.ensureDir(config.logPath);
    
    // Create log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      status,
      details
    };
    
    // Append to log file (one entry per line)
    const logFile = path.join(config.logPath, 'scheduler.log');
    await fs.appendFile(
      logFile,
      JSON.stringify(logEntry) + '\n'
    );
  } catch (error) {
    console.error(`Error writing to log: ${error.message}`);
  }
}

// Schedule the scraper using cron
cron.schedule(config.cronSchedule, () => {
  console.log(`🔔 Cron job triggered at ${new Date().toISOString()}`);
  runScheduledScrape();
});

console.log(`📅 Scheduler started. Next run scheduled according to cron pattern: ${config.cronSchedule}`);
console.log(`   (Current time: ${new Date().toLocaleString()})`);

// Allow manual execution via command line
if (require.main === module) {
  if (process.argv.includes('--run-now')) {
    console.log('🚀 Manual execution triggered');
    runScheduledScrape();
  }
}

module.exports = {
  runScheduledScrape
};