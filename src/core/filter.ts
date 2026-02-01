import type { Article, Feed } from './types.js';

export interface FilterOptions {
  limit?: number;
  since?: Date;
  author?: string;
  tag?: string;
  reverse?: boolean;
}

export function filterArticles(articles: Article[], options: FilterOptions): Article[] {
  let filtered = [...articles];

  if (options.since) {
    filtered = filtered.filter(a => a.publishedAt >= options.since!);
  }

  if (options.author) {
    filtered = filtered.filter(a =>
      a.author?.toLowerCase().includes(options.author!.toLowerCase())
    );
  }

  if (options.tag) {
    // Tag filtering would need to be implemented with feed category
    // This is a placeholder for now
    filtered = filtered;
  }

  if (options.reverse) {
    filtered = filtered.reverse();
  } else {
    filtered = filtered.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }

  if (options.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

export function searchArticles(articles: Article[], query: string, options: FilterOptions = {}): Article[] {
  const searchTerms = query.toLowerCase().split(/\s+/);

  return filterArticles(
    articles.filter(article => {
      const searchableText = [
        article.title,
        article.summary,
        article.content
      ].join(' ').toLowerCase();

      return searchTerms.every(term => searchableText.includes(term));
    }),
    options
  );
}
