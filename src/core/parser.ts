import Parser from 'rss-parser';
import type { Feed, Article } from './types.js';

const parser = new Parser();

export interface ParsedFeed {
  title: string;
  description: string;
  link: string;
  items: ParsedArticle[];
}

export interface ParsedArticle {
  title: string;
  link: string;
  pubDate: Date | null;
  content: string | null;
  contentSnippet: string | null;
  author: string | null;
}

export async function parseFeed(url: string, timeoutMs: number = 10000): Promise<ParsedFeed> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'rss-agent-viewer/0.3.5',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlContent = await response.text();
    const feed = await parser.parseString(xmlContent);

    return {
      title: feed.title || 'Unknown Feed',
      description: feed.description || '',
      link: feed.link || url,
      items: feed.items.map((item: any) => ({
        title: item.title || 'No title',
        link: item.link || '',
        pubDate: item.pubDate ? new Date(item.pubDate) : null,
        content: item.content || item['content:encoded'] || null,
        contentSnippet: item.contentSnippet || null,
        author: item.author || item.creator || null
      }))
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Feed fetch timeout after ${timeoutMs}ms: ${url}`);
    }

    if (error instanceof Error) {
      throw new Error(`Failed to parse feed: ${error.message}`);
    }

    throw new Error(`Failed to parse feed: ${String(error)}`);
  }
}

export function getFeedType(xmlContent: string): 'rss' | 'atom' | 'unknown' {
  if (xmlContent.includes('<rss')) return 'rss';
  if (xmlContent.includes('<feed') || xmlContent.includes('<atom')) return 'atom';
  return 'unknown';
}
