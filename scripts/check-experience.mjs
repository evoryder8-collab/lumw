/** Checks rendered destinations and meaningful migration invariants, not source patterns. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { parseHTML } from 'linkedom';

const dist = path.resolve('dist');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const files = walk(dist);
const documents = new Map();
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const normalize = (text) => text.normalize('NFC').replace(/\s+/g, ' ').trim();
const canonicalHost = 'https://www.luma-wellness.com';
const indexable = process.env.PUBLIC_INDEXABLE === 'true';
const baseline = JSON.parse(fs.readFileSync('src/data/migration-content-baseline.json', 'utf8'));
// Explicit owner request, 16 September 2026. Keep the original crawl intact.
const approvedHeadings = { '/': 'International ausgezeichnete Massage', '/about': 'Über June', '/service-page/60min-luma-gesichts-und-kopf-massage': 'Ultimate Face Lifting' };
// Owner explicitly commissioned a site-wide editorial rewrite on 18 Sep 2026.
// Keep the migration archive and metadata tests intact; freeze commercial facts
// separately so polishing prose cannot silently change a price or service URL.
const revisedPages = new Set(['/', '/about', '/contact', '/meineangebote-preise', '/massage-buxtehude-faq']);
const facts = JSON.parse(fs.readFileSync('src/data/editorial-facts-baseline.json', 'utf8'));
const treatments = JSON.parse(fs.readFileSync('src/content/treatments.json', 'utf8')).treatments;
const services = JSON.parse(fs.readFileSync('src/content/services.json', 'utf8')).services;
assert.deepEqual(treatments.map(({id,name,priceLine,prices}) => ({id,name,priceLine,prices})), facts.treatments, 'Treatment prices/names changed during editorial revision');
assert.deepEqual(services.map(({id,slug,name,durationMin,priceEur,seoTitle,seoDescription}) => ({id,slug,name,durationMin,priceEur,seoTitle,seoDescription})), facts.services, 'Service facts changed during editorial revision');

for (const file of files.filter((file) => file.endsWith('.html'))) {
  const { document } = parseHTML(fs.readFileSync(file, 'utf8'));
  if (document.querySelector('meta[http-equiv="refresh"]') || file.endsWith('/404.html')) continue;
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
  if (!canonical) { failures.push(`${file}: missing canonical`); continue; }
  const route = decodeURI(new URL(canonical).pathname);
  check(!documents.has(route), `${route}: duplicate canonical destination`);
  documents.set(route, { document, file });
}
check(documents.size === 61, `Expected 25 original German, 30 translated pages, and six link-in-bio pages; found ${documents.size}`);

for (const [route, { document }] of documents) {
  const locale = document.documentElement.lang;
  const shareImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  check(shareImage?.startsWith(`${canonicalHost}/`) && shareImage.endsWith('/social/luma-wellness-cover.jpg'), `${route}: missing sharing cover`);
  check(document.querySelector('meta[property="og:image:width"]')?.getAttribute('content') === '1200' && document.querySelector('meta[property="og:image:height"]')?.getAttribute('content') === '630', `${route}: sharing dimensions are wrong`);
  check(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content') === 'summary_large_image', `${route}: missing large sharing preview`);
  check(!!document.querySelector('link[rel="apple-touch-icon"]') && !!document.querySelector('link[rel="icon"][type="image/png"]'), `${route}: missing brand icons`);
  check(document.querySelectorAll('h1').length === 1, `${route}: expected one H1`);
  check(!!document.querySelector('meta[name="description"]')?.getAttribute('content'), `${route}: missing description`);
  const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '';
  const robotDirectives = robots.split(',').map((value) => value.trim());
  check(robotDirectives.includes(indexable ? 'index' : 'noindex') && robotDirectives.includes(indexable ? 'follow' : 'nofollow'), `${route}: wrong robots policy`);
  check(document.querySelector('meta[name="google-site-verification"]')?.getAttribute('content') === 'OSbPqjHPC8B-5LSnAuVPZw-8I2HVK0zDGEjJE7L0VBk', `${route}: existing Google ownership verification is missing`);
  if (baseline.pages[route]) {
    const original = baseline.pages[route];
    check(normalize(document.querySelector('h1').textContent) === (approvedHeadings[route] ?? original.h1), `${route}: German H1 changed`);
    const body = normalize(document.querySelector('main').textContent);
    if (!revisedPages.has(route) && !route.startsWith('/service-page/')) for (const paragraph of original.paragraphs) check(body.includes(paragraph), `${route}: lost migration paragraph: ${paragraph.slice(0, 85)}`);
  }
  const alternates = [...document.querySelectorAll('link[rel="alternate"][hreflang]')];
  if (alternates.length) {
    check(alternates.length === 7, `${route}: expected six languages and x-default`);
    for (const alternate of alternates) {
      const href = alternate.getAttribute('href');
      const destination = decodeURI(new URL(href).pathname);
      const target = documents.get(destination)?.document;
      check(!!target, `${route}: alternate ${destination} does not exist`);
      const self = [...(target?.querySelectorAll('link[rel="alternate"]') ?? [])].some((a) => a.getAttribute('href') === `${canonicalHost}${route}`);
      check(self, `${route}: alternate ${destination} is not reciprocal`);
    }
  }
  if (locale !== 'de') {
    check(alternates.length === 7, `${route}: translated page has no hreflang cluster`);
    check(route.startsWith(`/${locale}`), `${route}: incorrect document language ${locale}`);
    if (document.querySelector('.localized-treatments')) {
      check(document.querySelectorAll('[data-treatment-details]').length === 9, `${route}: nine local treatment details required`);
      check(!document.querySelector('.localized-original'), `${route}: obsolete German details link remains`);
      for (const details of document.querySelectorAll('[data-treatment-details]')) {
        check(details.querySelectorAll('.treatment-details__copy p').length >= 2, `${route}: treatment details are incomplete`);
        check(!!details.querySelector('[data-treatment-close][aria-label]'), `${route}: treatment popup has no labelled close button`);
      }
    }
  }
  const brandHref = document.querySelector('.brand')?.getAttribute('href') ?? '/';
  const localeRoot = locale === 'de' ? '/' : `/${locale}`;
  const base = brandHref.slice(0, brandHref.length - localeRoot.length);
  for (const el of document.querySelectorAll('[href],script[src],img[src],video[poster],source[src]')) {
    const value = el.getAttribute('href') ?? el.getAttribute('src') ?? el.getAttribute('poster');
    if (!value || !value.startsWith('/') || value.startsWith('//')) continue;
    const resolved = new URL(value, 'https://staging.invalid');
    const pathname = decodeURI(resolved.pathname);
    check(!base || pathname === base || pathname.startsWith(`${base}/`), `${route}: missing staging prefix: ${value}`);
    const local = pathname.slice(base.length) || '/';
    const targetDocument = documents.get(local)?.document;
    const targetFile = path.join(dist, local);
    check(!!targetDocument || fs.existsSync(targetFile) || fs.existsSync(`${targetFile}.html`), `${route}: broken asset or link ${value}`);
    if (targetDocument && resolved.hash) {
      check(!!targetDocument.getElementById(decodeURIComponent(resolved.hash.slice(1))), `${route}: missing anchor ${value}`);
    }
    if (targetDocument && resolved.searchParams.has('treatment')) {
      const selected = resolved.searchParams.get('treatment');
      check([...targetDocument.querySelectorAll('select[name="treatment"] option')].some((option) => option.getAttribute('value') === selected), `${route}: enquiry cannot select treatment ${selected}`);
    }
  }
  for (const video of document.querySelectorAll('video')) {
    if (video.closest('[data-device-loop]')) {
      check(['autoplay', 'muted', 'loop', 'playsinline'].every(attribute => video.hasAttribute(attribute)) && !video.hasAttribute('controls'), `${route}: product demonstration must be a silent inline loop without transport UI`);
      if (video.hasAttribute('data-device-video')) {
        check(!video.hasAttribute('src') && !!video.getAttribute('data-device-src') && !video.querySelector('source[src]'), `${route}: product loop must wait until visible before downloading`);
        check(!!video.parentElement.querySelector('[data-device-toggle][aria-label]'), `${route}: keyboard pause action missing`);
      } else check(!!video.closest('noscript'), `${route}: immediate loop source must be a no-JavaScript fallback`);
      continue;
    }
    check(video.getAttribute('preload') === 'none' && !video.hasAttribute('autoplay'), `${route}: unexpected eager video`);
    const introControls = video.hasAttribute('data-intro-film') && document.querySelector('[data-intro-transport] [data-intro-toggle]') && document.querySelector('[data-intro-seek]') && document.querySelector('.intro-film noscript video[controls]');
    check((video.hasAttribute('controls') || introControls) && video.hasAttribute('playsinline'), `${route}: film controls missing`);
  }
  const record = document.querySelector('.award-record');
  if (record) {
    check(record.querySelectorAll('[data-award]').length === 6, `${route}: six distinct award records required`);
    check(record.querySelector('[data-award="swiss-silver"]')?.textContent.includes('Freestyle Eastern'), `${route}: Swiss category is missing`);
    check(record.querySelector('[data-award="athens-silver"]')?.textContent.includes('Wellness & Spa'), `${route}: Athens category is missing`);
    check(record.querySelector('[data-award="penzberg-silver"]')?.textContent.includes('Freestyle Eastern'), `${route}: Penzberg silver category is missing`);
    check(!!record.querySelector('[data-award="penzberg-bronze"] .award-record__note'), `${route}: overall ranking needs its explanation`);
    check(record.querySelector('[data-award="paris-photo-gold"]')?.textContent.includes('2026'), `${route}: photography award year is missing`);
    if (locale === 'en') check(record.textContent.includes('Swiss Massage Championship') && !record.textContent.includes('Schweizer'), `${route}: untranslated Swiss event`);
  }
  if (document.querySelector('.photo-award')) {
    check(document.querySelector('.photo-award__image img')?.getAttribute('alt')?.length > 20, `${route}: winning image requires descriptive alternative text`);
    check(document.querySelector('[data-award-video-open]')?.getAttribute('href')?.endsWith('/media/june-awarded-2026.mp4'), `${route}: photography story must link its award film`);
  }
  const filmSources = [...document.querySelectorAll('.film-section source')].map((source) => source.getAttribute('src'));
  check(new Set(filmSources).size === filmSources.length && !filmSources.some((src) => src.endsWith('/june-passion.mp4')), `${route}: duplicate award-film export in the collection`);
  if (document.querySelector('.hero--immersive')) {
    check(!!document.querySelector('.lotus-rim'), `${route}: static floral portrait fallback missing`);
    const sections = [...document.querySelectorAll('main section')];
    check(sections.indexOf(document.querySelector('.photo-award')) > sections.indexOf(document.querySelector('.reviews')), `${route}: photography prize must follow reviews, not lead the homepage`);
  }
  check(!document.querySelector('.portal-corner'), `${route}: obsolete portal ornaments remain`);
  check(!document.querySelector('.film-section__note'), `${route}: redundant film note remains`);
  if (document.querySelector('.intro-film__caption')) check(document.querySelectorAll('.intro-film__caption span').length === 2, `${route}: redundant centre film caption`);
  if (locale === 'en') check(!/More than a moment|A moment to remember|Your moment starts here|Book some time/.test(document.querySelector('main').textContent), `${route}: retired generic copy remains`);
  document.querySelectorAll('script,style').forEach((el) => el.remove());
  check(!document.documentElement.textContent.includes('\u2014'), `${route}: visible text contains an em dash`);
  for (const el of document.querySelectorAll('[aria-label],meta[content]')) {
    check(!(el.getAttribute('aria-label') ?? el.getAttribute('content') ?? '').includes('\u2014'), `${route}: accessible text or metadata contains an em dash`);
  }
}

const scripts = files.filter((file) => file.endsWith('.js'));
const compressed = scripts.map((file) => ({ file, size: gzipSync(fs.readFileSync(file)).length }));
const total = compressed.reduce((sum, item) => sum + item.size, 0);
check(total < 100 * 1024, `JavaScript exceeds 100 KiB gzip: ${(total / 1024).toFixed(1)} KiB`);
for (const item of compressed.filter((item) => path.basename(item.file).startsWith('motion.'))) check(item.size < 60 * 1024, 'Motion exceeds 60 KiB gzip');

for (const locale of ['de','en','fr','es','pt','it']) {
  const sitemap = fs.readFileSync(path.join(dist, `sitemaps/${locale}.xml`), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => decodeURI(new URL(m[1]).pathname));
  check(urls.length === (locale === 'de' ? 26 : 7), `${locale}: incorrect sitemap coverage`);
  for (const route of urls) check(documents.has(route), `${locale}: sitemap lists a missing page ${route}`);
}
const robotsFile = fs.readFileSync(path.join(dist, 'robots.txt'), 'utf8');
if (indexable) {
  check(/^Allow: \/$/m.test(robotsFile), 'Production robots.txt must allow crawling');
  check(!/^Disallow: \/$/m.test(robotsFile), 'Production robots.txt blocks crawling');
  check(robotsFile.includes(`Sitemap: ${canonicalHost}/sitemap.xml`), 'Production robots.txt must advertise the canonical sitemap');
} else {
  check(/^Disallow: \/$/m.test(robotsFile), 'Staging robots.txt must block crawling');
}
assert.equal(failures.length, 0, `Experience checks failed:\n${failures.join('\n')}`);
console.log(`✓ ${documents.size} pages: commercial facts, legal content retention, locale links, hreflang, assets, sitemaps, ${indexable ? 'production indexing' : 'staging noindex'}, ownership verification, video loading, and no em dashes`);
console.log(`✓ JavaScript: ${(total / 1024).toFixed(1)} KiB gzip / 100 KiB budget`);
