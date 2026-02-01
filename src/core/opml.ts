import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface OPMLFeed {
  url: string;
  title: string;
  category?: string;
}

export interface OPMLImport {
  title?: string;
  feeds: OPMLFeed[];
}

export function parseOPML(opmlContent: string): OPMLImport {
  const feeds: OPMLFeed[] = [];

  const outlineMatches = opmlContent.match(/<outline[^>]*>/gi);
  if (!outlineMatches) {
    return { feeds };
  }

  let currentCategory = 'General';

  for (const outline of outlineMatches) {
    const xmlUrl = getAttribute(outline, 'xmlUrl');
    const title = getAttribute(outline, 'title') || getAttribute(outline, 'text') || 'Untitled';
    const category = getAttribute(outline, 'category') || currentCategory;
    const text = getAttribute(outline, 'text') || '';

    if (xmlUrl) {
      feeds.push({ url: xmlUrl, title, category });
      currentCategory = category;
    } else if (text !== '' && !xmlUrl) {
      currentCategory = text;
    }
  }

  return { feeds };
}

function getAttribute(element: string, attrName: string): string | null {
  const regex = new RegExp(`${attrName}\\s*=\\s*["']([^"']*)["']`, 'i');
  const match = element.match(regex);
  return match ? match[1] : null;
}

export function generateOPML(feeds: Array<{ url: string; title: string; category: string }>): string {
  const categories = new Map<string, Array<{ url: string; title: string }>>();

  feeds.forEach(feed => {
    const category = feed.category || 'General';
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push({ url: feed.url, title: feed.title });
  });

  let opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>RSS Feeds Export</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>
`;

  const escapeXml = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');

  categories.forEach((categoryFeeds, categoryName) => {
    const safeCategory = escapeXml(categoryName);
    opml += `    <outline text="${safeCategory}" title="${safeCategory}">\n`;

    categoryFeeds.forEach(feed => {
      const safeTitle = escapeXml(feed.title);
      const safeUrl = escapeXml(feed.url);
      opml += `      <outline text="${safeTitle}" xmlUrl="${safeUrl}" title="${safeTitle}"/>\n`;
    });

    opml += `    </outline>\n`;
  });

  opml += `  </body>
</opml>`;

  return opml;
}

export function importOPMLFile(filePath: string): OPMLImport {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  return parseOPML(content);
}
