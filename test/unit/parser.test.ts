import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const parseStringMock = vi.hoisted(() => vi.fn());

vi.mock('rss-parser', () => ({
  default: class {
    parseString = parseStringMock;
  }
}));

import { parseFeed, getFeedType } from '../../src/core/parser.js';

describe('Parser', () => {
  const mockFetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      text: () => Promise.resolve('<rss version="2.0"></rss>')
    } as Response)
  );

  beforeEach(() => {
    parseStringMock.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses RSS 2.0 feeds with defaults', async () => {
    parseStringMock.mockResolvedValue({
      title: 'Example Feed',
      description: 'Sample feed',
      link: 'https://example.com',
      items: [
        {
          title: 'Item One',
          link: 'https://example.com/one',
          pubDate: '2025-01-01T00:00:00.000Z',
          content: '<p>Content</p>',
          contentSnippet: 'Content',
          author: 'Author A'
        },
        {
          title: null,
          link: null,
          pubDate: null,
          content: null,
          contentSnippet: null,
          creator: 'Creator B'
        }
      ]
    });

    const result = await parseFeed('https://example.com/rss');
    expect(result.title).toBe('Example Feed');
    expect(result.items).toHaveLength(2);
    expect(result.items[0].author).toBe('Author A');
    expect(result.items[1].title).toBe('No title');
    expect(result.items[1].author).toBe('Creator B');
    expect(result.items[1].link).toBe('');
  });

  it('falls back to Unknown Feed when metadata is missing', async () => {
    parseStringMock.mockResolvedValue({
      title: undefined,
      description: undefined,
      link: undefined,
      items: []
    });

    const result = await parseFeed('https://example.com/rss');
    expect(result.title).toBe('Unknown Feed');
    expect(result.description).toBe('');
    expect(result.link).toBe('https://example.com/rss');
  });

  it('throws a helpful error on parse failure', async () => {
    parseStringMock.mockRejectedValue(new Error('Bad XML'));

    await expect(parseFeed('https://example.com/rss')).rejects.toThrow('Failed to parse feed: Bad XML');
  });

  it('detects feed type from XML content', () => {
    expect(getFeedType('<rss version="2.0"></rss>')).toBe('rss');
    expect(getFeedType('<feed xmlns="http://www.w3.org/2005/Atom"></feed>')).toBe('atom');
    expect(getFeedType('<atom></atom>')).toBe('atom');
    expect(getFeedType('<html></html>')).toBe('unknown');
  });
});
