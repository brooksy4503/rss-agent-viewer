import { join } from 'node:path';
import { existsSync } from 'node:fs';
import chalk from 'chalk';
import { FeedDatabase, type RankedArticle } from '../storage/database.js';
import { DiscoveryCache } from '../core/cache.js';
import { parseFeed, getFeedType } from '../core/parser.js';
import { parseOPML, generateOPML, importOPMLFile } from '../core/opml.js';
import { initConfig, loadConfig } from '../storage/config.js';
import type { Config } from '../storage/config.js';
import { formatFeedsTable } from '../utils/formatter.js';
import { WebSearch } from '../core/websearch/index.js';

let db: FeedDatabase | null = null;
let discoveryCache: DiscoveryCache | null = null;
let config: Config | null = null;

async function fetchFeedTitle(feedUrl: string, timeoutMs: number = 10000): Promise<string | null> {
  try {
    const parsed = await parseFeed(feedUrl, timeoutMs);
    return parsed.title;
  } catch {
    return null;
  }
}

function getConfig(): Config {
  if (!config) {
    config = loadConfig();
  }
  return config;
}

function getDatabase(): FeedDatabase {
  if (!db) {
    db = new FeedDatabase(getConfig().databasePath);
  }
  return db;
}

function getDiscoveryCache(): DiscoveryCache {
  if (!discoveryCache) {
    const cacheTTLSeconds = Math.max(1, Math.round(getConfig().cacheTTL / 1000));
    discoveryCache = new DiscoveryCache(getDatabase(), cacheTTLSeconds);
  }
  return discoveryCache;
}

export async function handleInit() {
  const initialized = initConfig();
  const configDir = join(initialized.configPath, '..');

  if (!existsSync(configDir)) {
    console.log(chalk.dim(`Creating config directory: ${configDir}`));
  }

  const testDb = new FeedDatabase(initialized.databasePath);
  testDb.close();

  console.log(`${chalk.green('✓')} Database created at: ${initialized.databasePath}`);
  console.log(`${chalk.green('✓')} Config path: ${initialized.configPath}`);
  console.log('\nYou can now add feeds with:');
  console.log('  rss-viewer add <url>');
  console.log('  rss-viewer discover <url>');
}

export async function handleAdd(url: string, options: { discover?: boolean; category?: string; timeout?: string }) {
  const database = getDatabase();
  const cache = getDiscoveryCache();
  const settings = getConfig();
  const feedTimeout = parseTimeoutOption(options.timeout, settings.feedTimeout);

  let feedUrl = url;
  let feedTitle = url;
  let feedType: 'rss' | 'atom' = 'rss';

  if (options.discover) {
    console.log(chalk.dim(`Auto-discovering feeds from: ${url}`));

    const cached = cache.get(url);
    let discoveredFeeds: any[] = [];

    if (cached && cached.results[0]?.feeds?.length > 0) {
      console.log(`${chalk.green('✓')} Using cached discovery results`);
      discoveredFeeds = cached.results[0].feeds;
    } else {
      const { discoverFeeds } = await import('../core/discovery.js');

      const result = await discoverFeeds(url, {
        timeout: settings.discoveryTimeout,
        skipBlogs: false,
        maxBlogs: settings.maxBlogs,
        verbose: false
      });

      if (result.success && result.results[0]?.feeds?.length > 0) {
        discoveredFeeds = result.results[0].feeds;
        cache.set(url, result);

        console.log(`${chalk.green('✓')} Found ${discoveredFeeds.length} feed(s) from discovery`);
      } else {
        console.log(`${chalk.yellow('○')} No feeds found, adding as manual feed`);
      }
    }

  if (discoveredFeeds.length > 0) {
    feedUrl = discoveredFeeds[0].url;
    const realTitle = await fetchFeedTitle(feedUrl, feedTimeout);
    feedTitle = realTitle || discoveredFeeds[0].title || url;
    feedType = discoveredFeeds[0].type === 'unknown' ? 'rss' : discoveredFeeds[0].type;

    console.log(chalk.dim(`  Using: ${feedUrl}`));
    console.log(chalk.dim(`  Title: ${feedTitle}`));
    console.log(chalk.dim(`  Type: ${feedType}`));
  }
  }

  const category = options.category || 'General';

  try {
    const feedId = database.addFeed({
      url: feedUrl,
      title: feedTitle,
      link: feedUrl,
      type: feedType,
      category
    });

    console.log(`${chalk.green('✓')} Added feed: ${feedUrl}`);
    console.log(chalk.dim(`  Category: ${category}`));
  } catch (error) {
    console.error(`${chalk.red('✗')} Failed to add feed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

export async function handleDiscover(url: string, options: { timeout?: number; skipBlogs?: boolean; maxBlogs?: number }) {
  console.log(chalk.dim(`Discovering feeds from: ${url}`));

  const cache = getDiscoveryCache();
  const settings = getConfig();

  const cached = cache.get(url);
  if (cached) {
    console.log(`${chalk.green('✓')} Using cached discovery results`);
    if (cached.success && cached.results[0].feeds.length > 0) {
      cached.results[0].feeds.forEach((feed: any) => {
        console.log(chalk.dim(`  Found: ${feed.url} (${feed.title}, ${feed.type})`));
      });
    }
    return;
  }

  const { discoverFeeds } = await import('../core/discovery.js');

  const result = await discoverFeeds(url, {
    timeout: typeof options.timeout === 'number' ? options.timeout : settings.discoveryTimeout,
    skipBlogs: options.skipBlogs,
    maxBlogs: typeof options.maxBlogs === 'number' ? options.maxBlogs : settings.maxBlogs,
    verbose: false
  });

  if (result.success) {
    const feeds = result.results[0]?.feeds || [];
    if (feeds.length > 0) {
      console.log(`${chalk.green('✓')} Found ${feeds.length} feed(s):`);
      feeds.forEach((feed: any) => {
        console.log(chalk.dim(`  ${feed.url} (${feed.title}, ${feed.type})`));
      });

      cache.set(url, result);
    } else {
      console.log(`${chalk.yellow('○')} No feeds found`);
    }
  } else {
    const error = result.results[0]?.error || 'Unknown error';
    console.log(`${chalk.red('✗')} Discovery failed: ${error}`);
    process.exit(2);
  }
}

export async function handleFeeds() {
  const database = getDatabase();

  const feeds = database.getAllFeeds();

  if (feeds.length === 0) {
    console.log(chalk.yellow('No feeds found. Add a feed with:'));
    console.log('  rss-viewer add <url>');
    return;
  }

  console.log(`\n${chalk.bold('Subscribed Feeds')}`);
  console.log(formatFeedsTable(feeds));
  console.log(chalk.dim(`\nTotal: ${feeds.length} feeds`));
}

export async function handleRemove(url: string) {
  const database = getDatabase();

  const feed = database.getFeedByUrl(url);
  if (!feed) {
    console.log(`${chalk.red('✗')} Feed not found: ${url}`);
    process.exit(1);
  }

  const removed = database.removeFeed(url);
  if (removed) {
    console.log(`${chalk.green('✓')} Removed feed: ${feed.title}`);
  } else {
    console.log(`${chalk.red('✗')} Failed to remove feed`);
    process.exit(1);
  }
}

const CONCURRENCY_LIMIT = 10;

async function fetchFeedWithLimit(feed: any, database: FeedDatabase, timeoutMs: number): Promise<{ success: boolean; title: string; articles: number; error?: string }> {
  try {
    const parsedFeed = await parseFeed(feed.url, timeoutMs);

    if (parsedFeed.title !== feed.title) {
      database.addFeed({
        url: feed.url,
        title: parsedFeed.title,
        link: parsedFeed.link,
        type: feed.type,
        category: feed.category
      });
    }

    let articleCount = 0;
    for (const item of parsedFeed.items) {
      database.addArticle({
        feedId: feed.id,
        title: item.title,
        link: item.link,
        content: item.content,
        summary: item.contentSnippet,
        author: item.author,
        publishedAt: item.pubDate ? item.pubDate.toISOString() : new Date().toISOString(),
        readAt: null
      });
      articleCount++;
    }

    return { success: true, title: feed.title || feed.url, articles: articleCount };
  } catch (error) {
    return { success: false, title: feed.title || feed.url, articles: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchAllFeedsParallel(feeds: any[], database: FeedDatabase, timeoutMs: number, overallTimeoutMs?: number): Promise<void> {
  const total = feeds.length;
  let completed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  const batches: any[][] = [];
  for (let i = 0; i < feeds.length; i += CONCURRENCY_LIMIT) {
    batches.push(feeds.slice(i, i + CONCURRENCY_LIMIT));
  }

  // Add overall timeout if specified
  const overallTimeoutPromise = overallTimeoutMs ? new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Overall fetch timeout after ${overallTimeoutMs}ms`)), overallTimeoutMs);
  }) : null;

  const fetchPromise = (async () => {
    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(feed => fetchFeedWithLimit(feed, database, timeoutMs))
      );

      for (const result of results) {
        completed++;
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            succeeded++;
          } else {
            failed++;
            errors.push(`${result.value.title}: ${result.value.error}`);
          }
        } else {
          failed++;
        }
      }

      process.stdout.write(`\r${chalk.dim(`Fetching: ${completed}/${total} feeds...`)}`);
    }
  })();

  try {
    if (overallTimeoutPromise) {
      await Promise.race([fetchPromise, overallTimeoutPromise]);
    } else {
      await fetchPromise;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Overall fetch timeout')) {
      console.log(`\n${chalk.yellow('⚠')} ${error.message} - using partial results`);
    } else {
      throw error;
    }
  }

  console.log(`\r${chalk.dim('Fetching:'.padEnd(30))}`);
  console.log(`${chalk.green('✓')} ${succeeded} feeds fetched successfully`);
  if (failed > 0) {
    console.log(`${chalk.yellow('⚠')} ${failed} feeds failed`);
    if (errors.length <= 5) {
      errors.forEach(err => console.log(chalk.dim(`  - ${err}`)));
    }
  }
}

function parseTimeoutOption(value: string | undefined, fallback: number): number {
  if (value == null || value === '') return fallback;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

export async function handleRead(url: string | undefined, options: any) {
  const database = getDatabase();
  const settings = getConfig();
  const timeoutMs = parseTimeoutOption(options.timeout, settings.feedTimeout);
  const overallTimeoutMs = parseTimeoutOption(options.overallTimeout, settings.overallTimeout);

  if (url) {
    const feed = database.getFeedByUrl(url);
    if (!feed) {
      console.log(`${chalk.red('✗')} Feed not found: ${url}`);
      process.exit(1);
    }

    console.log(chalk.dim(`Fetching: ${feed.url}`));
    try {
      const parsedFeed = await parseFeed(feed.url, timeoutMs);

      if (parsedFeed.title !== feed.title) {
        database.addFeed({
          url: feed.url,
          title: parsedFeed.title,
          link: parsedFeed.link,
          type: feed.type,
          category: feed.category
        });
      }

      let fetched = 0;
      for (const item of parsedFeed.items) {
        database.addArticle({
          feedId: feed.id,
          title: item.title,
          link: item.link,
          content: item.content,
          summary: item.contentSnippet,
          author: item.author,
          publishedAt: item.pubDate ? item.pubDate.toISOString() : new Date().toISOString(),
          readAt: null
        });
        fetched++;
      }
      console.log(`${chalk.green('✓')} Fetched ${fetched} articles`);
    } catch (error) {
      console.log(`${chalk.yellow('⚠')} Failed to fetch feed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const limit = options.limit ? parseInt(options.limit) : 20;
    const articles = database.getArticlesByFeedId(feed.id, limit);

    console.log(`\nReading from: ${feed.title}\n`);
    displayArticles(articles);

    if (db) {
      db.close();
    }
  } else {
    const feeds = database.getAllFeeds();

    if (!options.cached && feeds.length > 0) {
      console.log(chalk.dim(`Fetching from ${feeds.length} feed(s)...`));
      await fetchAllFeedsParallel(feeds, database, timeoutMs, overallTimeoutMs);
    } else if (options.cached) {
      console.log(chalk.dim('Using cached data (--cached)'));
    }

    const filters: any = {};
    if (options.limit) filters.limit = parseInt(options.limit);
    if (options.since) filters.since = new Date(options.since);
    if (options.author) filters.author = options.author;
    if (options.tag) filters.category = options.tag;

    const articles = database.filterArticles(filters);
    console.log('\nReading from all feeds\n');
    displayArticles(articles);

    if (db) {
      db.close();
    }
  }
}

export async function handleSearch(query: string, options: any) {
  if (options.web) {
    await handleDiscoverSearch(query, options);
    return;
  }

  const database = getDatabase();

  try {
    const filters: any = {};
    if (options.limit) filters.limit = parseInt(options.limit);
    if (options.since) filters.since = new Date(options.since);
    if (options.author) filters.author = options.author;
    if (options.tag) filters.category = options.tag;

    const articles = database.searchArticlesWithRelevance(query, filters);

    if (articles.length === 0) {
      console.log(chalk.yellow(`No articles found for: "${query}"`));
      return;
    }

    console.log(`\n${chalk.bold(`Search results for: "${query}"`)}\n`);
    displayRankedArticles(articles);
  } finally {
    if (db) db.close();
  }
}

export async function handleDiscoverSearch(query: string, options: any) {
  const database = getDatabase();
  const cache = getDiscoveryCache();
  const config = getConfig();

  try {
    if (!config.exaApiKey) {
      console.log(chalk.red('Exa API key is required for web search. Please add it to your config or set EXA_API_KEY environment variable.'));
      return;
    }

    console.log(chalk.dim(`Searching web for: "${query}"`));
    const webSearch = new WebSearch(config);

    const searchResults = await webSearch.search(query, {
      maxResults: options.maxResults ? parseInt(options.maxResults) : config.maxWebResults
    });

    if (searchResults.results.length === 0) {
      console.log(chalk.yellow('○ No web search results found'));
      return;
    }

    console.log(chalk.dim(`Found ${searchResults.results.length} URL(s)`));

    let discoveredFeeds: any[] = [];
    const { discoverFeeds } = await import('../core/discovery.js');

    for (const result of searchResults.results) {
      console.log(chalk.dim(`Discovering feeds from: ${result.url}`));

      const cached = cache.get(result.url);
      let feeds: any[] = [];

      if (cached) {
        feeds = cached.results[0]?.feeds || [];
        console.log(chalk.dim('  Using cached discovery'));
      } else {
        const discovery = await discoverFeeds(result.url, {
          timeout: options.timeout ? parseInt(options.timeout) : config.discoveryTimeout,
          skipBlogs: false,
          maxBlogs: config.maxBlogs,
          verbose: false
        });

        if (discovery.success) {
          feeds = discovery.results[0]?.feeds || [];
          cache.set(result.url, discovery);
        }
      }

      discoveredFeeds.push(...feeds);
    }

    const uniqueFeeds = Array.from(
      new Map(discoveredFeeds.map(f => [f.url, f])).values()
    );

    if (uniqueFeeds.length === 0) {
      console.log(chalk.yellow('○ No RSS feeds found from web results'));
      return;
    }

    console.log(chalk.green(`✓ Found ${uniqueFeeds.length} unique feed(s)`));

    if (options.autoAdd) {
      const category = options.category || 'General';

      for (const feed of uniqueFeeds) {
        try {
          const realTitle = await fetchFeedTitle(feed.url);
          const titleToUse = realTitle || feed.title;

          database.addFeed({
            url: feed.url,
            title: titleToUse,
            link: feed.url,
            type: feed.type === 'unknown' ? 'rss' : feed.type,
            category
          });
          console.log(chalk.dim(`  ✓ Added: ${titleToUse}`));
        } catch (error) {
          console.log(chalk.dim(`  ✗ Failed: ${feed.url}`));
        }
      }

      console.log(chalk.green(`✓ Added ${uniqueFeeds.length} feed(s) to database`));
    }

    if (options.read) {
      const limit = options.limit ? parseInt(options.limit) : 20;

      for (const feed of uniqueFeeds) {
        const dbFeed = database.getFeedByUrl(feed.url);
        if (!dbFeed) continue;

        console.log(chalk.dim(`Fetching articles from: ${feed.title}`));

        try {
          const parsed = await parseFeed(feed.url, config.feedTimeout);

          for (const item of parsed.items) {
            database.addArticle({
              feedId: dbFeed.id,
              title: item.title,
              link: item.link,
              content: item.content,
              summary: item.contentSnippet,
              author: item.author,
              publishedAt: item.pubDate ? item.pubDate.toISOString() : new Date().toISOString(),
              readAt: null
            });
          }
        } catch (error) {
          console.log(chalk.dim(`  ✗ Failed to fetch: ${feed.title}`));
        }
      }
    }

    const searchLimit = options.limit ? parseInt(options.limit) : config.searchResultsLimit;
    const articles = database.searchArticlesWithRelevance(query, {
      limit: searchLimit
    });

    console.log(`\n${chalk.bold(`Search results for: "${query}"`)}\n`);
    displayRankedArticles(articles);
  } finally {
    if (db) db.close();
  }
}

function displayArticles(articles: any[]) {
  if (articles.length === 0) {
    console.log(chalk.yellow('No articles found.'));
    return;
  }

  articles.forEach((article: any, index: number) => {
    const published = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'Unknown';
    const readStatus = article.readAt ? chalk.green('✓') : chalk.dim('○');

    console.log(`\n${chalk.bold(`${index + 1}. ${article.title}`)}`);
    console.log(chalk.dim(`   ${article.link}`));
    console.log(chalk.dim(`   Published: ${published}  ${readStatus}`));
  });

  console.log(chalk.dim(`\nTotal: ${articles.length} articles`));
}

function displayRankedArticles(articles: RankedArticle[]) {
  if (articles.length === 0) {
    console.log(chalk.yellow('No articles found.'));
    return;
  }

  articles.forEach((article: any, index: number) => {
    const published = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'Unknown';
    const readStatus = article.readAt ? chalk.green('✓') : chalk.dim('○');
    const relevancePercent = Math.round((1 - Math.min(Math.abs(article.relevanceScore), 10) / 10) * 100);

    console.log(`\n${chalk.bold(`${index + 1}. ${article.title}`)} ${chalk.dim(`(${relevancePercent}% match)`)}`);
    console.log(chalk.dim(`   ${article.link}`));
    console.log(chalk.dim(`   Published: ${published}  ${readStatus}`));
  });

  console.log(chalk.dim(`\nTotal: ${articles.length} articles`));
}

export async function handleImport(file: string) {
  console.log(chalk.dim(`Importing from: ${file}`));

  const database = getDatabase();

  try {
    const opml = importOPMLFile(file);

    if (opml.feeds.length === 0) {
      console.log(chalk.yellow('No feeds found in OPML file'));
      return;
    }

    let imported = 0;
    for (const feed of opml.feeds) {
      database.addFeed({
        url: feed.url,
        title: feed.title,
        link: feed.url,
        type: 'rss',
        category: feed.category || 'General'
      });
      imported++;
    }

    console.log(`${chalk.green('✓')} Imported ${imported} feed(s) from OPML`);
  } catch (error) {
    console.error(`${chalk.red('✗')} Failed to import: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  } finally {
    if (db) db.close();
  }
}

export async function handleExport(format: string) {
  const database = getDatabase();

  try {
    const feeds = database.getAllFeeds();

    if (format === 'json') {
      console.log(JSON.stringify(feeds, null, 2));
    } else if (format === 'opml') {
      const feedsForOPML = feeds.map(feed => ({
        url: feed.url,
        title: feed.title,
        category: feed.category
      }));

      console.log(generateOPML(feedsForOPML));
    } else {
      console.log(chalk.red(`Unknown format: ${format}`));
      console.log(chalk.dim('Available formats: json, opml'));
      process.exit(1);
    }
  } finally {
    if (db) db.close();
  }
}

export async function handleCache(action: string) {
  const database = getDatabase();

  try {
    switch (action) {
      case 'stats':
        const stats = database.getCacheStats();
        console.log(chalk.bold('Cache Statistics:'));
        console.log(chalk.dim(`  Entries: ${stats.count}`));
        console.log(chalk.dim(`  Size: ${(stats.size / 1024).toFixed(2)} KB`));
        break;

      case 'clear':
        database.clearCache();
        console.log(`${chalk.green('✓')} Cache cleared`);
        break;

      case 'refresh':
        console.log(chalk.yellow('Cache refresh not yet implemented'));
        break;

      default:
        console.log(chalk.red(`Unknown cache action: ${action}`));
        console.log(chalk.dim('Available actions: stats, clear, refresh'));
        process.exit(1);
    }
  } finally {
    if (db) db.close();
  }
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

async function validateFeed(url: string): Promise<{ valid: boolean; reason?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'rss-agent-viewer/0.3.4' }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 404) return { valid: false, reason: 'Feed not found (404)' };
      if (response.status === 403) return { valid: false, reason: 'Access denied (403)' };
      return { valid: false, reason: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!text.includes('<rss') && !text.includes('<feed') && !text.includes('<atom')) {
      return { valid: false, reason: 'Not a valid RSS/Atom feed' };
    }

    const feedTimeout = getConfig().feedTimeout;
    const feed = await parseFeed(url, feedTimeout);
    if (!feed || !feed.items || feed.items.length === 0) {
      return { valid: false, reason: 'No articles found' };
    }

    return { valid: true };
  } catch (error) {
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('abort')) return { valid: false, reason: 'Timeout (10s)' };
    if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) return { valid: false, reason: 'Domain not found' };
    if (message.includes('ECONNREFUSED')) return { valid: false, reason: 'Connection refused' };
    return { valid: false, reason: message.slice(0, 50) };
  }
}

export async function handleCleanup(options: { broken?: boolean; duplicates?: boolean; dryRun?: boolean }) {
  const database = getDatabase();
  const feeds = database.getAllFeeds();

  if (feeds.length === 0) {
    console.log(chalk.yellow('No feeds to clean up.'));
    return;
  }

  const checkBroken = options.broken === true;
  const checkDuplicates = options.duplicates === true;
  const checkBoth = !checkBroken && !checkDuplicates;

  console.log(chalk.dim(`Scanning ${feeds.length} feeds...`));
  console.log('');

  const toRemove: Array<{ url: string; title: string; reason: string }> = [];

  if (checkDuplicates || checkBoth) {
    console.log(chalk.bold('Checking for duplicates...'));
    const domainMap = new Map<string, Array<{ url: string; title: string }>>();

    for (const feed of feeds) {
      const domain = extractDomain(feed.url);
      if (!domainMap.has(domain)) {
        domainMap.set(domain, []);
      }
      domainMap.get(domain)!.push({ url: feed.url, title: feed.title });
    }

    let duplicateCount = 0;
    for (const [domain, feedsInDomain] of domainMap) {
      if (feedsInDomain.length > 1) {
        const validFeeds = feedsInDomain.filter(f => 
          f.url.includes('/feed') || 
          f.url.includes('/rss') || 
          f.url.includes('/atom') ||
          f.url.includes('.xml')
        );

        for (const feed of feedsInDomain) {
          if (validFeeds.length > 0 && !validFeeds.includes(feed)) {
            toRemove.push({ url: feed.url, title: feed.title, reason: `Duplicate of ${domain}` });
            duplicateCount++;
          } else if (validFeeds.length === 0 && feedsInDomain.indexOf(feed) > 0) {
            toRemove.push({ url: feed.url, title: feed.title, reason: `Duplicate of ${domain}` });
            duplicateCount++;
          }
        }
      }
    }
    console.log(`${chalk.dim('  Found')} ${duplicateCount} ${chalk.dim('potential duplicates')}`);
  }

  if (checkBroken || checkBoth) {
    console.log('');
    console.log(chalk.bold('Checking for broken feeds...'));

    let checked = 0;
    const batches: any[][] = [];
    for (let i = 0; i < feeds.length; i += CONCURRENCY_LIMIT) {
      batches.push(feeds.slice(i, i + CONCURRENCY_LIMIT));
    }

    for (const batch of batches) {
      const results = await Promise.all(
        batch.map(async (feed) => {
          const result = await validateFeed(feed.url);
          checked++;
          return { feed, ...result };
        })
      );

      for (const result of results) {
        if (!result.valid) {
          toRemove.push({
            url: result.feed.url,
            title: result.feed.title,
            reason: result.reason || 'Unknown error'
          });
        }
      }

      process.stdout.write(`\r${chalk.dim(`  Checked: ${checked}/${feeds.length}`)}`);
    }
    console.log('');
  }

  const uniqueRemovals = Array.from(
    new Map(toRemove.map(r => [r.url, r])).values()
  );

  if (uniqueRemovals.length === 0) {
    console.log('');
    console.log(`${chalk.green('✓')} All feeds look good!`);
    if (db) db.close();
    return;
  }

  console.log('');
  console.log(chalk.bold(`Feeds to remove (${uniqueRemovals.length}):`));
  console.log('');

  for (const item of uniqueRemovals.slice(0, 20)) {
    console.log(`  ${chalk.red('✗')} ${item.title || item.url}`);
    console.log(`    ${chalk.dim(item.reason)}`);
  }

  if (uniqueRemovals.length > 20) {
    console.log(chalk.dim(`  ... and ${uniqueRemovals.length - 20} more`));
  }

  if (options.dryRun) {
    console.log('');
    console.log(chalk.yellow('Dry run mode - no feeds removed.'));
    console.log(chalk.dim('Run without --dry-run to remove these feeds.'));
  } else {
    console.log('');
    console.log(chalk.dim(`Removing ${uniqueRemovals.length} feeds...`));

    let removed = 0;
    for (const item of uniqueRemovals) {
      if (database.removeFeed(item.url)) {
        removed++;
      }
    }

    console.log(`${chalk.green('✓')} Removed ${removed} feeds`);
    console.log(chalk.dim(`${feeds.length - removed} feeds remaining`));
  }

  if (db) db.close();
}
