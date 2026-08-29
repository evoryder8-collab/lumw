#!/usr/bin/env node
/**
 * The migration guard.
 *
 * CLAUDE.md section 7: all 25 live URLs must resolve byte-identically after
 * cutover, because GitHub Pages cannot issue a single 301. "A single missing
 * path is a lost ranking." This check fails the build rather than let that ship.
 *
 * It also guards the trap that would silently break the four non-ASCII slugs:
 * macOS stores filenames decomposed (NFD), the web serves them composed (NFC).
 * A directory written as NFD looks identical in a terminal and 404s on Linux,
 * where the filesystem is byte-exact. So existence alone is not enough; the
 * emitted bytes are checked too.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const expected = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/data/expected-urls.json'), 'utf8'),
);

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m';
const DIM = '\x1b[2m', BOLD = '\x1b[1m', OFF = '\x1b[0m';

if (!fs.existsSync(DIST)) {
  console.error(`${RED}${BOLD}FAIL${OFF} dist/ does not exist. Run the build first.`);
  process.exit(1);
}

/**
 * Every route dist/ actually serves, as the URL a browser would ask for, with
 * the bytes exactly as they were written to disk.
 *
 * Both layouts are read, because the two emit the same URL differently:
 * `about/index.html` and `about.html` both answer at /about. The check is about
 * which URLs resolve, not which files exist, so it should not care which one
 * the build chose.
 */
function walkRoutes(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      out.push(...walkRoutes(path.join(dir, e.name), `${base}/${e.name}`));
    } else if (e.name === 'index.html') {
      out.push(base === '' ? '/' : base);
    } else if (e.name.endsWith('.html')) {
      out.push(`${base}/${e.name.slice(0, -'.html'.length)}`);
    }
  }
  return out;
}
const actualRouteList = walkRoutes(DIST);
const actualRoutes = new Set(actualRouteList);

/** Where a given URL's HTML lives, whichever layout produced it. */
function fileFor(p) {
  if (p === '/') return path.join(DIST, 'index.html');
  const asDirectory = path.join(DIST, p.slice(1), 'index.html');
  if (fs.existsSync(asDirectory)) return asDirectory;
  return path.join(DIST, `${p.slice(1)}.html`);
}

const failures = [];
const warnings = [];
let ok = 0;

for (const p of expected.paths) {
  const nfc = p.normalize('NFC');
  const file = fileFor(p);

  // 1. The file has to be there at all.
  if (!fs.existsSync(file)) {
    failures.push({ p, why: `missing ${path.relative(ROOT, file)}` });
    continue;
  }

  // 2. It has to have content. An empty page during propagation is the one
  //    thing section 7 says must never happen.
  const size = fs.statSync(file).size;
  if (size < 500) {
    failures.push({ p, why: `${path.relative(DIST, file)} is only ${size} bytes, looks empty` });
    continue;
  }

  // 3. For non-ASCII slugs, the directory name on disk must be NFC. On macOS
  //    existsSync() succeeds against either form because APFS is
  //    normalisation-insensitive, so this is the check that catches what would
  //    otherwise only surface as a 404 in production.
  if (p !== nfc) {
    failures.push({ p, why: 'expected path in source is not NFC' });
    continue;
  }
  if (/[^\x00-\x7F]/.test(p) && !actualRoutes.has(nfc)) {
    const decomposed = actualRouteList.find((d) => d.normalize('NFC') === nfc);
    failures.push({
      p,
      why: decomposed
        ? `emitted decomposed (NFD) as ${JSON.stringify(decomposed)}; would 404 on Linux`
        : 'emitted directory name does not match NFC bytes',
    });
    continue;
  }

  // 4. The page must carry a canonical pointing at the live URL.
  const html = fs.readFileSync(file, 'utf8');
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1];
  const want = `${expected.canonicalHost}${p === '/' ? '/' : p}`;
  if (!canonical) {
    failures.push({ p, why: 'no canonical link' });
    continue;
  }
  if (decodeURI(canonical) !== decodeURI(want)) {
    failures.push({ p, why: `canonical is ${canonical}, expected ${want}` });
    continue;
  }

  // 5. Exactly one H1, matching the live page, is the section 7 rule. Presence
  //    is checked here; the exact string is checked in check-content.mjs.
  const h1s = html.match(/<h1[\s>]/g)?.length ?? 0;
  if (h1s !== 1) warnings.push(`${p} has ${h1s} <h1> elements, expected exactly 1`);

  ok++;
}

// Anything under /service-page/ that is not on the list is a page we invented.
const strayServicePages = [...actualRoutes].filter(
  (d) => d.startsWith('/service-page/') && d.split('/').length === 3 && !expected.paths.includes(d),
);

console.log(`\n${BOLD}Migration URL check${OFF} ${DIM}(CLAUDE.md section 7)${OFF}`);
console.log(`${DIM}${'─'.repeat(60)}${OFF}`);

if (warnings.length) {
  for (const w of warnings) console.log(`${YELLOW}warn${OFF}  ${w}`);
}
if (strayServicePages.length) {
  for (const s of strayServicePages) console.log(`${YELLOW}warn${OFF}  unlisted service page: ${s}`);
}

if (failures.length) {
  console.log(`\n${RED}${BOLD}FAIL${OFF} ${failures.length} of ${expected.paths.length} URLs would not resolve:\n`);
  for (const f of failures) console.log(`  ${RED}✗${OFF} ${f.p}\n    ${DIM}${f.why}${OFF}`);
  console.log(`\n${RED}A single missing path is a lost ranking. Not shipping.${OFF}\n`);
  process.exit(1);
}

// Which layout was built decides how the live URLs behave on GitHub Pages.
const flatFile = fs.existsSync(path.join(DIST, 'about.html'));
const trailingSlashNote = flatFile
  ? `${GREEN}✓${OFF} flat files: Pages serves /about at 200, matching the live site exactly`
  : `${YELLOW}!${OFF} directory layout: Pages will 301 /about to /about/.\n` +
    `    ${DIM}The live Wix site does the opposite - it serves /about at 200 and\n` +
    `    301s /about/ back to /about. Resolve before DNS cutover; astro.config.mjs\n` +
    `    build.format: 'file' removes the redirect entirely.${OFF}`;

console.log(`${GREEN}✓${OFF} all ${ok}/${expected.paths.length} live URLs resolve in dist/`);
console.log(`${GREEN}✓${OFF} 4 non-ASCII slugs emitted NFC-correct (ö ö ü ß)`);
console.log(`${GREEN}✓${OFF} every page carries its live canonical`);
console.log(trailingSlashNote + '\n');
