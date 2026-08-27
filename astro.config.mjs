// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Canonical host is www and never changes. Switching to the apex would be an
// avoidable migration event (CLAUDE.md section 7).
const SITE = 'https://www.luma-wellness.com';

export default defineConfig({
  site: SITE,

  // Emit /path/index.html for every route so all 25 live URLs resolve on a
  // static host with no redirects available.
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
