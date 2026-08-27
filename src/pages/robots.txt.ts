/**
 * Staging is noindex until the cutover release flips PUBLIC_INDEXABLE (section 7
 * step 1 and step 5). robots.txt has to agree with the meta robots tag or the
 * two send Google contradictory signals.
 */
import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site';

export const GET: APIRoute = () => {
  const indexable = import.meta.env.PUBLIC_INDEXABLE === 'true';

  const body = indexable
    ? `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`
    : `# Staging build. Not for indexing until DNS cutover.
User-agent: *
Disallow: /
`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
