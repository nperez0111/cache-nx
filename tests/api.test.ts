import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../src/server";

describe("Nx Cache Server API", () => {
  let server: any;

  beforeAll(async () => {
    // For testing, we could mock Redis or use a test instance
    // This is a basic test structure
  });

  afterAll(async () => {
    if (server) {
      server.stop();
    }
  });

  test("should return health status", async () => {
    const response = await app.handle(new Request("http://localhost/health"));
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeDefined();
  });

  test("should require authentication for cache operations", async () => {
    const response = await app.handle(
      new Request("http://localhost/v1/cache/test-hash")
    );
    
    expect(response.status).toBe(403);
  });

  test("should serve web interface", async () => {
    const response = await app.handle(new Request("http://localhost/web"));
    
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html");
  });
});