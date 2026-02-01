import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DiscoveryCache } from '../../src/core/cache.js';
import { FeedDatabase } from '../../src/storage/database.js';
import type { DiscoveredFeeds } from '../../src/core/types.js';

describe('Discovery Cache', () => {
  let db: FeedDatabase;
  let cache: DiscoveryCache;
  const testDbPath = join(process.cwd(), 'test-discovery.db');

  beforeEach(() => {
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }

    db = new FeedDatabase(testDbPath);
    cache = new DiscoveryCache(db);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  it('should cache and retrieve discovery results', () => {
    const testData: DiscoveredFeeds = {
      success: true,
      results: [{
        url: 'https://example.com',
        feeds: [{
          url: 'https://example.com/rss',
          title: 'Test Feed',
          type: 'rss'
        }],
        error: null
      }]
    };

    cache.set('https://example.com', testData, 300);

    const retrieved = cache.get('https://example.com');
    expect(retrieved).toEqual(testData);
  });

  it('should return undefined for cache miss', () => {
    const result = cache.get('https://not-cached.com');
    expect(result).toBeUndefined();
  });

  it('should respect TTL and expire old entries', () => {
    const testData: DiscoveredFeeds = {
      success: true,
      results: [{
        url: 'https://example.com',
        feeds: [],
        error: null
      }]
    };

    cache.set('https://example.com', testData, -1);

    const result = cache.get('https://example.com');
    expect(result).toBeUndefined();
  });

  it('should track cache statistics', () => {
    cache.set('https://example.com', { success: true }, 300);
    cache.set('https://example2.com', { success: false }, 300);

    const stats = cache.getStats();
    expect(stats.entries).toBe(2);
  });

  it('should clear all cache entries', () => {
    cache.set('https://example.com', { success: true }, 300);
    cache.clear();

    const result = cache.get('https://example.com');
    expect(result).toBeUndefined();

    const stats = cache.getStats();
    expect(stats.entries).toBe(0);
  });
});
