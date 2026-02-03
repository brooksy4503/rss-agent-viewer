# RSS Agent Viewer - Discussion & Planning

**Date**: 2026-02-02  
**Status**: Planning Phase

---

## Discussion Summary

### Initial Concept

User wants to build a tool that leverages RSS feeds to provide AI-powered answers to technical questions, similar to a personalized search engine powered by trusted sources.

### Key Insights

**Why This Matters for AI Agents**
- AI agents with access to technical RSS feeds can provide **current, battle-tested advice**
- Instead of outdated training data, agents reference real engineering blog posts
- Real-time technical awareness (framework updates, security issues, patterns)
- Cross-source synthesis from multiple perspectives

### Use Cases Identified

**For AI Coding Agents (Claude, Cursor, etc.)**
- Real-time technical awareness before suggesting code
- Context-aware suggestions from recent blog posts
- Security checks via security feeds (KrebsOnSecurity)
- Pattern recognition from engineering blogs (Simon Willison, Mitchellh, etc.)
- Trend detection for technology decisions
- Quick research while coding

**For Users**
- Technical Q&A with cited sources
- Stay current with subscribed feeds
- Multi-perspective answers
- Trusted information sources only

---

## Current Setup

- **92 RSS feeds** imported (blogs, engineering, security, AI)
- Using **rss-agent-viewer** CLI tool
- Local storage with Better-SQLite3

---

## Architecture Decision Matrix

### Deployment Options

| Platform | Pros | Cons | Use Case |
|-----------|-------|-------|----------|
| **CLI** | Fast, dev-friendly, anywhere | No GUI, harder for non-devs | Primary (individual) |
| **Web Dashboard** | Visual, accessible, shareable | Requires server, more complex | Team collaboration |
| **API Service** | Integratable into AI tools | Infrastructure required | Multi-tool integration |

**Decision**: Start with CLI, extend to web/API as needed

### Database Comparison

| Database | Capacity | Concurrency | Hosting | Verdict |
|----------|-----------|--------------|----------|----------|
| **SQLite** | 140TB | Single writer | Local/Self-hosted | ✅ Individual |
| **Turso** | Edge SQLite | Auto-replicated | Managed cloud | ✅ Small teams |
| **PostgreSQL** | Unlimited | High concurrency | Managed/Self-hosted | ✅ Large teams |

**Data Estimates**:
- Individual: ~100MB/year
- Team (10): ~1GB/year  
- Company (100): ~10GB/year

**Decision**: Start with **Better-SQLite3** locally, upgrade to Turso/PostgreSQL if needed

---

## Requirements Gathering

### Open Questions (User Input Needed)

1. **Target Users**
   - [ ] Individual only
   - [ ] Small team (2-10)
   - [ ] Large team (10+)
   - [ ] Open source project

2. **Platform Priority**
   - [ ] CLI only
   - [ ] Web dashboard
   - [ ] API service
   - [ ] All three

3. **Hosting Preference**
   - [ ] Local only
   - [ ] Self-hosted cloud
   - [ ] Managed service

4. **MVP Scope**
   - [ ] Minimal (search + fetch + answer)
   - [ ] Full-featured (history, bookmarks, UI)

5. **AI Integration**
   - [ ] OpenAI API
   - [ ] Claude API
   - [ ] Local LLM (Ollama)
   - [ ] Multiple providers

6. **Tool Integration**
   - [ ] Standalone only
   - [ ] Cursor-compatible
   - [ ] Claude Code integration
   - [ ] Generic API for any agent

---

## Demo Results

### Test Query: "What's the current best way to handle state in 2026?"

**Workflow**:
1. `rss-viewer search "state management"` → Found 5 articles
2. Fetched top 2 articles full content
3. Extracted key recommendations

**Key Finding** (from Builder.io, Jan 2026):
> **State management: Zustand** - Simple, minimal boilerplate, scales well. Hook-based API that feels native to React without Redux ceremony.

**Sources Referenced**:
- Builder.io - "The React + AI Stack for 2026" (Jan 2026)
- Builder.io - "15 Best React UI Libraries for 2026" (Dec 2025)
- Plus 3 other relevant articles

**Performance**: Search was instant, article fetching took ~2s each

---

## Next Steps

1. ✅ Confirm target user scale
2. ✅ Choose platform (CLI/web/API)
3. ✅ Select database approach (SQLite confirmed for individual use)
4. ✅ Define MVP feature set
5. ⏳ Design detailed architecture
6. ⏳ Implement core features
7. ⏳ Test with real queries
8. ⏳ Iterate based on usage

---

## Notes

- User described the concept as "personal Google" powered by their own trusted feeds
- Emphasis on: trusted sources, no SEO spam, fresh insights, cited answers, no tracking
- 92 feeds provide good coverage of engineering, security, AI topics
- Better-SQLite3 is perfectly suitable for individual use (handles 100MB easily)
- Cloud hosting only needed if sharing with team or multi-device access