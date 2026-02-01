import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSearch } from '../../src/core/websearch/index.js';
import type { Config } from '../../src/core/websearch/types.js';

describe('WebSearch', () => {
  let mockConfig: Config;
  let webSearch: WebSearch;

  beforeEach(() => {
    mockConfig = {
      webSearchProvider: 'agent',
      exaApiKey: undefined,
      exaApiUrl: 'https://api.exa.ai/search',
      maxWebResults: 10,
      searchResultsLimit: 20,
      boostRecentSearch: false
    };
    webSearch = new WebSearch(mockConfig);
  });

  describe('searchWithAgent', () => {
    it('should return empty results for agent provider', async () => {
      const result = await webSearch.search('test query', { provider: 'agent' });

      expect(result.results).toEqual([]);
      expect(result.query).toBe('test query');
      expect(result.provider).toBe('agent');
    });
  });

  describe('filterUrlsForFeeds', () => {
    it('should deduplicate URLs', () => {
      const results = [
        { url: 'https://example.com/feed.xml', title: 'Feed 1', snippet: '', score: 1 },
        { url: 'https://example.com/feed.xml', title: 'Feed 1', snippet: '', score: 1 },
        { url: 'https://other.com/rss.xml', title: 'Feed 2', snippet: '', score: 1 }
      ];

      const filtered = webSearch['filterUrlsForFeeds'](results);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].url).toBe('https://example.com/feed.xml');
      expect(filtered[1].url).toBe('https://other.com/rss.xml');
    });

    it('should filter out blocked file extensions', () => {
      const results = [
        { url: 'https://example.com/feed.xml', title: 'Feed', snippet: '', score: 1 },
        { url: 'https://example.com/image.jpg', title: 'Image', snippet: '', score: 1 },
        { url: 'https://example.com/document.pdf', title: 'PDF', snippet: '', score: 1 },
        { url: 'https://example.com/video.mp4', title: 'Video', snippet: '', score: 1 }
      ];

      const filtered = webSearch['filterUrlsForFeeds'](results);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].url).toBe('https://example.com/feed.xml');
    });

    it('should be case-insensitive when filtering', () => {
      const results = [
        { url: 'https://example.com/feed.XML', title: 'Feed', snippet: '', score: 1 },
        { url: 'https://example.com/file.JPG', title: 'Image', snippet: '', score: 1 }
      ];

      const filtered = webSearch['filterUrlsForFeeds'](results);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].url).toBe('https://example.com/feed.XML');
    });
  });
});
