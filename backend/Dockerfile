# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/
COPY package*.json ./

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci --only=production

# Copy prisma schema and generate client
COPY backend/prisma ./prisma
RUN npx prisma generate

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy backend files and dependencies
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/generated ./backend/generated
COPY backend/ ./backend/

# Set working directory for backend
WORKDIR /app/backend

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Run the API server
CMD ["node", "api/server.js"]