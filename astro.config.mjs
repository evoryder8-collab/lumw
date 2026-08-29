// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Canonical host is www and never changes. Switching to the apex would be an
// avoidable migration event (CLAUDE.md section 7).
const SITE = 'https://www.luma-wellness.com';

/**
 * Staging lives at evoryder8-collab.github.io/lumw, production at the root of
 * the custom domain. Without a base the staging build emits /_astro/... which
 * 404s under the /lumw prefix, so every image and stylesheet silently breaks
 * while the HTML still returns 200.
 */
const BASE = process.env.PUBLIC_BASE || '/';

export default defineConfig({
  site: SITE,
  base: BASE,

  // Section 7 asks for two things: that every path stays byte-identical, which
  // it calls the highest priority in the project, and that Astro emit
  // /path/index.html. On GitHub Pages those two are in conflict, and the first
  // one wins.
  //
  // With the directory layout Pages 301s /about to /about/, while the live Wix
  // site does the exact opposite: it serves /about at 200 and 301s /about/ back
  // to /about. Every one of the 25 indexed URLs would have started redirecting,
  // in the opposite direction, to a form Google has never seen. It also left
  // /about/ answering 200 while its own canonical pointed at /about, a URL that
  // redirected straight back to it.
  //
  // format: 'file' emits about.html, which Pages serves at /about with no
  // redirect: the indexed URL and the canonical finally agree, and the path is
  // byte-identical to live. The index.html mechanism assumed a server that
  // serves /path/index.html at /path without redirecting, which is what most
  // hosts do and Pages does not.
  build: { format: 'file', inlineStylesheets: 'always' },

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
