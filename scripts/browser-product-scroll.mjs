import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {startPreview} from './preview-server.mjs';
const preview=await startPreview();
const browser=await chromium.launch({headless:true});
const errors=[];
const saved=()=>{sessionStorage.setItem('luma-welcome-done','yes');sessionStorage.setItem('luma-sound','no');};
const scrub=async(page,progress)=>{
  await page.evaluate(p=>{const root=document.querySelector('[data-ss]');scrollTo(0,root.getBoundingClientRect().top+scrollY+(root.offsetHeight-root.querySelector('.ss-stage').offsetHeight)*p);},progress);
  await page.waitForTimeout(1300);
};
fs.mkdirSync('artifacts/browser',{recursive:true});
try {
  for(const width of [390,1440]) {
    const c=await browser.newContext({viewport:{width,height:900},reducedMotion:'no-preference'});
    await c.addInitScript(saved);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.goto(preview.url('/en/treatments-prices'));
    await p.locator('#gesicht-kopf .face-media__destination').click();
    await p.waitForURL(/\/en\/ultimate-face-lifting$/);
    await p.locator('[data-ss].is-active').waitFor();
    await scrub(p,.12);
    const arrival=await p.locator('[data-player]').evaluate(el=>el.style.transform);
    await scrub(p,.48);
    assert.notEqual(await p.locator('[data-player]').evaluate(el=>el.style.transform),arrival);
    await expect.poll(()=>p.locator('[data-pointer]').evaluate(el=>el.style.opacity),{timeout:10000}).toBe('1');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await p.screenshot({path:`artifacts/browser/product-scroll-${width}.png`});
    await scrub(p,.86);
    await expect.poll(()=>p.locator('[data-closing]').evaluate(el=>Number(el.style.opacity)),{timeout:10000}).toBeGreaterThan(.85);
    await scrub(p,.12);
    await expect.poll(()=>p.locator('[data-pointer]').evaluate(el=>Number(el.style.opacity)),{timeout:10000}).toBeLessThan(.05);
    await scrub(p,.48);
    await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    const frozen=await p.locator('[data-player]').evaluate(el=>el.style.transform);
    await p.waitForTimeout(250);assert.equal(await p.locator('[data-player]').evaluate(el=>el.style.transform),frozen);
    await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
    const echo=p.locator('.face-science video');await echo.scrollIntoViewIfNeeded();
    await expect.poll(()=>echo.evaluate(v=>!v.paused&&v.muted&&v.currentTime>0)).toBe(true);
    const audit=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
    await p.screenshot({path:`artifacts/browser/product-science-${width}.png`});
    await p.locator('#face-options').scrollIntoViewIfNeeded();
    await expect.poll(()=>p.locator('[data-ss]').evaluate(el=>el.getBoundingClientRect().bottom<0)).toBe(true);
    await p.waitForTimeout(100);
    await expect.poll(async()=>{
      const transform=await p.locator('[data-player]').evaluate(el=>el.style.transform);
      await p.waitForTimeout(200);
      return transform===await p.locator('[data-player]').evaluate(el=>el.style.transform);
    },{timeout:5000}).toBe(true);
    await p.locator('.face-page__back').click();await p.waitForURL(/treatments-prices#gesicht-kopf$/);
    await p.locator('#gesicht-kopf .card__name a').click();await p.waitForURL(/ultimate-face-lifting$/);
    await p.locator('[data-ss].is-active').waitFor();await scrub(p,.48);
    await expect.poll(()=>p.locator('[data-player]').evaluate(el=>el.style.opacity),{timeout:10000}).toBe('1');
    await c.close();
  }
  for(const [locale,path] of [['de','/service-page/60min-luma-gesichts-und-kopf-massage'],...['en','fr','es','pt','it'].map(l=>[l,`/${l}/ultimate-face-lifting`])]) {
    const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await c.addInitScript(saved);
    const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(preview.url(path));
    assert.equal(await p.locator('html').getAttribute('lang'),locale);
    assert.equal(await p.locator('[data-ss].is-active').count(),0);
    assert.equal(await p.locator('#face-options .face-rate').count(),3);
    assert.equal(await p.locator('link[rel="alternate"][hreflang]').count(),7);
    await p.locator('[data-player]').scrollIntoViewIfNeeded();
    assert.ok(await p.locator('[data-player]').isVisible());
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await p.screenshot({path:`artifacts/browser/product-static-${locale}.png`});await c.close();
  }
  const c=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const p=await c.newPage();
  await p.goto(preview.url('/fr/ultimate-face-lifting'));assert.ok(await p.locator('[data-player]').isVisible());
  assert.equal(await p.locator('video[controls]').count(),1);await c.close();
  assert.deepEqual(errors,[]);
  console.log('✓ Product card navigation, desktop/mobile scroll and reverse motion, background/offscreen suspension, re-entry, looping echogram, WCAG, six localized routes, reduced motion and no-JS fallback');
} finally {await browser.close();preview.close();}
