/**
 * Titles and meta descriptions must not drift from the live site.
 *
 * CLAUDE.md section 7: "Keep them identical at cutover. Improve them later, one
 * page at a time, after rankings have settled. Never change URL and title in the
 * same release." The title is one of the few things Google uses to identify a
 * page, and this rebuild changes the host, the markup and the rendering already.
 *
 * Nothing enforced that. The titles were transcribed by hand from the archive in
 * content-source/luma-wellness-copy.md, and a single careless edit - or a
 * well-meant one, since two titles are long enough to truncate in a search
 * result - would have shipped silently. Improving them is a deliberate
 * post-cutover exercise, so this fails the build until the archive is updated to
 * match, which makes the change conscious rather than accidental.
 *
 * Only the seven main pages carry SEO title lines in the archive. The eighteen
 * service pages are listed there by URL alone and their titles come from
 * services.json, so they are out of scope here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ARCHIVE = path.join(ROOT, 'content-source/luma-wellness-copy.md');

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m';
const DIM = '\x1b[2m', BOLD = '\x1b[1m', OFF = '\x1b[0m';

const md = fs.readFileSync(ARCHIVE, 'utf8').split('\n');

/** Walk the archive collecting URL / SEO title / Meta description triples. */
const expected = [];
let current = null;
for (const line of md) {
  const url = line.match(/^URL:\s*(\S+)/);
  if (url) {
    current = { url: url[1], title: null, description: null };
    expected.push(current);
    continue;
  }
  if (!current) continue;
  const t = line.match(/^SEO title:\s*(.+?)\s*$/);
  if (t) current.title = t[1];
  const d = line.match(/^Meta description:\s*(.+?)\s*$/);
  if (d) current.description = d[1];
}

/** Only entries that actually declare a title are checked. */
const checkable = expected.filter((e) => e.title);

/** dist file for a live URL, flat layout first. */
function fileFor(urlStr) {
  const p = new URL(urlStr).pathname.replace(/\/$/, '');
  if (p === '') return path.join(DIST, 'index.html');
  const flat = path.join(DIST, `${p.slice(1)}.html`);
  return fs.existsSync(flat) ? flat : path.join(DIST, p.slice(1), 'index.html');
}

/**
 * Astro escapes ampersands numerically, so the built page says &#38; where the
 * archive says &. Comparing raw would report drift on every description that
 * contains one - which is the checker being wrong, not the page.
 */
const decode = (s) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
   .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
   .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
   .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&euro;/g, '€');

const failures = [];
const notes = [];

for (const e of checkable) {
  const file = fileFor(e.url);
  if (!fs.existsSync(file)) {
    failures.push({ url: e.url, why: `no built page at ${path.relative(ROOT, file)}` });
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');

  const gotTitle = decode(html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? '');
  const gotDesc = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1]?.trim() ?? '');

  // Normalise whitespace only. Every other character must survive, umlauts and
  // the en dash included.
  const norm = (s) => s.replace(/\s+/g, ' ').trim();

  if (norm(gotTitle) !== norm(e.title)) {
    failures.push({ url: e.url, why: `title drifted\n      live: ${e.title}\n      built: ${gotTitle}` });
  }
  if (e.description && norm(gotDesc) !== norm(e.description)) {
    failures.push({ url: e.url, why: `description drifted\n      live: ${e.description}\n      built: ${gotDesc}` });
  }

  // Truncation is worth knowing about, but it is not a failure: these lengths
  // are the live site's and section 7 says to keep them until rankings settle.
  if (e.title.length > 60) notes.push(`${e.url} title is ${e.title.length} chars, will truncate in a result`);
  if (e.description && e.description.length > 160) {
    notes.push(`${e.url} description is ${e.description.length} chars, will truncate in a result`);
  }
}

console.log(`\n${BOLD}Title and description drift${OFF} ${DIM}(CLAUDE.md section 7)${OFF}`);
console.log(`${DIM}${'─'.repeat(72)}${OFF}`);

if (failures.length) {
  console.log(`\n${RED}${BOLD}FAIL${OFF} ${failures.length} pages no longer match the live site:\n`);
  for (const f of failures) console.log(`  ${RED}✗${OFF} ${f.url}\n    ${DIM}${f.why}${OFF}`);
  console.log(`\n${RED}Changing a title at cutover is changing what Google uses to identify${OFF}`);
  console.log(`${RED}the page. Update content-source/ in a deliberate, separate release.${OFF}\n`);
  process.exit(1);
}

console.log(`${GREEN}✓${OFF} ${checkable.length} pages carry the live title and description, character for character`);
for (const n of notes) console.log(`${YELLOW}note${OFF}  ${n} ${DIM}(the live site's own length; improve after rankings settle)${OFF}`);
console.log();
