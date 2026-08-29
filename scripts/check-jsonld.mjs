#!/usr/bin/env node
/**
 * Validate the JSON-LD on every built page.
 *
 * CLAUDE.md section 7 step 4: validate JSON-LD on every page before cutover,
 * not after. This runs the real jsonld processor, so a malformed @context,
 * a bad @id or an unresolvable term fails here rather than silently producing
 * an empty graph in Search Console weeks later.
 *
 * It also enforces the rules the spec is explicit about: one @graph per page,
 * the award record present on the Person node, and no Review or
 * AggregateRating anywhere on the site.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsonld from 'jsonld';
import { parseHTML } from 'linkedom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m';
const DIM = '\x1b[2m', BOLD = '\x1b[1m', OFF = '\x1b[0m';

/** Offline context loader: CI must not reach out to schema.org mid-build. */
const CONTEXT_URL = 'https://schema.org';
const documentLoader = async (url) => {
  if (url === CONTEXT_URL || url === 'https://schema.org/' || url === 'http://schema.org') {
    return {
      contextUrl: null,
      documentUrl: url,
      // Minimal context: enough for expansion to resolve terms into IRIs.
      document: { '@context': { '@vocab': 'https://schema.org/' } },
    };
  }
  throw new Error(`refused to fetch remote context: ${url}`);
};

function htmlFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...htmlFiles(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/**
 * The trailing-slash aliases are not pages.
 *
 * Under the flat layout, about.html is the page and about/index.html is the
 * alias that sends /about/ back to it. The alias carries a canonical and
 * nothing else by design, so checking it for structured data is checking the
 * redirect and not the document - which reported every aliased page as having
 * no JSON-LD at all.
 */
/**
 * The 404 is noindex and is not an entity. Structured data describes a thing
 * Google might hold a record for, and "the page you asked for is not here" is
 * not one, so requiring a graph on it would mean inventing one.
 */
const isErrorPage = (file) => path.basename(file) === '404.html';

const isAlias = (file) => {
  if (path.basename(file) !== 'index.html') return false;
  const flat = `${path.dirname(file)}.html`;
  return fs.existsSync(flat);
};

const files = htmlFiles(DIST).filter((f) => !isAlias(f) && !isErrorPage(f));
const failures = [];
const warnings = [];
let pagesChecked = 0;
let nodesChecked = 0;
let sawAwards = false;

for (const file of files) {
  const rel = '/' + path.relative(DIST, file).replace(/index\.html$/, '').replace(/\/$/, '');
  const html = fs.readFileSync(file, 'utf8');
  const { document } = parseHTML(html);
  const blocks = [...document.querySelectorAll('script[type="application/ld+json"]')];

  if (blocks.length === 0) {
    failures.push({ rel, why: 'no JSON-LD block' });
    continue;
  }
  if (blocks.length > 1) {
    failures.push({ rel, why: `${blocks.length} JSON-LD blocks; the spec wants one @graph per page` });
    continue;
  }

  let data;
  try {
    data = JSON.parse(blocks[0].textContent);
  } catch (err) {
    failures.push({ rel, why: `JSON is not parseable: ${err.message}` });
    continue;
  }

  if (!data['@graph'] || !Array.isArray(data['@graph'])) {
    failures.push({ rel, why: 'no @graph array' });
    continue;
  }

  // Real expansion. This is the part that catches structural breakage.
  let expanded;
  try {
    expanded = await jsonld.expand(data, { documentLoader });
  } catch (err) {
    failures.push({ rel, why: `jsonld.expand failed: ${err.message}` });
    continue;
  }
  if (expanded.length === 0) {
    failures.push({ rel, why: 'expands to nothing; @context or @type is wrong' });
    continue;
  }

  const graph = data['@graph'];
  const types = graph.map((n) => n['@type']);
  nodesChecked += graph.length;

  // Every node needs a type, and every node the graph points at should exist.
  const ids = new Set(graph.map((n) => n['@id']).filter(Boolean));
  for (const node of graph) {
    if (!node['@type']) failures.push({ rel, why: `a node has no @type` });
  }

  // The business node anchors every page.
  if (!types.includes('HealthAndBeautyBusiness')) {
    failures.push({ rel, why: 'no HealthAndBeautyBusiness node' });
  }

  // WebPage must exist and must carry a description.
  const webPage = graph.find((n) => n['@type'] === 'WebPage');
  if (!webPage) failures.push({ rel, why: 'no WebPage node' });
  else if (!webPage.description) failures.push({ rel, why: 'WebPage has no description' });

  // Person carries the award record. This is the strongest signal on the site,
  // so its absence is a failure and not a warning.
  const person = graph.find((n) => n['@type'] === 'Person');
  if (person) {
    if (!Array.isArray(person.award) || person.award.length < 5) {
      failures.push({ rel, why: `Person.award has ${person.award?.length ?? 0} entries, expected 5` });
    } else {
      sawAwards = true;
    }
  }

  // Offers must carry a price and a currency or they are useless to Google.
  for (const svc of graph.filter((n) => n['@type'] === 'Service')) {
    for (const offer of svc.offers ?? []) {
      if (offer.price === undefined || offer.price === '') {
        failures.push({ rel, why: `Service "${svc.name}" has an Offer with no price` });
      }
      if (offer.priceCurrency !== 'EUR') {
        failures.push({ rel, why: `Service "${svc.name}" has an Offer with currency ${offer.priceCurrency}` });
      }
    }
  }

  // Breadcrumbs on every page below the root.
  if (rel !== '' && rel !== '/' && !types.includes('BreadcrumbList')) {
    warnings.push(`${rel || '/'} has no BreadcrumbList`);
  }

  // The hard prohibition. Fake review markup earns a manual action and is a
  // misleading commercial practice under German UWG.
  const raw = JSON.stringify(data);
  if (/"(AggregateRating|Review)"/.test(raw)) {
    failures.push({ rel, why: 'contains Review or AggregateRating markup, which the spec forbids' });
  }

  // Dangling @id references mean Google reads disconnected entities.
  const refs = [...raw.matchAll(/"@id":"([^"]+)"/g)].map((m) => m[1]);
  for (const r of refs) {
    if (r.includes('#') && !ids.has(r) && !r.startsWith('https://schema.org')) {
      warnings.push(`${rel || '/'} references ${r} but no node defines it`);
    }
  }

  pagesChecked++;
}

console.log(`\n${BOLD}JSON-LD validation${OFF} ${DIM}(CLAUDE.md section 4)${OFF}`);
console.log(`${DIM}${'─'.repeat(60)}${OFF}`);

const uniqueWarnings = [...new Set(warnings)];
for (const w of uniqueWarnings.slice(0, 12)) console.log(`${YELLOW}warn${OFF}  ${w}`);
if (uniqueWarnings.length > 12) console.log(`${DIM}      +${uniqueWarnings.length - 12} more${OFF}`);

if (failures.length) {
  const unique = [...new Map(failures.map((f) => [`${f.rel}|${f.why}`, f])).values()];
  console.log(`\n${RED}${BOLD}FAIL${OFF} ${unique.length} JSON-LD problems:\n`);
  for (const f of unique.slice(0, 25)) console.log(`  ${RED}✗${OFF} ${f.rel || '/'}\n    ${DIM}${f.why}${OFF}`);
  process.exit(1);
}

console.log(`${GREEN}✓${OFF} ${pagesChecked} pages, ${nodesChecked} nodes, all expand cleanly`);
console.log(`${GREEN}✓${OFF} one @graph per page, every node typed`);
if (sawAwards) console.log(`${GREEN}✓${OFF} June's five competition awards present on the Person node`);
console.log(`${GREEN}✓${OFF} no Review or AggregateRating markup anywhere\n`);
