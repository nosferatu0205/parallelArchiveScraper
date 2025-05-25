# New Age BD Commodity Price Scraper - Dockerized

A parallel web scraper for extracting commodity prices from New Age Bangladesh's archive pages, now fully containerized with Docker.

## Quick Start

### 1. Clone and Setup
```bash
# Clone the repository
git clone [your-repo-url]
cd newage-price-scraper

# Copy environment variables
cp .env.example .env
```

### 2. Run with Docker Compose

#### Basic Usage (One-time scrape)
```bash
# Run with default settings
docker-compose up

# Run with custom dates via environment variables
START_DATE=2024-06-01 END_DATE=2024-06-30 docker-compose up

# Run in background
docker-compose up -d

# Check logs
docker-compose logs -f
```

#### Custom Parameters
Edit `.env` file or use environment variables:
```bash
START_DATE=2024-01-01 \
END_DATE=2024-12-31 \
WORKERS=6 \
COMMODITIES="Sugar,Rice,Eggs" \
docker-compose up
```

### 3. Output
- Results are saved in `./output/` directory on your host machine
- One CSV file per commodity
- Combined JSON file with all data

## Advanced Usage

### Build Only
```bash
docker-compose build
```

### Run with Scheduler (Daily Scraping)
```bash
# Enable scheduler profile for automatic daily runs at 2 AM
docker-compose --profile scheduler up -d
```

### Shell Access
```bash
# Access container shell for debugging
docker-compose run --rm scraper sh
```

### Clean Up
```bash
# Stop and remove containers
docker-compose down

# Remove everything including images
docker-compose down --rmi all
```

## Configuration

### Environment Variables
- `START_DATE`: Start date for scraping (YYYY-MM-DD)
- `END_DATE`: End date for scraping (YYYY-MM-DD)
- `WORKERS`: Number of parallel workers (default: 4)
- `COMMODITIES`: Comma-separated list of commodities to track

### Commodities Supported
- Sugar (Refined Sugar, White Sugar)
- Rice (Coarse, Miniket, Najirshail)
- Broiler Chicken
- Eggs
- Fish (Hilsa, Pangas, Katla, Rohita, Tilapia)
- Vegetables (Potato, Onion, Tomato, Green Chillies, etc.)
- Oil (Soybean Oil, Palm Oil)
- And more...

## Troubleshooting

### Memory Issues
If you encounter memory errors, adjust the limits in `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      memory: 8G  # Increase as needed
```

### Slow Performance
- Reduce number of workers
- Ensure Docker has enough resources allocated
- Check your internet connection

### No Output
- Check logs: `docker-compose logs`
- Ensure output directory has proper permissions
- Verify date range contains articles

## Development

### Local Development (Without Docker)
```bash
npm install
node parallelArchiveScraper.js --start 2024-01-01 --end 2024-01-31
```

### Modifying the Scraper
1. Edit `parallelArchiveScraper.js`
2. Rebuild: `docker-compose build`
3. Run: `docker-compose up`

## System Requirements
- Docker & Docker Compose installed
- At least 4GB RAM available to Docker
- Stable internet connection
- 1GB+ free disk space for output

## Notes
- First run may take longer as Docker downloads the base image
- The scraper respects rate limits to avoid overwhelming the server
- Each worker uses its own browser instance for parallel processing
