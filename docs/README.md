# RSS Agent Viewer - Documentation

Documentation for building an AI-powered RSS feed answer engine.

---

## 📚 Document Overview

### [discussion-summary.md](./discussion-summary.md)
Summary of our planning conversation including:
- Initial concept and use cases
- Architecture decision matrix
- Database comparison (SQLite vs PostgreSQL vs Turso)
- Demo results from testing
- Requirements gathering questions
- Next steps

**Read this first** to understand the project context and decisions made.

---

### [architecture-plan.md](./architecture-plan.md)
Comprehensive technical architecture covering:
- System architecture diagram
- Technology stack recommendations
- Database schema (SQL)
- Directory structure
- Core features (feed management, search, AI synthesis)
- Performance considerations
- Security & privacy
- Scaling path (MVP → production)
- Cost estimates
- 4-week development roadmap

**Read this** for detailed implementation guidance and design decisions.

---

### [quick-start.md](./quick-start.md)
Step-by-step implementation guide:
- Prerequisites setup
- Project initialization
- Database setup
- CLI framework
- Feed fetcher
- Search implementation
- AI integration
- UI components
- Testing & deployment

**Use this** to start coding immediately. Contains copy-paste ready code.

---

## 🎯 Project Goals

Build a personalized search engine powered by your curated RSS feeds that:
- Answers technical questions with **current, cited sources**
- Uses **trusted sources** only (your 92 feeds)
- Provides **real-time technical awareness** for AI agents
- Runs **locally** with privacy and control
- Scales from **individual to team** use

---

## 📊 Current Status

| Phase | Status | Completion |
|--------|--------|-------------|
| Planning | ✅ Complete | 100% |
| Design | ✅ Complete | 100% |
| Implementation | ⏳ Pending | 0% |
| Testing | ⏳ Pending | 0% |

---

## 🚀 Quick Start

1. **Read** [discussion-summary.md](./discussion-summary.md) for context
2. **Review** [architecture-plan.md](./architecture-plan.md) for design
3. **Follow** [quick-start.md](./quick-start.md) to build MVP

```bash
# Clone and start
cd /Users/garthscaysbrook/Code/rss-agent-viewer
mkdir src
# Then follow quick-start.md
```

---

## 🗂️ Expected File Structure (After Implementation)

```
rss-agent-viewer/
├── src/
│   ├── cli/
│   │   ├── index.ts           # CLI entry point
│   │   ├── commands/
│   │   └── ui/
│   ├── db/
│   │   ├── index.ts          # DB initialization
│   │   └── schema.sql        # SQL schema
│   ├── rss/
│   │   ├── fetcher.ts       # RSS fetch logic
│   │   └── parser.ts        # Parse RSS to articles
│   ├── ai/
│   │   └── client.ts        # AI provider abstraction
│   ├── search/
│   │   └── fulltext.ts      # FTS5 search
│   └── cache/
│       └── manager.ts       # Article caching
├── data/
│   └── rss-agent.db         # SQLite database
├── docs/
│   └── *.md               # This documentation
├── package.json
└── README.md
```

---

## 🔧 Technology Stack

| Component | Technology | Rationale |
|-----------|-------------|-----------|
| **Runtime** | Node.js 20+ / Bun | Fast, native TypeScript |
| **Language** | TypeScript | Type safety, better DX |
| **Database** | Better-SQLite3 | Fast, embedded, FTS5 |
| **CLI Framework** | Ink / Meow | React for CLI, easy API |
| **RSS Parser** | rss-parser | Robust, well-tested |
| **AI Provider** | OpenAI / Claude | Flexible, multi-model |
| **Search** | SQLite FTS5 | Built-in, sub-millisecond |

---

## 📈 Development Roadmap

### Phase 1: MVP (Weeks 1-2)
- [ ] CLI with Better-SQLite3
- [ ] Feed management (add/list/remove)
- [ ] Full-text search
- [ ] AI answer synthesis
- [ ] Basic caching

### Phase 2: Enhanced (Weeks 3-4)
- [ ] Semantic search (embeddings)
- [ ] Query history
- [ ] Better TUI
- [ ] Background fetching

### Phase 3: Collaboration (Months 2-3)
- [ ] Web dashboard
- [ ] Multi-user support
- [ ] Team subscriptions

### Phase 4: Production (Months 3-4)
- [ ] API endpoint
- [ ] Integration with Cursor/Claude Code
- [ ] Turso migration option

---

## 💡 Key Decisions Made

### Database: Better-SQLite3 (Local)
**Why**: 
- Handles 100MB/year easily (you have ~2,300 articles/year)
- 50K-100K ops/sec (far exceeds individual needs)
- Zero setup, portable, git-trackable
- Built-in FTS5 for search

**When to upgrade**: >50 concurrent users or need multi-device sync

### AI Provider: OpenAI GPT-4o-mini (MVP)
**Why**:
- Fast, cheap (~$0.01 per query)
- Good for synthesis with citations
- Can switch to Claude later

### CLI-first: Terminal Interface
**Why**:
- Fastest to build (1-2 weeks vs 4-6 weeks for web)
- Integrates with dev workflow
- Can build web version as extension

---

## 🤔 Open Questions for User

1. **AI Provider Preference**:
   - [ ] OpenAI (GPT-4o/4o-mini)
   - [ ] Anthropic (Claude 3.5 Sonnet)
   - [ ] Local (Ollama)
   - [ ] Multi-provider

2. **Initial Scope**:
   - [ ] Minimal CLI (ask, feeds, update only)
   - [ ] Full-featured (history, bookmarks, semantic search)

3. **Embeddings**:
   - [ ] Use OpenAI embeddings ($0.02/1M tokens)
   - [ ] Use local model (free, slower)
   - [ ] Skip for MVP

4. **CLI Name**:
   - [ ] `rss-agent`
   - [ ] `ai-rss`
   - [ ] `query-feeds`
   - [ ] Other: _______

---

## 🔗 External Resources

- [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3)
- [Ink - React for CLIs](https://github.com/vadimdemedes/ink)
- [rss-parser](https://github.com/bobby-brennan/rss-parser)
- [OpenAI API](https://platform.openai.com/docs)
- [Anthropic API](https://docs.anthropic.com/)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [Turso](https://turso.tech/)

---

## 📝 Notes

- 92 RSS feeds imported (blogs, engineering, security, AI)
- Current focus: **individual user** (scalable to teams)
- Deployment: **local** (Better-SQLite3 on your machine)
- Estimated annual cost: **$12-468** (infrastructure + AI API)
- Database size: **~100MB/year** for individual use

---

## 🎯 Success Criteria

**MVP Complete When**:
- ✅ Can add/list/remove feeds via CLI
- ✅ Can search articles by keyword
- ✅ Can ask questions and get AI-synthesized answers with citations
- ✅ Answers reference actual articles from feeds
- ✅ Performance: Search <1s, AI answer <5s

**Production Ready When**:
- ✅ Background feed fetching
- ✅ Query history
- ✅ Error handling & recovery
- ✅ Documentation complete
- ✅ Tested with 100+ queries

---

**Last Updated**: 2026-02-02