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
const scrubPopup=async(page,progress)=>{
  await page.locator('.treatment-dialog[open]').evaluate((dialog,p)=>{
    const root=dialog.querySelector('[data-ss]');
    dialog.scrollTop+=root.getBoundingClientRect().top-dialog.getBoundingClientRect().top-dialog.clientTop+(root.offsetHeight-root.querySelector('.ss-stage').offsetHeight)*p;
  },progress);
  await page.waitForTimeout(1300);
};
fs.mkdirSync('artifacts/browser',{recursive:true});
try {
  for(const [width,height] of [[390,844],[1440,844],[844,390]]) {
    const c=await browser.newContext({viewport:{width,height},reducedMotion:'no-preference'});
    await c.addInitScript(saved);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
    for(const [route,selector] of [['/en','[data-featured-treatment="gesicht-kopf"]'],['/en/treatments-prices','#gesicht-kopf']]) {
      await p.goto(preview.url(route));await p.evaluate(()=>document.fonts.ready);
      assert.equal(await p.locator('[data-ss].is-active').count(),0,'Closed popup initialized its animation during page load');
      const trigger=p.locator(`${selector} .treatment-details__trigger`);
      await trigger.scrollIntoViewIfNeeded();await trigger.click();
      const url=p.url(),background=await p.evaluate(()=>scrollY);
      const d=p.locator('.treatment-dialog[open]');await d.waitFor();
      await expect.poll(()=>d.locator('[data-face-echo] video').evaluate(v=>!v.paused&&v.muted&&v.currentTime>0)).toBe(true);
      assert.equal(await d.evaluate(el=>el.scrollTop),0);
      // Products should already be arriving while the panel is entering view,
      // before the visitor has scrolled far enough to pin its top edge.
      await d.evaluate(dialog=>{
        const root=dialog.querySelector('[data-ss]');
        dialog.scrollTop+=root.getBoundingClientRect().top-dialog.getBoundingClientRect().top-dialog.clientTop-dialog.clientHeight*.5;
      });
      await expect(d.locator('[data-ss-hint]')).toHaveCSS('opacity','1');
      await d.evaluate((dialog,fraction)=>{
        const root=dialog.querySelector('[data-ss]');
        dialog.scrollTop+=root.getBoundingClientRect().top-dialog.getBoundingClientRect().top-dialog.clientTop-dialog.clientHeight*fraction;
      },height<600?.1:.25);
      await expect.poll(()=>d.locator('[data-player]').evaluate(el=>Number(el.style.opacity)),{message:'Product scene stays empty during its entrance'}).toBeGreaterThan(.99);
      await expect.poll(()=>d.locator('[data-player] img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
      await expect.poll(()=>d.locator('[data-player]').evaluate(el=>{
        const r=el.getBoundingClientRect(),clip=el.closest('dialog').getBoundingClientRect();
        const w=Math.max(0,Math.min(r.right,clip.right)-Math.max(r.left,clip.left));
        const h=Math.max(0,Math.min(r.bottom,clip.bottom)-Math.max(r.top,clip.top));
        return w*h/(r.width*r.height);
      }),{message:'The entering product must be clearly inside the visible popup'}).toBeGreaterThan(.65);
      await p.screenshot({path:`artifacts/browser/product-entry-${route==='/en'?'home':'menu'}-${width}.png`});
      await scrubPopup(p,0);
      const start=await d.evaluate(el=>el.scrollTop);
      const stage=await d.locator('.ss-stage').boundingBox();
      await p.mouse.move(stage.x+stage.width/2,stage.y+stage.height/2);
      await p.mouse.wheel(0,320);
      await expect.poll(()=>d.evaluate(el=>el.scrollTop)).toBeGreaterThan(start+100);
      await expect(d.locator('[data-ss]')).toHaveClass(/has-scrolled/);
      await expect(d.locator('[data-ss-hint]')).toHaveCSS('opacity','0');
      assert.equal(p.url(),url,'More info or its scroll changed the page URL');
      assert.ok(Math.abs(await p.evaluate(()=>scrollY)-background)<2,'Popup scrolling moved the underlying page');
      await scrubPopup(p,.48);
      await expect.poll(()=>d.locator('[data-pointer]').evaluate(el=>Number(el.style.opacity))).toBeGreaterThan(.99);
      const db=await d.boundingBox(),sb=await d.locator('.ss-stage').boundingBox();
      assert.ok(Math.abs(sb.y-db.y)<3,'Product scene is not pinned to the popup');
      assert.equal(await d.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
      await expect(d.locator('[data-treatment-close]')).toBeInViewport();
      await p.screenshot({path:`artifacts/browser/product-popup-${route==='/en'?'home':'menu'}-${width}.png`});
      const audit=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      assert.deepEqual(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
      await scrubPopup(p,.86);
      await expect.poll(()=>d.locator('[data-closing]').evaluate(el=>Number(el.style.opacity))).toBeGreaterThan(.85);
      await scrubPopup(p,-.25);
      await expect.poll(()=>d.locator('[data-pointer]').evaluate(el=>Number(el.style.opacity))).toBeLessThan(.05);
      await scrubPopup(p,0);await d.locator('.ss-skip').click();
      assert.equal(p.url(),url,'Skipping the animation should remain inside the popup');
      assert.equal(await d.locator('.treatment-details__copy').evaluate(el=>el===document.activeElement),true);
      await scrubPopup(p,.48);
      const product=await d.locator('[data-player]').elementHandle();
      await d.locator('[data-treatment-close]').click();
      const frozen=await product.evaluate(el=>el.style.transform);
      await p.waitForTimeout(250);assert.equal(await product.evaluate(el=>el.style.transform),frozen,'Closed popup kept rendering');
      assert.ok(Math.abs(await p.evaluate(()=>scrollY)-background)<2);
      await trigger.click();await expect.poll(()=>d.evaluate(el=>el.scrollTop)).toBe(0);
      assert.equal(await d.locator('[data-ss].has-scrolled').count(),0,'Reopening did not reset the hint');
      await p.keyboard.press('Escape');await expect(trigger).toBeFocused();
    }
    await c.close();
  }
  for(const width of [390,1440]) {
    const c=await browser.newContext({viewport:{width,height:900},reducedMotion:'no-preference'});
    await c.addInitScript(saved);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.goto(preview.url('/en/treatments-prices'));
    await p.locator('#gesicht-kopf .face-media__destination').click();
    await p.waitForURL(/\/en\/ultimate-face-lifting$/);
    await p.locator('[data-ss].is-active').waitFor();
    await p.locator('[data-ss]').evaluate(root=>scrollTo(0,root.getBoundingClientRect().top+scrollY-innerHeight*.25));
    await expect.poll(()=>p.locator('[data-player]').evaluate(el=>Number(el.style.opacity)),{message:'Product page stays empty during its entrance'}).toBeGreaterThan(.7);
    await scrub(p,.12);
    const arrival=await p.locator('[data-player]').evaluate(el=>el.style.transform);
    await scrub(p,.48);
    assert.notEqual(await p.locator('[data-player]').evaluate(el=>el.style.transform),arrival);
    await expect.poll(()=>p.locator('[data-pointer]').evaluate(el=>el.style.opacity),{timeout:10000}).toBe('1');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await p.screenshot({path:`artifacts/browser/product-scroll-${width}.png`});
    await scrub(p,.86);
    await expect.poll(()=>p.locator('[data-closing]').evaluate(el=>Number(el.style.opacity)),{timeout:10000}).toBeGreaterThan(.85);
    await scrub(p,-.2);
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
    const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.goto(preview.url(locale==='de'?'/':`/${locale}`));
    await p.locator('[data-featured-treatment="gesicht-kopf"] .treatment-details__trigger').click();
    const popup=p.locator('.treatment-dialog[open]');
    assert.equal(await popup.locator('[data-ss].is-active').count(),0);
    assert.equal(await popup.locator('.face-rate').count(),3);
    assert.equal(await popup.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
    await popup.locator('[data-player]').scrollIntoViewIfNeeded();
    assert.equal(await popup.locator('[data-ss]').evaluate(el=>el.offsetHeight),await popup.locator('.ss-stage').evaluate(el=>el.offsetHeight)+2,'Reduced motion should have no long scroll track');
    await p.keyboard.press('Escape');await p.goto(preview.url(path));
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
  assert.equal(await p.locator('video[controls]').count(),1);
  await p.goto(preview.url('/fr'));await p.locator('[data-featured-treatment="gesicht-kopf"] .treatment-details__trigger').click();
  assert.ok(await p.locator('[data-featured-treatment="gesicht-kopf"] [data-player]').isVisible());
  assert.equal(await p.locator('[data-featured-treatment="gesicht-kopf"] .face-rate').count(),3);await c.close();
  assert.deepEqual(errors,[]);
  console.log('✓ Homepage/menu popups: real internal wheel scroll, echogram first, hint, pinned product animation, reverse motion, skip, focus, preserved URL/background, close/reopen, six languages, reduced motion and no-JS');
  console.log('✓ Product card navigation, desktop/mobile scroll and reverse motion, background/offscreen suspension, re-entry, looping echogram, WCAG, six localized routes, reduced motion and no-JS fallback');
} finally {await browser.close();preview.close();}
