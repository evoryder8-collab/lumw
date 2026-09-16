# Media and review sources

Added 16 September 2026, with the supplied original photographs and films
preserved outside the repository. Website derivatives are resized or encoded
for delivery. No generated portraits or invented awards are used.

## Supplied photographs

| Original filename | Website asset and use |
|---|---|
| `C5CECAB0-1725-490D-8FCD-D8AE21CA13DE 3.jpg` | `june-winner.webp`, homepage portrait and gallery |
| `213C0B37-5DC7-4C3F-815F-F61C61A626A8 4.JPG` | `june-dark-portrait.webp`, dark feature, About, gallery |
| `edit5D4_2824-retouched.JPG` | `june-waterside-portrait.webp`, gallery |
| `edit5D4_2852-retouched.JPG` | `june-at-the-water.webp`, gallery |
| `78d4e4ef-0025-4a4c-a538-722283210069.jpg` | `june-cup-winner.webp`, gallery |
| `IMG_0602.JPG` | `june-athens-2023.webp`, gallery |
| `baeeb3de-b0a5-4c5f-9c9f-459eb3171b42.JPG` | `june-massage-in-practice.webp`, gallery |
| `IMG_1109.jpg` | `june-swiss-championship.webp`, gallery |
| `caa97595-1fc7-4e33-85e7-87101c66e8e8 2.JPG` | `about/june-penzberg-championship.webp`, full group photograph alongside the Penzberg story on About pages |
| `3C35946F-8F87-47C1-BA03-AD1A1E635A74.JPG` | `june-welcome-portrait.webp`, circular portrait in the delayed homepage invitation |

These assets are under `src/assets`. Astro creates responsive AVIF and WebP
variants. Full gallery views use a larger WebP and preserve the entire frame.
The studio exterior comes from the existing `june website media` collection;
`studio-exterior-clear.webp` removes the earlier baked edge fade by returning
to that original file.

## Supplied films

| Original | Public derivative | Encoding |
|---|---|---|
| `June Awarded rev2 2026.mp4` | `public/media/june-awarded-2026.mp4` | 33.15 seconds, 720×1280 H.264, AAC, fast start; first film on Home and featured on About |
| `VIDEO 4 WEB & YOUT.MOV` | `public/media/june-intro.mp4` | 34.5 seconds, 1920×1080 H.264, AAC, fast start |
| `6b17a993-3d4d-4b7a-b4a9-d43e309d5a7b.mov` | `public/media/june-in-motion.mp4` | 13.9 seconds, original 480×848 H.264 remux, fast start |
| `IMG_4046.mp4` | `public/media/june-passion.mp4` | 33.2 seconds, 720×1280 H.264, AAC, fast start |
| `june subs lake.mov` | `public/media/june-story.mp4` | 41 seconds, 720×1280 H.264, AAC, fast start |
| `8676f941-593f-47af-8ac4-e6f8fd6b67ff.MP4` | `public/media/june-touch-and-technique.mp4` | 51.3 seconds, original 480×848 H.264 / AAC remux, fast start |

The original audio and subtitles burned into the source footage are retained.
There is no separate caption file in the supplied media. Film posters are
frames extracted from the corresponding originals. All players use
`preload="none"`, inline playback and native controls.

## Country flags

Flag artwork was downloaded from [Flagcdn](https://flagcdn.com/), which uses
[Wikimedia Commons](https://commons.wikimedia.org/) vector files. Germany,
United Kingdom, Thailand, Spain, Portugal and Italy are paired with visible
language names. Local lossless WebP derivatives at three times the display
width avoid loading the detailed coat-of-arms vectors on the first screen.
Original SVGs are retained alongside them for provenance. No third-party flag
request is made by a visitor's browser.

## Google review snapshot

Verified in the public Google Maps UI on 16 September 2026 against the
[listing supplied by the owner](https://maps.app.goo.gl/BxwjHDVVHHgmB6of8?g_st=ic).
The listing showed **5.0 from 39 reviews** at Hauptstraße 19, Buxtehude, with
LUMA's matching website and phone number.

Each displayed excerpt is at most 25 words, remains in the original German,
retains its public author and five-star rating, and has a review-specific link:

- [Marie](https://maps.app.goo.gl/ck5QEiJd7WM7Tk1K9)
- [Senada](https://maps.app.goo.gl/hCrYiJi4D9z1VwJ57)
- [Klaus Wolf](https://maps.app.goo.gl/KkwPjFcJgiJodfF17)

Review identifiers and excerpts are in `src/data/google-reviews.json`. This is
a static selection with a visible verification date. Recheck the listing and
each source link before changing the snapshot. The site does not emit Review
or AggregateRating structured data for these self-hosted testimonials.

## Google Maps icon

`public/brand/google-maps.png` is the unmodified Maps pin served by the
[official Google Maps site](https://www.google.com/maps/about/) on 16 September
2026. Its source is
[Google's product asset](https://www.gstatic.com/marketing-cms/assets/images/81/e4/1bdb808b40a28cc70ac24bf5e6fa/google-maps-favicon.png=s180).
It labels links to the listing and does not imply sponsorship.

## Native link-in-bio

The supplied screenshots and the public
[TapLink page](https://luma-wellness.taplink.ws/) establish the original actions.
Its published page data confirmed the WhatsApp number, email, contact-card
fields and the current Instagram `lumawellnessbyjune` and Facebook
`lumawellnessbyjunesaurin` destinations. No profile settings were changed.

## Original brand symbol

The original flat logo is preserved as `logo-luma-symbol.webp`. Its painted
area is framed with CSS inside a light badge. The 216px lossless WebP display
derivative preserves sharp transparent edges at 8.3 KB. The symbol itself is
not redrawn or altered.

## Display font

`fraunces-display-var.woff2` is derived from the existing local Fraunces font,
with optical size set to 48 and the used weight range 300 to 700 preserved.
This reduces its transfer from about 67 KB to 35 KB while retaining the display
family and variable weights. The source font is kept alongside it.

## Award wording to confirm before domain cutover

The supplied Swiss certificate photograph reads “Free Style Massage (Eastern
Inspired)”. The archived German About copy and historical award data instead
say Wellness for that event. The migration copy is preserved in this redesign;
June should confirm the category before an editorial correction and cutover.

## Medal artwork

The gold, silver and bronze placement illustrations are generated metal assets,
not championship logos. The award text and event names continue to use the
existing award record. Original PNGs, exact prompts and delivery details are
documented in [medal-artwork.md](medal-artwork.md).
