import type { SearchProvider, SearchResult, SourceRetriever, SourceRetrievalMetadata } from '@domain-forge/contracts';

/** Deterministic fake search — no provider-native browsing */
export class FakeSearchProvider implements SearchProvider {
  private readonly catalog: Map<string, SearchResult[]>;

  constructor(catalog?: Record<string, SearchResult[]>) {
    this.catalog = new Map(Object.entries(catalog ?? {}));
  }

  async search(query: string, options?: { maxResults?: number }): Promise<SearchResult[]> {
    const results = this.catalog.get(query) ?? [];
    const max = options?.maxResults ?? 10;
    return results.slice(0, max);
  }

  registerQuery(query: string, results: SearchResult[]): void {
    this.catalog.set(query, results);
  }
}

/** Deterministic fake retriever — Forge-controlled fetch simulation */
export class FakeSourceRetriever implements SourceRetriever {
  private readonly pages: Map<string, string>;

  constructor(pages?: Record<string, string>) {
    this.pages = new Map(Object.entries(pages ?? {}));
  }

  async fetch(url: string): Promise<{ content: string; metadata: SourceRetrievalMetadata }> {
    const content = this.pages.get(url);
    if (content === undefined) {
      throw new Error(`SOURCE_UNAVAILABLE: ${url}`);
    }
    return {
      content,
      metadata: {
        url,
        finalUrl: url,
        httpStatus: 200,
        contentType: 'text/plain',
        contentLength: content.length,
        retrievedAt: new Date().toISOString(),
      },
    };
  }

  registerPage(url: string, content: string): void {
    this.pages.set(url, content);
  }
}
