import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FeedDatabase } from '../../src/storage/database.js';
import { generateOPML, parseOPML } from '../../src/core/opml.js';

describe('OPML Import/Export Integration', () => {
  it('exports feeds to OPML and parses back', () => {
    const folder = mkdtempSync(join(tmpdir(), 'rss-viewer-'));
    const dbPath = join(folder, 'feeds.db');
    const db = new FeedDatabase(dbPath);

    try {
      db.addFeed({
        url: 'https://example.com/rss',
        title: 'Example RSS',
        link: 'https://example.com',
        type: 'rss',
        category: 'Tech'
      });
      db.addFeed({
        url: 'https://news.example.com/rss',
        title: 'Example News',
        link: 'https://news.example.com',
        type: 'rss',
        category: 'News'
      });

      const feeds = db.getAllFeeds().map(feed => ({
        url: feed.url,
        title: feed.title,
        category: feed.category
      }));

      const opml = generateOPML(feeds);
      const parsed = parseOPML(opml);

      expect(parsed.feeds).toHaveLength(2);
      expect(parsed.feeds).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: 'https://example.com/rss',
            title: 'Example RSS',
            category: 'Tech'
          }),
          expect.objectContaining({
            url: 'https://news.example.com/rss',
            title: 'Example News',
            category: 'News'
          })
        ])
      );
    } finally {
      db.close();
    }
  });
});
