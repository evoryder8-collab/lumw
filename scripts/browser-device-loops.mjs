import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, webkit, expect } from '@playwright/test';
import { startPreview } from './preview-server.mjs';

const preview = await startPreview();
const failures = [], errors = [];
fs.mkdirSync('artifacts/browser', { recursive: true });
const playing = async (video) => expect.poll(() => video.evaluate(v => !v.paused && v.muted && v.currentTime > .03), { timeout: 12000 }).toBe(true);
const check = async (name, run) => {
  try { await run(); console.log(`✓ ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`✗ ${name}: ${error.message}`); }
};

try {
  for (const engine of [chromium, webkit].filter(engine => !process.env.LUMA_DEVICE_ENGINE || engine.name() === process.env.LUMA_DEVICE_ENGINE)) {
    const browser = await engine.launch({ headless: true });
    const context = async (reducedMotion = 'no-preference') => {
      const c = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, reducedMotion });
      await c.addInitScript(() => {
        try {
          sessionStorage.setItem('luma-welcome-done', 'yes');
          sessionStorage.setItem('luma-sound', 'no');
        } catch { /* The blank page has no storage origin yet. */ }
      });
      c.on('page', p => p.on('pageerror', error => errors.push(error.message)));
      return c;
    };
    const open = async c => {
      const p = await c.newPage();
      await p.goto(preview.url('/en'));
      await p.locator('.face-media').scrollIntoViewIfNeeded();
      return { p, video: p.locator('.face-media video').first() };
    };
    try {
      for (const reducedMotion of ['no-preference', 'reduce']) {
        await check(`${engine.name()}: mobile loop starts with ${reducedMotion}`, async () => {
          const c = await context(reducedMotion);
          try {
            const { p, video } = await open(c);
            await playing(video);
            await video.evaluate(v => { v.currentTime = v.duration - .12; });
            await expect.poll(() => video.evaluate(v => !v.paused && v.currentTime < v.duration - .25)).toBe(true);
            // Hover and touch focus must not reveal player chrome on the card.
            await p.locator('.face-media').hover();
            await p.waitForTimeout(250);
            assert.equal(await video.evaluate(v => v.controls), false);
            assert.equal(await p.locator('.face-media').evaluate(el => [...el.querySelectorAll('button')].some(b => {
              const style = getComputedStyle(b), rect = b.getBoundingClientRect();
              return !b.hidden && rect.width > 5 && rect.height > 5 && Number(style.opacity) > .05 && style.clipPath === 'none';
            })), false, 'The looping card exposes a visible transport button');
            await p.screenshot({ path: `artifacts/browser/device-loop-${engine.name()}-${reducedMotion}.png` });
            // A browser interruption should recover without a play button.
            await video.evaluate(v => v.pause());
            await playing(video);
          } finally { await c.close(); }
        });
      }
      await check(`${engine.name()}: a rejected first play recovers on the next touch`, async () => {
        const c = await context();
        try {
          await c.addInitScript(() => {
            const play = HTMLMediaElement.prototype.play;
            let rejected = false;
            HTMLMediaElement.prototype.play = function () {
              if (this.closest('[data-device-loop]') && !rejected) {
                rejected = true;
                return Promise.reject(new DOMException('Playback interrupted by mobile policy', 'NotAllowedError'));
              }
              return play.call(this);
            };
          });
          const { p, video } = await open(c);
          await p.locator('[data-featured-treatment="gesicht-kopf"] .feature-price').tap();
          await playing(video);
          assert.equal(await video.evaluate(v => v.controls), false);
        } finally { await c.close(); }
      });
      await check(`${engine.name()}: a failed first video request recovers automatically`, async () => {
        const c = await context();
        try {
          let requests = 0;
          await c.route('**/media/corefit/face-player-action.mp4', async route => {
            if (++requests === 1) await route.abort('failed');
            else await route.continue();
          });
          const { video } = await open(c);
          await playing(video);
          assert.ok(requests > 1, 'The failed source was not retried');
          assert.equal(await video.evaluate(v => v.controls), false);
        } finally { await c.close(); }
      });
    } finally { await browser.close(); }
  }
  assert.deepEqual(errors, [], 'Product-loop browser errors');
  assert.deepEqual(failures, [], 'Mobile product-loop regressions');
} finally { preview.close(); }
