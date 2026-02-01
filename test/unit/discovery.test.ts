import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { discoverFeeds } from '../../src/core/discovery.js';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn()
}));

const spawnSyncMock = vi.mocked(spawnSync);

describe('Discovery Wrapper', () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
  });

  it('parses JSON from stdout with extra logs', () => {
    spawnSyncMock.mockReturnValue({
      stdout: [
        'Debug: Fetching https://example.com',
        '{"success":true,"results":[{"url":"https://example.com","feeds":[{"url":"https://example.com/rss","title":"Example","type":"rss"}],"error":null}]}'
      ].join('\n'),
      stderr: '',
      status: 0,
      error: null,
      signal: null,
      pid: 1234
    } as ReturnType<typeof spawnSync>);

    const result = discoverFeeds('https://example.com');
    expect(result.success).toBe(true);
    expect(result.results[0].feeds[0].url).toBe('https://example.com/rss');
  });

  it('parses JSON from stderr when stdout is empty', () => {
    spawnSyncMock.mockReturnValue({
      stdout: '',
      stderr: [
        'Debug: Error scanning https://example.com/blog',
        '{"success":false,"results":[{"url":"https://example.com","feeds":[],"error":"timeout"}]}'
      ].join('\n'),
      status: 0,
      error: null,
      signal: null,
      pid: 1234
    } as ReturnType<typeof spawnSync>);

    const result = discoverFeeds('https://example.com');
    expect(result.success).toBe(false);
    expect(result.results[0].error).toBe('timeout');
  });

  it('returns exit code error when no JSON output', () => {
    spawnSyncMock.mockReturnValue({
      stdout: '',
      stderr: 'Debug: Failed to scan',
      status: 2,
      error: null,
      signal: null,
      pid: 1234
    } as ReturnType<typeof spawnSync>);

    const result = discoverFeeds('https://example.com');
    expect(result.success).toBe(false);
    expect(result.results[0].error).toContain('exited with code 2');
  });

  it('returns generic error when JSON is malformed', () => {
    spawnSyncMock.mockReturnValue({
      stdout: '{invalid json',
      stderr: '',
      status: 0,
      error: null,
      signal: null,
      pid: 1234
    } as ReturnType<typeof spawnSync>);

    const result = discoverFeeds('https://example.com');
    expect(result.success).toBe(false);
    expect(result.results[0].error).toBe('No valid JSON output from rss-discover');
  });

  it('normalizes output when feeds are top-level', () => {
    spawnSyncMock.mockReturnValue({
      stdout: JSON.stringify({
        success: true,
        url: 'https://example.com',
        feeds: [{ url: 'https://example.com/rss', title: '', type: 'rss' }]
      }),
      stderr: '',
      status: 0,
      error: null,
      signal: null,
      pid: 1234
    } as ReturnType<typeof spawnSync>);

    const result = discoverFeeds('https://example.com');
    expect(result.success).toBe(true);
    expect(result.results[0].feeds[0].title).toBe('https://example.com/rss');
  });

  it('normalizes when output is a feeds array', () => {
    spawnSyncMock.mockReturnValue({
      stdout: JSON.stringify([{ url: 'https://example.com/atom', title: 'Example', type: 'atom' }]),
      stderr: '',
      status: 0,
      error: null,
      signal: null,
      pid: 1234
    } as ReturnType<typeof spawnSync>);

    const result = discoverFeeds('https://example.com');
    expect(result.success).toBe(true);
    expect(result.results[0].feeds[0].type).toBe('atom');
  });

  it('prefers stdout JSON over stderr JSON', () => {
    spawnSyncMock.mockReturnValue({
      stdout: JSON.stringify({
        success: true,
        results: [{ url: 'https://example.com', feeds: [{ url: 'https://example.com/rss', title: 'Example', type: 'rss' }], error: null }]
      }),
      stderr: JSON.stringify({
        success: false,
        results: [{ url: 'https://example.com', feeds: [], error: 'timeout' }]
      }),
      status: 0,
      error: null,
      signal: null,
      pid: 1234
    } as ReturnType<typeof spawnSync>);

    const result = discoverFeeds('https://example.com');
    expect(result.success).toBe(true);
    expect(result.results[0].feeds.length).toBe(1);
  });
});
