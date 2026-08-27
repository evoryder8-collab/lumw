// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Canonical host is www and never changes. Switching to the apex would be an
// avoidable migration event (CLAUDE.md section 7).
const SITE = 'https://www.luma-wellness.com';

export default defineConfig({
  site: SITE,

  // CLAUDE.md section 7 requires /path/index.html for every route, so that is
  // what ships.
  //
  // Be aware of what this costs on GitHub Pages specifically. Pages 301s
  // /about to /about/, while the live Wix site does the exact opposite: it
  // serves /about at 200 and 301s /about/ back to /about. So every one of the
  // 25 indexed URLs would start redirecting, in the opposite direction, to a
  // form Google has never seen.
  //
  // Switching to format: 'file' emits about.html, which Pages serves at /about
  // with no redirect at all - byte-identical to live. It is a one-word change
  // and check:urls reports which behaviour is currently built. This is a
  // cutover decision, not a build decision, and it is flagged rather than made
  // here because section 7 names the directory layout explicitly.
  build: { format: 'directory', inlineStylesheets: 'always' },

  // The live Wix URLs carry no trailing slash and neither do our canonicals.
  trailingSlash: 'ignore',

  compressHTML: true,
  vite: { plugins: [tailwindcss()] },

  image: {
    // AVIF first with WebP fallback, per the performance budget.
    responsiveStyles: true,
  },

  devToolbar: { enabled: false },
});
