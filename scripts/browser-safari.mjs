import assert from 'node:assert/strict';
import fs from 'node:fs';
import { webkit, expect } from '@playwright/test';
import sharp from 'sharp';
import { startPreview } from './preview-server.mjs';

const preview = await startPreview();
const browser = await webkit.launch({ headless: true });
const failures = [];
const errors = [];
fs.mkdirSync('artifacts/browser', { recursive: true });
const run = async (name, check) => {
  try { await check(); console.log(`✓ WebKit: ${name}`); }
  catch (error) { failures.push(`${name}: ${error.stack}`); console.error(`✗ WebKit: ${name}: ${error.message}`); }
};
const context = async (width = 430, height = 932, returning = false) => {
  const c = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: 'en-GB' });
  if (returning) await c.addInitScript(() => {
    sessionStorage.setItem('luma-welcome-done', 'yes');
    sessionStorage.setItem('luma-sound', 'no');
  });
  c.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  return c;
};
const pixels = async (buffer, points) => {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return points.map(([x, y]) => {
    const i = (Math.floor(y) * info.width + Math.floor(x)) * info.channels;
    return [...data.subarray(i, i + 3)];
  });
};
// Compare the actual rendered corner with the same view without the inner
// surface. This catches compositing leaks as well as CSS cascade regressions.
const clippedCorners = async (page, selector, inset, label) => {
  const el = page.locator(selector);
  const box = await el.boundingBox();
  const points = [
    [box.x + inset, box.y + inset],
    [box.x + box.width - inset, box.y + inset],
  ];
  const before = await pixels(await page.screenshot(), points);
  await el.evaluate(node => node.style.visibility = 'hidden');
  const behind = await pixels(await page.screenshot(), points);
  await el.evaluate(node => node.style.removeProperty('visibility'));
  for (let i = 0; i < points.length; i++) {
    const difference = Math.max(...before[i].map((v, channel) => Math.abs(v - behind[i][channel])));
    assert.ok(difference < 14, `${label} leaks outside its rounded corner: ${before[i]} vs ${behind[i]}`);
  }
};

try {
  for (const [width, height] of [[430, 932], [440, 956]]) {
    await run(`product corners and sticky scrolling at ${width}px`, async () => {
      const c = await context(width, height, true);
      try {
        const p = await c.newPage();
        await p.goto(preview.url('/en'));
        await p.evaluate(() => document.fonts.ready);
        await p.locator('.hero-winner').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await p.addStyleTag({ content: '.hero-winner, .hero-winner *, .hero-winner::before { animation-play-state: paused !important; }' });
        await p.screenshot({ path: `artifacts/browser/safari-portrait-${width}.png` });
        await run(`portrait clips at ${width}px`, () => clippedCorners(p, '.hero-winner > .media', 18, 'Portrait'));

        await p.locator('[data-featured-treatment="gesicht-kopf"] summary').tap();
        const dialog = p.locator('.treatment-dialog[open]');
        await dialog.locator('[data-ss].is-active').waitFor();
        await dialog.evaluate(d => {
          const scene = d.querySelector('[data-ss]');
          d.scrollTop += scene.getBoundingClientRect().top - d.getBoundingClientRect().top - 160;
        });
        await p.waitForTimeout(300);
        await expect.poll(() => dialog.locator('[data-player]').evaluate(el => Number(el.style.opacity)), { timeout: 10000, message: 'Products should enter before the green panel reaches the popup top' }).toBeGreaterThan(.7);
        await p.screenshot({ path: `artifacts/browser/safari-scene-${width}.png` });
        await clippedCorners(p, '.treatment-dialog[open] .ss-stage', 3, 'Product scene');

        await dialog.evaluate(d => {
          const root = d.querySelector('[data-ss]');
          d.scrollTop += root.getBoundingClientRect().top - d.getBoundingClientRect().top - d.clientTop + (root.offsetHeight - root.querySelector('.ss-stage').offsetHeight) * .48;
        });
        // Software WebKit rendering in CI can advance this spring more slowly.
        // Keep the visual threshold, allowing it to reach the same settled pose.
        await expect.poll(() => dialog.locator('[data-pointer]').evaluate(el => Number(el.style.opacity)), { timeout: 15000 }).toBeGreaterThan(.99);
        const stage = await dialog.locator('.ss-stage').boundingBox(), frame = await dialog.boundingBox();
        assert.ok(Math.abs(stage.y - frame.y) < 3, 'Clipping broke sticky product animation');
        await expect(dialog.locator('[data-treatment-close]')).toBeInViewport();
        await p.screenshot({ path: `artifacts/browser/safari-scene-pinned-${width}.png` });
        await dialog.locator('[data-treatment-close]').tap();
      } finally { await c.close(); }
    });
  }
  await run('native intro controls remain available without JavaScript', async () => {
    const c = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, javaScriptEnabled: false });
    try {
      const p = await c.newPage();
      await p.goto(preview.url('/en'));
      await expect(p.locator('[data-intro-film]')).toBeHidden();
      const fallback = p.locator('.intro-film__screen noscript video');
      await expect(fallback).toBeVisible();
      assert.equal(await fallback.evaluate(v => v.controls), true);
      assert.ok((await fallback.getAttribute('src')).endsWith('/media/june-intro.mp4'));
    } finally { await c.close(); }
  });
  for (const enabled of [true, false]) {
    await run(`intro starts ${enabled ? 'with sound after changing language' : 'muted'}`, async () => {
      const c = await context();
      try {
        const p = await c.newPage(), requests = [];
        p.on('request', request => { if (request.url().includes('june-intro')) requests.push(request.url()); });
        await p.goto(preview.url(enabled ? '/' : '/en'));
        await p.locator('[data-language-pick][lang="en"]').tap();
        await p.locator('[data-sound-dialog]').waitFor({ state: 'visible' });
        assert.equal(requests.length, 0, 'Film downloaded before sound choice');
        await p.locator(enabled ? '[data-sound-yes]' : '[data-sound-no]').tap();
        await expect.poll(() => p.locator('[data-intro-film]').evaluate(v => v.currentTime), { timeout: 20000 }).toBeGreaterThan(.5);
        assert.equal(await p.locator('[data-intro-film]').evaluate(v => v.muted), !enabled);
        const previous = await p.locator('[data-intro-film]').evaluate(v => v.currentTime);
        await expect.poll(() => p.locator('[data-intro-film]').evaluate(v => v.currentTime)).toBeGreaterThan(previous + .5);
        await expect(p.locator('[data-intro-play]')).toBeHidden();
        await p.screenshot({ path: `artifacts/browser/safari-intro-${enabled ? 'sound' : 'silent'}.png` });
      } finally { await c.close(); }
    });
  }
  await run('failed first video request recovers instead of remaining at 00:00', async () => {
    const c = await context();
    try {
      let requests = 0;
      await c.route('**/media/june-intro*.mp4', async route => {
        requests++;
        if (requests === 1) await route.abort('failed');
        else await route.continue();
      });
      const p = await c.newPage();
      await p.goto(preview.url('/en'));
      await p.locator('[data-language-pick][lang="en"]').tap();
      await p.locator('[data-sound-yes]').tap();
      await expect.poll(() => p.locator('[data-intro-film]').evaluate(v => v.currentTime), { timeout: 18000 }).toBeGreaterThan(.5);
      assert.ok(requests > 1, 'No recovery request was made');
      assert.equal(await p.locator('[data-intro-film]').evaluate(v => v.muted), false);
    } finally { await c.close(); }
  });
  await run('persistent startup failure offers a working retry with sound', async () => {
    const c = await context();
    try {
      let unavailable = true, requests = 0;
      await c.route('**/media/june-intro*.mp4', async route => {
        requests++;
        if (unavailable) await route.abort('failed'); else await route.continue();
      });
      const p = await c.newPage();
      await p.goto(preview.url('/en'));
      await p.locator('[data-language-pick][lang="en"]').tap();
      await p.locator('[data-sound-yes]').tap();
      await expect(p.locator('.intro-film__screen')).toHaveAttribute('data-playback', 'retry', { timeout: 20000 });
      await expect(p.locator('[data-intro-play]')).toBeVisible();
      await expect(p.locator('[data-intro-poster]')).toBeVisible();
      await expect(p.locator('[data-intro-loading]')).toBeHidden();
      const attempts = requests;
      await p.waitForTimeout(500);
      assert.equal(requests, attempts, 'Startup retries were not bounded');
      unavailable = false;
      await p.locator('[data-intro-play]').tap();
      await expect.poll(() => p.locator('[data-intro-film]').evaluate(v => v.currentTime), { timeout: 15000 }).toBeGreaterThan(.5);
      assert.equal(await p.locator('[data-intro-film]').evaluate(v => v.muted), false);
      await expect(p.locator('[data-intro-poster]')).toBeHidden();
    } finally { await c.close(); }
  });
  await run('a pending request at 00:00 is restarted without another tap', async () => {
    const c = await context();
    let held;
    try {
      let requests = 0;
      await c.route('**/media/june-intro*.mp4', async route => {
        if (++requests === 1) { held = route; return; }
        await route.continue();
      });
      const p = await c.newPage();
      await p.goto(preview.url('/en'));
      await p.locator('[data-language-pick][lang="en"]').tap();
      await p.locator('[data-sound-yes]').tap();
      await expect(p.locator('[data-intro-loading]')).toBeVisible();
      await expect(p.locator('[data-intro-poster]')).toBeVisible();
      await expect.poll(() => p.locator('[data-intro-film]').evaluate(v => v.currentTime), { timeout: 18000 }).toBeGreaterThan(.5);
      assert.equal(await p.locator('[data-intro-film]').evaluate(v => v.muted), false);
      await expect(p.locator('[data-intro-loading]')).toBeHidden();
    } finally { await held?.abort().catch(() => {}); await c.close(); }
  });
  assert.deepEqual(errors, [], 'Safari page errors');
  assert.deepEqual(failures, [], 'Safari regressions');
} finally { await browser.close(); preview.close(); }
