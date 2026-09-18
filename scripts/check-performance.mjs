import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer-core';
import { chromium } from '@playwright/test';
import { startPreview } from './preview-server.mjs';

const preview = await startPreview();
// Use the same pinned browser locally and in CI. An installed Chrome can be
// several versions apart and have different loading and rendering behaviour.
const executablePath = process.env.CHROME_PATH || chromium.executablePath();
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
const directory = path.resolve('artifacts/performance');
fs.mkdirSync(directory, { recursive: true });
const host = { platform: os.platform(), cores: os.cpus().length, loadAverage: os.loadavg(), measuredAt: new Date().toISOString() };
const scenarios = [
  { name: 'welcome', route: '/', returning: false },
  { name: 'home', route: '/', returning: true },
  { name: 'treatments', route: '/meineangebote-preise', returning: true },
  { name: 'contact', route: '/contact', returning: true },
];
const runs = Number(process.env.LUMA_LIGHTHOUSE_RUNS || 1);
const summary = [];
try {
  console.log(`Host: ${host.cores} cores, load ${host.loadAverage.map((v) => v.toFixed(2)).join('/')}`);
  for (const scenario of scenarios.filter((s) => !process.env.LUMA_LIGHTHOUSE_SCENARIOS || process.env.LUMA_LIGHTHOUSE_SCENARIOS.split(',').includes(s.name))) {
    const measurements = [];
    for (let run = 1; run <= runs; run++) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      if (scenario.returning) await page.evaluateOnNewDocument(() => { sessionStorage.setItem('luma-welcome-done', 'yes'); sessionStorage.setItem('luma-sound', 'no'); });
      const result = await lighthouse(preview.url(scenario.route), {
        logLevel: 'error', output: 'html', onlyCategories: ['performance'], formFactor: 'mobile',
        disableStorageReset: false, screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 1, disabled: false },
      }, undefined, page);
      if (result.lhr.runtimeError) throw new Error(JSON.stringify(result.lhr.runtimeError));
      const audits = result.lhr.audits;
      if (process.env.LUMA_LIGHTHOUSE_TRACE === '1' || result.lhr.categories.performance.score < 0.95 || audits['largest-contentful-paint'].numericValue > 2500 || audits['cumulative-layout-shift'].numericValue > 0.02 || audits['total-blocking-time'].numericValue > 200) {
        fs.writeFileSync(path.join(directory, `${scenario.name}-${run}-trace.json`), JSON.stringify(result.artifacts.Trace));
      }
      const measurement = {
        score: Math.round(result.lhr.categories.performance.score * 100),
        lcp: Math.round(audits['largest-contentful-paint'].numericValue),
        cls: Number(audits['cumulative-layout-shift'].numericValue.toFixed(4)),
        tbt: Math.round(audits['total-blocking-time'].numericValue),
      };
      measurements.push(measurement);
      fs.writeFileSync(path.join(directory, `${scenario.name}-${run}.html`), result.report);
      fs.writeFileSync(path.join(directory, `${scenario.name}-${run}.json`), JSON.stringify(result.lhr, null, 2));
      console.log(`${scenario.name} ${run}/${runs}: ${measurement.score}, LCP ${measurement.lcp}ms, CLS ${measurement.cls}, TBT ${measurement.tbt}ms`);
      await context.close();
    }
    const median = (key) => measurements.map((m) => m[key]).sort((a,b) => a-b)[Math.floor(measurements.length / 2)];
    summary.push({ scenario: scenario.name, score: median('score'), lcp: median('lcp'), cls: median('cls'), tbt: median('tbt'), measurements });
  }
  fs.writeFileSync(path.join(directory, 'summary.json'), JSON.stringify({ host, base: preview.base, runs, summary }, null, 2));
  const failed = summary.filter((m) => m.score < 95 || m.lcp > 2500 || m.cls > 0.02 || m.tbt > 200);
  assert.deepEqual(failed, [], 'Mobile performance budget: score 95, LCP 2.5s, CLS 0.02, TBT 200ms');
  console.log('✓ All mobile performance budgets pass');
} finally {
  await browser.close(); preview.close();
}
