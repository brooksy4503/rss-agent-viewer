---
name: rss-agent-viewer
description: 'AI agent-friendly CLI RSS/Atom feed viewer with discovery, search, and OPML import/export. Use when an agent needs to manage RSS feeds, read articles, or run feed discovery from the terminal. Triggered by: "read RSS feeds", "view RSS", "RSS reader CLI", "rss-viewer", "discover RSS feeds", "import OPML", or "search feeds".'
---

# RSS Agent Viewer

CLI RSS/Atom feed viewer with built-in discovery, caching, and search.

## Quick start

```bash
npx -y rss-agent-viewer init
npx -y rss-agent-viewer discover https://vercel.com
npx -y rss-agent-viewer add https://vercel.com/atom
npx -y rss-agent-viewer read
```

## Core workflow

```bash
rss-viewer init
rss-viewer discover https://example.com
rss-viewer add https://example.com/feed.xml
rss-viewer feeds
rss-viewer read
```

## Common commands

```bash
rss-viewer init
rss-viewer add <url>
rss-viewer discover <url>
rss-viewer feeds
rss-viewer remove <url>
rss-viewer read [url]
rss-viewer search <query>
rss-viewer import <file>
rss-viewer export
rss-viewer cache <action>
```

## Usage patterns

### Discover and subscribe
```bash
rss-viewer discover https://example.com
rss-viewer add https://example.com/rss.xml
```

### Read a single feed
```bash
rss-viewer read https://example.com/rss.xml
```

### Search across all feeds
```bash
rss-viewer search "open source"
```

### Import OPML
```bash
rss-viewer import feeds.opml
```

### Export feeds
```bash
rss-viewer export
```

## When to use this tool

- Manage and read RSS/Atom feeds from the terminal
- Discover feed URLs for a website
- Search across multiple subscriptions
- Import or export subscriptions via OPML

## More information

- GitHub: https://github.com/brooksy4503/rss-agent-viewer
