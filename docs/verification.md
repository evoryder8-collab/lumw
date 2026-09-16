# Redesign verification

Local release checks, 16 September 2026, using the production build with
`PUBLIC_BASE=/lumw` and `PUBLIC_INDEXABLE=false`.

## Build and browser

- `npm run verify`: passed. 51 pages; all 25 original German URLs, metadata,
  H1s and substantive paragraphs retained; JSON-LD, contrast, reciprocal
  hreflang, six sitemaps, internal links and local assets checked.
- No em dashes in rendered visible text, metadata or accessible labels.
- JavaScript: 66.9 KiB gzip against a 100 KiB budget.
- `npm run check:browser`: passed with local Chrome. The final regression run
  also passed with the CI browser, Chromium 153, using
  `LUMA_BROWSER_CHANNEL=bundled npm run check:browser`.
- 51 canonical URLs returned 200 beneath `/lumw`.
- 32 responsive checks: eight representative pages at 360, 390, 768 and 1440px.
- Eight axe WCAG A/AA audits: no detected violations. This is automated coverage,
  not a claim that every accessibility consideration has been manually audited.
- Language selection, sound consent, actual audible intro playback, price
  count-up, one arrival glow, enquiry handoff, gallery keys and focus return,
  browser history, mobile navigation, reduced motion and no-JS checks passed.
- Nine supplied photographs and all five supplied films are integrated. Eight
  photographs are in the gallery and the newest portrait introduces the timed
  greeting. The four lower films play separately and pause each other. The
  passion film is also featured on About in all six languages.
- Link-in-bio tested with audible autoplay allowed and blocked. Both start
  inline; the blocked case falls back to muted and its sound toggle works.
  Original TapLink actions and the downloadable business vCard are present.
- Platform-tinted glass buttons reveal on scroll, with left-to-right gleams
  paused offscreen and touch feedback. The shared Contact map offers both
  Google Maps and Apple Maps. Its dialog works after client-side navigation,
  closes with Escape and returns focus; plain links work without JavaScript.
- The review hint makes a real horizontal movement and returns to the first
  card. Reduced-motion checks confirm no nudge.
- The greeting waits for welcome completion plus 20 seconds, leaves focus
  alone and stays dismissed after a reload. Normal and reduced-motion flows
  both pass. Mobile inspection caught and fixed an animated text layer that
  initially intercepted the close button.
- No messages were sent. No Instagram profile or production DNS was changed.
- The first CI run caught an unhandled native animation cancellation in
  Chromium 153. A focused reproduction confirmed it, and the lifecycle now
  acknowledges only AbortError cancellation. A regression journey skips the
  animation and verifies that Contact still becomes interactive.

## Mobile performance

`npm run check:performance`: passed. Lighthouse uses cold browser contexts and
its mobile simulation. Each row below is one local Chrome 151 run. The CI job
uses three runs per scenario and enforces the median.

Host: macOS, 12 CPU cores, load averages 5.93 / 5.04 / 3.89.

| Scenario | Performance | LCP | CLS | Blocking time |
|---|---:|---:|---:|---:|
| First welcome | 98 | 2.269 s | 0.0001 | 0 ms |
| Homepage after welcome | 97 | 2.405 s | 0.0001 | 0 ms |
| Treatments | 97 | 2.423 s | 0.0003 | 0 ms |
| Contact | 98 | 2.179 s | 0.0001 | 0 ms |

Chromium 153 also passed the full browser journeys after the cancellation fix.
Its first Lighthouse welcome measurement failed blocking time: the trace
contained a 3.19-second wall-time task with only 0.34 ms of thread CPU. The
prescribed three-run cold-context repeat passed: median score 97, LCP 2.407 s,
CLS 0.0001 and blocking time 0 ms. Its other three scenarios passed on their
first measurement. No budget or error filter was relaxed.

The next CI run passed all browser checks and three performance scenarios.
Treatments missed its LCP budget at a 2.541-second median because its first
visible photo was lazy. That photo now has a matching responsive preload and
eager high-priority loading in all six treatment pages. A Chromium 153 repeat
passed all three cold measurements: 2.106, 2.104 and 2.104 seconds, with a median
score of 98, CLS 0.0003 and blocking time 0 ms. Network evidence confirms one
download of the chosen photo candidate. The remaining photos stay lazy.

Budgets: performance 95, LCP 2.5 s, CLS 0.02, blocking time 200 ms. Reports and
screenshots are generated under ignored `artifacts/` and retained by CI for
14 days. Field INP and an actual Instagram app session are not measured by
these desktop browser checks. Those remain device and post-release checks.
