import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, webkit, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startPreview } from './preview-server.mjs';

const preview = await startPreview();
fs.mkdirSync('artifacts/browser', { recursive: true });
try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      const languages = [['fr-CH', 'fr'], ['de-CH', 'de'], ['de-AT', 'de'], ['de-DE', 'de'], ['en-US', 'en'], ['es-MX', 'es'], ['pt-BR', 'pt'], ['it-IT', 'it'], ['ja-JP', 'en']];
      for (const [browserLanguage, language] of languages) {
        const context = await browser.newContext({ locale: browserLanguage, viewport: { width: 360, height: 800 }, reducedMotion: 'reduce' });
        try {
          const page = await context.newPage();
          await page.goto(preview.url('/linkinbio?utm_source=instagram'));
          await expect(page.locator('html')).toHaveAttribute('lang', language);
          assert.equal(new URL(page.url()).searchParams.get('utm_source'), 'instagram');
          assert.equal(await page.locator('[data-language-dialog], [data-sound-dialog]').count(), 0, 'Link-in-bio must open without a portal');
          assert.equal(await page.locator('[data-bio-action]').count(), 8);
          assert.ok((await page.locator('[data-bio-action="spark"]').getAttribute('href')).includes(language === 'de' ? '/meineangebote-preise' : `/${language}/`));
          const menu = page.locator('[data-bio-language]');
          await menu.locator('summary').click();
          await expect(menu.locator(`[lang="${language}"]`)).toHaveAttribute('aria-current', 'page');
          assert.equal(await menu.locator('a[lang]').count(), 6);
          await page.keyboard.press('Escape');
          await expect(menu).not.toHaveAttribute('open');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          if (browserLanguage === 'fr-CH') {
            await menu.locator('summary').click();
            await menu.locator('a[lang="it"]').click();
            await expect(page.locator('html')).toHaveAttribute('lang', 'it');
            await page.goto(preview.url('/linkinbio'));
            await expect(page.locator('html')).toHaveAttribute('lang', 'it');
            await page.locator('[data-bio-language] summary').click();
            await page.locator('[data-bio-language] a[lang="de"]').click();
            await expect(page.locator('html')).toHaveAttribute('lang', 'de');
            await page.reload();
            await expect(page.locator('html')).toHaveAttribute('lang', 'de');
          }
        } finally { await context.close(); }
      }
      const unavailable = await browser.newContext({ viewport: { width: 360, height: 800 }, reducedMotion: 'reduce' });
      try {
        await unavailable.addInitScript(() => {
          Object.defineProperty(navigator, 'languages', { get: () => [] });
          Object.defineProperty(navigator, 'language', { get: () => '' });
        });
        const page = await unavailable.newPage();
        await page.goto(preview.url('/linkinbio'));
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      } finally { await unavailable.close(); }
      const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      try {
        await context.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Unavailable', 'SecurityError'); } }); });
        const page = await context.newPage();
        await page.goto(preview.url('/linkinbio'));
        await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
        await page.locator('[data-bio-language] summary').click();
        await page.locator('[data-bio-language] a[lang="de"]').click();
        await expect(page.locator('html')).toHaveAttribute('lang', 'de');
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('lang', 'de');
      } finally { await context.close(); }
      const page = await browser.newPage({ viewport: { width: 360, height: 800 }, javaScriptEnabled: false });
      await page.goto(preview.url('/fr/linkinbio'));
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
      await page.locator('[data-bio-language] summary').click();
      await expect(page.locator('[data-bio-language] a[lang="en"]')).toBeVisible();
      await page.close();
      console.log(`✓ ${engine.name()}: automatic bio language, regional matches, English fallback, manual choice, unavailable storage and no-JavaScript menu`);
    } finally { await browser.close(); }
  }
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [locale, label] of [['de', 'NEU'], ['en', 'NEW'], ['fr', 'NOUVEAU'], ['es', 'NUEVO'], ['pt', 'NOVO'], ['it', 'NOVITÀ']]) {
      const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
      await context.addInitScript(() => { sessionStorage.setItem('luma-welcome-done', 'yes'); });
      try {
        const page = await context.newPage();
        await page.goto(preview.url(locale === 'de' ? '/' : `/${locale}`));
        const card = page.locator('[data-featured-treatment="gesicht-kopf"]');
        await card.scrollIntoViewIfNeeded();
        const ribbon = card.locator('.new-ribbon__label');
        await expect(ribbon).toHaveText(label);
        assert.equal(await page.locator('.new-ribbon').count(), 1);
        assert.ok(await ribbon.evaluate(el => el.scrollWidth <= el.clientWidth), `${locale}: ribbon label clips`);
        await card.locator('.new-ribbon__band').evaluate(el => el.getAnimations({ subtree: true }).forEach(animation => { animation.currentTime = 0; }));
        const a = await card.locator('.new-ribbon__band').evaluate(el => getComputedStyle(el, '::after').transform);
        await page.waitForTimeout(350);
        const b = await card.locator('.new-ribbon__band').evaluate(el => getComputedStyle(el, '::after').transform);
        assert.notEqual(a, b, 'Ribbon shine does not move');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await card.locator('.new-ribbon__band').evaluate(el => getComputedStyle(el, '::after').animationName), 'none');
        await page.screenshot({ path: `artifacts/browser/new-ribbon-${locale}.png` });
        await page.goto(preview.url(locale === 'de' ? '/linkinbio?lang=de' : `/${locale}/linkinbio`));
        await page.locator('[data-bio-language] summary').click();
        const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        assert.deepEqual(a11y.violations, [], `${locale}: link-in-bio accessibility`);
        await page.screenshot({ path: `artifacts/browser/bio-language-${locale}.png` });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  console.log('✓ Six translated ribbons fit, shine and respect reduced motion; localized link-in-bio menus pass accessibility checks');
} finally { preview.close(); }
