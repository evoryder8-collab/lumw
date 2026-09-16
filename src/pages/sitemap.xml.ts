import type { APIRoute } from 'astro';
import { AVAILABLE } from '../i18n/locales';
import { SITE_URL } from '../lib/site';
export const GET: APIRoute = () => new Response(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${AVAILABLE.map((locale) => `<sitemap><loc>${SITE_URL}/sitemaps/${locale}.xml</loc></sitemap>`).join('\n')}
</sitemapindex>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
