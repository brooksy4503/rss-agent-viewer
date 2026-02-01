import type { Article } from '../core/types.js';

interface FeedRow {
  url: string;
  category: string;
}

export function formatFeedsTable(feeds: FeedRow[]): string {
  if (feeds.length === 0) {
    return 'No feeds found.';
  }

  const maxUrlLength = Math.max(...feeds.map(f => f.url.length), 30);
  const maxCategoryLength = Math.max(...feeds.map(f => f.category.length), 15);

  let output = '┌' + '─'.repeat(maxUrlLength + 2) + '┬' + '─'.repeat(maxCategoryLength + 2) + '┬' + '─'.repeat(10) + '┐\n';
  output += '│ ' + padRight('Feed', maxUrlLength) + ' │ ' + padRight('Category', maxCategoryLength) + ' │ Articles │\n';
  output += '├' + '─'.repeat(maxUrlLength + 2) + '┼' + '─'.repeat(maxCategoryLength + 2) + '┼' + '─'.repeat(10) + '┤\n';

  feeds.forEach(feed => {
    output += '│ ' + padRight(feed.url, maxUrlLength) + ' │ ' + padRight(feed.category, maxCategoryLength) + ' │ ' + padLeft('—', 8) + ' │\n';
  });

  output += '└' + '─'.repeat(maxUrlLength + 2) + '┴' + '─'.repeat(maxCategoryLength + 2) + '┴' + '─'.repeat(10) + '┘';
  return output;
}

export function formatArticlesTable(articles: Article[]): string {
  if (articles.length === 0) {
    return 'No articles found.';
  }

  let output = '';
  articles.forEach((article, index) => {
    output += `${index + 1}. ${article.title}\n`;
    output += `   ${article.link}\n`;
    if (article.publishedAt) {
      output += `   Published: ${article.publishedAt.toLocaleDateString()}\n`;
    }
    output += '\n';
  });

  return output;
}

export function formatJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function padRight(str: string, length: number): string {
  return str + ' '.repeat(Math.max(0, length - str.length));
}

function padLeft(str: string, length: number): string {
  return ' '.repeat(Math.max(0, length - str.length)) + str;
}
