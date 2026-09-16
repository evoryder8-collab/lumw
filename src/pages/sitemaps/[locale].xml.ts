import type { APIRoute } from 'astro';
import { AVAILABLE, ROUTES, routePath, alternatesFor, routeKeyForPath, type Locale, type RouteKey } from '../../i18n/locales';
import expected from '../../data/expected-urls.json';
import { lastmodFor } from '../../lib/lastmod';

export const getStaticPaths = () => AVAILABLE.map((locale) => ({ params: { locale } }));
export const GET: APIRoute = ({ params }) => {
  const locale = params.locale as Locale;
  const paths = locale === 'de' ? [...expected.paths, '/linkinbio'] : (Object.keys(ROUTES) as RouteKey[]).map((key) => routePath(key, locale));
  const absolute = (path: string) => encodeURI(`${expected.canonicalHost}${path}`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${paths.map((path) => {
  const key = routeKeyForPath(path);
  const alternates = key ? alternatesFor(key) : [];
  return `<url><loc>${absolute(path)}</loc><lastmod>${lastmodFor(path)}</lastmod>${alternates.map((a) => `<xhtml:link rel="alternate" hreflang="${a.tag}" href="${absolute(a.path)}" />`).join('')}${key ? `<xhtml:link rel="alternate" hreflang="x-default" href="${absolute(routePath(key, 'de'))}" />` : ''}</url>`;
}).join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
