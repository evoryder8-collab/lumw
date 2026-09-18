# Repair notes

Things that were broken, how they were found, why they broke, and what keeps
them from breaking again. Read this before touching the area it names. Most of
these looked fine in the source and were only visible in the built output or in
a real browser ; which is the point of recording them.

Format: **what** · *how it was found* · why · guard.

## 18 September: editorial, awards and welcome experience

**Popup scroll restoration must not wait for the native close event.** CI's
Chromium caught `body.overflow` still hidden immediately after closing a
treatment dialog. Native close events are queued and can arrive after a rapid
reopen. Close, Escape and backdrop actions now release the scroll lock and
return focus synchronously. A queued close event cannot unlock an already
reopened dialog. Browser checks include repeated keyboard open/close cycles.

**The refined entrance initially missed the mobile LCP budget.** The first
three-run median was 2.635 seconds. The new wordmark needed the body font early,
and a treatment photograph far below the introduction was still eager. Both
font faces now preload, the Hanken derivative retains only the used weights,
the introduction poster is smaller, and lower treatment images stay lazy.
Three new cold measurements put welcome and returning-home medians at 2.258
and 2.259 seconds, both scoring 98 with zero CLS and blocking time. The original
1080p film and winner portrait are unchanged. No performance budget was relaxed.

**The award list lost the category behind each placement.** It used Roman
numerals for lower placements and a German Swiss title on translated pages.
The owner supplied the correct six-entry record. `src/lib/awards.ts` now feeds
the ribbon, About and schema. Browser and build checks verify the category,
placement and English event name. Best Massage Photo is distinct from massage
competition credentials, and its 2023 photograph has a separate 2026 award story.

**The owner requested a full editorial rewrite.** This supersedes the original
paragraph freeze for public editorial pages. The migration archive remains
untouched. Original URLs, SEO metadata, prices, service names, durations and
legal texts remain guarded, including a separate commercial-facts snapshot.
Repeated slogans, redundant video labels and unsupported health promises were
removed. The malformed historical Luka quotation was omitted rather than
rewritten as a new testimonial; the verified Google excerpts are unchanged.
Conservative massage-health wording was checked against
[NCCIH's massage overview](https://www.nccih.nih.gov/health/massage-therapy-what-you-need-to-know).

**Translated treatment cards sent visitors to German details.** More info now
opens a native dialog containing the selected language's full description.
The close button is at the upper left. Escape, focus return and the selected
treatment's booking link work without leaving the page to read. The original
details element provides an in-place fallback without JavaScript.

**The sound question belongs over the language portal, before the curtains.**
Both dialogs remain stacked until Yes or No. The answer calls `play()` inside
the original gesture, then opens the curtains. Scroll locking is idempotent
across the stacked dialogs. Completion and the delayed greeting start after
the reveal. Timers, frames, media and dialogs are cleaned up during navigation.
Reduced motion skips the curtains; an explicit No keeps audio muted.

**The brand and portal carried unnecessary frames.** The shared mark now has
no surrounding rectangle, and its gold shine is masked to the original shape.
The portal uses finer bevels, a smaller typographic hierarchy and real flags,
with no decorative corner brackets or repeated welcome text.

**Portrait petals must stay bounded and respect the device.** `lotus.ts` uses
at most 32 particles, a capped settled pile and a small 30 fps canvas. It pauses
offscreen and when hidden, handles reduced-motion changes, and tears down on
navigation. Tap always provides the scatter action. Motion permission is
requested only from that tap on platforms that require it. Synthetic browser
tests cover allowed, denied and unavailable permission; these do not substitute
for testing physical motion on an iPhone. API reference:
[Device Orientation and Motion](https://w3c.github.io/deviceorientation/).

## September interaction refinements

**Enabling sound could leave a blocked video paused.** The sound control used
to change only `muted`. It now calls `play()` in the same user gesture and
restores a positive volume. A denied autoplay has a localized Play with sound
control, and an explicit No remains respected. Browser coverage includes
audible consent, a paused zero-volume player, and denial of both autoplay
attempts followed by a successful tap.

**Gallery scrolling needed the same hint as reviews.** Both now share a small
once-only scroll preview. It runs only when there is horizontal overflow,
yields to visitor input, and skips reduced motion. Tests observe actual
horizontal movement and the return to the first photograph on mobile.

**The prose archive omitted service metadata.** A fresh crawl before cutover
found all 18 service descriptions differed from live Wix. They are restored
from the 16 September archive and all 25 original titles and descriptions are
now checked. The checker decodes and NFC-normalizes umlaut filenames.

**The first treatment photo was lazy despite being visible at page entry.**
CI mobile Lighthouse identified the first Aroma-Luxus card as the largest
contentful element. Its median paint arrived at 2.541 seconds, just beyond the
2.5-second budget. German and translated treatment pages now preload the exact
responsive candidate and mark only the first card eager with high priority.
The remaining cards stay lazy. The release budget is unchanged.

**A skipped page animation raised an unhandled AbortError in Chromium 153.**
The CI journeys finished but correctly failed their browser-error gate. A
focused reproduction cancelled the native transition during `astro:before-swap`
and confirmed that the DOM still reached Contact. Astro 5 observes the update
and completion promises, but not the animation's `ready` promise. The shared
lifecycle now observes that promise and acknowledges only native AbortError
cancellation. Other errors remain visible. The browser suite explicitly
cancels a transition and can use the CI browser locally with
`LUMA_BROWSER_CHANNEL=bundled npm run check:browser`.
References: [native transition readiness](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition/ready)
and [Astro lifecycle events](https://docs.astro.build/en/guides/view-transitions/#astrobefore-swap).

**The LUMA symbol was much smaller than its image element.** The source has
large transparent margins. A shared `BrandMark` frames the actual painted
area on an opaque light badge without changing the original shape. Headers,
portal, footer and link-in-bio now use the same component.

**Map directions stopped working after a client-side page transition.**
The old component script ran once against the initial document. Directions
now mount with the shared experience lifecycle on every new body. A native
dialog provides focus containment and Escape handling, with plain directions
links when JavaScript is disabled. Browser checks cover link-in-bio to Contact.

**Hints must yield to the visitor.** The review nudge runs once and cancels
on touch, keyboard or horizontal wheel input. The delayed greeting counts
visible homepage time only after the welcome choices, pauses for modals and
the menu, and does not steal focus. Both honour reduced motion and clean up
on navigation. The greeting has a session dismissal guard.

---

## URLs and the migration

**`/about` 301'd to `/about/`, opposite to the live site.**
*Found by curling the staging deploy.* `build.format: 'directory'` emits
`about/index.html`, and GitHub Pages redirects the bare path to the slash form.
Wix does the reverse ; serves `/about` at 200, 301s `/about/` back. Every one of
the 25 indexed URLs would have started redirecting on cutover day, and
`/about/` was serving 200 with a canonical pointing at a URL that redirected
back to it. Fixed with `format: 'file'` in `astro.config.mjs`.
Guard: `check-urls` prints which layout was built and passes only on flat files.
Note that CLAUDE.md §7 literally asks for `/path/index.html` ; that line assumed
a host that serves it at `/path` without redirecting, which Pages does not. The
section's stated intent (byte-identical paths) wins over its stated mechanism.

**`/about/` then 404'd.**
Flat files have nothing at the slash form. `scripts/trailing-slash-aliases.mjs`
writes a small document there with the real URL as canonical and a zero-delay
refresh. The hop is relative (`../about`) so it resolves correctly under both
`/lumw` on staging and the root in production; root-absolute 404'd on staging.
Not `noindex` ; a page saying "don't index me" and "the real one is over there"
gives two instructions. Guard: runs inside `npm run build`.

**Both checkers read the alias instead of the page.**
`check-urls` and `check-jsonld` walked `dist/` and found `about/index.html`
(the 400-byte alias) before `about.html`. One reported the redirect as the
page; the other reported every aliased page as having no JSON-LD. Both now
prefer the flat file when it exists, and `check-jsonld` skips `404.html`.

**Umlaut slugs and NFD.** macOS writes filenames decomposed; the web serves
them composed; Linux (the CI runner and Pages) treats them as different bytes.
`check-urls` compares emitted route bytes to NFC and fails on a decomposed
name with "would 404 on Linux". It reads routes, not directories, so it still
catches this under the flat layout where the umlaut is in a filename.

**`PUBLIC_BASE` must be `/lumw` on staging.** Without it every `_astro/` asset
is root-absolute and 404s while the HTML returns 200 ; which looks exactly like
"the site has no photos". Set in `deploy.yml`. Flip to `/` in the same release
that points DNS.

---

## Titles, descriptions, copy

**A meta description had been edited.**
*Found the first time `check-titles` ran.* The pass that removed "Behandlung"
from the visible copy also changed the prices page description from
"Wellnessbehandlungen" to "Wellnessmassagen". §7 keeps titles and descriptions
identical at cutover. Restored, with a comment above it explaining why the word
is there so it does not get helpfully fixed again.
Guard: `scripts/check-titles.mjs` diffs every built title and description
against `content-source/luma-wellness-copy.md`, character for character, and
fails the build on drift. Runs in `verify` and in CI.

**Two titles and four descriptions exceed SERP length.** Those are the live
site's own lengths. The checker reports them as notes and does not fail.
Shorten them post-cutover, one page at a time, never with a URL change.

**Eight of nine treatment names carried a leading `| `.** A Wix layout
separator captured by the scrape. Stripped at two render sites by a duplicated
regex; a third copy would have shipped structured data advertising
"| STARK BALL MASSAGE". Now one helper: `treatmentName()` in `src/lib/site.ts`.

**Image filenames do not describe the images.** They were renamed for SEO.
`award-competition-gold.webp` is June *working* at a competition, not holding
a medal. Every crop decision in this build was made by rendering the candidate
and looking at it. Never choose a crop or an alt text from a filename.

---

## Images

**The nine card photographs were nine different shapes.**
*Found by measuring each card's `<img>` in the browser.* Aspect ratios from
0.67 to 1.91, several carrying a soft alpha vignette baked into the file, all
jammed into one `16/11` box with a centred cover crop. Portraits kept a narrow
band; opaque ones ended in a hard edge; `june-with-nadine-stark` (mean alpha
0.15) was two tiny heads adrift in an empty card.
Fix: `scripts/normalize-cards.mjs` (`npm run cards`) trims each file back to
its solid core, flattens it opaque, and cover-crops to one ratio per context ;
7:6 for cards, the page's own 3:2 / 2:3 for the About gallery, 16:9 for the
full-bleed chapters. One CSS mask then owns the fade for every card.
Re-run it whenever a source photograph changes.

**The full-bleed chapters were the worst case.** A transparent edge over a
100vw × 100svh element lets the page background through. All six chapters now
use the opaque 16:9 crops.

**`sharp.strategy.attention` picks the wrong subject in portraits.** It goes
for detail and contrast. It cut June out of her certificate photograph, reduced
the Nadine picture to two arms and a ball, and on the "gold" chapter found the
flower in her hair against a dark crowd. Gravity is named per image in the
script, with the reason next to each one.

**Images were being upscaled.** `treatment-cupping.webp` is 303px wide and was
requested at 900 ; softer *and* larger. `Photo.astro` and `heroPreload.ts` now
clamp requested widths to the source width. It mattered twice in the preload:
a width the `<picture>` will not offer is a second download.

**`<picture>` is `display: inline` with no height.** An `<img>` inside it
resolving `height: 100%` has nothing to measure against and falls back to
intrinsic size ; the chapter image rendered at 640×361 in a 562×702 box. Fixed
in `Photo.astro` with `.media picture { display: block; height: 100% }`.

**Astro `<Picture>` needs `fallbackFormat="webp"` and an explicit `width`**, or
it emits a PNG fallback and the original at intrinsic size ; half a megabyte
behind every picture that nothing downloads. Both set in `Photo.astro`.

**`sharp.tint()` desaturates to greyscale first.** It turned warm photographs
monochrome. `prepare-assets.mjs` uses `.recomb()` instead.

**Card alt text was being thrown away.** `treatments.json` carries written alt
for every treatment; the prices page passed `alt=""` over the top of it. Nine
photographs shipped invisible to image search. Now `t.data.imageAlt`.

---

## CSS

**`:global()` in a plain stylesheet is an invalid selector.**
*Found because a rule I added shipped literally as `:global(img)`.* It is Astro
scoped-style syntax; in `global.css` it means nothing. Worse, one invalid
selector invalidates its entire comma-separated group ; so a pre-existing
`.bleed :global(.media), .bleed .media` rule had been silently dead, and bled
media kept a full radius against the phone edge instead of losing its top
corners. Both fixed. `grep ':global(' src/styles/global.css` should return
only comments.

**The CTA pill's hover halo was swallowing clicks.**
*Found by `elementFromPoint` at the language button's centre returning
`a.pill`.* `.pill::before` is a blurred radial at `inset: -60%` ; on a 133px
pill that is ~80px past its edge on every side, and it was a pointer target
despite `opacity: 0` and `z-index: -1`. Every pill on the site was claiming an
invisible halo; the globe was just the first thing close enough to lose a click
to it. `pointer-events: none` on the pseudo-element, and `.lang-btn` carries
`position: relative; z-index: 2` besides.

**`backdrop-filter` makes an element the containing block for `position:
fixed` descendants.** The frosted header pill trapped the fixed nav inside
itself. Frost lives on `.glass::before` now, not on the container.

**A CSS keyframe animating `transform` beats an inline transform.** The
`.floatAnimation` on cards was overriding GSAP's writes. Float lives on an
inner element.

**Grid children default to `min-width: auto`.** Cards were 44px wider than
the phone. `min-width: 0` on grid items.

**`contain: strict` on viewport-sized layers cost 220ms of TBT.** Removed.

**Global `p { max-width: 68ch }`** left the portal's auto-message as a 343px
box at the left edge. Override where a paragraph is meant to be centred.

**SplitText's `.line-inner` mask clips descenders.** Padding-bottom on the
mask and a matching negative margin.

**The chapter section rendered twice.** A markup replacement left the old
`angebote.map(...)` block in place beside the new one; the counter read
"01 / 12". The old guard counted six chapter-media elements. The September redesign
uses an editorial grid and checks preservation of all six treatment texts.

---

## Motion

**The motion island boots late on purpose.** `MotionIsland.astro` waits for
the LCP paint, then `requestIdleCallback`. On a loaded machine that can be
several seconds. An empty `documentElement.className` right after load is
not a bug ; check again after `motion-ready` appears.

**Lenis hands its scroll callback the instance, not an event.** `ScrollCallback
= (lenis: Lenis) => void`. Destructuring `({ velocity })` works only because the
instance has that property. `initScrollVelocity` reads `instance.velocity` and
uses the unsubscribe that `on()` returns rather than passing the handler back
to `off()`.

**Scroll velocity is unverified in a browser.** The host sat at a load average
of 80–250 for the entire session; the pane accepted JS but refused trusted
input and eventually stopped compositing (blank screenshots while the DOM
reported content at opacity 1). Confirmed live: `has-scroll-velocity` is
applied, the three CSS consumers ship valid, and the handler subscribes to the
same event `ScrollTrigger.update` uses ; which demonstrably fires, since the
pinned chapters work. Not confirmed: the visual result. Scroll it on a quiet
machine before trusting it, and keep it under a third of a degree of skew.

**Lighthouse numbers taken under load are noise.** Identical builds scored 85
and 93 minutes apart at load 108. Record the load average next to every score,
and do not tune against a number taken above load 4.

**Historical motion choices:** the earlier build removed tilt and canvas grain.
The September 2026 owner brief explicitly requested depth. Review cards now
use restrained pointer tilt; touch and reduced-motion views stay static.
Canvas grain remains absent.

---

## Language portal

**It could not be reopened.** Pick once, stuck forever. A globe in the header
(`[data-portal-open]`) reopens it in `is-manual` mode: a close control appears,
the auto-forward countdown is suppressed, Escape works, and body scroll is
restored on every close. The reveal animations are restarted by stripping and
restoring `animation` on the staged elements, because CSS animations run once.

**Tiles must never point at an unbuilt locale.** Auto-continue once navigated
a visitor into a 404 without them touching anything. `available: boolean` in
`locales.ts` gates both the tiles and the guess; only `AVAILABLE` locales are
candidates. Five tiles read "in Kürze" until their pages exist.

**The portal is an overlay, not a page at `/`.** `/` must keep serving the
German home page byte-identically for crawlers. Do not turn the portal into a
route.

---

## SEO plumbing

**Sitemap `lastmod` was the build date on every URL.** All 25 pages claimed to
change on every deploy; Google learns to ignore a field that does that.
`src/lib/lastmod.ts` dates each URL from the last commit touching its sources.
CI checks out with `fetch-depth: 0` or every page would claim today.

**There was no 404 page.** Pages serves `dist/404.html`; without it a
mistyped URL on June's domain showed GitHub's error page. `src/pages/404.astro`
is `noindex` via a new per-page flag on `Layout` / `Meta` ; the flag can only
remove a page from the index, never put staging into one.

**The 18 service pages were seven islands.** Nothing linked across families.
Each now carries three treatments from other families, rotated from its own
position so the choice is stable and the links spread evenly. All 18 are
reachable from any one; 80 edges. Guard: the BFS in the commit that added it
is easy to re-run against `dist/service-page/`.

**Contact page was 55kB gzipped ; double every other page.** The inline map's
3,609 coordinates each carried a decimal in a 0–1000 space that renders a few
hundred pixels wide. Rounded to integers: identical geometry, 6kB less.

**The offer catalogue is built from `treatments.json`**, the same source the
prices page renders, so a price cannot be advertised in structured data that
the page does not show. Do not hand-write prices into the schema.

---

## Things that look like bugs and are not

- Card and chapter fields wrapped in `<label>` with no `for=` attribute are
  correctly labelled by implicit association.
- The enquiry form prepares a message for the visitor to send. It does not
  reserve a time. The earlier disabled form was replaced in September 2026.
- `about.html` and `about/index.html` both exist. The first is the page, the
  second is the alias. See above.
- Three variants of `june-with-nadine-stark` exist in `dist/_astro/`: the
  0.67 original (schema/social), 1.17 (card), 1.50 (About gallery) and 1.78
  (chapter). Each is used where its shape is right.
- The spec's stage 1 says Cloudflare Pages; the deploy is GitHub Pages. The
  GitHub Pages constraints (no 301s, `/lumw` prefix) are what shaped the URL
  work above.


## September 2026 redesign

**Astro scoped CSS beat the new global design rules.** The generated attribute
adds specificity. Shared overrides use the page scope where needed. Screenshots
and browser checks verify the resulting layout, rather than assuming a later
stylesheet wins.

**An invisible CTA halo expanded the mobile page.** `inset: -60%` still affected
scrollable overflow. A bounded 8px halo preserves the effect without a wider
footer. Grid tracks also use `minmax(0, 1fr)` for long German headings.
Guard: real document and body widths at four breakpoints.

**Double initialization reopened the welcome dialog.** An immediate script boot
and `astro:page-load` could both attach handlers. The interaction layer now
tracks the current body, aborts handlers before swaps and cleans up observers,
price animation frames and playback.

**Audible playback must begin inside the Yes click.** Calling `video.play()`
after awaiting a transition can lose mobile user activation. The sound handler
starts playback synchronously. Link-in-bio separately tries audible autoplay
and handles rejection with muted playback. Both permission outcomes are tested.

**`preload="none"` does not defer a video's poster.** Lower film posters were
competing with the hero on mobile. An intersection observer attaches them as
the section approaches. Native playback controls remain available without JS.
The intro poster remains immediately available.

**Font transfer was larger than the display design required.** A fixed optical
size retains Fraunces' character while reducing the display font to 35 KB.
The original file remains available. Hero preloads match the actual AVIF srcset.

**TapLink social destinations differed from the old site constants.** Reading
its public page data confirmed the current profiles. Shared social links now
match that source. The native contact download contains only business details.

**Reviews are a dated selection.** Keep the verification date, original author
and individual source link beside the original short excerpt. Google Maps is
identified by its current product pin and an explicit label. No live-fetch or
review-schema claim is made.

**Performance checks must use cold contexts.** Reusing the browser cache made
later measurements look better. Each Lighthouse run now uses a fresh isolated
context and resets storage, apart from a scripted welcome choice where that
scenario requires it. Record host load and retain reports. Run browser checks
and performance measurements sequentially, after the build has finished.


**Smooth CSS scrolling fought history restoration.** Astro restores the saved
position before the motion layer measures the new page. A document-wide smooth
scroll was still travelling when those measurements ran, leaving Back at the
top. Document scroll restoration is now immediate; desktop wheel motion remains
with Lenis. The browser test saves a nonzero position and checks Back returns.


## Awards and social polish, 16 September 2026

**The owner explicitly changed the homepage emphasis.** The headline now says
“International ausgezeichnete Massage”, with equivalent translated headings.
The archived crawl remains untouched; one documented H1 exception keeps the
content check meaningful. Existing title, description and substantive German
paragraphs are preserved.

**Line drawings did not communicate medal metal.** The shared medal component
now serves small WebP versions of generated transparent gold, silver and bronze
artwork. The larger ribbon shows the existing event and placement text. Exact
prompts and original paths are in `docs/medal-artwork.md`.

**The new awards film needed a compatible delivery encode.** Its HEVC original
is retained outside the repository; the site uses a 720p H.264/AAC fast-start
version. It is first on Home and present on About. The full Penzberg group
photograph sits alongside the championship story without cropping people out.

**A hidden parent did not hide the booking button.** The button's explicit
`visibility: visible` overrode the inherited hidden visibility when the mobile
menu opened. The social dock now leaves layout with `display: none` while a
menu or dialog is open. Browser checks exercise it after scrolling.

**Scroll snapping prevented the film hint from moving.** Film tracks now use
the shared `is-nudging` state to temporarily suspend snapping. The mobile tests
observe actual horizontal movement and its return to zero for photos and films.
The film rail also starts flush at zero: a 3px inset had let native snapping
look like prior visitor input and suppress the hint.


**The circular hero changed the first-paint cost.** CI caught welcome-screen
blocking and a homepage LCP just above 2.5 seconds. Portrait drift and its aura
now join the existing deferred motion layer, so they stay still behind the
initial welcome. Fullscreen welcome backdrops no longer blur the hidden page.
The circular portrait and its matching preload now declare their actual rendered
width and include a 360px candidate for small screens. The moving light inside
the language portal remains visible, and no performance threshold was relaxed.
