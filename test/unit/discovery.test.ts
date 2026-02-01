import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverFeeds } from '../../src/core/discovery.js';

vi.mock('rss-agent-discovery', async () => {
  const actual = await vi.importActual('rss-agent-discovery');
  return {
    ...actual,
    findRSSFeeds: vi.fn()
  };
});

const { findRSSFeeds } = await import('rss-agent-discovery');
const findRSSFeedsMock = vi.mocked(findRSSFeeds);

describe('Discovery Wrapper', () => {
  beforeEach(() => {
    findRSSFeedsMock.mockReset();
  });

  it('parses JSON from stdout with extra logs', async () => {
    findRSSFeedsMock.mockResolvedValue({
      url: 'https://example.com',
      feeds: [{ url: 'https://example.com/rss', title: 'Example', type: 'rss' }],
      error: null
    });

    const result = await discoverFeeds('https://example.com');
    expect(result.success).toBe(true);
    expect(result.results[0].feeds[0].url).toBe('https://example.com/rss');
  });

  it('parses JSON from stderr when stdout is empty', async () => {
    findRSSFeedsMock.mockResolvedValue({
      url: 'https://example.com',
      feeds: [],
      error: 'timeout'
    });

    const result = await discoverFeeds('https://example.com');
    expect(result.success).toBe(false);
    expect(result.results[0].error).toBe('timeout');
  });

  it('returns exit code error when no JSON output', async () => {
    findRSSFeedsMock.mockRejectedValue(new Error('Command exited with code 2'));

    const result = await discoverFeeds('https://example.com');
    expect(result.success).toBe(false);
    expect(result.results[0].error).toContain('exited with code 2');
  });

  it('returns generic error when JSON is malformed', async () => {
    findRSSFeedsMock.mockRejectedValue(new Error('No valid JSON output from rss-discover'));

    const result = await discoverFeeds('https://example.com');
    expect(result.success).toBe(false);
    expect(result.results[0].error).toBe('No valid JSON output from rss-discover');
  });

  it('normalizes output when feeds are top-level', async () => {
    findRSSFeedsMock.mockResolvedValue({
      url: 'https://example.com',
      feeds: [{ url: 'https://example.com/rss', title: '', type: 'rss' }],
      error: null
    });

    const result = await discoverFeeds('https://example.com');
    expect(result.success).toBe(true);
    expect(result.results[0].feeds[0].title).toBe('https://example.com/rss');
  });

  it('normalizes when output is a feeds array', async () => {
    findRSSFeedsMock.mockResolvedValue({
      url: 'https://example.com',
      feeds: [{ url: 'https://example.com/atom', title: 'Example', type: 'atom' }],
      error: null
    });

    const result = await discoverFeeds('https://example.com');
    expect(result.success).toBe(true);
    expect(result.results[0].feeds[0].type).toBe('atom');
  });

  it('prefers stdout JSON over stderr JSON', async () => {
    findRSSFeedsMock.mockResolvedValue({
      url: 'https://example.com',
      feeds: [{ url: 'https://example.com/rss', title: 'Example', type: 'rss' }],
      error: null
    });

    const result = await discoverFeeds('https://example.com');
    expect(result.success).toBe(true);
    expect(result.results[0].feeds.length).toBe(1);
  });
});