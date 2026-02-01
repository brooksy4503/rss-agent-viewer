import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export interface Feed {
  id: number;
  url: string;
  title: string;
  link: string;
  type: 'rss' | 'atom';
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface Article {
  id: number;
  feedId: number;
  title: string;
  link: string;
  content: string | null;
  summary: string | null;
  author: string | null;
  publishedAt: string;
  readAt: string | null;
  createdAt: string;
}

export interface Cache {
  key: string;
  value: Buffer;
  expiresAt: number;
  createdAt: number;
}

export class FeedDatabase {
  private db: DatabaseType;

  constructor(dbPath: string) {
    const dbDir = dirname(dbPath);

    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.runMigrations();
  }

  private runMigrations() {
    this.db.transaction(() => {
      const migrationsTable = this.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='migrations'
      `).get();

      if (!migrationsTable) {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version INTEGER NOT NULL UNIQUE,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }

      const appliedMigrations = this.db.prepare(
        'SELECT version FROM migrations ORDER BY version DESC'
      ).all() as Array<{ version: number }>;

      const appliedVersions = new Set(appliedMigrations.map(m => m.version));

      const migrations = this.getMigrations();

      for (const migration of migrations) {
        if (!appliedVersions.has(migration.version)) {
          console.log(`Applying migration v${migration.version}: ${migration.description}`);
          migration.up(this.db);
          this.db.prepare(
            'INSERT INTO migrations (version) VALUES (?)'
          ).run(migration.version);
        }
      }
    })();
  }

  private getMigrations() {
    return [
      {
        version: 1,
        description: 'Initial schema: feeds, articles, cache tables',
        up: (db: DatabaseType) => {
          db.exec(`
            CREATE TABLE IF NOT EXISTS feeds (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              url TEXT UNIQUE NOT NULL,
              title TEXT NOT NULL,
              link TEXT NOT NULL,
              type TEXT NOT NULL DEFAULT 'rss',
              category TEXT NOT NULL DEFAULT 'General',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
          `);

          db.exec(`
            CREATE INDEX IF NOT EXISTS idx_feeds_url ON feeds(url)
          `);

          db.exec(`
            CREATE INDEX IF NOT EXISTS idx_feeds_category ON feeds(category)
          `);

          db.exec(`
            CREATE TABLE IF NOT EXISTS articles (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              feed_id INTEGER NOT NULL,
              title TEXT NOT NULL,
              link TEXT NOT NULL,
              content TEXT,
              summary TEXT,
              author TEXT,
              published_at TEXT,
              read_at TEXT,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE
            )
          `);

          db.exec(`
            CREATE INDEX IF NOT EXISTS idx_articles_feed_id ON articles(feed_id)
          `);

          db.exec(`
            CREATE INDEX IF NOT EXISTS idx_articles_read_at ON articles(read_at)
          `);

          db.exec(`
            CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at)
          `);

          db.exec(`
            CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author)
          `);

          db.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_link ON articles(link)
          `);

          db.exec(`
            CREATE TABLE IF NOT EXISTS cache (
              key TEXT PRIMARY KEY,
              value BLOB,
              expires_at INTEGER NOT NULL,
              created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            )
          `);
        }
      }
    ];
  }

  addFeed(feed: Omit<Feed, 'id' | 'createdAt' | 'updatedAt'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO feeds (url, title, link, type, category)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        title = excluded.title,
        link = excluded.link,
        type = excluded.type,
        category = excluded.category,
        updated_at = CURRENT_TIMESTAMP
    `);

    const result = stmt.run(feed.url, feed.title, feed.link, feed.type, feed.category);
    return result.lastInsertRowid as number;
  }

  getFeedByUrl(url: string): Feed | undefined {
    const stmt = this.db.prepare('SELECT * FROM feeds WHERE url = ?');
    return stmt.get(url) as Feed | undefined;
  }

  getAllFeeds(): Feed[] {
    const stmt = this.db.prepare('SELECT * FROM feeds ORDER BY created_at DESC');
    return stmt.all() as Feed[];
  }

  removeFeed(url: string): boolean {
    const stmt = this.db.prepare('DELETE FROM feeds WHERE url = ?');
    const result = stmt.run(url);
    return result.changes > 0;
  }

  addArticle(article: Omit<Article, 'id' | 'createdAt'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO articles (feed_id, title, link, content, summary, author, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(link) DO UPDATE SET
        content = excluded.content,
        summary = excluded.summary,
        author = excluded.author,
        published_at = excluded.published_at
    `);

    const result = stmt.run(
      article.feedId,
      article.title,
      article.link,
      article.content,
      article.summary,
      article.author,
      article.publishedAt
    );
    return result.lastInsertRowid as number;
  }

  getArticlesByFeedId(feedId: number, limit: number = 20): Article[] {
    const stmt = this.db.prepare(`
      SELECT * FROM articles
      WHERE feed_id = ?
      ORDER BY published_at DESC
      LIMIT ?
    `);
    return stmt.all(feedId, limit) as Article[];
  }

  getAllArticles(limit: number = 20, offset: number = 0): Article[] {
    const stmt = this.db.prepare(`
      SELECT * FROM articles
      ORDER BY published_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as Article[];
  }

  searchArticles(query: string, limit: number = 20): Article[] {
    const stmt = this.db.prepare(`
      SELECT * FROM articles
      WHERE title LIKE ? OR summary LIKE ? OR content LIKE ?
      ORDER BY published_at DESC
      LIMIT ?
    `);
    const searchTerm = `%${query}%`;
    return stmt.all(searchTerm, searchTerm, searchTerm, limit) as Article[];
  }

  filterArticles(options: { limit?: number; since?: Date; author?: string; category?: string }): Article[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.since) {
      conditions.push(`published_at >= ?`);
      params.push(options.since.toISOString());
    }

    if (options.author) {
      conditions.push(`author LIKE ?`);
      params.push(`%${options.author}%`);
    }

    if (options.category) {
      conditions.push(`feed_id IN (SELECT id FROM feeds WHERE category = ?)`);
      params.push(options.category);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit || 20;
    const limitClause = `LIMIT ?`;

    const stmt = this.db.prepare(`
      SELECT * FROM articles
      ${whereClause}
      ORDER BY published_at DESC
      ${limitClause}
    `);

    return stmt.all(...params, limit) as Article[];
  }

  markAsRead(articleId: number): void {
    const stmt = this.db.prepare(`
      UPDATE articles SET read_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(articleId);
  }

  getCache(key: string): Cache | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM cache WHERE key = ? AND expires_at > strftime('%s', 'now')
    `);
    return stmt.get(key) as Cache | undefined;
  }

  setCache(key: string, value: Buffer, ttlSeconds: number): void {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cache (key, value, expires_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(key, value, expiresAt);
  }

  clearCache(): void {
    this.db.prepare('DELETE FROM cache').run();
  }

  getCacheStats(): { count: number; size: number } {
    const count = this.db.prepare('SELECT COUNT(*) as count FROM cache').get() as { count: number };
    const size = this.db.prepare('SELECT SUM(LENGTH(value)) as size FROM cache').get() as { size: number };
    return {
      count: count.count,
      size: size.size || 0
    };
  }

  close(): void {
    this.db.close();
  }
}
