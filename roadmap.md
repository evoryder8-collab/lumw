# LUMA: the new website and native link-in-bio

Revised 16 September 2026. The design is built around June's photography,
editorial type, deep forest green, warm porcelain and sculpted liquid glass.
This roadmap incorporates the owner's later requests for sound onboarding,
animated prices, Google reviews and a native Instagram landing page.

## Release principles

- Preserve all 25 original German URLs, metadata and substantive paragraphs.
  The owner requested the international-awards homepage H1 on 16 September 2026.
- Never invent reviews, prices, awards or appointment availability.
- No em dashes in visible or accessible text.
- Real flags, realistic gold, silver and bronze medal artwork, locally hosted media and fonts.
- Native touch scrolling, keyboard controls and a complete reduced-motion view.
- Staging remains noindex. Run `npm run verify` before every commit.

## Phase 0: working foundations

- [x] Five core pages in each of English, Thai, Spanish, Portuguese and Italian.
  Translated navigation, corresponding routes, reciprocal hreflang and sitemaps.
- [x] Replace the disabled contact form with an appointment-enquiry composer.
  The visitor sends through WhatsApp or email. June confirms availability.
- [x] Preserve German migration copy and automatically check built destinations,
  image sources, locale coverage, punctuation and compressed JavaScript.
- [x] Keep the original German service details and legal pages accessible.

## Phase 1: a new first impression

- [x] An animated language portal with actual flags, moving gradients, depth,
  fine glass edges and keyboard navigation.
- [x] A simple sound question after the first language choice. The Yes tap
  starts the introduction with sound; No starts muted, except under reduced
  motion. A visible play control handles browsers that decline playback.
- [x] The supplied introduction at the top of every homepage in a glass frame.
- [x] A floating circular winner portrait, an international-awards headline,
  oversized editorial type, sculpted navigation and a redesigned footer.
- [x] A larger forest-green awards ribbon with generated gold, silver and bronze
  placement medals. The archived award record remains the source of truth.

## Phase 2: depth throughout the website

- [x] Editorial treatment stories, a dark portrait feature, eight supplied
  gallery photographs, full-frame viewing and five additional original films.
  The supplied 2026 awards film leads the homepage collection and joins the
  passion film on About. The new Penzberg group photograph illustrates the
  championship story on all six About pages.
- [x] Three verified Google Maps review excerpts in horizontal glass cards.
  Author attribution, individual source links, an explicit Maps icon and label,
  and a dated rating snapshot. No invented testimonials or review schema.
- [x] A gentle, once-only horizontal review nudge previews scrolling on entry.
  Visitor input cancels it immediately; reduced motion leaves the cards still.
  Horizontal film collections use the same hint.
- [x] The mobile photo gallery uses the same once-only horizontal hint.
- [x] Redesigned treatment cards, a signature treatment, a useful index,
  clear prices and accessible full descriptions.
- [x] Matching About, FAQ, Contact, service-detail and translated pages.
- [x] Selected treatments carry through to the enquiry composer.

## Phase 3: motion and personal connection

- [x] Prices count up quickly on first reveal and finish with one glow.
  Screen readers and reduced-motion visitors receive the actual amount at once.
- [x] Page transitions, pointer reflections, restrained review-card depth,
  button feedback and ambient gleams, with cleanup during navigation.
- [x] The `/linkinbio` page shares LUMA's materials and typography. It contains
  every original TapLink action, a downloadable contact card, telephone,
  treatments and the Contact page's detailed map with Google Maps / Apple Maps
  directions. Each action has a platform tint, frosted glass depth, a moving
  gleam, scroll reveal and touch feedback.
- [x] A clearly framed original LUMA symbol in the header, portal, footer and
  native link page. Its empty source margins no longer shrink the actual mark.
- [x] A personal greeting with the ninth supplied portrait after 20 seconds
  of visible homepage time. Animated text and booking action, six languages,
  dismissible, once per session, with no focus theft or welcome interruption.
- [x] Link-in-bio playback tries audible autoplay and falls back to muted if
  rejected. A previous No is respected. It stays inline in its glass card.
  Reduced motion leaves the film paused. No language or sound gate on this page.
- [x] Instagram and Facebook destinations match the current public TapLink.
- [x] A persistent round Instagram, Facebook and WhatsApp dock uses vivid brand
  colors, frosted surfaces, glints and tap feedback. It clears open menus and
  dialogs. Native link buttons share those richer colors.
- [x] A clearer local street map identifies Hauptstraße 19, nearby streets,
  north and the studio, with explicit Google Maps access and the route chooser.

## Phase 4: reproducible evidence and release

The release pipeline builds the selected staging or production artifact, runs browser journeys,
checks accessibility, measures mobile performance and keeps its reports.

- Browser coverage: all 51 canonical URLs; twelve representative pages at
  360, 390, 768 and 1440 pixels; keyboard, history, reduced motion and no JS.
- Playback coverage: language then sound, audible Yes, muted No, navigation
  cleanup, and both allowed and blocked autoplay policies on `/linkinbio`.
- Performance release budgets: score at least 95, LCP at most 2.5 seconds,
  CLS at most 0.02, blocking time at most 200 ms. Use cold contexts and record
  host load. CI uses the median of three runs. The earlier 1.5-second LCP is
  retained as a stretch target, not reported as an achieved result.
- JavaScript: below 100 KiB gzip overall and 60 KiB for the deferred motion layer.
- Release sequence: verify, commit, push main, require successful CI deployment,
  then inspect the production URLs and media. Follow the authorized DNS
  migration in `docs/cutover.md`.

## Phase 5: production decisions and later growth

1. June confirms conflicting prices, actual availability and the Supabase
   project before a real calendar is built. Enforce overlap prevention in the
   database, RLS, rate limiting, confirmation email, DST and concurrent booking
   tests. The enquiry composer is the usable contact path in this release.
2. Native review of translations and owner review of legal identity, Impressum,
   privacy processors and archived medical claims remain ongoing editorial work.
3. The owner authorized domain cutover and the Wix to Infomaniak transfer on
   16 September 2026. The fresh 25-page metadata archive is checked in. Follow
   `docs/cutover.md` for DNS, HTTPS, Search Console and rollback status.
4. Recheck the dated Google review snapshot periodically against its source.
   A live feed requires an explicitly selected provider or Google API project.
5. Verify the link-in-bio experience in the owner's actual Instagram app before
   changing that profile link. Browser permission tests do not emulate its OS.
6. Plan the Astro, sharp and JSON-LD major-version maintenance updates separately.
7. One useful location page with verified local information and original photos;
   wait for four weeks of indexing evidence before expanding.
8. Choose analytics deliberately, then update privacy text for actual processors.
9. Revisit frozen German metadata after the migration has settled.

## Ownership in the code

- `src/i18n/`: translations and route correspondence.
- `src/styles/liquid-glass.css`: shared materials and composition.
- `src/pages/linkinbio.astro`, `src/styles/linkinbio.css`: Instagram destination.
- `src/scripts/experience.ts`: small interactions and navigation cleanup.
- `src/scripts/welcome.ts`: language, sound and film playback.
- `src/data/google-reviews.json`: verified excerpts and source links.
- `docs/media-sources.md`: supplied media and external asset provenance.
- `scripts/check-experience.mjs`, `browser-smoke.mjs`, `check-performance.mjs`:
  rendered-output, visitor-journey and performance checks.
