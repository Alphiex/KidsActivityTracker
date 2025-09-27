# Production Dockerfile for Kids Activity Tracker API
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY src ./src
COPY api ./api

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Create non-root user
RUN adduser -D -h /app appuser && chown -R appuser:appuser /app
USER appuser

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Start the server
CMD ["node", "dist/server.js"]