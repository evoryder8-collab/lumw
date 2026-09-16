import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startPreview } from './preview-server.mjs';

const preview = await startPreview();
const artifacts = path.resolve('artifacts/browser');
fs.mkdirSync(artifacts, { recursive: true });
const channel = process.env.LUMA_BROWSER_CHANNEL === 'bundled' ? undefined : process.env.LUMA_BROWSER_CHANNEL || (process.platform === 'darwin' ? 'chrome' : undefined);
const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
const failures = [];
const report = [];
const track = (page) => {
  page.on('pageerror', (error) => failures.push(`${page.url()}: ${error.name}: ${error.message}`));
  page.on('response', (response) => { if (response.url().startsWith(preview.origin) && response.status() >= 400) failures.push(`${response.status()}: ${response.url()}`); });
};
const savedWelcome = () => { sessionStorage.setItem('luma-welcome-done', 'yes'); sessionStorage.setItem('luma-sound', 'no'); };
const settled = async (page) => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(100); };
const noOverflow = async (page, label) => {
  const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(widths.document <= widths.viewport + 1 && widths.body <= widths.viewport + 1, `${label}: overflow ${JSON.stringify(widths)}`);
};
try {
  // Every canonical route must return 200 under the real deployment prefix.
  const routes = ['de','en','th','es','pt','it'].flatMap((locale) => [...fs.readFileSync(`dist/sitemaps/${locale}.xml`, 'utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]).pathname));
  for (const route of routes) assert.equal((await fetch(preview.url(route))).status, 200, route);
  report.push(`${routes.length} canonical URLs return 200 at ${preview.base || '/'}`);

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); track(page);
  const mediaRequests = [];
  page.on('request', (request) => { if (request.url().endsWith('.mp4')) mediaRequests.push(request.url()); });
  await page.goto(preview.url());
  await page.waitForFunction(() => document.querySelector('[data-language-dialog]').open);
  assert.equal(mediaRequests.length, 0, 'A video downloaded before the welcome choice');
  assert.equal(await page.locator('[data-language-dialog] .language-choice__flag img').count(), 6);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-language-dialog] img')].every((img) => img.complete && img.naturalWidth > 0));
  await page.locator('[data-language-pick][lang="en"]').click();
  await page.waitForURL(preview.url('/en'));
  await page.waitForFunction(() => document.querySelector('[data-sound-dialog]').open);
  assert.equal(await page.locator('[data-sound-dialog] button').count(), 2);
  await page.screenshot({ path: path.join(artifacts, 'sound-question.png') });
  await page.locator('[data-sound-yes]').click();
  await page.waitForFunction(() => { const v = document.querySelector('[data-intro-film]'); return !v.paused && !v.muted && v.currentTime > 0.1; });
  await page.screenshot({ path: path.join(artifacts, 'intro-playing.png') });
  const oldVideo = await page.locator('[data-intro-film]').elementHandle();
  await page.locator('.nav__link').first().click();
  await page.waitForURL(preview.url('/en/treatments-prices'));
  assert.equal(await oldVideo.evaluate((v) => v.paused), true, 'Navigation left audio playing');
  report.push('Language, sound permission, actual audible playback, and navigation cleanup');

  // Watch actual number changes, then prove the final price and single glow.
  await page.goto(preview.url('/meineangebote-preise'));
  const price = page.locator('[data-price-counter]').first();
  await price.evaluate((element) => {
    window.priceSamples = [];
    new MutationObserver(() => window.priceSamples.push(Number(element.textContent))).observe(element, { childList: true });
  });
  await price.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('[data-price-counter]').dataset.counted === 'true');
  const amount = Number(await price.getAttribute('data-price'));
  assert.equal(Number(await price.innerText()), amount);
  assert.ok((await page.evaluate(() => window.priceSamples)).some((value) => value > 0 && value < amount), 'Price did not count up');
  assert.equal(await price.evaluate((el) => getComputedStyle(el).animationIterationCount), '1');
  await page.screenshot({ path: path.join(artifacts, 'price-reveal.png') });
  const card = page.locator('.card').first();
  await card.locator('summary').click();
  assert.equal(await card.locator('details').getAttribute('open'), '');
  await card.locator('[data-collapse]').click();
  assert.equal(await card.locator('details').getAttribute('open'), null);
  report.push('Price count-up reaches the correct amount with one glow; descriptions expand and collapse');

  await card.locator('.card__cta').click();
  await page.locator('.hero .pill').first().click();
  await page.waitForURL(/contact\?treatment=aroma-luxus/);
  assert.equal(await page.locator('select[name="treatment"]').inputValue(), 'aroma-luxus');
  await page.locator('[data-enquiry] button[type="submit"]').click();
  assert.equal(await page.locator('[data-enquiry-result]').isVisible(), false);
  await page.locator('[name="firstName"]').fill('Browser test');
  await page.locator('[name="email"]').fill('preview@example.com');
  await page.locator('[name="message"]').fill('A & B <test> + 50%');
  await page.locator('[data-enquiry] button[type="submit"]').click();
  const handoff = new URL(await page.locator('[data-enquiry-whatsapp]').getAttribute('href'));
  assert.ok(handoff.searchParams.get('text').includes('A & B <test> + 50%'));
  assert.equal(await page.locator('[data-enquiry-preview] test').count(), 0);
  await page.locator('[name="firstName"]').fill('Changed name');
  assert.equal(await page.locator('[data-enquiry-result]').isVisible(), false);
  report.push('Treatment choice, native form validation, safely encoded WhatsApp/email handoff; no message sent');

  await page.goto(preview.url());
  assert.equal(await page.locator('[data-gallery-open]').count(), 8);
  await page.locator('[data-reviews-track]').evaluate((track) => {
    window.reviewScrollSamples = [];
    track.addEventListener('scroll', () => window.reviewScrollSamples.push(track.scrollLeft));
  });
  await page.locator('[data-reviews-track]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('[data-reviews-track]').dataset.nudge === 'done');
  assert.ok((await page.evaluate(() => window.reviewScrollSamples)).some((x) => x > 20 && x <= 49));
  assert.ok(await page.locator('[data-reviews-track]').evaluate((track) => track.scrollLeft < 2));
  await page.locator('.reviews__rating').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.reviews__google img').naturalWidth > 0);
  assert.match(await page.locator('.reviews__google').innerText(), /Google Maps/);
  await page.locator('[data-review-next]').click();
  await page.waitForFunction(() => document.querySelector('[data-reviews-track]').scrollLeft > 50);
  assert.equal(await page.locator('.review-card__link').count(), 3);
  const cup = page.locator('[data-gallery-open]').nth(1);
  await cup.click();
  assert.equal(await page.locator('[data-gallery-dialog]').evaluate((d) => d.open), true);
  assert.match(await page.locator('[data-gallery-caption]').innerText(), /^2 \/ 8/);
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('[data-gallery-caption]').innerText(), /^3 \/ 8/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-gallery-dialog]').evaluate((d) => d.open), false);
  assert.equal(await cup.evaluate((el) => document.activeElement === el), true);
  const films = page.locator('.film-section video');
  assert.equal(await films.count(), 4);
  for (let index = 0; index < 4; index++) {
    await films.nth(index).evaluate(async (v) => { v.muted = true; await v.play(); });
    assert.equal(await films.nth(index).evaluate((v) => v.paused), false);
  }
  assert.equal(await films.first().evaluate((v) => v.paused), true);
  assert.equal(await films.nth(1).evaluate((v) => v.paused), true);
  assert.equal(await films.nth(2).evaluate((v) => v.paused), true);
  await films.nth(3).evaluate((v) => v.pause());
  report.push('Reviews nudge horizontally once and return; eight gallery photos with keyboard navigation; all four lower films play independently');

  await page.goto(preview.url('/about'));
  assert.match(await page.locator('.film-section--featured source').getAttribute('src'), /june-passion\.mp4$/);
  await page.evaluate(() => window.scrollTo({ top: 1100, behavior: 'instant' }));
  await page.waitForFunction(() => Math.abs(window.scrollY - 1100) < 5);
  await page.waitForFunction(() => Math.abs((history.state?.scrollY ?? 0) - window.scrollY) < 5);
  const rememberedScroll = await page.evaluate(() => window.scrollY);
  // Click the visible sticky navigation directly. Locator auto-scrolling can
  // reposition the document to honor its 120px anchor offset before clicking.
  const contactLink = await page.locator('.nav__link').last().boundingBox();
  assert.ok(contactLink && contactLink.y >= 0 && contactLink.y < 1000, 'Sticky contact link is not visible');
  await page.mouse.click(contactLink.x + contactLink.width / 2, contactLink.y + contactLink.height / 2);
  await page.waitForURL(preview.url('/contact'));
  await page.locator('[data-enquiry]').waitFor({ state: 'visible' });
  await page.goBack();
  await page.waitForURL(preview.url('/about'));
  await page.waitForFunction((saved) => Math.abs(window.scrollY - saved) < 100, rememberedScroll, { timeout: 5000 });
  await page.locator('[data-portal-open]').click();
  await page.locator('[data-language-pick][lang="it"]').click();
  await page.waitForURL(preview.url('/it/chi-sono'));
  assert.equal(await page.locator('html').getAttribute('lang'), 'it');
  await page.goto(preview.url('/about'));
  await page.evaluate(() => document.addEventListener('astro:before-swap', (event) => event.viewTransition.skipTransition(), { once: true }));
  await page.locator('.nav__link').last().click();
  await page.waitForURL(preview.url('/contact'));
  await page.locator('[data-enquiry]').waitFor({ state: 'visible' });
  report.push('Cancelled native page animation still completes navigation without an unhandled rejection');
  await context.close();

  const axeResults = [];
  for (const width of [360, 390, 768, 1440]) {
    const responsive = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await responsive.addInitScript(savedWelcome);
    const view = await responsive.newPage(); track(view);
    for (const route of ['/', '/meineangebote-preise', '/about', '/contact', '/massage-buxtehude-faq', '/th', '/en/treatments-prices', '/linkinbio']) {
      await view.goto(preview.url(encodeURI(route))); await settled(view);
      await noOverflow(view, `${width}px ${route}`);
      if (width === 390 || width === 1440) await view.screenshot({ path: path.join(artifacts, `${width}-${route.replaceAll('/', '_') || 'home'}.png`) });
      if (width === 390) {
        const audit = await new AxeBuilder({ page: view }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        axeResults.push({ route, violations: audit.violations });
      }
    }
    if (width === 390) {
      await view.goto(preview.url('/en/treatments-prices'));
      await view.locator('.nav-burger').click();
      assert.equal(await view.locator('.nav').evaluate((el) => el.inert), false);
      await view.keyboard.press('Escape');
      assert.equal(await view.locator('.nav').evaluate((el) => el.inert), true);
    }
    await responsive.close();
  }
  fs.writeFileSync(path.join(artifacts, 'accessibility.json'), JSON.stringify(axeResults, null, 2));
  assert.deepEqual(axeResults.filter((r) => r.violations.length).map((r) => ({ route: r.route, violations: r.violations.map((v) => v.id) })), []);
  report.push('32 responsive page checks at 360, 390, 768 and 1440 pixels; eight axe WCAG audits');

  const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const reducedPage = await reduced.newPage(); track(reducedPage);
  const motionRequests = [];
  reducedPage.on('request', (r) => { if (/\/motion\..*\.js/.test(r.url())) motionRequests.push(r.url()); });
  await reducedPage.goto(preview.url());
  await reducedPage.locator('[data-language-pick][lang="de"]').click();
  await reducedPage.locator('[data-sound-no]').click();
  assert.equal(await reducedPage.locator('[data-intro-film]').evaluate((v) => v.paused && v.muted), true);
  await reducedPage.locator('[data-reviews-track]').scrollIntoViewIfNeeded();
  assert.equal(await reducedPage.locator('[data-reviews-track]').evaluate((track) => track.scrollLeft), 0);
  assert.equal(await reducedPage.locator('[data-reviews-track]').getAttribute('data-nudge'), null);
  await reducedPage.goto(preview.url('/meineangebote-preise'));
  await reducedPage.locator('[data-price-counter]').first().scrollIntoViewIfNeeded();
  assert.equal(await reducedPage.locator('.is-price-complete').count(), 0);
  assert.deepEqual(motionRequests, []);
  await reduced.close();

  const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const staticPage = await noJS.newPage(); track(staticPage);
  await staticPage.goto(preview.url());
  assert.equal(await staticPage.locator('[data-language-dialog]').isVisible(), false);
  assert.equal((await staticPage.locator('h1').innerText()).replace(/\s+/g, ' '), 'Beste Massage in Buxtehude');
  await staticPage.locator('.nav-burger').click();
  await staticPage.locator('.nav').waitFor({ state: 'visible' });
  assert.equal(await staticPage.locator('.nav').isVisible(), true);
  await staticPage.goto(preview.url('/contact'));
  assert.equal(await staticPage.locator('noscript a').count(), 4);
  await staticPage.goto(preview.url('/linkinbio'));
  assert.equal(await staticPage.locator('.loc noscript a').count(), 2);
  assert.equal(await staticPage.locator('[data-bio-action]').count(), 8);
  await noJS.close();
  report.push('Reduced motion keeps static prices and skips GSAP; no-JavaScript navigation and contact remain usable');

  // Exercise both permission outcomes. This verifies the player logic without
  // pretending a desktop browser is the Instagram app on a physical phone.
  for (const policy of ['no-user-gesture-required', 'user-gesture-required']) {
    const autoplayBrowser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}), args: [`--autoplay-policy=${policy}`] });
    try {
      const bio = await autoplayBrowser.newPage({ viewport: { width: 390, height: 844 } }); track(bio);
      await bio.goto(preview.url('/linkinbio'));
      await bio.waitForFunction(() => { const v = document.querySelector('[data-bio-film]'); return !v.paused && v.currentTime > 0.1; });
      assert.equal(await bio.locator('[data-bio-film]').evaluate((v) => v.muted), policy === 'user-gesture-required');
      assert.equal(await bio.locator('[data-language-dialog], [data-sound-dialog]').count(), 0);
      assert.equal(await bio.locator('[data-bio-film]').getAttribute('playsinline'), '');
      assert.equal(await bio.locator('[data-bio-action]').count(), 8);
      assert.equal(await bio.locator('[data-bio-action="instagram"]').getAttribute('href'), 'https://www.instagram.com/lumawellnessbyjune');
      assert.equal(await bio.locator('[data-bio-action="facebook"]').getAttribute('href'), 'https://www.facebook.com/lumawellnessbyjunesaurin');
      if (policy === 'user-gesture-required') {
        await bio.locator('[data-intro-sound]').click();
        assert.equal(await bio.locator('[data-bio-film]').evaluate((v) => v.muted), false);
      }
      const vcard = await (await fetch(preview.url('/june-saurin.vcf'))).text();
      assert.ok(vcard.includes('FN:June Saurin\r\n') && vcard.includes('TEL;TYPE=CELL:+491788875085'));
      assert.ok(await bio.locator('[data-bio-action="contact"]').getAttribute('download'));
      await noOverflow(bio, 'Link-in-bio with autoplay');
      await bio.locator('[data-bio-action="facebook"]').scrollIntoViewIfNeeded();
      await bio.waitForFunction(() => document.querySelector('[data-bio-action="facebook"]').dataset.bioRevealed === 'true');
      await bio.locator('[data-drive]').click();
      assert.equal(await bio.locator('#route-choice').evaluate((dialog) => dialog.open), true);
      const directions = await bio.locator('[data-choice-option]').evaluateAll((links) => links.map((link) => link.href));
      assert.ok(directions[0].startsWith('https://www.google.com/maps/dir/'));
      assert.ok(directions[1].startsWith('https://maps.apple.com/'));
      assert.ok(directions.every((href) => decodeURIComponent(href).includes('Hauptstraße 19')));
      await bio.keyboard.press('Escape');
      assert.equal(await bio.locator('[data-drive]').evaluate((button) => document.activeElement === button), true);
      await bio.screenshot({ path: path.join(artifacts, `linkinbio-${policy}.png`), fullPage: true });
      await bio.locator('.bio-footer a').filter({ hasText: /^Kontakt$/ }).click();
      await bio.waitForURL(preview.url('/contact'));
      await bio.locator('[data-drive]').click();
      assert.equal(await bio.locator('#route-choice').evaluate((dialog) => dialog.open), true);
      await bio.locator('[data-choice-close]').click();
      await bio.waitForFunction(() => document.querySelector('[data-drive]').getAttribute('aria-expanded') === 'false');
      assert.equal(await bio.locator('[data-drive]').getAttribute('aria-expanded'), 'false');
    } finally { await autoplayBrowser.close(); }
  }
  report.push('Link-in-bio: audible autoplay and muted fallback, sound toggle, contact actions, vCard, scroll reveals, Maps/Apple directions and navigation cleanup');

  for (const motion of ['no-preference', 'reduce']) {
  const invitationContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: motion });
  const invitation = await invitationContext.newPage(); track(invitation);
  await invitation.clock.install();
  await invitation.goto(preview.url());
  await invitation.clock.fastForward(25_000);
  assert.equal(await invitation.locator('[data-june-invitation]').isVisible(), false, 'Greeting covered the welcome choices');
  await invitation.locator('[data-language-pick][lang="de"]').click();
  await invitation.locator('[data-sound-no]').click();
  await invitation.clock.fastForward(19_000);
  assert.equal(await invitation.locator('[data-june-invitation]').isVisible(), false, 'Greeting appeared too early');
  await invitation.clock.fastForward(1100);
  assert.equal(await invitation.locator('[data-june-invitation]').isVisible(), true);
  assert.equal(await invitation.locator('[data-june-invitation]').evaluate((card) => card.contains(document.activeElement)), false, 'Greeting stole focus');
  assert.ok(await invitation.locator('[data-invitation-book]').getAttribute('href') === `${preview.base}/contact`);
  await invitation.screenshot({ path: path.join(artifacts, `june-invitation-${motion}.png`) });
  await invitation.locator('.nav-burger').click();
  await invitation.locator('[data-june-invitation]').waitFor({ state: 'hidden' });
  assert.equal(await invitation.locator('[data-june-invitation]').isVisible(), false, 'Greeting covered the mobile menu');
  await invitation.keyboard.press('Escape');
  await invitation.locator('[data-june-invitation]').waitFor({ state: 'visible' });
  assert.equal(await invitation.locator('[data-june-invitation]').isVisible(), true);
  await invitation.locator('[data-invitation-close]').click();
  await invitation.reload();
  await invitation.clock.fastForward(25_000);
  assert.equal(await invitation.locator('[data-june-invitation]').isVisible(), false, 'Dismissed greeting returned');
  await invitationContext.close();
  }
  report.push('June greeting waits for welcome plus 20 seconds, offers booking without taking focus, and stays dismissed for the session');
  assert.deepEqual([...new Set(failures)], [], 'Browser errors');
  fs.writeFileSync(path.join(artifacts, 'summary.json'), JSON.stringify({ base: preview.base, checks: report }, null, 2));
  report.forEach((line) => console.log(`✓ ${line}`));
} finally {
  await browser.close(); preview.close();
}
