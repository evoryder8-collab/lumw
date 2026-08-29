/**
 * One sitemap, generated from the same 25-URL list the CI check reads, so the
 * sitemap can never drift from what actually shipped.
 *
 * Astro's sitemap integration is deliberately not used: it would enumerate
 * whatever routes happen to exist, and the whole migration depends on this file
 * asserting the known-good list instead.
 */
import type { APIRoute } from 'astro';
import urls from '../data/expected-urls.json';
import { lastmodFor } from '../lib/lastmod';

const PRIORITY: Record<string, string> = {
  '/': '1.0',
  '/meineangebote-preise': '0.9',
  '/massage-buxtehude-faq': '0.8',
  '/about': '0.8',
  '/contact': '0.8',
  '/nutzungsbedingungen': '0.3',
  '/datenschutzrichtlinie': '0.3',
};

export const GET: APIRoute = () => {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.paths
  .map((p) => {
    const loc = `${urls.canonicalHost}${p === '/' ? '/' : p}`;
    const priority = PRIORITY[p] ?? '0.7';
    return `  <url>
    <loc>${encodeURI(loc)}</loc>
    <lastmod>${lastmodFor(p)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  })
  .join('\n')}
</urlset>
`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
