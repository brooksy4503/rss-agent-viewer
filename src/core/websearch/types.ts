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
  maxResults?: number;
  apiKey?: string;
  apiUrl?: string;
  provider?: string;
}

export interface Config {
  exaApiKey?: string;
  exaApiUrl?: string;
  maxWebResults?: number;
  searchResultsLimit?: number;
  boostRecentSearch?: boolean;
}
