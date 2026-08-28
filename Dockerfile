# ==============================================================================
#  NEXADISK V2 - MASTER STORAGE CLUSTER DOCKERFILE
# ==============================================================================

# Stage 1: Build React Frontend Client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --silent || npm install --silent
COPY client/ ./
RUN npm run build

# Stage 2: Production Server Runtime Container
FROM node:20-alpine AS runtime
WORKDIR /app

# Install hardware telemetry & media processing utilities
RUN apk add --no-cache smartmontools ffmpeg openssl bash iproute2 ca-certificates

# Install server dependencies
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --only=production --silent || npm install --only=production --silent

# Copy server application code & built client bundle
COPY server/ ./
COPY --from=client-builder /app/client/dist /app/client/dist

# Create storage roots
RUN mkdir -p /var/lib/nexadisk/storage /var/lib/nexadisk/trash /var/lib/nexadisk/backups

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["node", "index.js"]
