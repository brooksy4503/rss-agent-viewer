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
- `search <query>` - Search across all feeds
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

## License

MIT
