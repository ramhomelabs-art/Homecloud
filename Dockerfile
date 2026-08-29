# ==============================================================================
#  NEXADISK V2 - MASTER STORAGE CLUSTER DOCKERFILE
# ==============================================================================

# Stage 1: Build React Frontend Client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps
COPY client/ ./
RUN npm run build

# Stage 2: Production Server Runtime Container
FROM node:20-alpine AS runtime
WORKDIR /app

# Install hardware telemetry, compression, media processing & networking utilities
RUN apk add --no-cache smartmontools ffmpeg openssl bash iproute2 ca-certificates samba-client cifs-utils p7zip curl tzdata procps


# Install server dependencies
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --only=production --legacy-peer-deps || npm install --only=production --legacy-peer-deps

# Copy server application code & built client bundle
COPY server/ ./
COPY --from=client-builder /app/client/dist /app/client/dist

# Copy remote cluster agent codebase for auto-provisioning
COPY agent/ /app/agent/

# Create storage roots
RUN mkdir -p /var/lib/nexadisk/storage /var/lib/nexadisk/trash /var/lib/nexadisk/backups


ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["node", "index.js"]
