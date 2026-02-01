# Development Guide

This guide documents local development workflows, discovery behavior, and testing tips for `rss-agent-viewer`.

## Setup

```bash
cd /Users/garthscaysbrook/Code/rss-agent-viewer
npm install
```

## Build and Run

```bash
npm run build
node dist/index.js --version
```

## Test

```bash
npm test
npm run test:unit
npm run test:integration
```

## Discovery CLI Behavior

The CLI delegates feed discovery to the external `rss-discover` executable.

- If `rss-discover` is not working on your system, you can override the binary:
  - `RSS_DISCOVER_BIN` to point at a custom executable
  - `RSS_DISCOVER_PATH` to point at `find-rss-feeds.js` (the script is run with Node)

- `rss-discover` writes JSON to stdout but may interleave debug or error logs on stderr.
- Complex sites can produce a mix of logs and JSON in both stdout and stderr.
- The wrapper normalizes multiple JSON shapes and prefers stdout JSON over stderr.
- On failure, the wrapper surfaces a helpful error message when available.

### Common Output Patterns

- Clean JSON only:
  - `{"success":true,"results":[...]}`
- Logs + JSON:
  - `Debug: Fetching https://example.com/blog`
  - `{"success":false,"results":[...]}`
- JSON emitted in stderr (still parsed).

## Discovery Wrapper Behavior

The wrapper (`src/core/discovery.ts`) tries multiple parsing strategies:

- Parse stdout JSON first, then stderr, then combined output.
- Accepts `success/results` envelope or top-level `feeds`.
- Normalizes feed entries and handles missing titles/types.
- When no JSON is found, falls back to an error message from logs or exit code.

Caching:

- Discovery results are stored in the SQLite `cache` table.
- Default TTL is 5 minutes (`RSS_VIEWER_CACHE_TTL` in ms).
- `handleDiscover` returns cached results without calling `rss-discover`.
- `handleAdd --discover` uses cached results when available.

## OPML Examples

### Simple OPML
```xml
<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <body>
    <outline text="Tech">
      <outline text="Example RSS" xmlUrl="https://example.com/rss" />
    </outline>
  </body>
</opml>
```

### Category-Only Outline
```xml
<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <body>
    <outline text="Science" />
    <outline text="Space News" xmlUrl="https://science.example.com/rss" />
  </body>
</opml>
```

## CLI Usage Examples

```bash
rss-viewer init
rss-viewer add https://news.ycombinator.com/rss --category Tech
rss-viewer discover https://example.com
rss-viewer feeds
rss-viewer read --limit 10
rss-viewer search "serverless"
rss-viewer import ./feeds.opml
rss-viewer export --fmt opml
rss-viewer cache stats
```

## Testing Guide (Real URLs)

Discovery behavior should be verified against real sources:

- https://news.ycombinator.com/rss
- https://news.ycombinator.com/atom
- https://example.com/feed

Suggested verification:

1. `rss-viewer discover <url>` returns at least one feed.
2. `rss-viewer cache stats` shows cached entries.
3. `rss-viewer add <url> --discover` uses cache without errors.

## Known Issues

- Discovery can still fail on complex sites with noisy stderr output.
- Global installs of `rss-agent-discovery` may ship a bin script that cannot locate the `dist` folder; use `RSS_DISCOVER_PATH` to work around.
- Progress indicators are limited for long-running operations.
- Cache refresh is not implemented (`rss-viewer cache refresh`).

## Search Architecture

### Local Search

Uses SQLite FTS5 (Full-Text Search) for fast text-based queries.

**Features:**
- BM25 ranking for relevance scoring
- Supports phrase matching (`"exact phrase"`)
- Supports exclusion (`-term`)
- Filters by date, author, category

**Example:**
```typescript
const articles = database.searchArticlesWithRelevance('Rust programming', {
  limit: 20,
  since: new Date('2024-01-01'),
  category: 'Tech'
});
```

### Web Search

Two providers available:

#### Agent Search (Default)
- Returns empty results
- Agent calls web search separately
- No API costs

#### Exa API (BYOK)
- Semantic search via Exa API
- Requires `EXA_API_KEY`
- Better for discovering relevant feeds

**Workflow:**
```
1. User queries: "React 19 features"
2. Agent calls: rss-viewer discover-search "React 19 features" --web --auto-add --read
3. Tool:
   - Searches web (Exa or agent)
   - Filters URLs for feed candidates
   - Discovers feeds from each URL (rss-agent-discovery)
   - Adds feeds to database (if --auto-add)
   - Fetches articles from new feeds (if --read)
   - Searches local database for query
   - Returns ranked results
```

### URL Filtering

Web search results are filtered to:
- Remove duplicates
- Filter out non-content files (images, videos, PDFs)
- Prioritize blog/article URLs

**Blocked Extensions:**
- `.jpg`, `.png`, `.gif` - Images
- `.pdf` - PDF documents
- `.zip` - Archives
- `.mp4`, `.avi`, `.mov`, `.webm` - Videos

### BYOK (Bring Your Own Key)

Exa API integration is optional:
- API key stored in config file or environment variable
- Env vars override config file
- No API key stored in code
- Tool works without it (falls back to agent search)

**Environment Variables:**
```bash
EXA_API_KEY="your-api-key"                    # Exa API key (optional)
RSS_VIEWER_SEARCH_PROVIDER="agent|exa"        # Search provider (default: agent)
RSS_VIEWER_MAX_WEB_RESULTS=10                 # Max web search results
RSS_VIEWER_SEARCH_LIMIT=20                    # Max article results
RSS_VIEWER_BOOST_RECENT=false                # Boost recent articles in search
EXA_API_URL="https://api.exa.ai/search"      # Custom Exa endpoint (optional)
```

**Config File (~/.config/rss-viewer/config.json):**
```json
{
  "webSearchProvider": "exa",
  "exaApiKey": "your-api-key",
  "maxWebResults": 10,
  "searchResultsLimit": 20,
  "boostRecentSearch": false
}
```
