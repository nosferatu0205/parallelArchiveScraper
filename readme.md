# NewAge BD Commodity Price Scraper

A parallel web scraper that extracts commodity prices from NewAge Bangladesh's archived articles. This tool helps track price trends for various commodities in Bangladesh markets.

## Features

- **Parallel Processing**: Uses worker threads to scrape multiple dates simultaneously
- **Multi-Commodity Support**: Extracts prices for multiple commodities in a single run
- **Intelligent Price Extraction**: Uses advanced context-aware algorithms to accurately extract prices
- **Automatic Scheduling**: Includes a cron scheduler for automated daily runs
- **CSV Export**: Generates commodity-specific CSV files for easy analysis
- **Detailed Logging**: Comprehensive logging for troubleshooting and verification

## Installation

### Prerequisites

- Node.js (v18 or later)
- npm (comes with Node.js)

### Setup

1. Clone the repository or download the source code:

```bash
git clone https://github.com/your-username/newage-price-scraper.git
cd newage-price-scraper
```

2. Install dependencies:

```bash
npm install
```

## Usage

### Basic Usage

Run the scraper with specific dates:

```bash
node index.js --start "2024-01-01" --end "2024-01-31" --workers 4
```

### Command Line Arguments

- `--start`: Start date in YYYY-MM-DD format (required)
- `--end`: End date in YYYY-MM-DD format (required)
- `--workers`: Number of parallel workers (default: 4)
- `--commodities`: Comma-separated list of commodities to track (default: includes common items)
- `--headless`: Whether to run browser in headless mode (default: true)
- `--retry-attempts`: Number of retry attempts for failed pages (default: 3)
- `--page-timeout`: Page load timeout in seconds (default: 30)
- `--debug`: Enable debug logging

### Example Commands

Scrape a single day:

```bash
node index.js --start "2024-01-01" --end "2024-01-01"
```

Scrape a month with more workers:

```bash
node index.js --start "2024-01-01" --end "2024-01-31" --workers 8
```

Scrape specific commodities:

```bash
node index.js --start "2024-01-01" --end "2024-01-05" --commodities "Rice,Potato,Onion"
```

## Automated Scheduling

The project includes a cron scheduler for automated daily runs.

### Starting the Scheduler

#### Windows

1. Open Command Prompt or PowerShell and navigate to the project directory
2. Run the scheduler in the foreground:

```
node scheduler.js
```

3. Alternatively, run it in the background using the start-scheduler script:

```
node start-scheduler.js
```

#### Mac/Linux

1. Open Terminal and navigate to the project directory
2. Run the scheduler in the foreground:

```bash
node scheduler.js
```

3. Run it in the background:

```bash
node start-scheduler.js
```

4. For a proper daemon setup on Linux, use the systemd service:

```bash
# Create a service file
sudo nano /etc/systemd/system/commodity-scraper.service

# Paste the service configuration from below, then save and exit

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable commodity-scraper
sudo systemctl start commodity-scraper
```

Example systemd service file:

```ini
[Unit]
Description=Commodity Price Scraper Scheduler
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/your/scraper
ExecStart=/usr/bin/node scheduler.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=commodity-scraper

[Install]
WantedBy=multi-user.target
```

### Configuring the Scheduler

Edit the `scheduler.js` file to adjust the scheduling settings:

- `cronSchedule`: When to run the scraper (uses cron format)
- `daysToScrape`: How many days of data to scrape in each run
- `commodities`: Which commodities to track
- `workers`: Number of parallel workers
- `headless`: Whether to run in headless mode

### Manual Execution

To run the scheduler immediately:

```bash
node scheduler.js --run-now
```

## Output Files

The scraper generates the following output files in the `output` directory:

- Commodity-specific CSV files (e.g., `Rice_prices.csv`, `Potato_prices.csv`)
- A combined JSON data file (`all_prices_data.json`)

### CSV Format

Each CSV contains the following columns:

- Month
- Product Name
- Price Range
- Price Type (Retail/Wholesale)
- Source Date
- Article Title
- Article URL

## Understanding the Code

### Project Structure

- `index.js`: Main entry point
- `orchestrator.js`: Manages parallel worker threads
- `worker.js`: Processes individual dates and extracts data
- `utils.js`: Contains core extraction logic and utility functions
- `config.js`: Configuration settings and regex patterns
- `browser.js`: Browser automation functions
- `output.js`: Generates output files
- `scheduler.js`: Cron job scheduler
- `start-scheduler.js`: Helper script to run scheduler as a background process

### Key Components

1. **Price Extraction Algorithm**:

   - Sentence-based analysis to properly match commodities with their prices
   - Context-aware matching to avoid false positives
   - Price pattern recognition with filters for special cases

2. **Web Scraping Approach**:

   - Uses Playwright for browser automation
   - Employs stealth techniques to avoid detection
   - Includes retry mechanisms for robustness

3. **Data Processing**:
   - Deduplicates similar prices on the same day
   - Properly formats dates and ensures data quality
   - Adds source verification data to CSV output

## Troubleshooting

### Common Issues

1. **Missing dependencies**:

   - Ensure you've run `npm install` to install all required packages

2. **Playwright browser issues**:

   - Run `npx playwright install` to install browser dependencies

3. **Permission errors on Linux**:

   - Run `chmod +x start-scheduler.js` to make the script executable

4. **Scheduler not running**:
   - Check the logs in the `logs` directory for error messages
   - Ensure Node.js is properly installed and configured

### Logging

- Regular execution logs are printed to the console
- Scheduler logs are stored in the `logs` directory:
  - `scheduler.log`: JSON-formatted logs of scheduled runs
  - `scheduler-out.log`: Standard output from the scheduler
  - `scheduler-err.log`: Error output from the scheduler

## Extending the Scraper

### Adding New Commodities

Edit the `PRODUCT_VARIANTS` object in `config.js` to add new commodities:

```javascript
'New Commodity': ['variant1', 'variant2', 'বাংলা variant'],
```

### Customizing Price Patterns

The price extraction regex patterns can be customized in `config.js` in the `PRICE_PATTERNS` array.

### Adding New Data Sources

Currently, the scraper is designed for NewAge BD archives. To add new sources:

1. Create a new module for the source with appropriate extraction logic
2. Update the orchestrator to support the new source
3. Adjust price extraction patterns if needed

## License

This project is licensed under the ISC License.

## Acknowledgements

- [Playwright](https://playwright.dev/) - For browser automation
- [node-cron](https://github.com/node-cron/node-cron) - For scheduling
- [date-fns](https://date-fns.org/) - For date manipulation
- [fs-extra](https://github.com/jprichardson/node-fs-extra) - For enhanced file operations
- [commander](https://github.com/tj/commander.js/) - For command line argument parsing
