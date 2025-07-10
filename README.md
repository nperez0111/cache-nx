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
   - **Web Interface**: `http://localhost:3000/web`
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
| `MAX_CACHE_SIZE` | `104857600` | Maximum cache item size in bytes (100MB) |

## Using with Nx

### 1. Configure Nx to use the cache server

Add the following to your `nx.json`:

```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "test", "lint", "e2e"],
        "remoteCache": {
          "url": "http://localhost:3000/v1",
          "readToken": "readonly",
          "writeToken": "readwrite"
        }
      }
    }
  }
}
```

### 2. Environment-specific configuration

For different environments, you can use environment variables:

```bash
# Development
export NX_CACHE_URL="http://localhost:3000/v1"
export NX_CACHE_READ_TOKEN="readonly"
export NX_CACHE_WRITE_TOKEN="readwrite"

# Production
export NX_CACHE_URL="https://your-cache-server.com/v1"
export NX_CACHE_READ_TOKEN="your-production-read-token"
export NX_CACHE_WRITE_TOKEN="your-production-write-token"
```

Then in your `nx.json`:

```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "test", "lint", "e2e"],
        "remoteCache": {
          "url": "${NX_CACHE_URL}",
          "readToken": "${NX_CACHE_READ_TOKEN}",
          "writeToken": "${NX_CACHE_WRITE_TOKEN}"
        }
      }
    }
  }
}
```

### 3. Testing the cache

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
For enhanced security, generate custom tokens using Bun's crypto API:

```typescript
// Using Bun's built-in CryptoHasher
const secretKey = 'your-secret-key';
const tokenData = { permissions: 'readwrite', userId: 'user123' };
const tokenPart = Buffer.from(JSON.stringify(tokenData)).toString('base64url');

const hasher = new Bun.CryptoHasher('sha256', secretKey);
hasher.update(tokenPart);
const signature = Buffer.from(hasher.digest()).toString('base64url');
const token = `${tokenPart}.${signature}`;

// Or use the built-in helper function:
import { generateCustomToken } from './src/lib/auth';
const token = generateCustomToken('readwrite', 'user123');
```

## API Reference

The server implements the [Nx remote cache API specification](https://nx.dev/recipes/running-tasks/self-hosted-caching):

### Upload Cache
```http
PUT /v1/cache/{hash}
Authorization: Bearer {token}
Content-Length: {size}
Content-Type: application/octet-stream

{binary-data}
```

### Download Cache
```http
GET /v1/cache/{hash}
Authorization: Bearer {token}
```

### Response Codes
- `200` - Cache retrieved successfully
- `202` - Cache uploaded successfully  
- `401` - Missing or invalid authentication token
- `403` - Access forbidden (e.g., read-only token used for write)
- `404` - Cache not found
- `409` - Cannot override existing record
- `413` - Cache item too large

## Web Interface

Access the web interface at `http://localhost:3000/web` to:

- View cache statistics (total items, total size)
- Browse all cached items with metadata
- Delete individual cache items
- Purge all caches
- Monitor cache usage in real-time

The interface auto-refreshes every 30 seconds and provides a clean, responsive UI built with Tailwind CSS.

## Production Deployment

### Security Recommendations

1. **Change default tokens**: Always use custom tokens in production
2. **Use HTTPS**: Deploy behind a reverse proxy with SSL/TLS
3. **Network security**: Restrict access to authorized networks
4. **Resource limits**: Configure appropriate Redis memory limits

### Example production docker-compose.yml

```yaml
version: '3.8'
services:
  nx-cache-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - REDIS_URL=redis://redis:6379
      - AUTH_SECRET_KEY=${AUTH_SECRET_KEY}
      - READ_ONLY_TOKEN=${READ_ONLY_TOKEN}
      - READ_WRITE_TOKEN=${READ_WRITE_TOKEN}
      - CACHE_TTL=604800
      - MAX_CACHE_SIZE=104857600
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

  redis:
    image: redis:7.2.3-alpine
    command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

volumes:
  redis_data:
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-cache-server.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase upload limits for large cache items
        client_max_body_size 100M;
    }
}
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
   - Verify Nx configuration syntax
   - Check server logs for errors
   - Test API endpoints directly with curl

### Debug Mode
Enable debug logging by setting:
```bash
export NODE_ENV=development
```

## Development

### Project Structure
```
src/
├── server.ts           # Main server entry point
├── lib/
│   ├── config.ts       # Configuration management
│   ├── redis.ts        # Redis connection setup
│   └── auth.ts         # Authentication logic
├── routes/
│   ├── cache.ts        # Cache API routes
│   └── web.ts          # Web interface routes
└── types/
    └── index.ts        # TypeScript type definitions
```

### Running Tests
```bash
bun test
```

### Building for Production
```bash
bun run build
```

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
