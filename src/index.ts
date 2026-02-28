#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import {
  handleInit,
  handleAdd,
  handleDiscover,
  handleFeeds,
  handleRemove,
  handleRead,
  handleSearch,
  handleDiscoverSearch,
  handleImport,
  handleExport,
  handleCache,
  handleCleanup,
} from './cli/commands.js';

let __dirname: string;
try {
  __dirname = path.dirname(fileURLToPath(import.meta.url));
} catch {
  __dirname = path.dirname(process.execPath);
}

const program = new Command();

program
  .name('rss-viewer')
  .description('CLI RSS/Atom feed viewer with automatic feed discovery')
  .version('0.3.0');

program
  .command('init')
  .description('Initialize configuration and database')
  .action(handleInit);

program
  .command('add <url>')
  .description('Add a feed to database')
  .option('--discover', 'Auto-discover feeds from URL')
  .option('--category <name>', 'Feed category')
  .option('--timeout <ms>', 'Per-feed fetch timeout in milliseconds (e.g. when resolving title after discovery)')
  .action(handleAdd);

program
  .command('discover <url>')
  .description('Discover feeds from a URL')
  .option('--timeout <ms>', 'Discovery timeout in milliseconds', '10000')
  .option('--skip-blogs', 'Skip blog scanning')
  .option('--max-blogs <n>', 'Maximum blog paths to scan', '5')
  .action(handleDiscover);

program
  .command('feeds')
  .description('List all subscribed feeds')
  .action(handleFeeds);

program
  .command('remove <url>')
  .description('Remove a feed by URL')
  .action(handleRemove);

program
  .command('read [url]')
  .description('Read articles from a feed or all feeds')
  .option('--cached', 'Use cached data only, skip fetching')
  .option('--limit <n>', 'Maximum number of articles', '20')
  .option('--since <date>', 'Show articles newer than date')
  .option('--author <name>', 'Filter by author')
  .option('--tag <tag>', 'Filter by tag/category')
  .option('--reverse', 'Show oldest articles first')
  .option('--latest-per-feed', 'Show only the latest article from each feed (all-feeds mode)')
  .option('--timeout <ms>', 'Per-feed fetch timeout in milliseconds')
  .option('--overall-timeout <ms>', 'Overall fetch timeout in milliseconds (for --all with many feeds)')
  .action(handleRead);

program
  .command('search <query>')
  .description('Search articles in database or web')
  .option('--local', 'Search local database only (default)')
  .option('--web', 'Search web for new feeds')
  .option('--max-results <n>', 'Max web search results', '10')
  .option('--auto-add', 'Automatically add discovered feeds')
  .option('--no-confirm', 'Skip confirmation prompts')
  .option('--category <name>', 'Feed category')
  .option('--read', 'Fetch articles from new feeds')
  .option('--limit <n>', 'Maximum number of articles', '20')
  .option('--since <date>', 'Show articles newer than date')
  .option('--author <name>', 'Filter by author')
  .option('--tag <tag>', 'Filter by tag/category')
  .action(handleSearch);

program
  .command('discover-search <query>')
  .description('Search web, discover feeds, add, and search articles')
  .option('--max-results <n>', 'Max web search results', '10')
  .option('--auto-add', 'Automatically add discovered feeds (non-interactive)')
  .option('--no-confirm', 'Skip confirmation prompts')
  .option('--category <name>', 'Feed category', 'General')
  .option('--read', 'Fetch and display articles from new feeds')
  .option('--limit <n>', 'Max articles to display', '20')
  .option('--timeout <ms>', 'Discovery timeout in milliseconds', '10000')
  .action(handleDiscoverSearch);

program
  .command('import <file>')
  .description('Import feeds from OPML file')
  .action(handleImport);

program
  .command('export')
  .description('Export feeds to OPML or JSON')
  .option('--fmt <format>', 'Output format (opml|json)', 'opml')
  .action(handleExport);

program
  .command('cache <action>')
  .description('Manage cache (stats, clear, refresh)')
  .action(handleCache);

program
  .command('cleanup')
  .description('Remove broken and duplicate feeds (runs both checks by default)')
  .option('--broken', 'Only remove feeds that fail to fetch')
  .option('--duplicates', 'Only remove duplicate feeds from same domain')
  .option('--dry-run', 'Show what would be removed without removing')
  .action(handleCleanup);

program.parse(process.argv);
