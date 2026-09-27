/**
 * Public help-desk surface contract tests (APODEX continuation i).
 *
 * Static contract: the indexable /help route exists with its aliases, the
 * landing page mounts the anonymous CampusQaSearch box, and the SEO surface
 * (sitemap.xml + robots.txt) actually publishes /help, /privacy and /terms to
 * crawlers instead of hiding them.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
import { describe, expect, it } from 'vitest';

const read = (...parts: string[]) => readFileSync(join(repoRoot, ...parts), 'utf8');

describe('public help desk routing contract', () => {
  it('registers the indexable /help route behind a route error boundary', () => {
    const app = read('src', 'App.tsx');
    expect(app).toContain('path="/help"');
    expect(app).toContain('RouteErrorBoundary name="Help"');
    expect(app).toMatch(/path="\/faq"/);
    expect(app).toMatch(/path="\/support"/);
  });

  it('mounts the anonymous campus Q&A search box on the signed-out landing page', () => {
    const landing = read('src', 'pages', 'LandingPage.tsx');
    expect(landing).toContain("import { CampusQaSearch } from '@/components/CampusQaSearch'");
    expect(landing).toContain('<CampusQaSearch />');
  });

  it('publishes /help, /privacy and /terms in sitemap.xml and keeps them crawlable in robots.txt', () => {
    const sitemap = read('public', 'sitemap.xml');
    for (const loc of ['/help', '/privacy', '/terms']) {
      expect(sitemap).toContain(`<loc>https://rgitrozgar.in${loc}</loc>`);
    }
    const robots = read('public', 'robots.txt');
    for (const loc of ['/help', '/privacy', '/terms']) {
      expect(robots).not.toContain(`Disallow: ${loc}`);
    }
    expect(robots).toContain('Sitemap: https://rgitrozgar.in/sitemap.xml');
  });
});
