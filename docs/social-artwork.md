# LUMA sharing cover and browser icons

Created 18 September 2026 with the built-in image generator, followed by
ordinary delivery resizing with Sharp. No fallback CLI or API key was used.
The owner approved the composition, portrait choice and typography, selected
the original all-gold logo, then requested repair of the background above the hair.

## Final files

- `src/assets/luma-social-cover-master.png`: approved master, 1730×909.
- `public/social/luma-wellness-cover.jpg`: sharing image, 1200×630, about 119 KB.
- `public/favicon.svg`, `public/favicon-32.png`, `public/favicon.ico`: browser icons.
- `public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png`:
  touch and manifest icons.

The browser icons use the exact existing `logo-luma-symbol-display.webp`
artwork inside a small ivory ground. They are not generated redrawings.
Run `node scripts/prepare-brand-assets.mjs` to reproduce the delivery files.

All pages declare the same absolute image URL, JPEG type, dimensions and
description through Open Graph and a large-image Twitter card. Markup follows
the [Open Graph protocol](https://ogp.me/). Actual link-preview caches belong to
the platforms; an already-shared message may retain its previous thumbnail.

Final generator output:
`/Users/jaxoncorrey/.codex/generated_images/01a0a717-a0ac-7fc0-840c-c8c39e0df562/exec-e136be69-c530-4086-989b-c9a48899be33.png`

## Initial composition prompt

References: the supplied dark portrait, `june-dark-portrait.webp`, and the
original transparent `logo-luma-symbol-display.webp`. The logo reference was
replaced in the edit below at the owner's request.

Create a finished premium website social sharing cover for LUMA Wellness by June Saurin. A wide horizontal Open Graph card, EXACT 1.90476:1 composition (1200 by 630 target), full bleed, designed to be readable when reduced to a WhatsApp link preview. Reference image 1 is the actual portrait of June, use her exact supplied face, hair, pose and clothing as an unchanged photographic cutout on the right 43 percent of this composition, from head to upper torso. Preserve her likeness faithfully, no beautification, no new facial expression. Reference image 2 is the official transparent gold LUMA flame-shaped mark with June within it. Reproduce this brand mark accurately, small but clearly visible in an ivory pearl medallion in the upper-left. This medallion is for contrast only, restrained, no extra icon. Design: an exceptionally refined deep forest green (#14372c) background and subtle illuminated champagne-gold liquid-glass perimeter with realistic fine bevelled reflections, silky emerald gradients, calm organic curves and soft depth. June's existing dark portrait background dissolves naturally into the green background. No leaves or busy decorative foliage. An elegant editorial wellness brand, not science fiction. Left 55 percent has beautiful carefully aligned typography with generous breathing room. Exact text, no additional text: large widely spaced refined modern sans-serif 'LUMA'; below it medium 'WELLNESS'; a clearly readable line 'by June Saurin'; further below an elegant ivory editorial serif headline on two lines 'Internationally' then 'awarded massage'. Tiny but still readable 'BUXTEHUDE, GERMANY' at bottom left. No em dashes. Keep all content and the face at least 55 pixels inside the target 1200 by 630 safe margins. Gold and ivory lettering with excellent dark-background contrast. Refined expensive material realism, beautiful photography, highly legible typography, professional art direction. No fake awards, no stars, no medal icons, no large buttons, no watermark. Only one finished social sharing cover, landscape, no mockup device, no surrounding border outside the artwork.

## All-gold emblem edit prompt

References: initial cover `exec-17a6c978-23ed-4a9d-acf0-bc5e1584847f.png`
and `src/assets/logo-luma-full.webp`.

Use case: precise-object-edit. Image 1 is an approved social sharing card. Image 2 is the official ALL-GOLD LUMA brand logo. Change ONLY the small emblem inside the ivory round medallion at the upper left of image 1. Replace the current black figure and flame with the ALL-GOLD flame and massage therapist emblem from image 2. Use ONLY the pictorial upper portion of image 2, not the LUMA wellness lettering below it. Faithfully reproduce the gold outline of a woman with a bun, looking down as she gives a massage, her bent arms, and the asymmetric flame around her. This is an all-gold brand emblem with gold facial contours and gold clothing, never a black silhouette and never a forward-facing photographic person. Preserve the exact authentic shape of this emblem from image 2, as if its gold artwork is applied onto the ivory pearl medallion. The gold figure should be clear against the ivory ground and delicately embossed. Keep the existing circular ivory medallion and its fine gold edge. Preserve EVERYTHING ELSE in image 1 unchanged: exact same large photographic portrait on the right, face, pose, hair, clothing, all words, typography, spacing, layout, dark green and gold waves, lighting, and dimensions. No new objects, no other changes. Only replace the logo within the small round upper-left medallion with the official all-gold emblem.

## Final background repair prompt

Edit target: all-gold cover `exec-3ca2be04-5ccd-4cbc-a922-9ecfe34caa5c.png`.

Use case: precise-object-edit, background cleanup. This image is an approved finished social sharing card. There is a defective, very conspicuous patchy black cutout halo in the BACKGROUND ABOVE THE WOMAN'S HEAD AND AROUND THE OUTER EDGE OF HER HAIR, mostly across the upper right. Repair ONLY that defective background. Replace the irregular black patches and green fringing above and behind her hair with a perfectly smooth, uninterrupted deep forest-green gradient matching the beautiful background on the left. The canvas must be fully opaque, no transparency, no black holes, no jagged mask edges, no color-key halo. Natural clean photographic hair edges against continuous green. Keep the woman entirely unchanged, preserving her exact face, hair, expression, clothes, pose, and fine hair strands. Do NOT redraw or modify her. Preserve the ALL-GOLD LUMA logo in its ivory medallion at upper left exactly as it is. Preserve every text character, typography, size, placement, gold flowing curves, lighting and entire composition. All parts outside the defective background around the head and top-right must stay identical. This is a local background repair only, NOT a new version of the design. No pure black background areas at the top of the image. Smooth fully opaque forest green behind the entire head.
