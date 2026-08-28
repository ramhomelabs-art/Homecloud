# ==============================================================================
#  NEXADISK V2 - MASTER SERVER DOCKERFILE
# ==============================================================================

# Build Frontend
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --silent
COPY client/ ./
RUN npm run build

# Runtime Container
FROM node:20-alpine AS runtime
WORKDIR /app

# Install hardware & media tools: SMART monitoring, ffmpeg, OpenSSL
RUN apk add --no-cache smartmontools ffmpeg openssl bash iproute2

COPY package*.json ./
RUN npm ci --only=production --silent

COPY server/ ./server/
COPY --from=client-builder /app/client/dist ./client/dist

# Create storage roots
RUN mkdir -p /var/lib/nexadisk/storage /var/lib/nexadisk/trash

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["node", "server/index.js"]
