FROM oven/bun:1.3-alpine

RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Create a non-root user
RUN addgroup -S -g 1001 bunuser && \
    adduser -S -u 1001 -G bunuser bunuser

# Change ownership of the app directory
RUN chown -R bunuser:bunuser /app
USER bunuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["bun", "start"]