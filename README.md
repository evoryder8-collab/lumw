# luma-wellness.com

Hand-built replacement for the Wix site at www.luma-wellness.com. Astro 5,
Tailwind 4, static output, deployed to GitHub Pages.

The live site ranks top 3 for "massage buxtehude" and number 1 on Google Maps.
**Ranking preservation outranks every other concern, including design.**

## The one rule

All 25 live URLs must resolve byte-identically. GitHub Pages cannot issue a
single 301, so the migration works by never changing a URL. Four of the 25
contain non-ASCII characters (`schröpfkopf` ×2, `rücken`, `fuß`) and must be
emitted composed (NFC) or they 404 on Linux while looking correct on macOS.

`npm run build` runs that check and fails the build if any path is missing,
empty, decomposed, or has lost its canonical.

```bash
npm run build
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Build **and** run the 25-URL migration check |
| `npm run check:urls` | The migration guard on its own |
| `npm run check:jsonld` | Expand and validate the JSON-LD on every page |
| `npm run check:contrast` | Contrast against the aurora wash's extreme states |
| `npm run assets` | Regenerate `src/assets` from the original photo export |
| `npm run verify` | Build plus every check |

## Staging and cutover

Every page ships `noindex` and `robots.txt` disallows everything. This is
deliberate: the cutover protocol builds staging noindex and lifts it in the
same release that points DNS at Pages.

To go live, set `PUBLIC_INDEXABLE: 'true'` in `.github/workflows/deploy.yml`
**in the same release as the DNS change**, never before.

## Content

Copy is pasted verbatim from `content-source/luma-wellness-copy.md` and never
paraphrased. The live site has a list of known inconsistencies (a "60min."
service configured as 90 minutes, contradictory Thai prices, `UBER MICH`
without its umlaut, an Australian Privacy Act clause on a German privacy page).
**These are deliberately not fixed at cutover** — they get corrected one at a
time once rankings have settled.

| Where | What |
|---|---|
| `src/content/services.json` | The 18 Wix Bookings entries behind `/service-page/` |
| `src/content/treatments.json` | The 9 sections on `/meineangebote-preise` |
| `src/content/faq.json` | The 11 FAQ entries, feeding the page and `FAQPage` |
| `src/content/legal/*.md` | Nutzungsbedingungen and Datenschutzrichtlinie |
| `src/data/expected-urls.json` | The 25 URLs. The authority for the sitemap and the guard. |
| `src/lib/site.ts` | NAP, hours, June's award record |

### Photography

The filenames in `june website media/` are keyword-stuffed for SEO and **do not
describe what is in the pictures**. `thai-massage-buxtehude v2.webp` is June's
portrait; `massage.webp` is the Google Reviews logo. `scripts/prepare-assets.mjs`
holds the real mapping, established by looking at every image, plus the tone
lift that brings the darker frames into the light design register. Never pick an
image by its filename.

## Design

The visual contract is section 9 of the build spec: warm porcelain under a
low-chroma aurora wash, Fraunces at light weights, gold as the only accent
metal. Fonts are self-hosted variable WOFF2 — never the Google CDN, which
German courts have ruled transmits visitor IPs without consent.

One deviation, enforced by `check:contrast`: the spec names `#b8934e` as gold
"for text and lines", but it measures 2.68:1 on porcelain and clears neither AA
nor AA-large. It keeps every non-text job; a darker step on the same hue
(`--gold-text`, 4.90:1) carries the text. The check lints for regressions.

## Not built yet

Stages 4 to 10 of the build order: Supabase schema, Edge Functions and the
booking island, the GSAP motion layer, Impressum, locales, location pages, and
the cutover itself. The contact form is inert until the booking backend lands
and says so on the page.
