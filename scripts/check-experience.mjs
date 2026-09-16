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
const approvedHeadings = { '/': 'International ausgezeichnete Massage' };

for (const file of files.filter((file) => file.endsWith('.html'))) {
  const { document } = parseHTML(fs.readFileSync(file, 'utf8'));
  if (document.querySelector('meta[http-equiv="refresh"]') || file.endsWith('/404.html')) continue;
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
  if (!canonical) { failures.push(`${file}: missing canonical`); continue; }
  const route = decodeURI(new URL(canonical).pathname);
  check(!documents.has(route), `${route}: duplicate canonical destination`);
  documents.set(route, { document, file });
}
check(documents.size === 51, `Expected 25 original German, 25 translated pages, and linkinbio; found ${documents.size}`);

for (const [route, { document }] of documents) {
  const locale = document.documentElement.lang;
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
    for (const paragraph of original.paragraphs) check(body.includes(paragraph), `${route}: lost migration paragraph: ${paragraph.slice(0, 85)}`);
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
    check(video.getAttribute('preload') === 'none' && !video.hasAttribute('autoplay'), `${route}: unexpected eager video`);
    check(video.hasAttribute('controls') && video.hasAttribute('playsinline'), `${route}: film controls missing`);
  }
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

for (const locale of ['de','en','th','es','pt','it']) {
  const sitemap = fs.readFileSync(path.join(dist, `sitemaps/${locale}.xml`), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => decodeURI(new URL(m[1]).pathname));
  check(urls.length === (locale === 'de' ? 26 : 5), `${locale}: incorrect sitemap coverage`);
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
console.log(`✓ 51 pages: content retention, locale links, hreflang, assets, sitemaps, ${indexable ? 'production indexing' : 'staging noindex'}, ownership verification, video loading, and no em dashes`);
console.log(`✓ JavaScript: ${(total / 1024).toFixed(1)} KiB gzip / 100 KiB budget`);
