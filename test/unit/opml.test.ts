import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateOPML, importOPMLFile, parseOPML } from '../../src/core/opml.js';

describe('OPML', () => {
  it('parses feeds with categories and nested outlines', () => {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>Test Export</title>
  </head>
  <body>
    <outline text="Tech">
      <outline text="Example RSS" xmlUrl="https://example.com/rss" />
      <outline text="Example Atom" xmlUrl="https://example.com/atom" />
    </outline>
    <outline text="Science">
      <outline text="Science Feed" xmlUrl="https://science.example.com/rss" />
    </outline>
  </body>
</opml>`;

    const result = parseOPML(opml);
    expect(result.feeds).toHaveLength(3);
    expect(result.feeds[0]).toEqual({
      url: 'https://example.com/rss',
      title: 'Example RSS',
      category: 'Tech'
    });
    expect(result.feeds[2]).toEqual({
      url: 'https://science.example.com/rss',
      title: 'Science Feed',
      category: 'Science'
    });
  });

  it('uses category attribute when provided', () => {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <body>
    <outline text="Tech">
      <outline text="Example RSS" xmlUrl="https://example.com/rss" category="Favorites" />
    </outline>
  </body>
</opml>`;

    const result = parseOPML(opml);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].category).toBe('Favorites');
  });

  it('generates OPML grouped by category', () => {
    const output = generateOPML([
      { url: 'https://one.example/rss', title: 'One', category: 'Tech' },
      { url: 'https://two.example/rss', title: 'Two', category: 'Tech' },
      { url: 'https://news.example/rss', title: 'News', category: 'News' }
    ]);

    expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(output).toContain('<opml version="1.0">');
    expect(output).toContain('<dateCreated>');
    expect(output).toContain('<outline text="Tech" title="Tech">');
    expect(output).toContain('xmlUrl="https://one.example/rss"');
    expect(output).toContain('<outline text="News" title="News">');
    expect(output).toContain('xmlUrl="https://news.example/rss"');
  });

  it('handles category-only outlines and assigns following feeds', () => {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <body>
    <outline text="Tech" />
    <outline text="Example RSS" xmlUrl="https://example.com/rss" />
  </body>
</opml>`;

    const result = parseOPML(opml);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].category).toBe('Tech');
  });

  it('returns empty feeds when no outlines exist', () => {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <body></body>
</opml>`;

    const result = parseOPML(opml);
    expect(result.feeds).toHaveLength(0);
  });

  it('escapes special characters on export', () => {
    const output = generateOPML([
      { url: 'https://example.com/rss?tag=one&two=three', title: 'News & "More"', category: "Tech <All>" }
    ]);

    expect(output).toContain('text="Tech &lt;All&gt;"');
    expect(output).toContain('title="News &amp; &quot;More&quot;"');
    expect(output).toContain('xmlUrl="https://example.com/rss?tag=one&amp;two=three"');
  });

  it('imports OPML from file', () => {
    const folder = mkdtempSync(join(tmpdir(), 'rss-viewer-'));
    const filePath = join(folder, 'feeds.opml');
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <body>
    <outline text="Tech">
      <outline text="Example RSS" xmlUrl="https://example.com/rss" />
    </outline>
  </body>
</opml>`;

    writeFileSync(filePath, opml, 'utf-8');
    const result = importOPMLFile(filePath);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe('https://example.com/rss');
  });

  it('throws when import file is missing', () => {
    expect(() => importOPMLFile('/tmp/does-not-exist.opml')).toThrow('File not found');
  });
});
