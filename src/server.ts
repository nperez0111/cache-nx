import { Elysia } from "elysia";
import cacheApp from "./routes/cache";
import webApp from "./routes/web";
import { config } from "./lib/config";
import { setupRedis } from "./lib/redis";

import frontend from "./frontend/index.html";

// Initialize Redis connection
const redisClient = await setupRedis();

export const app = new Elysia()
  .decorate("redis", redisClient)
  .decorate("config", config)
  .use(cacheApp)
  .use(webApp)
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

console.log(`🦊 Nx Cache Server is running at http://localhost:${config.port}`);
console.log(`🔑 Redis connected to: ${config.redis.url}`);

export type App = typeof app;

Bun.serve({
  routes: {
    "/": frontend,
  },
  fetch: app.fetch,
  port: config.port,
});
