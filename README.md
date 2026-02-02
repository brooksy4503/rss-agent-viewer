# RSS Agent Viewer

CLI RSS/Atom feed viewer with automatic feed discovery via `rss-agent-discovery`.

## Installation

```bash
npm install -g rss-agent-viewer
```

Or run without installation:

```bash
npx rss-viewer
```

### Agent Skills

Install the AI agent skill with Skills CLI:

```bash
npx skills add brooksy4503/rss-agent-viewer --skill rss-agent-viewer
```

More info about the Skills CLI: https://skills.sh/

## Quick Start

```bash
# Initialize configuration
rss-viewer init

# Add a feed
rss-viewer add https://vercel.com/atom

# List all feeds
rss-viewer feeds

# Read articles
rss-viewer read
```

## Commands

- `init` - Initialize configuration and database
- `add <url>` - Add a feed to the database
- `discover <url>` - Discover feeds from a URL
- `feeds` - List all subscribed feeds
- `remove <url>` - Remove a feed by URL
- `read [url]` - Read articles from a feed or all feeds
- `search <query>` - Search across all feeds (local or web)
- `discover-search <query>` - Search web, discover feeds, add, and search articles
- `import <file>` - Import feeds from OPML file
- `export` - Export feeds to OPML or JSON
- `cache <action>` - Manage cache (stats, clear, refresh)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Development mode
npm run dev
```

## Configuration

### Web Search

The `discover-search` command supports web search via:

1. **Agent Search (default)** - Uses agent's built-in search capabilities
2. **Exa API (BYOK)** - Optional API integration for semantic search

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
  "exaApiUrl": "https://api.exa.ai/search",
  "maxWebResults": 10,
  "searchResultsLimit": 20,
  "boostRecentSearch": false
}
```

### Search Examples

**Local Database Search:**
```bash
rss-viewer search "React 19" --limit 10
rss-viewer search "TypeScript" --author "Dan" --since "2024-01-01"
```

**Web Search with Discovery:**
```bash
# Use agent's built-in search (default)
rss-viewer discover-search "micro-frontends" --auto-add --read

# Use Exa API (requires EXA_API_KEY)
export EXA_API_KEY="your-api-key"
rss-viewer discover-search "WebGPU" \
  --provider exa \
  --max-results 5 \
  --category Development \
  --auto-add \
  --read \
  --limit 20
```

## License

MIT
