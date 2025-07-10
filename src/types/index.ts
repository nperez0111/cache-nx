export interface CacheMetadata {
  hash: string;
  size: number;
  createdAt: string;
  lastAccessed: string;
  contentType: string;
}

export interface CacheStats {
  totalItems: number;
  totalSize: number;
  oldestItem?: string;
  newestItem?: string;
}

export interface CacheListItem {
  hash: string;
  size: number;
  createdAt: string;
  lastAccessed: string;
}