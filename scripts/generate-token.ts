#!/usr/bin/env bun

/**
 * Token generation script using Bun's crypto API
 * Run with: bun run scripts/generate-token.ts [readonly|readwrite] [userId]
 */

import { generateCustomToken } from "../src/lib/auth";

function printUsage() {
  console.log("Usage: bun run scripts/generate-token.ts [readonly|readwrite] [userId]");
  console.log("\nExamples:");
  console.log("  bun run scripts/generate-token.ts readonly");
  console.log("  bun run scripts/generate-token.ts readwrite myuser123");
  console.log("\nEnvironment variables:");
  console.log("  AUTH_SECRET_KEY - Secret key for HMAC signing (required)");
}

function generateToken() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }
  
  const permissions = args[0] as "readonly" | "readwrite";
  const userId = args[1];
  
  if (!["readonly", "readwrite"].includes(permissions)) {
    console.error("❌ Error: Permission must be 'readonly' or 'readwrite'");
    printUsage();
    process.exit(1);
  }
  
  if (!process.env.AUTH_SECRET_KEY) {
    console.error("❌ Error: AUTH_SECRET_KEY environment variable is required");
    console.log("Set it with: export AUTH_SECRET_KEY='your-secret-key'");
    process.exit(1);
  }
  
  try {
    const token = generateCustomToken(permissions, userId);
    
    console.log("🎉 Token generated successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📋 Token: ${token}`);
    console.log(`🔑 Permissions: ${permissions}`);
    console.log(`👤 User ID: ${userId || "anonymous"}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n💡 Usage in Nx:");
    console.log(`export NX_CACHE_${permissions.toUpperCase()}_TOKEN="${token}"`);
    console.log("\n🧪 Test with curl:");
    console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3000/v1/cache/test-hash`);
    
  } catch (error) {
    console.error("❌ Error generating token:", error);
    process.exit(1);
  }
}

function generateSimpleTokens() {
  console.log("🔐 Simple Token Examples (using Bun's crypto):");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const secretKey = "example-secret-key";
  const tokenData = { permissions: "readwrite", userId: "example-user" };
  const tokenPart = Buffer.from(JSON.stringify(tokenData)).toString("base64url");
  
  // Use Bun's CryptoHasher
  const hasher = new Bun.CryptoHasher("sha256", secretKey);
  hasher.update(tokenPart);
  const signature = Buffer.from(hasher.digest()).toString("base64url");
  const customToken = `${tokenPart}.${signature}`;
  
  console.log("Using Bun.CryptoHasher for HMAC-SHA256:");
  console.log(`Token Data: ${JSON.stringify(tokenData)}`);
  console.log(`Token Part: ${tokenPart}`);
  console.log(`Signature: ${signature}`);
  console.log(`Full Token: ${customToken}`);
  console.log("\nThis demonstrates how the server verifies tokens using Bun's native crypto API!");
}

if (import.meta.main) {
  if (process.argv.includes("--example")) {
    generateSimpleTokens();
  } else {
    generateToken();
  }
}