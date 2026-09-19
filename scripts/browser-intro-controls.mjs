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
      for (const width of [430, 1440]) {
        const context = await browser.newContext({ viewport: { width, height: 956 }, isMobile: width < 500, hasTouch: width < 500, locale: 'en-GB' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
          window.__introCalls = [];
          for (const method of ['play', 'pause']) {
            const original = HTMLMediaElement.prototype[method];
            HTMLMediaElement.prototype[method] = function (...args) {
              const entry = { method, at: performance.now(), source: this.getAttribute('src'), time: this.currentTime, stack: new Error().stack };
              window.__introCalls.push(entry);
              const result = original.apply(this, args);
              result?.then(() => { entry.result = 'resolved'; }, error => { entry.result = `${error.name}: ${error.message}`; });
              return result;
            };
          }
          document.addEventListener('click', event => {
            const button = event.target.closest?.('[data-intro-transport] button');
            if (button) window.__introCalls.push({ method: 'click', label: button.getAttribute('aria-label'), at: performance.now() });
          }, true);
        });
        try {
          await page.goto(preview.url('/en'));
          await page.locator('[data-language-pick][lang="en"]').click();
          await page.locator('[data-sound-yes]').click();
          const film = page.locator('[data-intro-film]');
          await film.evaluate(v => {
            window.__introEvents = [];
            for (const name of ['play', 'playing', 'pause', 'ended', 'seeking', 'seeked', 'waiting', 'stalled', 'error', 'timeupdate']) {
              v.addEventListener(name, () => window.__introEvents.push({ event: name, at: performance.now(), time: v.currentTime, paused: v.paused, ended: v.ended, seeking: v.seeking, ready: v.readyState, error: v.error?.code }));
            }
          });
          await expect.poll(() => film.evaluate(v => v.currentTime), { timeout: 20000 }).toBeGreaterThan(.1);
          assert.equal(await film.evaluate(v => v.controls), false, 'Native controls darken the opening frames');
          assert.equal(await film.evaluate(v => v.muted), false, 'Clean startup lost the sound choice');
          await page.locator('[data-welcome-curtain]').waitFor({ state: 'hidden' });
          const transport = page.locator('[data-intro-transport]');
          await expect(transport).toBeVisible();
          const screen = await page.locator('.intro-film__screen').boundingBox();
          const rail = await transport.boundingBox();
          assert.ok(rail.y >= screen.y + screen.height - 1, 'Controls cover the picture');
          await page.screenshot({ path: `artifacts/browser/intro-clean-${engine.name()}-${width}.png` });

          await transport.getByRole('button', { name: 'Pause video', exact: true }).click();
          await expect.poll(() => film.evaluate(v => v.paused)).toBe(true);
          const seek = transport.getByRole('slider', { name: 'Video position' });
          await seek.focus();
          await seek.press('Home');
          for (let i = 0; i < 5; i++) await seek.press('ArrowRight');
          await expect.poll(() => film.evaluate(v => Math.round(v.currentTime))).toBe(5);
          await transport.getByRole('button', { name: 'Play video', exact: true }).click();
          await expect.poll(() => film.evaluate(v => v.currentTime)).toBeGreaterThan(5.5);
          await transport.getByRole('button', { name: 'Turn sound off', exact: true }).click();
          assert.equal(await film.evaluate(v => v.muted), true);
          await transport.getByRole('button', { name: 'Turn sound on', exact: true }).click();
          assert.equal(await film.evaluate(v => v.muted), false);

          if (engine === chromium && width === 1440) {
            await transport.getByRole('button', { name: 'Enter fullscreen' }).click();
            await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
            await transport.getByRole('button', { name: 'Exit fullscreen' }).click();
            await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
          }
          await seek.focus();
          await seek.press('End');
          await expect.poll(() => film.evaluate(v => v.ended)).toBe(true);
          await transport.getByRole('button', { name: 'Replay video', exact: true }).click();
          await expect.poll(() => film.evaluate(v => !v.paused && v.currentTime > .1 && v.currentTime < 5)).toBe(true);
          assert.equal(await film.evaluate(v => v.controls), false, 'Native overlay returned after replay');
          const a11y = await new AxeBuilder({ page }).include('.intro-film').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
          assert.deepEqual(a11y.violations, [], 'Intro controls accessibility');
          assert.deepEqual(errors, [], 'Intro player errors');
          console.log(`✓ ${engine.name()} ${width}px: clean audible opening, controls below film, pause, seek, mute, replay and accessibility`);
        } catch (error) {
          const diagnostic = await page.evaluate(() => {
            const v = document.querySelector('[data-intro-film]');
            return { state: v && { time: v.currentTime, duration: v.duration, paused: v.paused, ended: v.ended, seeking: v.seeking, ready: v.readyState, network: v.networkState, error: v.error?.code }, events: window.__introEvents, calls: window.__introCalls };
          });
          console.error(`${engine.name()} ${width}px playback failure:`, JSON.stringify(diagnostic));
          fs.writeFileSync(`artifacts/browser/intro-failure-${engine.name()}-${width}.json`, JSON.stringify(diagnostic, null, 2));
          await page.screenshot({ path: `artifacts/browser/intro-failure-${engine.name()}-${width}.png` });
          throw error;
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
} finally { preview.close(); }
