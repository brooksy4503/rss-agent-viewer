import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

export interface Config {
  databasePath: string;
  configPath: string;
  cacheTTL: number;
  discoveryTimeout: number;
  maxBlogs: number;
}

const BASE_CONFIG: Config = {
  databasePath: join(homedir(), '.config', 'rss-viewer', 'feeds.db'),
  configPath: join(homedir(), '.config', 'rss-viewer', 'config.json'),
  cacheTTL: 300000, // 5 minutes (ms)
  discoveryTimeout: 10000,
  maxBlogs: 5
};

function parseEnvNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function applyEnvOverrides(config: Config): Config {
  const cacheTTL = parseEnvNumber(process.env.RSS_VIEWER_CACHE_TTL);
  const discoveryTimeout = parseEnvNumber(process.env.RSS_DISCOVER_TIMEOUT);
  const maxBlogs = parseEnvNumber(process.env.RSS_DISCOVER_MAX_BLOGS);

  return {
    ...config,
    databasePath: process.env.RSS_VIEWER_DB_PATH || config.databasePath,
    configPath: process.env.RSS_VIEWER_CONFIG_PATH || config.configPath,
    cacheTTL: cacheTTL ?? config.cacheTTL,
    discoveryTimeout: discoveryTimeout ?? config.discoveryTimeout,
    maxBlogs: maxBlogs ?? config.maxBlogs
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
