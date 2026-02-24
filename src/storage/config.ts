import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

export interface Config {
  databasePath: string;
  configPath: string;
  cacheTTL: number;
  discoveryTimeout: number;
  feedTimeout: number;
  overallTimeout: number;
  maxBlogs: number;
  exaApiKey?: string;
  exaApiUrl?: string;
  maxWebResults?: number;
  searchResultsLimit?: number;
  boostRecentSearch?: boolean;
}

const BASE_CONFIG: Config = {
  databasePath: join(homedir(), '.config', 'rss-viewer', 'feeds.db'),
  configPath: join(homedir(), '.config', 'rss-viewer', 'config.json'),
  cacheTTL: 300000,
  discoveryTimeout: 10000,
  feedTimeout: 10000,
  overallTimeout: 120000,
  maxBlogs: 5,
  exaApiKey: undefined,
  exaApiUrl: 'https://api.exa.ai/search',
  maxWebResults: 10,
  searchResultsLimit: 20,
  boostRecentSearch: false
};

function parseEnvNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function applyEnvOverrides(config: Config): Config {
  const cacheTTL = parseEnvNumber(process.env.RSS_VIEWER_CACHE_TTL);
  const discoveryTimeout = parseEnvNumber(process.env.RSS_DISCOVER_TIMEOUT);
  const feedTimeout = parseEnvNumber(process.env.RSS_FEED_TIMEOUT);
  const maxBlogs = parseEnvNumber(process.env.RSS_DISCOVER_MAX_BLOGS);
  const maxWebResults = parseEnvNumber(process.env.RSS_VIEWER_MAX_WEB_RESULTS);
  const searchResultsLimit = parseEnvNumber(process.env.RSS_VIEWER_SEARCH_LIMIT);

  return {
    ...config,
    databasePath: process.env.RSS_VIEWER_DB_PATH || config.databasePath,
    configPath: process.env.RSS_VIEWER_CONFIG_PATH || config.configPath,
    cacheTTL: cacheTTL ?? config.cacheTTL,
    discoveryTimeout: discoveryTimeout ?? config.discoveryTimeout,
    feedTimeout: feedTimeout ?? config.feedTimeout,
    maxBlogs: maxBlogs ?? config.maxBlogs,
    exaApiKey: process.env.EXA_API_KEY || config.exaApiKey,
    exaApiUrl: process.env.EXA_API_URL || config.exaApiUrl,
    maxWebResults: maxWebResults ?? config.maxWebResults,
    searchResultsLimit: searchResultsLimit ?? config.searchResultsLimit,
    boostRecentSearch: process.env.RSS_VIEWER_BOOST_RECENT === 'true' || config.boostRecentSearch
  };
}

export function loadConfig(): Config {
  const baseConfig = applyEnvOverrides({ ...BASE_CONFIG });
  const configPath = baseConfig.configPath;

  if (!existsSync(configPath)) {
    return baseConfig;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return applyEnvOverrides({ ...BASE_CONFIG, ...config, configPath });
  } catch {
    return baseConfig;
  }
}

export function saveConfig(config: Config): void {
  const configDir = join(config.configPath, '..');
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  writeFileSync(config.configPath, JSON.stringify(config, null, 2));
}

export function initConfig(): Config {
  const config = applyEnvOverrides({ ...BASE_CONFIG });
  saveConfig(config);
  console.log(`Config created at: ${config.configPath}`);
  console.log(`Database path: ${config.databasePath}`);
  return config;
}
