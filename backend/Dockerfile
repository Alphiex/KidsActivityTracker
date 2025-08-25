# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript code (skip for now, use ts-node in production)
# RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files first
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/tsconfig.json ./

# Install all dependencies (including ts-node for now)
RUN npm ci

# Copy all source files
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma

# Generate Prisma client in production stage
RUN npx prisma generate

# Copy legacy API files
COPY --from=builder /app/api ./api
COPY --from=builder /app/database ./database
COPY --from=builder /app/services ./services
COPY --from=builder /app/scrapers ./scrapers
COPY --from=builder /app/utils ./utils
# Don't copy generated - we already generated it above
# COPY --from=builder /app/generated ./generated

# Copy scraper job files
COPY --from=builder /app/scraper-detailed-cloud-job.js ./
COPY --from=builder /app/update-schema-production.js ./
COPY --from=builder /app/scraper-job.js ./
COPY --from=builder /app/create-all-tables.sql ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of all files to nodejs user
RUN chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3000

# Start the application using JavaScript server with authentication
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "api/server.js"]