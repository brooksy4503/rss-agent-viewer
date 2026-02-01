import { spawnSync } from 'node:child_process';
import type { DiscoveredFeeds, DiscoveryOptions } from './types.js';

function normalizeFeedsList(feeds: unknown): DiscoveredFeeds['results'][number]['feeds'] {
  if (!Array.isArray(feeds)) return [];

  return feeds
    .filter((feed): feed is { url: string; title?: string; type?: string } => {
      return Boolean(feed && typeof (feed as { url?: string }).url === 'string');
    })
    .map(feed => ({
      url: feed.url,
      title: typeof feed.title === 'string' && feed.title.trim().length > 0 ? feed.title : feed.url,
      type: feed.type === 'rss' || feed.type === 'atom' ? feed.type : 'unknown'
    }));
}

function normalizeCandidate(candidate: unknown, defaultUrl: string): DiscoveredFeeds | null {
  if (!candidate || typeof candidate !== 'object') return null;

  const asRecord = candidate as Record<string, unknown>;

  if (typeof asRecord.success === 'boolean' && Array.isArray(asRecord.results)) {
    const normalizedResults = asRecord.results
      .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
      .map(entry => {
        const feeds = normalizeFeedsList(entry.feeds);
        const url = typeof entry.url === 'string' ? entry.url : defaultUrl;
        const error = typeof entry.error === 'string' ? entry.error : null;
        return { url, feeds, error };
      })
      .filter(entry => entry.url.length > 0);

    if (normalizedResults.length > 0) {
      return { success: asRecord.success, results: normalizedResults };
    }
  }

  if (Array.isArray(asRecord.feeds) || Array.isArray(candidate)) {
    const feeds = Array.isArray(asRecord.feeds)
      ? normalizeFeedsList(asRecord.feeds)
      : normalizeFeedsList(candidate);
    const url = typeof asRecord.url === 'string' ? asRecord.url : defaultUrl;
    const error = typeof asRecord.error === 'string' ? asRecord.error : null;
    const success = typeof asRecord.success === 'boolean' ? asRecord.success : feeds.length > 0;

    return {
      success,
      results: [{ url, feeds, error }]
    };
  }

  if (typeof asRecord.error === 'string') {
    return {
      success: false,
      results: [{ url: defaultUrl, feeds: [], error: asRecord.error }]
    };
  }

  return null;
}

function parseDiscoveryJson(output: string, defaultUrl: string): DiscoveredFeeds | null {
  const trimmed = output.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const normalized = normalizeCandidate(parsed, defaultUrl);
      if (normalized) return normalized;
    } catch {
      // fall through to scan
    }
  }

  const candidates: DiscoveredFeeds[] = [];
  const length = trimmed.length;
  let index = 0;

  while (index < length) {
    const start = trimmed.indexOf('{', index);
    if (start === -1) break;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < length; i += 1) {
      const char = trimmed[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{') {
        depth += 1;
        continue;
      }

      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          const candidate = trimmed.slice(start, i + 1);
          try {
            const parsed = JSON.parse(candidate) as unknown;
            const normalized = normalizeCandidate(parsed, defaultUrl);
            if (normalized) candidates.push(normalized);
          } catch {
            // ignore malformed JSON
          }
          index = i + 1;
          break;
        }
      }
    }

    if (depth !== 0) {
      index = start + 1;
    }
  }

  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

export function discoverFeeds(url: string, options: DiscoveryOptions = {}): DiscoveredFeeds {
  const args: string[] = [url];

  if (options.timeout) args.push('--timeout', options.timeout.toString());
  if (options.skipBlogs) args.push('--skip-blogs');
  if (options.maxBlogs) args.push('--max-blogs', options.maxBlogs.toString());
  if (options.customBlogPaths) {
    const paths = options.customBlogPaths.join(',');
    args.push('--blog-paths', paths);
  }
  if (options.verbose) args.push('--verbose');

  const overridePath = process.env.RSS_DISCOVER_PATH;
  const overrideBin = process.env.RSS_DISCOVER_BIN;
  const command = overrideBin || 'rss-discover';
  const commandArgs = overridePath ? [overridePath, ...args] : args;
  const result = spawnSync(overridePath ? process.execPath : command, commandArgs, { encoding: 'utf-8' });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const combinedOutput = [stdout, stderr].filter(Boolean).join('\n');

  const parsed =
    parseDiscoveryJson(stdout, url) ??
    parseDiscoveryJson(stderr, url) ??
    parseDiscoveryJson(combinedOutput, url);
  if (parsed) return parsed;

  const extractHelpfulError = (output: string): string | null => {
    const lines = output
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const tagged = lines.find(line => /(error|failed|timeout|exception)/i.test(line));
    return tagged ?? null;
  };

  const errorMessage = result.error
    ? result.error.message
    : result.status !== 0
      ? `rss-discover exited with code ${result.status}`
      : extractHelpfulError(stderr) ??
      extractHelpfulError(stdout) ??
      'No valid JSON output from rss-discover';

  return {
    success: false,
    results: [{ url, feeds: [], error: errorMessage }]
  };
}
