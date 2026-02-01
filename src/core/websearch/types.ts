export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  score: number;
}

export interface WebSearchResponse {
  results: SearchResult[];
  query: string;
  provider: string;
}

export interface WebSearchOptions {
  provider: 'agent' | 'exa';
  maxResults?: number;
  apiKey?: string;
  apiUrl?: string;
}

export interface Config {
  webSearchProvider: 'agent' | 'exa';
  exaApiKey?: string;
  exaApiUrl?: string;
  maxWebResults?: number;
  searchResultsLimit?: number;
  boostRecentSearch?: boolean;
}
