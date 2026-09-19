/** Guard the owner-approved replacement across pages, booking and search data. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
const copy = JSON.parse(fs.readFileSync('src/i18n/face-care.json'));
const prices = JSON.parse(fs.readFileSync('src/content/treatments.json')).treatments.find((t) => t.id === 'gesicht-kopf').prices;
assert.deepEqual(prices, [{variant:'ultimate',durationMin:20,priceEur:75},{variant:'pointer',durationMin:5,priceEur:30},{variant:'duo',durationMin:10,priceEur:50}]);
const flatten = (v, prefix = '') => typeof v === 'string' ? [[prefix, v]] : Object.entries(v).flatMap(([k, child]) => flatten(child, `${prefix}.${k}`));
const keys = flatten(copy.en).map(([key]) => key).sort();
const routes = {
  de: ['/', '/meineangebote-preise', '/contact'],
  en: ['/en', '/en/treatments-prices', '/en/contact'],
  fr: ['/fr', '/fr/massages-tarifs', '/fr/contact'],
  es: ['/es', '/es/tratamientos-precios', '/es/contacto'],
  pt: ['/pt', '/pt/tratamentos-precos', '/pt/contacto'],
  it: ['/it', '/it/trattamenti-prezzi', '/it/contatti'],
};
const read = (route) => parseHTML(fs.readFileSync(`dist${route === '/' ? '/index' : route}.html`, 'utf8')).document;
for (const [locale, paths] of Object.entries(routes)) {
  const strings = flatten(copy[locale]);
  assert.deepEqual(strings.map(([key]) => key).sort(), keys, `${locale}: incomplete facial care copy`);
  for (const [key, value] of strings) assert.ok(value.trim() && !value.includes('\u2014'), `${locale}.${key}: empty or forbidden copy`);
  const home = read(paths[0]);
  assert.equal(home.querySelectorAll('.hero-kicker').length, 0, `${locale}: redundant hero label`);
  assert.deepEqual([...home.querySelectorAll('[data-featured-treatment]')].map((el) => el.getAttribute('data-featured-treatment')), ['aroma-luxus','gesicht-kopf','stark-ball']);
  assert.ok(home.querySelector('[data-featured-treatment="stark-ball"] a').getAttribute('href').endsWith('#stark-ball'));
  assert.equal(home.querySelector('[data-featured-treatment="stark-ball"] [data-price-counter]').getAttribute('data-price'), '149');
  assert.ok(home.querySelector('[data-language-countdown] [data-countdown-toggle]'));
  for (const route of paths.slice(0,2)) {
    const doc = read(route);
    assert.ok(doc.querySelector('.face-media [data-device-loop] video[muted][playsinline]'), `${route}: demonstration missing`);
    if (route === paths[0]) {
      assert.equal(doc.querySelectorAll('.featured-treatments [data-price-counter]').length, 3);
      assert.equal(doc.querySelectorAll('.featured-treatments .face-rates').length, 0);
      continue;
    }
    assert.ok(doc.querySelector('.treatment-details__panel [data-face-echo] .device-loop--echogram video'), `${route}: ultrasound missing`);
    const panel = doc.querySelector('[data-face-details]');
    const siblings = [...panel.parentElement.children];
    assert.ok(siblings.indexOf(panel.parentElement.querySelector('[data-face-echo]')) < siblings.indexOf(panel.parentElement.querySelector('.treatment-details__copy')), `${route}: popup should lead with the ultrasound`);
    assert.equal(panel.querySelectorAll('.face-details__safety li').length, 4);
    assert.ok(panel.textContent.includes('Kosuke Takeuchi') && panel.textContent.includes('ViEW=TECH'));
    assert.deepEqual([...panel.querySelectorAll('.face-rate [data-price-counter]')].map((el) => +el.getAttribute('data-price')), [75,30,50]);
    assert.ok(!doc.querySelector('main').textContent.includes('Gua Sha'), `${route}: retired treatment copy`);
  }
  const detailPath = locale === 'de' ? '/service-page/60min-luma-gesichts-und-kopf-massage' : `/${locale}/ultimate-face-lifting`;
  const detail = read(detailPath);
  assert.equal(detail.querySelectorAll('[data-ss]').length, 1);
  assert.ok(detail.querySelector('[data-ss] [data-pointer] img').getAttribute('src').includes('scroll-pointer.webp'));
  assert.ok(detail.querySelector('.face-science video[loop][muted]'));
  assert.equal(detail.querySelectorAll('#face-options .face-rate').length, 3);
  assert.equal(detail.querySelectorAll('link[rel="alternate"][hreflang]').length, 7);
  assert.ok(read(paths[1]).querySelector('#gesicht-kopf .face-media__destination').getAttribute('href').endsWith(detailPath));
  const contact = read(paths[2]);
  assert.deepEqual([...contact.querySelectorAll('select[name="variant"] option')].map((el) => el.getAttribute('value')), ['','ultimate','pointer','duo']);
  const data = JSON.parse(read(paths[1]).querySelector('script[type="application/ld+json"]').textContent);
  const face = data['@graph'].find((v) => v['@type'] === 'Service' && v.name === 'Ultimate Face Lifting');
  assert.deepEqual(face.offers.map((v) => [Number(v.price),v.eligibleDuration.value]), [[75,20],[30,5],[50,10]]);
  assert.deepEqual(face.offers.map((v) => v.name), Object.values(copy[locale].variants));
}
const legacy = read('/service-page/60min-luma-gesichts-und-kopf-massage');
assert.equal(legacy.querySelector('h1').textContent.trim(), 'Ultimate Face Lifting');
assert.equal(legacy.querySelectorAll('[data-face-details]').length, 1);
assert.ok(legacy.querySelector('title').textContent.includes('Ultimate Face Lifting'));
console.log('✓ Six-language facial care, three exact price options, both demonstrations, booking choices, schema and original URL');
