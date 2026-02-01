import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { FeedDatabase } from '../../src/storage/database.js';

describe('Database', () => {
  const testDbPath = join(process.cwd(), 'test.db');

  beforeEach(() => {
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
    const testDir = join(process.cwd(), 'test-data');
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      rmSync(testDbPath);
    } catch {}
  });

  it('should create database file and tables', () => {
    const db = new FeedDatabase(testDbPath);

    const feeds = db.getAllFeeds();
    expect(feeds).toEqual([]);

    db.close();
  });

  it('should add and retrieve a feed', () => {
    const db = new FeedDatabase(testDbPath);

    const feedId = db.addFeed({
      url: 'https://example.com/rss',
      title: 'Example Feed',
      link: 'https://example.com',
      type: 'rss',
      category: 'Tech'
    });

    expect(feedId).toBeGreaterThan(0);

    const feed = db.getFeedByUrl('https://example.com/rss');
    expect(feed).toBeDefined();
    expect(feed?.title).toBe('Example Feed');
    expect(feed?.category).toBe('Tech');

    db.close();
  });

  it('should update feed on duplicate URL', () => {
    const db = new FeedDatabase(testDbPath);

    db.addFeed({
      url: 'https://example.com/rss',
      title: 'Original Title',
      link: 'https://example.com',
      type: 'rss',
      category: 'Tech'
    });

    db.addFeed({
      url: 'https://example.com/rss',
      title: 'Updated Title',
      link: 'https://example.com',
      type: 'rss',
      category: 'News'
    });

    const feed = db.getFeedByUrl('https://example.com/rss');
    expect(feed?.title).toBe('Updated Title');
    expect(feed?.category).toBe('News');

    db.close();
  });

  it('should remove a feed', () => {
    const db = new FeedDatabase(testDbPath);

    db.addFeed({
      url: 'https://example.com/rss',
      title: 'Example Feed',
      link: 'https://example.com',
      type: 'rss',
      category: 'Tech'
    });

    const removed = db.removeFeed('https://example.com/rss');
    expect(removed).toBe(true);

    const feed = db.getFeedByUrl('https://example.com/rss');
    expect(feed).toBeUndefined();

    db.close();
  });

  it('should add and retrieve articles', () => {
    const db = new FeedDatabase(testDbPath);

    const feedId = db.addFeed({
      url: 'https://example.com/rss',
      title: 'Example Feed',
      link: 'https://example.com',
      type: 'rss',
      category: 'Tech'
    });

    db.addArticle({
      feedId,
      title: 'Test Article',
      link: 'https://example.com/article1',
      content: '<p>Article content</p>',
      summary: 'Article summary',
      author: 'John Doe',
      publishedAt: '2024-01-01T00:00:00.000Z',
      readAt: null
    });

    const articles = db.getArticlesByFeedId(feedId);
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('Test Article');

    db.close();
  });

  it('should cache and retrieve values with TTL', () => {
    const db = new FeedDatabase(testDbPath);

    const key = 'test-key';
    const value = Buffer.from('test-value');

    db.setCache(key, value, 60);

    const cached = db.getCache(key);
    expect(cached).toBeDefined();
    expect(cached?.value).toEqual(value);

    const stats = db.getCacheStats();
    expect(stats.count).toBe(1);

    db.close();
  });

  it('should clear expired cache entries', () => {
    const db = new FeedDatabase(testDbPath);

    const key = 'test-key';
    const value = Buffer.from('test-value');

    db.setCache(key, value, -1);

    const cached = db.getCache(key);
    expect(cached).toBeUndefined();

    db.close();
  });
});
