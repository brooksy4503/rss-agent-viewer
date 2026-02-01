import type { SearchResult, WebSearchResponse, WebSearchOptions, Config } from './types.js';

export class WebSearch {
  constructor(private config: Config) {}

  async search(query: string, options: WebSearchOptions): Promise<WebSearchResponse> {
    const provider = options.provider || this.config.webSearchProvider;

    if (provider === 'exa' && this.config.exaApiKey) {
      return this.searchWithExa(query, options);
    } else {
      return this.searchWithAgent(query, options);
    }
  }

  private async searchWithExa(query: string, options: WebSearchOptions): Promise<WebSearchResponse> {
    const apiKey = options.apiKey || this.config.exaApiKey;

    if (!apiKey) {
      throw new Error('Exa API key is required for provider=exa');
    }

    const apiUrl = options.apiUrl || this.config.exaApiUrl || 'https://api.exa.ai/search';
    const maxResults = options.maxResults || this.config.maxWebResults || 10;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        query,
        numResults: maxResults,
        type: 'keyword',
        useAutoprompt: false,
        contents: { text: true }
      })
    });

    if (!response.ok) {
      throw new Error(`Exa API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const results: SearchResult[] = data.results.map((item: any) => ({
      url: item.url,
      title: item.title,
      snippet: item.text || '',
      score: item.score || 0
    }));

    return {
      results: this.filterUrlsForFeeds(results),
      query,
      provider: 'exa'
    };
  }

  private async searchWithAgent(query: string, options: WebSearchOptions): Promise<WebSearchResponse> {
    return {
      results: [],
      query,
      provider: 'agent'
    };
  }

  filterUrlsForFeeds(results: SearchResult[]): SearchResult[] {
    const seenUrls = new Set<string>();
    const filtered: SearchResult[] = [];

    const blockedExtensions = ['.jpg', '.png', '.gif', '.pdf', '.zip', '.mp4', '.avi', '.mov', '.webm'];

    for (const result of results) {
      const url = result.url.toLowerCase();

      if (seenUrls.has(url)) continue;

      if (blockedExtensions.some(ext => url.includes(ext))) continue;

      seenUrls.add(url);
      filtered.push(result);
    }

    return filtered;
  }
}
