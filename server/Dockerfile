# ---- Build Stage ----
FROM node:20-alpine AS builder

# Install build tools for native addons (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---- Production Stage ----
FROM node:20-alpine

WORKDIR /app

# Copy only production node_modules and source
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/

# Create data directory for SQLite
RUN mkdir -p data

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "src/index.js"]
