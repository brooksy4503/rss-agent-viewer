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

export async function parseFeed(url: string): Promise<ParsedFeed> {
  try {
    const feed = await parser.parseURL(url);

    return {
      title: feed.title || 'Unknown Feed',
      description: feed.description || '',
      link: feed.link || url,
      items: feed.items.map(item => ({
        title: item.title || 'No title',
        link: item.link || '',
        pubDate: item.pubDate ? new Date(item.pubDate) : null,
        content: item.content || item['content:encoded'] || null,
        contentSnippet: item.contentSnippet || null,
        author: item.author || item.creator || null
      }))
    };
  } catch (error) {
    throw new Error(`Failed to parse feed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function getFeedType(xmlContent: string): 'rss' | 'atom' | 'unknown' {
  if (xmlContent.includes('<rss')) return 'rss';
  if (xmlContent.includes('<feed') || xmlContent.includes('<atom')) return 'atom';
  return 'unknown';
}
