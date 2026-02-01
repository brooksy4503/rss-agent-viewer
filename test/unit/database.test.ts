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

  it('should search articles with relevance using FTS', () => {
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
      title: 'Rust Programming Guide',
      link: 'https://example.com/article1',
      content: 'Learn Rust programming language basics',
      summary: 'Introduction to Rust',
      author: 'John Doe',
      publishedAt: '2024-01-01T00:00:00.000Z',
      readAt: null
    });

    db.addArticle({
      feedId,
      title: 'JavaScript Best Practices',
      link: 'https://example.com/article2',
      content: 'Modern JavaScript techniques',
      summary: 'JS tips and tricks',
      author: 'Jane Smith',
      publishedAt: '2024-01-02T00:00:00.000Z',
      readAt: null
    });

    const results = db.searchArticlesWithRelevance('Rust', {
      limit: 10
    });

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Rust Programming Guide');
    expect(results[0].relevanceScore).toBeDefined();

    db.close();
  });

  it('should handle quoted phrases in search', () => {
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
      title: 'Introduction to Machine Learning',
      link: 'https://example.com/article1',
      content: 'Machine learning basics',
      summary: 'ML overview',
      author: 'Alice',
      publishedAt: '2024-01-01T00:00:00.000Z',
      readAt: null
    });

    const results = db.searchArticlesWithRelevance('"Machine Learning"', {
      limit: 10
    });

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Introduction to Machine Learning');

    db.close();
  });

  it('should filter articles by date', () => {
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
      title: 'Old Article',
      link: 'https://example.com/article1',
      content: 'Old content',
      summary: 'Old summary',
      author: 'Author',
      publishedAt: '2024-01-01T00:00:00.000Z',
      readAt: null
    });

    db.addArticle({
      feedId,
      title: 'New Article',
      link: 'https://example.com/article2',
      content: 'New content',
      summary: 'New summary',
      author: 'Author',
      publishedAt: '2024-02-01T00:00:00.000Z',
      readAt: null
    });

    const results = db.searchArticlesWithRelevance('Article', {
      limit: 10,
      since: new Date('2024-01-15T00:00:00.000Z')
    });

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('New Article');

    db.close();
  });

  it('should filter articles by category', () => {
    const db = new FeedDatabase(testDbPath);

    const techFeedId = db.addFeed({
      url: 'https://example.com/rss',
      title: 'Tech Feed',
      link: 'https://example.com',
      type: 'rss',
      category: 'Tech'
    });

    const newsFeedId = db.addFeed({
      url: 'https://news.com/rss',
      title: 'News Feed',
      link: 'https://news.com',
      type: 'rss',
      category: 'News'
    });

    db.addArticle({
      feedId: techFeedId,
      title: 'Tech Article',
      link: 'https://example.com/article1',
      content: 'Tech content',
      summary: 'Tech summary',
      author: 'Author',
      publishedAt: '2024-01-01T00:00:00.000Z',
      readAt: null
    });

    db.addArticle({
      feedId: newsFeedId,
      title: 'News Article',
      link: 'https://news.com/article1',
      content: 'News content',
      summary: 'News summary',
      author: 'Author',
      publishedAt: '2024-01-02T00:00:00.000Z',
      readAt: null
    });

    const results = db.searchArticlesWithRelevance('Article', {
      limit: 10,
      category: 'Tech'
    });

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Tech Article');

    db.close();
  });
});
