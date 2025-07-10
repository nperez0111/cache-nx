import { createHmac } from "node:crypto";
import { config } from "./config";

export type TokenType = "readonly" | "readwrite" | "invalid";

export function verifyToken(token: string): TokenType {
  if (!token) return "invalid";
  
  // Remove "Bearer " prefix if present
  const cleanToken = token.replace(/^Bearer\s+/, "");
  
  // Verify against known tokens
  if (cleanToken === config.auth.readOnlyToken) {
    return "readonly";
  }
  
  if (cleanToken === config.auth.readWriteToken) {
    return "readwrite";
  }
  
  // For custom tokens, verify using HMAC
  try {
    const [tokenPart, signature] = cleanToken.split(".");
    if (!tokenPart || !signature) {
      return "invalid";
    }
    
    const expectedSignature = Buffer.from(
      createHmac("sha256", config.auth.secretKey)
        .update(tokenPart)
        .digest()
    ).toString("base64url");
    
    if (signature === expectedSignature) {
      // Parse token to determine permissions
      const tokenData = JSON.parse(Buffer.from(tokenPart, "base64url").toString());
      return tokenData.permissions === "readwrite" ? "readwrite" : "readonly";
    }
  } catch (error) {
    // Invalid token format
  }
  
  return "invalid";
}

export function hasWritePermission(tokenType: TokenType): boolean {
  return tokenType === "readwrite";
}

export function hasReadPermission(tokenType: TokenType): boolean {
  return tokenType === "readonly" || tokenType === "readwrite";
}