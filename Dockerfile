# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    linux-headers \
    libc6-compat

# Copy package files
COPY package*.json ./
COPY requirements.txt ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Install Python dependencies for AI components
RUN pip3 install --no-cache-dir -r requirements.txt

# Create necessary directories
RUN mkdir -p logs models data config

# Copy application code
COPY src/ ./src/
COPY config/ ./config/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ai-gateway -u 1001 -G nodejs

# Change ownership of application files
RUN chown -R ai-gateway:nodejs /app

# Switch to non-root user
USER ai-gateway

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); \
    const options = { host: 'localhost', port: 3000, path: '/health', timeout: 2000 }; \
    const req = http.request(options, (res) => process.exit(res.statusCode === 200 ? 0 : 1)); \
    req.on('error', () => process.exit(1)); \
    req.end();"

# Start the application
CMD ["npm", "start"]