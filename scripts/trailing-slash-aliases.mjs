/**
 * Keep /about/ from 404ing.
 *
 * The flat-file layout serves /about at 200, which is the URL Google has
 * indexed and the one the canonical names. The cost is that /about/ has nothing
 * to answer with, and the live Wix site does answer it - with a 301 back to
 * /about. Any backlink someone wrote with a trailing slash works today and
 * would break on cutover day, and a 404 throws away whatever that link was
 * worth.
 *
 * GitHub Pages cannot issue a 301, so this writes the nearest thing it can
 * serve: a tiny document at /about/ that names /about as its canonical and
 * sends the visitor there immediately. Google treats a zero-delay refresh as a
 * redirect and consolidates on the canonical, which is the same outcome Wix's
 * 301 produces.
 *
 * Deliberately not noindex. A page that says "do not index me" while also
 * saying "the real version is over there" gives two different instructions;
 * the canonical alone is the unambiguous one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://www.luma-wellness.com';

/** Every flat page dist/ emitted, as the URL it answers. */
function flatPages(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      out.push(...flatPages(path.join(dir, e.name), `${base}/${e.name}`));
    } else if (e.name.endsWith('.html') && e.name !== 'index.html' && e.name !== '404.html') {
      out.push(`${base}/${e.name.slice(0, -'.html'.length)}`);
    }
  }
  return out;
}

/**
 * The hop is relative, not root-absolute.
 *
 * Staging serves the site under /lumw, production under the root. From
 * /lumw/about/ a relative "../about" resolves to /lumw/about, and from /about/
 * it resolves to /about - correct in both without the script needing to know
 * which one it is building. A root-absolute /about would 404 on staging.
 *
 * The canonical is the production URL either way, because that is the address
 * Google should hold for the page regardless of where it was built.
 */
const stub = (route) => {
  const target = `${SITE}${route}`;
  const hop = `../${route.slice(route.lastIndexOf('/') + 1)}`;
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Weiterleitung</title>
<link rel="canonical" href="${target}">
<meta http-equiv="refresh" content="0; url=${hop}">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
<p>Diese Seite ist umgezogen: <a href="${hop}">${target}</a></p>
</body>
</html>
`;
};

if (!fs.existsSync(DIST)) {
  console.error('FAIL dist/ does not exist. Run the build first.');
  process.exit(1);
}

let written = 0;
for (const route of flatPages(DIST)) {
  const dir = path.join(DIST, route.slice(1));
  // Never write over a real page. If a directory build already put something
  // here, that something is the page and this alias is not wanted.
  if (fs.existsSync(path.join(dir, 'index.html'))) continue;

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), stub(route), 'utf8');
  written++;
}

console.log(`\x1b[32m✓\x1b[0m ${written} trailing-slash aliases written, so /about/ resolves like it does on the live site`);

// The owner replaced Thai with French on 18 September 2026. Keep existing
// bookmarks usable, with a single hop to the corresponding French page.
// Relative destinations work both at the custom domain and under /lumw.
const retired = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/retired-locale-routes.json'), 'utf8'));
for (const [from, to] of Object.entries(retired)) {
  if (!fs.existsSync(path.join(DIST, `${to.slice(1)}.html`))) throw new Error(`Missing replacement for ${from}: ${to}`);
  for (const trailing of [false, true]) {
    const base = trailing ? from : path.posix.dirname(from);
    const hop = path.posix.relative(base, to);
    const output = path.join(DIST, trailing ? `${from.slice(1)}/index.html` : `${from.slice(1)}.html`);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Page déplacée | LUMA Wellness</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="${SITE}${to}">
<meta http-equiv="refresh" content="0; url=${hop}">
</head><body><p>Cette page est disponible en français : <a href="${hop}">Continuer</a></p></body></html>\n`);
  }
}
console.log(`\x1b[32m✓\x1b[0m ${Object.keys(retired).length} retired Thai destinations redirect directly to French`);
