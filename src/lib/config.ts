export const config = {
  port: Number(process.env.PORT) || 3000,
  auth: {
    secretKey: process.env.AUTH_SECRET_KEY || "nx-cache-server-secret-key",
    readOnlyToken: process.env.READ_ONLY_TOKEN || "readonly",
    readWriteToken: process.env.READ_WRITE_TOKEN || "readwrite",
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    ttl: Number(process.env.CACHE_TTL) || 7 * 24 * 60 * 60, // 7 days in seconds
  },
  cache: {
    maxSize: Number(process.env.MAX_CACHE_SIZE) || 100 * 1024 * 1024, // 100MB
  },
} as const;