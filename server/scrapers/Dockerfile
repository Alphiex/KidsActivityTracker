# Kids Activity Tracker - Scraper Dockerfile
# Uses Puppeteer for web scraping

FROM node:20-slim

# Install Puppeteer dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files from server root
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Generate Prisma client
RUN npx prisma generate

# Copy scraper source code and dependencies
COPY scrapers ./scrapers/
COPY generated ./generated/
COPY src/config ./src/config/
COPY src/utils ./utils/

# Set environment variables
ENV NODE_ENV=production
ENV HEADLESS=true

# Run the scraper orchestrator
CMD ["node", "scrapers/scripts/runAllScrapers.js"]
