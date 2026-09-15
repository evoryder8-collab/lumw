# Roadmap

What it would take to move this site from "a very good rebuild" to a site that
reads, at first contact, as something a world-class hotel or spa paid a serious
studio for. Ordered by what earns the most for the least risk, and written
against the site as it actually stands, not against a generic checklist.

Two rules sit above every item here, from CLAUDE.md:

1. **Rankings first.** Top-3 for "massage buxtehude" and #1 on Maps. Nothing
   below is worth doing if it costs that. Until DNS moves, URL-shape and
   structure changes are free; after it, they are not.
2. **Lighthouse mobile ≥ 95, always.** Every effect is a garnish. Section 9.6
   names the removal order if a Core Web Vital regresses. Nothing here is exempt.

Where a phase depends on the machine being quiet enough to benchmark honestly,
it says so. Most of the motion work is unverifiable while the host sits at a
load average over 80, which it did for most of this build.

---

## Phase 0 — Close the pre-cutover gaps (do before anything visual)

These are cheap now and expensive after DNS moves.

- [ ] **Translations, five locales.** The portal is built, the tiles render,
      and five of them say "in Kürze". Human-quality, context-aware German →
      English, Thai, Spanish, Portuguese, Italian. Flip `available: true` in
      `src/i18n/locales.ts` per locale as each lands, never before. Keep
      Nutzungsbedingungen and Datenschutz German-only — they are legally
      operative and a translation would be a second legal text.
- [ ] **Booking form (stage 5).** The contact form is deliberately disabled
      with a visible note. Supabase schema (stage 4) → Edge Function →
      island. Test the double-booking race on purpose.
- [ ] **hreflang** once ≥1 locale is live. `alternatesFor()` already exists.
- [ ] **Cutover rehearsal.** Run the section 7 protocol on staging end to end,
      including the archive diff. `npm run verify` now guards URLs, NFC slugs,
      canonicals, titles, JSON-LD and contrast — but the *content* diff
      (word count per page vs. the live archive) is still manual.
- [ ] **Post-cutover only: shorten the two titles and four descriptions** that
      exceed SERP length. `check-titles` reports them as notes. Do this one
      page at a time, four weeks after DNS moves, never with a URL change.

---

## Phase 1 — Transitions: make moving between pages feel authored

The single largest gap between this site and a studio build. ClientRouter is
installed and one `transition:name` exists (service card → service hero). Every
other navigation is a cut.

- [ ] **Shared-element morph, fully choreographed.** Card image → hero image
      already has the name. Add the *title* and the *price line* as named
      elements so three things travel, not one. Stagger their arrival 60ms.
- [ ] **Page curtain.** A porcelain wipe with a gold hairline that sweeps
      across on every non-morph navigation. `::view-transition-old/new`
      keyframes in `global.css`. Duration 640ms, `--ease`. Under reduced
      motion: instant, as now.
- [ ] **Header persistence.** Give the header pill `transition:name="header"`
      so it never repaints between pages — it is the one thing that should
      feel bolted to the glass.
- [ ] **Scroll restoration** that respects Lenis. Verify the back button lands
      where you left, not at the top.
- [ ] **Language switch as a transition, not a reload.** When a locale goes
      live, the portal's tile click should morph the wordmark into the new
      page's header rather than hard-navigating.

---

## Phase 2 — Hero: the first three seconds

The hero is a portrait with SplitText. Correct, but it does not *arrive*.

- [ ] **Preloader that is the portal.** Right now the language portal appears
      over a page that may still be painting. Unify them: the mark and
      wordmark are the loading state; the tiles resolve in once fonts and the
      LCP image are ready. One system, one timeline.
- [ ] **Hero image breathing.** A 1.00 → 1.03 scale over 18s, alternate, on
      the portrait. Spec 9.3 calls it Ken Burns at rest and it is not wired on
      the hero itself, only on chapters.
- [ ] **Text mask reveal on the H1**, not a line reveal: the display words
      sweep in through a `clip-path` from the baseline, with the gold "gilt"
      highlight travelling once as they settle. Fraunces has an optical-size
      axis — animate `font-variation-settings: 'opsz'` from 144 → 9 over the
      reveal so the letterforms literally sharpen as they land. Nobody does
      this; it is the kind of detail that reads as expensive without being
      loud.
- [ ] **Pointer-reactive aurora.** The wash drifts on its own. Let the
      nearest blob lean 2–3vw toward the pointer on fine-pointer devices, via
      the existing `--mx/--my` custom properties. Nothing on touch.
- [ ] **Scroll cue** that is not an arrow: a single mote that falls from the
      hero's lower edge and fades, on a 4s loop, until the first scroll.

---

## Phase 3 — Cards: the prices page is the money page

Nine cards, now with uniform photographs. They lift and gleam on hover. That
is where a template stops. Tilt was tried and rejected; do not bring it back.

- [ ] **Entrance in sequence.** Cards currently fade up with a stagger. Replace
      with a `clip-path: inset(0 0 100% 0)` → `inset(0)` wipe per card, 70ms
      apart, so the grid *unfolds* down the page.
- [ ] **Inner image parallax on hover.** The photo inside the card drifts
      6–8px opposite the pointer while the card holds still. Reads as depth
      without the rotation that made tilt feel cheap.
- [ ] **Price count-up.** `EUR 79` ticks up from 0 over 700ms as the card
      enters view, digits rolling vertically in a mask. Once per session, and
      only the *from* price, not every duration line.
- [ ] **Signature card treatment.** The Gold Medalie card is the hero of this
      page and currently differs by a ribbon and a conic border. Give it the
      award medal (already drawn in `Medal.astro`) sitting *on* the photo's
      lower-right corner with a soft shadow, and a second, slower sheen loop.
- [ ] **Sticky price index.** A slim, glass rail on desktop listing the nine
      names; the active one tracks scroll with a gold marker. Doubles as
      in-page navigation and as a second set of internal links.
- [ ] **"Ganze Beschreibung" as an accordion with height animation**, not a
      `<details>` snap. Measure, then animate `height` via GSAP; keep the
      bottom collapse control that was added.

---

## Phase 4 — Buttons and micro-interactions

Magnetic pull and sheen exist. They are good. The next layer is *response*.

- [ ] **Press depth.** `:active` on pills: `translateY(1px)` and the shadow
      shortens for 90ms, then the elastic return the magnetic already has.
      Buttons currently have no press state at all.
- [ ] **Arrow that draws itself.** The `card__arrow` SVG: `stroke-dasharray`
      draw-on when the card enters view, then the arrowhead slides 4px right
      on hover. `pathLength="1"` makes this two lines of CSS.
- [ ] **Label letter-shift** on the primary CTA: on hover each letter of
      "Jetzt buchen" rises 1px with a 12ms stagger and settles. SplitText is
      already loaded.
- [ ] **WhatsApp / Anrufen / Email cards on the contact page**: the pulse
      that was asked for. A single soft ring expanding from the icon every
      6s, desynced across the three, paused offscreen.
- [ ] **Copy-to-clipboard on the phone number** with a 1.2s gold "Kopiert"
      toast that rises from the number and dissolves.
- [ ] **Form field float labels** (when the form goes live): the label sits
      in the field and lifts to the top edge on focus, with the field's
      bottom rule drawing gold left-to-right. Validation states in ink-mute
      and the brand green, never red.

---

## Phase 5 — Scroll: more grammar, same restraint

Pinned chapters, drift, sunbeams, velocity response and the counter exist.
What is missing is *variety* — every scroll moment currently uses the same
three moves.

- [ ] **Horizontal award gallery** on the About page. The three award
      photographs plus the certificate become a pinned horizontal track that
      scrubs with vertical scroll, each image scaling from 0.92 → 1 as it
      centres. Reduced motion and touch: a native horizontal scroll-snap.
- [ ] **Manifesto fill.** The intro paragraph on the home page fills from
      ink-mute to ink word by word as it scrolls through the middle third of
      the viewport. Scrubbed, not triggered. One paragraph only; it is a
      device, not a style.
- [ ] **The map draws itself.** `LocationMap.astro` is inline SVG. Roads
      stroke-draw from the studio outward over 1.4s as it enters view; the
      studio marker drops in last with a single ripple. Buildings fade up
      after. This is the most memorable single moment available on the site
      and the data is already there.
- [ ] **Medal ribbon draw** in the award strip: on first paint the ribbons
      draw down and the disc scales in, 40ms apart along the strip.
- [ ] **Sticky image stack on service pages.** Hero image pins while the
      description scrolls beside it, then releases to the siblings block.
- [ ] **Section numerals** (01, 02, 03) in the margin on desktop, tracking
      the active section with a slow crossfade. Matches the chapter counter's
      grammar and extends it to the whole page.

---

## Phase 6 — Subtle motion and ambient life

The things nobody points at but everyone feels.

- [ ] **Custom cursor on fine pointers.** A 6px ink dot with a 28px gold ring
      that lags 80ms behind. The ring expands to 44px and thins over links;
      collapses to the dot over text. Hidden entirely on touch. This is the
      single most "studio" signal a site can send and it costs one element.
- [ ] **Variable-font breathing** on the wordmark: `wght` 300 → 340 → 300
      over 9s. Imperceptible as motion, perceptible as life.
- [ ] **Grain that shifts.** The film-grain tile currently animates via
      `steps(10)`. Slow it to 14s and add a 0.4% opacity oscillation so it
      never reads as a static overlay.
- [ ] **Logo ripple.** The droplet mark: a single concentric ring on hover
      and once on page load, 900ms, gold at 18%.
- [ ] **Time-of-day wash.** Shift the aurora's hue by ±6° and its warmth by
      the local hour — cooler at 8am, warmer at 8pm. Computed once at load,
      CSS custom properties, zero runtime cost. "Morning Light" that is
      actually the morning's light.
- [ ] **Header contraction.** After 120px of scroll the pill tightens its
      padding by 4px and its frost deepens. Reverses on scroll-up. Uses the
      velocity property already written.

---

## Phase 7 — Graphics and iconography

- [ ] **A drawn icon set** to match the medals: phone, WhatsApp, mail, clock,
      pin, arrow, globe, close. One stroke weight (1.25), one corner radius,
      gold-capable. Replace the Lucide-style strokes in `ThumbBar`,
      `SiteHeader` and the contact cards. The medals set the standard; the
      rest of the icons currently do not meet it.
- [ ] **Gold linework dividers** between sections: a single hairline that
      draws in from the centre, with a 3px gap around a tiny mark. The
      `card__linework` curves are a start; make them a system.
- [ ] **Illustrated "how a visit goes"** on the contact or about page: four
      small line illustrations (arrive, consult, treatment, tea) that draw in
      sequence. Gives the page a moment that is neither photo nor type.
- [ ] **OG images per page**, rendered at build from a template: the page
      title in Fraunces on the porcelain wash with the mark. Currently every
      page shares June's portrait. Astro can render these from an endpoint.
- [ ] **Favicon animation** on the tab: the droplet fills on load. Purely SVG.

---

## Phase 8 — Content and trust surfaces (SEO that also looks good)

- [ ] **Reviews, displayed, not marked up.** A curated strip of three Google
      reviews, quoted with permission, with a link to the profile. Displayed
      only — CLAUDE.md forbids `AggregateRating` and the checker enforces it.
- [ ] **Three location pages (stage 9)**: Stade, Neu Wulmstorf, Harburg.
      Same template as a service page, real copy, real photos of the *route*
      not the studio. Ship one, wait four weeks, extend.
- [ ] **Image sitemap** entries for the 33 normalised photographs, with the
      German captions already in `imageAlt`.
- [ ] **FAQ page redesign** into an accordion with the map-draw treatment on
      the "Wo finde ich Sie" answer. `FAQPage` schema is already emitted.
- [ ] **Privacy-safe analytics**: cookieless, self-hosted or Plausible, no
      consent banner needed. Currently the site is flying blind.

---

## Phase 9 — Measurement and discipline

- [ ] **Lighthouse in CI** against the built `dist/`, mobile, throttled,
      three runs averaged, failing under 95 on performance. The budget in
      section 5 is a document until this exists.
- [ ] **A quiet-machine benchmark ritual.** Every score taken in this build
      was noise — load averages of 80 to 250. Benchmark only under load < 4,
      and record the load next to the score.
- [ ] **Visual regression**: Playwright screenshots of every page at 360 and
      1440, diffed per PR. The `:global()` dead-rule bug and the pill halo
      would both have been caught by a pixel diff.
- [ ] **Per-effect kill switches** as data attributes, so any garnish can be
      disabled in production without a deploy if a CWV regresses.

---

## What not to do

- No 3D tilt. It was built, tamed, and removed; all three reference repos
  use a 6px lift and no rotation.
- No canvas grain. It was tried; it blocked. The SVG tile is correct.
- No third-party fonts, maps, or scripts. Self-hosted or nothing — TTDSG.
- No `AggregateRating` or `Review` schema. Ever.
- No title or description change in the same release as any URL change.
- Nothing that animates layout or `box-shadow` directly. Section 9.3.
