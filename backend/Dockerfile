# Build stage
FROM node:18-alpine AS builder

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
FROM node:18-alpine

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

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 3000

# Start the application using ts-node
ENTRYPOINT ["dumb-init", "--"]
CMD ["npx", "ts-node", "src/server.ts"]