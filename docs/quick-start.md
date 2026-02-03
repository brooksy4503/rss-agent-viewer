# Quick Start Guide - Building RSS Agent Viewer

This guide walks through implementing the architecture plan.

---

## Prerequisites

```bash
# Install dependencies
brew install sqlite3

# Node.js 20+ or Bun
brew install node
# or
curl -fsSL https://bun.sh/install | bash
```

---

## Step 1: Project Setup (10 min)

```bash
# Create project
mkdir rss-agent-viewer
cd rss-agent-viewer

# Initialize
npm init -y
npm install --save-dev typescript @types/node tsx

# Core dependencies
npm install better-sqlite3 rss-parser meow chalk ora

# CLI UI
npm install ink react react-dom

# AI provider (choose one)
npm install openai
# or
npm install @anthropic-ai/sdk

# Development
npm install --save-dev tsx nodemon
```

**package.json scripts**:
```json
{
  "scripts": {
    "dev": "tsx watch src/cli/index.ts",
    "build": "tsc",
    "start": "node dist/cli/index.js"
  }
}
```

---

## Step 2: Database Setup (15 min)

Create `src/db/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS feeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  added_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_id INTEGER REFERENCES feeds(id) ON DELETE CASCADE,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  author TEXT,
  published_at INTEGER,
  fetched_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts 
USING fts5(title, content, content="articles", content_rowid="id");
```

Create `src/db/index.ts`:
```typescript
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'data', 'rss-agent.db');

export function initDB() {
  const db = new Database(DB_PATH);
  
  // Create tables
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
  
  return db;
}

export const db = initDB();
```

---

## Step 3: CLI Framework (20 min)

Create `src/cli/index.ts`:
```typescript
#!/usr/bin/env node
import meow from 'meow';
import { render } from 'ink';

const cli = meow(`
  Usage
    $ rss-agent <command> [options]

  Commands
    ask <question>    Ask a question using your feeds
    feeds list       List all feeds
    feeds add <url>   Add a new feed
    update            Fetch new articles

  Options
    --help           Show help
`, {
  importMeta: require('../../package.json'),
  flags: {}
});

// Router
const command = cli.input[0];
const args = cli.input.slice(1);

switch (command) {
  case 'ask':
    render(<AskQuestion question={args.join(' ')} />);
    break;
  case 'feeds':
    render(<FeedManagement subcommand={args[0]} />);
    break;
  case 'update':
    render(<UpdateFeeds />);
    break;
  default:
    console.log('Unknown command. Use --help');
}
```

---

## Step 4: Feed Fetcher (30 min)

Create `src/rss/fetcher.ts`:
```typescript
import Parser from 'rss-parser';
import { db } from '../db';

const parser = new Parser();

export async function fetchFeed(url: string) {
  try {
    const feed = await parser.parseURL(url);
    
    for (const item of feed.items) {
      // Upsert article
      const existing = db.prepare(`
        SELECT id FROM articles WHERE url = ?
      `).get(item.link || item.guid);
      
      if (!existing) {
        db.prepare(`
          INSERT INTO articles (feed_id, url, title, content, author, published_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          getFeedId(url),
          item.link || item.guid,
          item.title || 'Untitled',
          item.contentSnippet || item.content || '',
          item.creator || '',
          item.pubDate ? Math.floor(new Date(item.pubDate).getTime() / 1000) : null
        );
      }
    }
    
    console.log(`✓ Fetched ${feed.items.length} articles from ${feed.title}`);
  } catch (error) {
    console.error(`✗ Error fetching ${url}:`, error);
  }
}

function getFeedId(url: string): number {
  const feed = db.prepare('SELECT id FROM feeds WHERE url = ?').get(url);
  return feed?.id || -1;
}
```

---

## Step 5: Search Implementation (20 min)

Create `src/search/fulltext.ts`:
```typescript
import { db } from '../db';

export interface SearchResult {
  id: number;
  title: string;
  url: string;
  snippet: string;
  published_at: number;
}

export function searchArticles(query: string): SearchResult[] {
  try {
    const results = db.prepare(`
      SELECT a.id, a.title, a.url, a.published_at,
             snippet(articles_fts, 2, '<b>', '</b>', '...', 50) as snippet
      FROM articles a
      JOIN articles_fts fts ON a.id = fts.rowid
      WHERE articles_fts MATCH ?
      ORDER BY a.published_at DESC
      LIMIT 20
    `).all(query) as SearchResult[];
    
    return results;
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}
```

---

## Step 6: AI Integration (30 min)

Create `src/ai/client.ts`:
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function answerWithSources(
  question: string, 
  articles: SearchResult[]
): Promise<string> {
  
  const context = articles.map(a => 
    `Title: ${a.title}\nURL: ${a.url}\nContent: ${a.snippet}`
  ).join('\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a technical assistant that answers questions
        based ONLY on the provided articles. Always cite your sources
        using this format: [Title](URL). If no relevant articles are found,
        say so clearly.`
      },
      {
        role: 'user',
        content: `Question: ${question}\n\nArticles:\n${context}`
      }
    ],
    max_tokens: 1000,
    temperature: 0.3
  });

  return response.choices[0].message.content || 'No answer generated.';
}
```

---

## Step 7: UI Components (20 min)

Create `src/cli/ui/AskQuestion.tsx`:
```typescript
import { Box, Text } from 'ink';
import { useState, useEffect } from 'ink';
import { searchArticles } from '../../search/fulltext';
import { answerWithSources } from '../../ai/client';

export default function AskQuestion({ question }: { question: string }) {
  const [answer, setAnswer] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const results = searchArticles(question);
      if (results.length === 0) {
        setLoading(false);
        setAnswer('No relevant articles found in your feeds.');
        return;
      }

      const response = await answerWithSources(question, results);
      setAnswer(response);
      setLoading(false);
    })();
  }, [question]);

  if (loading) {
    return <Text>Searching your feeds and generating answer...</Text>;
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="blue">Question:</Text>
        <Text> {question}</Text>
      </Box>
      <Box>
        <Text>{answer}</Text>
      </Box>
    </Box>
  );
}
```

---

## Step 8: Testing (10 min)

```bash
# 1. Create database directory
mkdir -p data

# 2. Set API key
export OPENAI_API_KEY="your-key-here"
# or save to ~/.rss-agent-apikey

# 3. Test feed fetch
tsx src/rss/fetcher.ts https://simonwillison.net/atom/everything/

# 4. Test search
tsx src/search/fulltext.ts "React state management"

# 5. Run CLI
npm run dev ask "What's current best React state management?"
```

---

## Step 9: Production Build (5 min)

```bash
# Build TypeScript
npm run build

# Create executable
chmod +x dist/cli/index.js

# Install globally
npm link

# Use anywhere
rss-agent ask "How do I handle forms in React?"
```

---

## Next Steps After MVP

1. **Add more commands**:
   - `rss-agent feeds remove <id>`
   - `rss-agent feeds categories`
   - `rss-agent history`

2. **Add semantic search**:
   - Generate embeddings with OpenAI
   - Store in database
   - Implement cosine similarity search

3. **Add background fetching**:
   - Cron job or in-process timer
   - Auto-update every hour

4. **Improve UI**:
   - Better formatting
   - Progress bars
   - Color coding

---

## Troubleshooting

### SQLite "database is locked"
```bash
# Single writer issue with SQLite
# Solution: Close all connections before opening new one
# Or use WAL mode: db.pragma('journal_mode = WAL');
```

### API key not found
```bash
# Create key file
echo "sk-..." > ~/.rss-agent-apikey
chmod 600 ~/.rss-agent-apikey
```

### Memory issues with large feeds
```typescript
// Stream articles instead of loading all
for (const item of feed.items) {
  // Process one at a time
  await processItem(item);
}
```

---

## Resources

- [Ink Documentation](https://github.com/vadimdemedes/ink)
- [Better-SQLite3 API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- [RSS-Parser](https://github.com/bobby-brennan/rss-parser/blob/master/docs/README.md)
- [OpenAI Node SDK](https://github.com/openai/openai-node)
