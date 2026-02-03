# RSS Agent Viewer - Architecture Plan

**Version**: 1.0  
**Target**: Individual user (scalable to teams)  
**Database**: Better-SQLite3 (local)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface                      │
│  CLI (Ink/Blessed)  │  Web (Next.js) │  API    │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Application Layer                      │
│  • Query processing                                │
│  • Feed management                                 │
│  • Cache coordination                              │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
┌─────────┐  ┌─────────┐  ┌──────────┐
│  RSS    │  │  Article│  │  Embed  │
│  Fetcher│  │  Parser │  │  Engine  │
└────┬────┘  └────┬────┘  └────┬─────┘
     │            │             │
     ▼            ▼             ▼
┌──────────────────────────────────────────────────────────┐
│              Data Layer                            │
│  Better-SQLite3 with FTS5                        │
│  • feeds (RSS subscriptions)                       │
│  • articles (fetched content)                      │
│  • articles_fts (full-text search)                │
│  • embeddings (vector similarity)                   │
└──────────────────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│              External Services                       │
│  • OpenAI API / Claude API (answer synthesis)       │
│  • Feed URLs (fetch content)                       │
└──────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Core Runtime
- **Runtime**: Bun or Node.js 20+
- **Language**: TypeScript
- **Package Manager**: pnpm

### CLI Implementation (MVP)
```javascript
// Core dependencies
{
  "dependencies": {
    "better-sqlite3": "^11.0.0",      // Database
    "openai": "^4.0.0",              // AI API
    "rss-parser": "^3.13.0",          // RSS parsing
    "ink": "^4.4.0",                 // TUI framework
    "meow": "^13.0.0",               // CLI parser
    "chalk": "^5.3.0",               // Colors
    "ora": "^8.0.0",                 // Spinners
    "openai": "^4.0.0"               // Optional: LLM API
  }
}
```

### Database Schema

```sql
-- RSS Feeds
CREATE TABLE feeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  category TEXT,
  added_at INTEGER DEFAULT (unixepoch()),
  last_fetched INTEGER,
  fetch_frequency INTEGER DEFAULT 3600,  -- seconds
  is_active INTEGER DEFAULT 1
);

-- Articles
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_id INTEGER REFERENCES feeds(id),
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  author TEXT,
  published_at INTEGER,
  fetched_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE
);

-- Full-text search (built into SQLite)
CREATE VIRTUAL TABLE articles_fts 
USING fts5(title, content, content="articles", content_rowid="id");

-- Embeddings (optional, for semantic search)
CREATE TABLE embeddings (
  article_id INTEGER PRIMARY KEY REFERENCES articles(id),
  embedding BLOB,  -- vector(1536) or similar
  model TEXT,      -- e.g., "text-embedding-3-small"
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

-- Query History (optional)
CREATE TABLE queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT,
  sources TEXT,  -- JSON array of article IDs
  created_at INTEGER DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX idx_articles_published ON articles(published_at DESC);
CREATE INDEX idx_articles_feed_id ON articles(feed_id);
CREATE INDEX idx_feeds_active ON feeds(is_active);
```

### Directory Structure

```
rss-agent-viewer/
├── src/
│   ├── cli/
│   │   ├── index.ts           # CLI entry point
│   │   ├── commands/
│   │   │   ├── ask.ts        # Main query command
│   │   │   ├── init.ts       # Initialize DB
│   │   │   ├── feeds.ts      # Feed management
│   │   │   └── config.ts     # Configuration
│   │   └── ui/
│   │       ├── components/     # Ink components
│   │       └── layouts/       # TUI layouts
│   ├── db/
│   │   ├── index.ts          # DB initialization
│   │   ├── schema.sql        # Schema definition
│   │   └── queries.ts       # Query functions
│   ├── rss/
│   │   ├── fetcher.ts       # RSS fetch logic
│   │   ├── parser.ts        # Parse RSS to articles
│   │   └── scheduler.ts     # Background fetching
│   ├── ai/
│   │   ├── client.ts        # AI provider abstraction
│   │   ├── openai.ts       # OpenAI implementation
│   │   └── claude.ts       # Claude implementation
│   ├── search/
│   │   ├── fulltext.ts      # FTS search
│   │   └── semantic.ts      # Vector similarity search
│   └── cache/
│       └── manager.ts       # Article content caching
├── data/
│   └── rss-agent.db         # SQLite database (gitignored)
├── docs/
│   └── *.md               # Documentation
├── package.json
├── tsconfig.json
└── README.md
```

---

## Core Features

### 1. Feed Management

**CLI Commands**:
```bash
rss-agent feeds add <url>           # Add new feed
rss-agent feeds list               # List all feeds
rss-agent feeds remove <id>        # Remove feed
rss-agent feeds update            # Fetch new articles
rss-agent feeds categories         # Show feed categories
```

**Background Fetching**:
```javascript
// Automatic updates every hour
const fetchAllFeeds = async () => {
  const activeFeeds = db.prepare(`
    SELECT * FROM feeds WHERE is_active = 1
    AND (last_fetched IS NULL OR last_fetched < ?)
  `).all(Date.now() - 3600000);  // 1 hour ago
  
  for (const feed of activeFeeds) {
    await fetchAndParseFeed(feed);
  }
};
```

### 2. Search

**Full-Text Search (Fast)**:
```javascript
const searchFTS = (query: string) => {
  return db.prepare(`
    SELECT a.*, snippet(articles_fts, 2, '...', '...', 50) as snippet
    FROM articles a
    JOIN articles_fts fts ON a.id = fts.rowid
    WHERE articles_fts MATCH ?
    ORDER BY a.published_at DESC
    LIMIT 20
  `).all(query);
};
```

**Semantic Search (AI-powered)**:
```javascript
const searchSemantic = async (query: string) => {
  const queryEmbedding = await getEmbedding(query);
  
  // Similarity search (SQLite extensions or manual)
  const results = db.prepare(`
    SELECT a.*, (embedding <=> ?) as distance
    FROM articles a
    JOIN embeddings e ON a.id = e.article_id
    ORDER BY distance
    LIMIT 10
  `).all(queryEmbedding);
  
  return results;
};
```

### 3. AI Answer Synthesis

**Flow**:
```javascript
const answerQuestion = async (question: string) => {
  // 1. Search for relevant articles
  const articles = searchFTS(question);
  
  if (articles.length === 0) {
    return "No relevant articles found in your feeds.";
  }
  
  // 2. Fetch full article content
  const fullArticles = articles.map(a => fetchArticleContent(a.url));
  
  // 3. Prepare context for AI
  const context = fullArticles.map(a => ({
    title: a.title,
    url: a.url,
    author: a.author,
    date: new Date(a.published_at).toLocaleDateString(),
    content: a.content.slice(0, 3000)  // Token limit
  }));
  
  // 4. Ask AI with sources
  const response = await ai.chat.completions.create({
    model: "gpt-4o",  // or Claude 3.5
    messages: [
      {
        role: "system",
        content: `You are a technical assistant that answers questions
        based ONLY on the provided articles. Always cite your sources.
        Format answer with [source](url) citations.`
      },
      {
        role: "user",
        content: `Question: ${question}\n\nArticles:\n${JSON.stringify(context)}`
      }
    ]
  });
  
  // 5. Save query to history
  saveQuery(question, response.choices[0].message, articles);
  
  return response.choices[0].message;
};
```

**Output Format**:
```
┌─────────────────────────────────────────────────────────┐
│  Question: What's current state management?        │
│                                                  │
│  Answer:                                          │
│  Based on recent articles from your feeds, Zustand is  │
│  recommended for 2026. Key reasons:                  │
│                                                  │
│  • Simple, minimal boilerplate [Builder.io Jan 2026]  │
│  • Hook-based API, native to React [Source 2]       │
│  • Scales well without Redux ceremony [Source 3]      │
│                                                  │
│  Sources:                                          │
│  1. Builder.io - "React + AI Stack 2026"          │
│  2. Simon Willison - "State Management in 2026"    │
│  3. React Docs - Updated January 2026              │
└─────────────────────────────────────────────────────────┘
```

### 4. Caching Strategy

**Three Levels**:
```javascript
// Level 1: Database
const getFromDB = (url: string) => {
  return db.prepare(`
    SELECT * FROM articles WHERE url = ?
  `).get(url);
};

// Level 2: Memory cache (LRU)
const memoryCache = new LRUCache({ max: 100 });

const getWithCache = (url: string) => {
  if (memoryCache.has(url)) {
    return memoryCache.get(url);
  }
  const article = getFromDB(url);
  memoryCache.set(url, article);
  return article;
};

// Level 3: Content cache (full HTML/filesystem)
const cacheContent = (url: string, html: string) => {
  const filename = hash(url);
  fs.writeFileSync(`./cache/${filename}.html`, html);
};
```

---

## Performance Considerations

### Expected Load (Individual)
- **Feeds**: 92
- **Articles/year**: ~2,300 (25 articles/feed/year)
- **Queries/day**: 10-50
- **Concurrent users**: 1

### SQLite Capabilities
- **Read operations**: 50K-100K/sec ✅
- **Write operations**: 5K-20K/sec ✅
- **Database size limit**: 140TB ✅
- **FTS5 search**: Sub-millisecond ✅

### Optimization Strategies

1. **Indexing**
   - Index on `published_at` for sorting
   - Index on `feed_id` for feed queries
   - FTS5 for full-text search

2. **Batch Operations**
   ```javascript
   // Batch insert articles (faster than single inserts)
   const insertMany = db.transaction((articles) => {
     for (const article of articles) {
       insertArticle(article);
     }
   });
   insertMany(newArticles);
   ```

3. **Pagination**
   ```javascript
   // Don't load all articles
   const getArticlesPage = (offset: number, limit: number) => {
     return db.prepare(`
       SELECT * FROM articles
       ORDER BY published_at DESC
       LIMIT ? OFFSET ?
     `).all(limit, offset);
   };
   ```

4. **Vacuum periodically**
   ```javascript
   // Reclaim space after deletions
   db.exec('VACUUM');
   ```

---

## Security & Privacy

### Local Deployment Advantages
- ✅ No data leaves your machine
- ✅ No tracking/analytics
- ✅ Full control over API keys
- ✅ Can audit all code

### API Key Management
```javascript
// Environment variables (never commit)
const apiKey = process.env.OPENAI_API_KEY || 
  fs.readFileSync(path.join(os.homedir(), '.rss-agent-apikey'), 'utf-8').trim();
```

### Feed Validation
```javascript
// Only fetch from trusted URLs
const ALLOWED_DOMAINS = new Set([
  'simonwillison.net',
  'mitchellh.com',
  // ... your approved domains
]);

const isValidFeed = (url: string) => {
  const domain = new URL(url).hostname;
  return ALLOWED_DOMAINS.has(domain);
};
```

---

## Scaling Path

### Phase 1: MVP (Weeks 1-2)
- [ ] CLI with Better-SQLite3
- [ ] Feed management (add/list/remove)
- [ ] Full-text search
- [ ] AI answer synthesis (OpenAI/Claude)
- [ ] Basic caching

### Phase 2: Enhanced Features (Weeks 3-4)
- [ ] Semantic search (embeddings)
- [ ] Query history
- [ ] Article bookmarks
- [ ] Better TUI
- [ ] Background fetching

### Phase 3: Collaboration (Months 2-3)
- [ ] Web dashboard (Next.js)
- [ ] Multi-user support
- [ ] Feed sharing (OPML export/import)
- [ ] Team subscriptions

### Phase 4: Production (Months 3-4)
- [ ] API endpoint
- [ ] Integration with Cursor/Claude Code
- [ ] Turso migration option
- [ ] Analytics (optional, self-hosted)

---

## Migration to Turso (When Needed)

**When to migrate**:
- >50 concurrent users
- Need multi-device sync
- Need automatic backups

**Migration steps**:
```javascript
// 1. Export from SQLite
const exportData = () => {
  const feeds = db.prepare('SELECT * FROM feeds').all();
  const articles = db.prepare('SELECT * FROM articles').all();
  return { feeds, articles };
};

// 2. Import to Turso (SQLite-compatible)
import { createClient } from '@libsql/client';
const turso = createClient(TURSO_URL, { authToken });

feeds.forEach(feed => {
  turso.execute('INSERT INTO feeds VALUES (?, ?, ...)', 
    [feed.id, feed.url, ...]);
});

// 3. Update connection string
// Change: new Database('rss-agent.db')
// To: createClient(TURSO_URL, { authToken })
```

---

## Cost Estimates

### Infrastructure
- **Local (SQLite)**: $0/month
- **Turso (Free tier)**: $0/month (500MB, 1B reads)
- **Turso (Paid)**: $29/month (10GB, 20B reads)

### AI API Costs
- **OpenAI GPT-4o**: $5/M tokens → ~$0.01 per query
- **Claude 3.5 Sonnet**: $3/M tokens → ~$0.006 per query
- **100 queries/month**: ~$0.60-1.00
- **1,000 queries/month**: ~$6-10

### Annual Estimate (Individual)
- Infrastructure: $0-348
- AI API: $12-120 (based on usage)
- **Total**: $12-468/year

---

## Development Roadmap

### Week 1: Foundation
- [x] Set up project structure
- [ ] Implement Better-SQLite3 schema
- [ ] Build CLI framework (meow + ink)
- [ ] Test feed parsing

### Week 2: Core Features
- [ ] Feed management commands
- [ ] RSS fetcher with error handling
- [ ] Full-text search implementation
- [ ] Basic caching

### Week 3: AI Integration
- [ ] AI client abstraction
- [ ] Answer synthesis with citations
- [ ] Source formatting
- [ ] CLI output improvements

### Week 4: Polish
- [ ] Error handling
- [ ] Documentation
- [ ] Testing with real queries
- [ ] Performance tuning

---

## Open Questions

1. **AI Provider**: OpenAI vs Claude vs Local LLM?
2. **Embeddings**: Use OpenAI embeddings or local model?
3. **TUI Library**: Ink vs Blessed vs custom?
4. **Background Service**: Cron job or in-process scheduler?
5. **CLI Name**: `rss-agent`, `ai-rss`, or `query-feeds`?

---

## References

- [Better-SQLite3 Docs](https://github.com/WiseLibs/better-sqlite3)
- [Ink - React for CLIs](https://github.com/vadimdemedes/ink)
- [rss-parser](https://github.com/bobby-brennan/rss-parser)
- [OpenAI API](https://platform.openai.com/docs)
- [Anthropic API](https://docs.anthropic.com/)
- [Turso](https://turso.tech/)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)