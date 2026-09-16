# LUMA Wellness

Astro 5 and Tailwind 4. Static output deployed to GitHub Pages. `main` publishes
[staging](https://evoryder8-collab.github.io/lumw/). The production domain remains
on Wix until the owner completes the cutover procedure in `CLAUDE.md`.

## Verify before every commit

```sh
npm ci
PUBLIC_BASE=/lumw PUBLIC_INDEXABLE=false npm run verify
npm run check:browser
npm run check:performance
```

`verify` builds 51 pages and checks the original 25 URLs, German titles,
descriptions, H1s and paragraphs, JSON-LD, text contrast, six-language links,
sitemaps, assets, noindex, visible punctuation and compressed JavaScript size.

`check:browser` starts its own preview and checks real visitor journeys, video
playback, price animation, gallery controls, the enquiry composer, keyboard
navigation, four viewport widths, reduced motion and JavaScript disabled. It
also runs axe on eight representative pages. Install the browser first with
`npx playwright install --with-deps chromium`; local macOS checks use Chrome.

`check:performance` measures four mobile scenarios with cold browser contexts.
Budgets: performance 95, LCP 2.5 seconds, CLS 0.02 and blocking time 200 ms.
CI uses the median of three runs. Reports, screenshots and host load are written
to ignored `artifacts/`. Video transfer after the visitor presses play is not
part of the initial page-loading budget.

## Visitor experience

- The first homepage visit in a tab opens the language portal, then asks about
  sound. The affirmative tap starts the introduction with audio. Declining
  starts muted, or leaves it paused under reduced motion. Browser playback
  restrictions fall back to an explicit play button.
- Sound and welcome choices live only in session storage, with an in-memory
  fallback if storage is blocked. Returning to the page does not restart audio.
- The other four films have native controls and load only on playback. Starting
  one film pauses the others; navigating away pauses all of them.
- Prices count up once as they enter view, then glow once. The accessible text
  always contains the final amount. Reduced motion and no-JavaScript views
  show prices immediately.
- Contact is an enquiry composer. It prepares an accurate WhatsApp or email
  message for the visitor to send. It does not claim a reserved appointment.
- Three short Google review excerpts link to their original reviews. The
  rating is a dated, manually verified snapshot, not an automatic live feed.
- Their horizontal cards make a small, once-only preview movement on entry.
  Touch or keyboard input cancels it, and reduced motion disables it.
- June's portrait greeting appears after 20 seconds of visible homepage time
  after the welcome choices. It offers the translated enquiry link, never
  takes focus, and can be dismissed for the session.

## Native link-in-bio

`/linkinbio` uses the same design system and the supplied introduction. It
tries audible inline autoplay, falls back to muted playback if rejected, and
respects a previously declined sound choice. The sound control stays visible.
Reduced motion leaves it paused. Both browser permission outcomes are tested;
an actual Instagram device check remains an owner task before changing the bio.

Every TapLink action is present, including the current social profiles and a
native downloadable contact card at `/june-saurin.vcf`. The production canonical
is `https://www.luma-wellness.com/linkinbio`; staging uses `/lumw/linkinbio`.
The platform-tinted glass buttons have a slow travelling gleam, viewport
reveals and touch feedback. The Contact map is shared here, including its
Google Maps / Apple Maps chooser and no-JavaScript directions links.

## Content and structure

| Location | Purpose |
|---|---|
| `src/content/` | Preserved German services, treatments, FAQs and legal text |
| `src/i18n/` | Five translated core-page sets and route correspondence |
| `src/data/expected-urls.json` | Original 25 migration paths |
| `src/data/migration-content-baseline.json` | German H1 and paragraph regression baseline |
| `src/data/google-reviews.json` | Verified review excerpts and source links |
| `src/styles/liquid-glass.css` | Shared materials and composition |
| `src/scripts/experience.ts` | Interaction setup and navigation cleanup |
| `src/scripts/welcome.ts` | Language, sound consent and playback |
| `src/scripts/prices.ts` | Scroll-triggered price animation |
| `docs/media-sources.md` | Photo, video, flag and review provenance |

German service details and legal pages remain in German. All five core pages
are available in English, Thai, Spanish, Portuguese and Italian. Translated
catalogues identify links to the full original German descriptions.

## URL preservation and staging

Astro emits flat files, so `/about` resolves at 200 on GitHub Pages. Small
`/about/index.html` aliases support trailing-slash visitors. Umlaut paths stay
NFC-normalized. Internal links and media honor `/lumw`; canonicals retain
`https://www.luma-wellness.com`.

Staging is always `noindex, nofollow`. Do not change DNS, the indexing flag or
production canonicals as part of ordinary staging design work. Pricing
conflicts and the remaining production gates are recorded in `roadmap.md`.
