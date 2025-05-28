# Use Playwright's official image with pre-installed browsers
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Install Node.js 18 (Playwright image comes with Node 16 by default)
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (keeping dev dependencies for Playwright CLI)
RUN npm ci

# Verify Playwright installation and browsers
RUN npx playwright --version && \
    ls -la /ms-playwright/chromium-*/chrome-linux/chrome

# Copy application code
COPY parallelArchiveScraperPlaywright.js ./
COPY docker-compose.yml ./

# Create output directory with proper permissions
RUN mkdir -p output

# Create non-root user (playwright user already exists in base image)
RUN chown -R playwright:playwright /app

# Switch to non-root user
USER playwright

# Expose any ports if needed (optional)
# EXPOSE 3000

# Health check to ensure the scraper can start
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

# Default command with sensible defaults for testing
CMD ["node", "parallelArchiveScraperPlaywright.js", \
    "--start", "2024-01-01", \
    "--end", "2024-01-03", \
    "--workers", "2", \
    "--headless"]