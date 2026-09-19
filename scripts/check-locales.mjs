/** Check complete translations and the rendered French replacement, not just JSON. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

const locales = ['de', 'en', 'fr', 'es', 'pt', 'it'];
const translated = Object.fromEntries(locales.filter((locale) => locale !== 'de').map((locale) => [locale, JSON.parse(fs.readFileSync(`src/i18n/${locale}.json`, 'utf8'))]));
const flatten = (value, prefix = '') => typeof value === 'string'
  ? [[prefix, value]]
  : Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
const expectedKeys = flatten(translated.en).map(([key]) => key).sort();
let strings = 0;
for (const [locale, content] of Object.entries(translated)) {
  const entries = flatten(content);
  assert.deepEqual(entries.map(([key]) => key).sort(), expectedKeys, `${locale}: missing or extra translation fields`);
  for (const [key, value] of entries) {
    assert.ok(value.trim().length > 0, `${locale}.${key}: empty translation`);
    assert.ok(!/[\u2014\u0e00-\u0e7f]/u.test(value), `${locale}.${key}: em dash or retired Thai text`);
    strings++;
  }
}

const bioCopy = JSON.parse(fs.readFileSync('src/i18n/linkinbio.json', 'utf8'));
assert.deepEqual(Object.keys(bioCopy), locales, 'Link-in-bio languages do not match the website');
for (const locale of locales) {
  assert.deepEqual(Object.keys(bioCopy[locale]), Object.keys(bioCopy.en), `${locale}: incomplete link-in-bio translation`);
  for (const [key, value] of Object.entries(bioCopy[locale])) {
    assert.ok(value.trim() && !/[\u2014\u0e00-\u0e7f]/u.test(value), `${locale}.${key}: invalid link-in-bio translation`);
    strings++;
  }
}

const dir = 'dist';
let pages = 0;
for (const locale of locales) {
  const sitemap = fs.readFileSync(`${dir}/sitemaps/${locale}.xml`, 'utf8');
  const routes = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => decodeURI(new URL(m[1]).pathname));
  for (const route of routes) {
    const file = route === '/' ? `${dir}/index.html` : `${dir}${route}.html`;
    const { document } = parseHTML(fs.readFileSync(file, 'utf8'));
    assert.equal(document.documentElement.lang, locale, `${route}: wrong document language`);
    const bio = route.endsWith('/linkinbio');
    if (bio) {
      const languageLinks = [...document.querySelectorAll('[data-bio-locale]')];
      assert.deepEqual(languageLinks.map((link) => link.getAttribute('lang')), locales, `${route}: incomplete language menu`);
      assert.equal(document.querySelector('[data-bio-locale][aria-current="page"]')?.getAttribute('lang'), locale, `${route}: incorrect selected language`);
      assert.equal(document.querySelector('[data-bio-action="whatsapp"] strong')?.textContent, bioCopy[locale].whatsapp, `${route}: untranslated WhatsApp action`);
      assert.equal(document.querySelector('[data-bio-action="spark"] strong')?.textContent, bioCopy[locale].services, `${route}: untranslated treatments action`);
    } else {
      const languageLinks = [...document.querySelectorAll('[data-language-pick]')];
      assert.deepEqual(languageLinks.map((link) => link.getAttribute('lang')), locales, `${route}: incorrect language portal`);
      assert.ok(languageLinks[2].textContent.includes('Français'), `${route}: French missing from selector`);
      assert.ok(languageLinks[2].querySelector('img').getAttribute('src').startsWith('data:image/webp;base64,'), `${route}: French flag missing`);
    }
    const content = translated[locale];
    if (content && !bio) {
      assert.deepEqual([...document.querySelectorAll('.nav__label')].map((el) => el.textContent.trim()), content.nav, `${route}: untranslated navigation`);
      assert.equal(document.querySelector('.nav__cta a')?.textContent.trim(), content.ui.book, `${route}: wrong booking label`);
      assert.equal(document.querySelector('.footer__note')?.textContent.trim(), content.ui.appointment, `${route}: untranslated appointment note`);
      const reviews = document.querySelector('.reviews');
      if (reviews) assert.equal(reviews.querySelector('blockquote')?.getAttribute('lang'), 'de', `${route}: original Google review language missing`);
      if (document.querySelector('[data-enquiry]')) {
        assert.equal(document.querySelector('[data-enquiry]').getAttribute('data-greeting'), content.ui.greeting, `${route}: wrong message language`);
        assert.ok(document.querySelector('[data-drive]'), `${route}: localised directions panel missing`);
        assert.ok(!document.querySelector('.loc').textContent.includes('Route starten'), `${route}: German map controls remain`);
      }
    }
    document.querySelectorAll('script,style').forEach((el) => el.remove());
    assert.ok(!/[\u2014\u0e00-\u0e7f]/u.test(document.documentElement.textContent), `${route}: em dash or retired Thai copy`);
    for (const element of document.querySelectorAll('*')) {
      for (const attribute of element.attributes) {
        if (/^(aria-|data-label|data-greeting|alt$|title$|placeholder$|content$)/.test(attribute.name)) {
          assert.ok(!/[\u2014\u0e00-\u0e7f]/u.test(attribute.value), `${route}: untranslated or forbidden text in ${attribute.name}`);
        }
      }
    }
    pages++;
  }
}

const index = fs.readFileSync(`${dir}/sitemap.xml`, 'utf8');
assert.ok(index.includes('/sitemaps/fr.xml') && !index.includes('/sitemaps/th.xml'), 'Sitemap still advertises Thai');
assert.ok(!fs.existsSync(`${dir}/sitemaps/th.xml`), 'Retired Thai sitemap remains');
const retired = JSON.parse(fs.readFileSync('src/data/retired-locale-routes.json', 'utf8'));
for (const [from, to] of Object.entries(retired)) {
  for (const slash of [false, true]) {
    const { document } = parseHTML(fs.readFileSync(`${dir}${from}${slash ? '/index.html' : '.html'}`, 'utf8'));
    const refresh = document.querySelector('meta[http-equiv="refresh"]').getAttribute('content');
    assert.ok(refresh.startsWith('0; url='), `${from}: redirect must be immediate`);
    for (const base of ['', '/lumw']) {
      const target = new URL(refresh.slice(7), `https://staging.invalid${base}${encodeURI(from)}${slash ? '/' : ''}`);
      assert.equal(decodeURI(target.pathname), `${base}${to}`, `${from}: redirect loses page or base path`);
    }
    assert.equal(document.querySelector('link[rel="canonical"]').getAttribute('href'), `https://www.luma-wellness.com${to}`, `${from}: wrong replacement canonical`);
    assert.ok(fs.existsSync(path.join(dir, `${to}.html`)), `${from}: replacement is missing`);
  }
}
console.log(`✓ ${strings} complete translation entries, ${pages} pages, six languages, French flags, localised controls and five retired-route redirects`);
