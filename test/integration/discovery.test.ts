import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FeedDatabase } from '../../src/storage/database.js';

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  spawnSync: spawnSyncMock
}));

async function loadCommands() {
  return await import('../../src/cli/commands.js');
}

describe('Discovery Integration', () => {
  let tempDir: string;
  let configPath: string;
  let dbPath: string;

  beforeEach(() => {
    vi.resetModules();
    spawnSyncMock.mockReset();

    tempDir = mkdtempSync(join(tmpdir(), 'rss-viewer-'));
    configPath = join(tempDir, 'config', 'config.json');
    dbPath = join(tempDir, 'data', 'feeds.db');

    process.env.RSS_VIEWER_CONFIG_PATH = configPath;
    process.env.RSS_VIEWER_DB_PATH = dbPath;
    process.env.RSS_VIEWER_CACHE_TTL = '600000';
    process.env.RSS_DISCOVER_TIMEOUT = '15000';
    process.env.RSS_DISCOVER_MAX_BLOGS = '5';
  });

  afterEach(() => {
    delete process.env.RSS_VIEWER_CONFIG_PATH;
    delete process.env.RSS_VIEWER_DB_PATH;
    delete process.env.RSS_VIEWER_CACHE_TTL;
    delete process.env.RSS_DISCOVER_TIMEOUT;
    delete process.env.RSS_DISCOVER_MAX_BLOGS;

    rmSync(tempDir, { recursive: true, force: true });
  });

  it('caches discovery results and reuses cache', async () => {
    const { handleInit, handleDiscover } = await loadCommands();

    spawnSyncMock.mockReturnValue({
      stdout: JSON.stringify({
        success: true,
        results: [
          {
            url: 'https://example.com',
            feeds: [{ url: 'https://example.com/rss', title: 'Example', type: 'rss' }],
            error: null
          }
        ]
      }),
      stderr: '',
      status: 0,
      error: null,
      signal: null,
      pid: 1234
    });

    await handleInit();
    await handleDiscover('https://example.com', {});
    await handleDiscover('https://example.com', {});

    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
  });

  it('uses cached discovery results in add --discover', async () => {
    const { handleInit, handleDiscover, handleAdd } = await loadCommands();

    spawnSyncMock.mockReturnValue({
      stdout: JSON.stringify({
        success: true,
        results: [
          {
            url: 'https://example.com',
            feeds: [{ url: 'https://example.com/rss', title: 'Example', type: 'rss' }],
            error: null
          }
        ]
      }),
      stderr: '',
      status: 0,
      error: null,
      signal: null,
      pid: 1234
    });

    await handleInit();
    await handleDiscover('https://example.com', {});

    spawnSyncMock.mockClear();
    await handleAdd('https://example.com', { discover: true, category: 'Tech' });

    expect(spawnSyncMock).not.toHaveBeenCalled();

    const db = new FeedDatabase(dbPath);
    try {
      const feed = db.getFeedByUrl('https://example.com/rss');
      expect(feed).toBeTruthy();
      expect(feed?.category).toBe('Tech');
    } finally {
      db.close();
    }
  });
});
