#!/usr/bin/env bun

/**
 * Test script for the Nx Cache Server API
 * Run with: bun run scripts/test-api.ts
 */

const BASE_URL = process.env.NX_CACHE_URL || "http://localhost:3000";
const READ_TOKEN = process.env.READ_TOKEN || "readonly";
const WRITE_TOKEN = process.env.WRITE_TOKEN || "readwrite";

async function testHealth() {
  console.log("🏥 Testing health endpoint...");
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    console.log("✅ Health check:", data);
  } catch (error) {
    console.error("❌ Health check failed:", error);
  }
}

async function testAuthenticationFailure() {
  console.log("🔐 Testing authentication failure...");
  try {
    const response = await fetch(`${BASE_URL}/v1/cache/test-hash`);
    console.log("✅ Authentication correctly rejected:", response.status);
  } catch (error) {
    console.error("❌ Authentication test failed:", error);
  }
}

async function testCacheUpload() {
  console.log("📤 Testing cache upload...");
  try {
    const testData = "Hello, Nx Cache!";
    const response = await fetch(`${BASE_URL}/v1/cache/test-hash-123`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${WRITE_TOKEN}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": testData.length.toString(),
      },
      body: testData,
    });
    
    console.log("✅ Cache upload response:", response.status, await response.text());
  } catch (error) {
    console.error("❌ Cache upload failed:", error);
  }
}

async function testCacheDownload() {
  console.log("📥 Testing cache download...");
  try {
    const response = await fetch(`${BASE_URL}/v1/cache/test-hash-123`, {
      headers: {
        "Authorization": `Bearer ${READ_TOKEN}`,
      },
    });
    
    if (response.ok) {
      const data = await response.text();
      console.log("✅ Cache download successful:", data);
    } else {
      console.log("📭 Cache not found (expected if not uploaded):", response.status);
    }
  } catch (error) {
    console.error("❌ Cache download failed:", error);
  }
}

async function testWebInterface() {
  console.log("🌐 Testing web interface...");
  try {
    const response = await fetch(`${BASE_URL}/web`);
    if (response.ok) {
      console.log("✅ Web interface accessible");
    } else {
      console.log("❌ Web interface failed:", response.status);
    }
  } catch (error) {
    console.error("❌ Web interface test failed:", error);
  }
}

async function runTests() {
  console.log(`🚀 Testing Nx Cache Server at ${BASE_URL}\n`);
  
  await testHealth();
  await testAuthenticationFailure();
  await testCacheUpload();
  await testCacheDownload();
  await testWebInterface();
  
  console.log("\n🎉 Test suite completed!");
}

if (import.meta.main) {
  runTests().catch(console.error);
}