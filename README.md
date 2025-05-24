### parallelArchiveScraper


## DEPENDENCIES:
1. Puppeteer for headless browser emulation
2. date-fns - manipulation of date-time and formatting
3. Commander - CLI usage streamlining
4. fs-extra - file manipulation

## INSTALL DEPENDENCIES
npm install puppeteer date-fns fs-extra commander

### HOW TO RUN:
node parallelArchiveScraper.js --start 2024-01-01 --end 2024-01-31 --workers 4 --commodities "Sugar,Rice,Broiler Chicken,Eggs"
^^date range (can be anything) ^^specify number of workers ^^commodities, must be csv
