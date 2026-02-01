import { findRSSFeeds, cliOptions } from 'rss-agent-discovery';
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

function normalizeResult(result: Awaited<ReturnType<typeof findRSSFeeds>>): DiscoveredFeeds['results'][number] {
  return {
    url: result.url,
    feeds: normalizeFeedsList(result.feeds),
    error: result.error ?? null
  };
}

export async function discoverFeeds(url: string, options: DiscoveryOptions = {}): Promise<DiscoveredFeeds> {
  const originalOptions = { ...cliOptions };

  if (options.timeout !== undefined) cliOptions.timeout = options.timeout;
  if (options.skipBlogs !== undefined) cliOptions.skipBlogs = options.skipBlogs;
  if (options.maxBlogs !== undefined) cliOptions.maxBlogs = options.maxBlogs;
  if (options.customBlogPaths !== undefined) cliOptions.customBlogPaths = options.customBlogPaths;
  if (options.verbose !== undefined) cliOptions.verbose = options.verbose;

  try {
    const result = await findRSSFeeds(url);
    const normalized = normalizeResult(result);

    Object.assign(cliOptions, originalOptions);

    return {
      success: !normalized.error,
      results: [normalized]
    };
  } catch (error) {
    Object.assign(cliOptions, originalOptions);

    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      results: [{
        url,
        feeds: [],
        error: errorMessage
      }]
    };
  }
}
