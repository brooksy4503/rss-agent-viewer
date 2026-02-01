export interface Feed {
  id: number;
  url: string;
  title: string;
  link: string;
  type: 'rss' | 'atom';
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Article {
  id: number;
  feedId: number;
  title: string;
  link: string;
  content: string | null;
  summary: string | null;
  author: string | null;
  publishedAt: Date;
  readAt: Date | null;
  createdAt: Date;
}

export interface DiscoveredFeeds {
  success: boolean;
  results: Array<{
    url: string;
    feeds: Array<{
      url: string;
      title: string;
      type: 'rss' | 'atom' | 'unknown';
    }>;
    error: string | null;
  }>;
}

export interface DiscoveryOptions {
  timeout?: number;
  skipBlogs?: boolean;
  maxBlogs?: number;
  customBlogPaths?: string[];
  verbose?: boolean;
}
