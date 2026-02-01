import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { handleInit } from '../../src/cli/commands.js';

describe('Init Flow Integration', () => {
  let tempDir: string;
  let configPath: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rss-viewer-'));
    configPath = join(tempDir, 'config', 'config.json');
    dbPath = join(tempDir, 'data', 'feeds.db');

    process.env.RSS_VIEWER_CONFIG_PATH = configPath;
    process.env.RSS_VIEWER_DB_PATH = dbPath;
    process.env.RSS_VIEWER_CACHE_TTL = '600000';
    process.env.RSS_DISCOVER_TIMEOUT = '15000';
    process.env.RSS_DISCOVER_MAX_BLOGS = '8';
  });

  afterEach(() => {
    delete process.env.RSS_VIEWER_CONFIG_PATH;
    delete process.env.RSS_VIEWER_DB_PATH;
    delete process.env.RSS_VIEWER_CACHE_TTL;
    delete process.env.RSS_DISCOVER_TIMEOUT;
    delete process.env.RSS_DISCOVER_MAX_BLOGS;

    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates config directory and file with overrides', async () => {
    await handleInit();

    expect(existsSync(join(tempDir, 'config'))).toBe(true);
    expect(existsSync(configPath)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as {
      databasePath: string;
      configPath: string;
      cacheTTL: number;
      discoveryTimeout: number;
      maxBlogs: number;
    };

    expect(config.databasePath).toBe(dbPath);
    expect(config.configPath).toBe(configPath);
    expect(config.cacheTTL).toBe(600000);
    expect(config.discoveryTimeout).toBe(15000);
    expect(config.maxBlogs).toBe(8);
  });

  it('initializes database with migrations and tables', async () => {
    await handleInit();

    expect(existsSync(dbPath)).toBe(true);

    const db = new Database(dbPath, { readonly: true });
    try {
      const tables = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
        .all()
        .map(row => row.name);

      expect(tables).toEqual(expect.arrayContaining(['feeds', 'articles', 'cache', 'migrations']));
    } finally {
      db.close();
    }
  });

  it('is idempotent when run multiple times', async () => {
    await handleInit();
    await handleInit();

    expect(existsSync(configPath)).toBe(true);
    expect(existsSync(dbPath)).toBe(true);
  });
});
