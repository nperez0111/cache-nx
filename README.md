# Nx Cache Server

A self-hosted Nx cache server built with Bun and Elysia, featuring Redis storage and a web management interface.

## Features

- 🚀 **High Performance**: Built with Bun and Elysia for maximum performance
- 🔐 **Secure Authentication**: Token-based authentication with read/write permissions
- 📊 **Web Interface**: Built-in web dashboard to view and manage cache items
- 🐳 **Docker Ready**: Complete Docker setup with Redis included
- ⚡ **Redis Backend**: Fast, reliable caching with configurable TTL
- 🔄 **Full Nx Compatibility**: Implements the complete Nx remote cache API specification

## Quick Start

### Docker Compose (Recommended)

1. Clone this repository:

```bash
git clone <repository-url>
cd nx-cache-server
```

2. Start the services:

```bash
docker-compose up -d
```

3. The server will be available at:
   - **API**: `http://localhost:3000`
   - **Web Interface**: `http://localhost:3000`
   - **Health Check**: `http://localhost:3000/health`

### Local Development

1. **Prerequisites**:
   - [Bun](https://bun.sh) installed
   - Redis server running locally

2. **Install dependencies**:

```bash
bun install
```

3. **Configure environment** (copy from `.env.example`):

```bash
cp .env.example .env
```

4. **Start the server**:

```bash
bun dev
```

## Configuration

Configure the server using environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `AUTH_SECRET_KEY` | `nx-cache-server-secret-key` | Secret key for token signing |
| `READ_ONLY_TOKEN` | `readonly` | Token for read-only access |
| `READ_WRITE_TOKEN` | `readwrite` | Token for read-write access |
| `CACHE_TTL` | `604800` | Cache TTL in seconds (7 days) |
| `MAX_ITEM_SIZE` | `104857600` | Maximum cache item size in bytes (100MB) |
| `MAX_TOTAL_CACHE_SIZE` | `10737418240` | Maximum total cache size in bytes (10GB). When exceeded, least recently used entries are evicted. |

## Using with Nx

**Requirements**: Nx version 21 or higher

### Environment Variables Configuration

Set the following environment variables in your Nx workspace:

```bash
# Development
export NX_SELF_HOSTED_REMOTE_CACHE_SERVER="http://localhost:3000"
export NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN="your-access-token"

# Production
export NX_SELF_HOSTED_REMOTE_CACHE_SERVER="https://your-cache-server.com"
export NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN="your-production-access-token"
```

### Generating Access Tokens

You can generate custom tokens using the built-in helper function:

```typescript
import { generateCustomToken } from './src/lib/auth';
const token = generateCustomToken('readwrite', 'user123');
```

Or manually using the `generate-token` script:

```typescript
bun run scripts/generate-token.ts readwrite user123
```

### Testing the cache

Run a cacheable task twice to see the cache in action:

```bash
# First run - will populate the cache
nx build my-app

# Second run - will use cached result
nx build my-app
```

You should see output indicating the cache was used on the second run.

## Authentication

The server supports multiple authentication methods:

### Simple Tokens

Use predefined tokens for quick setup:

- Read-only: Set `READ_ONLY_TOKEN` environment variable
- Read-write: Set `READ_WRITE_TOKEN` environment variable

### Custom HMAC Tokens

For enhanced security, generate custom tokens using Bun's crypto API as shown above.

## Web Interface

Access the web interface at `http://localhost:3000` to:

- View cache statistics (total items, total size)
- Browse all cached items with metadata
- Delete individual cache items
- Purge all caches
- Monitor cache usage in real-time

The interface auto-refreshes every 30 seconds and provides a clean, responsive UI built with React and Tailwind CSS.

## Docker

### Using the Official Image

The server is available as a Docker image at `ghcr.io/nperez0111/cache-nx`:

```bash
docker pull ghcr.io/nperez0111/cache-nx
```

### Docker Compose Example

```yaml
version: '3.8'
services:
  nx-cache-server:
    image: ghcr.io/nperez0111/cache-nx
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - REDIS_URL=redis://valkey:6379
      - AUTH_SECRET_KEY=${AUTH_SECRET_KEY}
      - READ_ONLY_TOKEN=${READ_ONLY_TOKEN}
      - READ_WRITE_TOKEN=${READ_WRITE_TOKEN}
      - CACHE_TTL=604800
      - MAX_ITEM_SIZE=104857600
      - MAX_TOTAL_CACHE_SIZE=10737418240
    depends_on:
      valkey:
        condition: service_healthy
    restart: unless-stopped

  valkey:
    image: valkey/valkey:latest
    volumes:
      - valkey_data:/data
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

volumes:
  valkey_data:
```

## Monitoring

### Health Check

The server provides a health endpoint at `/health`:

```bash
curl http://localhost:3000/health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Logs

The server provides structured logging for:

- Cache hits/misses
- Authentication attempts
- Error conditions
- Redis connection status

## Troubleshooting

### Common Issues

1. **Redis connection failed**
   - Verify Redis is running and accessible
   - Check the `REDIS_URL` configuration
   - Ensure network connectivity

2. **Authentication failures**
   - Verify tokens match between Nx and server configuration
   - Check for extra whitespace in token values
   - Ensure proper Bearer token format

3. **Cache not working**
   - Verify Nx version is 21 or higher
   - Check environment variables are set correctly
   - Test server logs for errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:

- Create an issue on GitHub
- Check the troubleshooting section
- Review the Nx documentation for cache configuration

---

Built with ❤️ using [Bun](https://bun.sh) and [Elysia](https://elysiajs.com)
