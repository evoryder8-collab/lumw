/**
 * Real modification dates for the sitemap.
 *
 * The sitemap was stamping every URL with the build date, so all 25 pages
 * claimed to have changed every time anything deployed. Google treats lastmod
 * as a hint it can stop trusting, and a file that cries wolf on every push is
 * how it stops trusting it. A date that is wrong is worse than no date.
 *
 * The honest answer is the last time the page's own sources changed, which git
 * already knows. Falls back to the build date when git is unavailable or the
 * history is too shallow to answer - a wrong-but-recent date is still better
 * than omitting the field, and CI fetches full history so the fallback should
 * not fire there.
 */
import { execFileSync } from 'node:child_process';

/** The sources whose content actually decides what a page renders. */
const SOURCES: Record<string, string[]> = {
  '/': ['src/pages/index.astro', 'src/content/treatments.json'],
  '/about': ['src/pages/about.astro'],
  '/contact': ['src/pages/contact.astro'],
  '/meineangebote-preise': ['src/pages/meineangebote-preise.astro', 'src/content/treatments.json'],
  '/massage-buxtehude-faq': ['src/pages/massage-buxtehude-faq.astro', 'src/content/faq.json'],
  '/nutzungsbedingungen': ['src/pages/[legal].astro', 'src/content/legal'],
  '/datenschutzrichtlinie': ['src/pages/[legal].astro', 'src/content/legal'],
};

/** Every service page is rendered from one template and one data file. */
const SERVICE_SOURCES = ['src/pages/service-page/[slug].astro', 'src/content/services.json'];

const BUILD_DATE = new Date().toISOString().slice(0, 10);

/** Newest commit date across a set of paths, as YYYY-MM-DD. */
function lastCommit(paths: string[]): string | null {
  try {
    const out = execFileSync(
      'git',
      ['log', '-1', '--format=%cI', '--', ...paths],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return out ? out.slice(0, 10) : null;
  } catch {
    return null;
  }
}

const cache = new Map<string, string>();

export function lastmodFor(path: string): string {
  const cached = cache.get(path);
  if (cached) return cached;

  const sources = path.startsWith('/service-page/') ? SERVICE_SOURCES : SOURCES[path];
  const date = (sources && lastCommit(sources)) || BUILD_DATE;

  cache.set(path, date);
  return date;
}
