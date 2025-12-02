# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files (adjust paths for root context)
COPY app/package*.json ./
COPY app/frontend/package*.json ./frontend/

# Install dependencies
RUN npm install
RUN cd frontend && npm install

# Copy source code
# Copy app folder contents to /app
COPY app/ .
# Copy abi and ids folders from root to /app/abi and /app/ids
COPY abi/ ./abi
COPY ids/ ./ids

# Build frontend
RUN cd frontend && npm run build

# Build backend
RUN npm run build
RUN echo "Listing dist folder:" && ls -R dist
RUN echo "Listing abi folder:" && ls -R abi

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY app/package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/abi ./abi
COPY --from=builder /app/ids ./ids

# Copy env file from app/ folder
COPY app/.env .env

# Expose port
EXPOSE 3000

# Env vars (default)
ENV PORT=3000
ENV NODE_ENV=production

# Start server
CMD ["node", "dist/src/index.js"]
