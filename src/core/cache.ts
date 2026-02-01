import { FeedDatabase } from '../storage/database.js';

export interface DiscoveryCacheEntry {
  key: string;
  value: any;
  expiresAt: number;
  createdAt: number;
}

export class DiscoveryCache {
  private db: FeedDatabase;
  private defaultTTLSeconds: number;

  constructor(db: FeedDatabase, defaultTTLSeconds: number = 300) {
    this.db = db;
    this.defaultTTLSeconds = defaultTTLSeconds;
  }

  get(url: string): any | undefined {
    const key = this.getCacheKey(url);
    const cached = this.db.getCache(key);

    if (!cached) {
      return undefined;
    }

    const expiresAt = cached.expiresAt;
    const now = Math.floor(Date.now() / 1000);

    if (expiresAt < now) {
      this.db.setCache(key, Buffer.from(''), 1);
      return undefined;
    }

    const value = JSON.parse(cached.value.toString('utf-8'));
    return value;
  }

  set(url: string, value: any, ttlSeconds?: number): void {
    const key = this.getCacheKey(url);
    const ttl = ttlSeconds ?? this.defaultTTLSeconds;
    const expiresAt = Math.floor(Date.now() / 1000) + ttl;
    const valueBuffer = Buffer.from(JSON.stringify(value), 'utf-8');
    this.db.setCache(key, valueBuffer, ttl);
  }

  clear(): void {
    this.db.clearCache();
  }

  getStats(): { entries: number; hitRate: number } {
    const stats = this.db.getCacheStats();
    return {
      entries: stats.count,
      hitRate: 0
    };
  }

  private getCacheKey(url: string): string {
    return `discovery:${url}`;
  }

  isCached(url: string): boolean {
    const key = this.getCacheKey(url);
    const cached = this.db.getCache(key);
    return cached !== undefined;
  }

  invalidate(url: string): void {
    const key = this.getCacheKey(url);
    this.db.setCache(key, Buffer.from(''), 1);
  }
}
