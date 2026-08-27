#!/usr/bin/env node
/**
 * Rebuild src/assets from the original export in "june website media".
 *
 * Two problems this solves.
 *
 * 1. The source filenames are keyword-stuffed for SEO and do not describe what
 *    is in the picture. "thai-massage-buxtehude v2.webp" is June's portrait by
 *    the water; "massage.webp" is the Google Reviews logo; "sportmassage-
 *    buxtehude.webp" is a competition photograph. Every mapping below was
 *    established by looking at the images, not by reading their names, and the
 *    `shows` field records what each one actually depicts.
 *
 * 2. Most of the usable photographs are dark - competition shots on black
 *    backgrounds, moody studio lighting - while section 9.3 asks for "bright,
 *    warm, overexposed-toward-white edges so images dissolve into the porcelain
 *    stage instead of sitting on it as dark rectangles". Reshooting is not on
 *    the table, so the darkest frames get a measured tone lift toward the
 *    Morning Light register. The CSS edge feather in Photo.astro does the rest.
 *
 * Idempotent: always reads the untouched originals, never its own output.
 * Run with `npm run assets`.
 */

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'june website media');
const OUT = path.join(ROOT, 'src/assets');

/** Nothing renders wider than ~1400 CSS px; 1800 covers that at 2x DPR. */
const CAP = 1800;
/** Below this mean luminance a photograph reads as a dark block on porcelain. */
const DARK = 100;

const MAP = [
  // dest                            source                                              shows
  ['june-portrait.webp',             'thai-massage-buxtehude v2.webp',                    'June, arms crossed, by the water at golden hour. The brightest usable frame and the site hero.'],
  ['june-portrait-square.webp',      'thai-massage-buxtehude-square.webp',                'Same portrait, square crop, for og:image and cards.'],
  ['studio-june-working.webp',       'massage-june-saurin-buxtehude.webp',                'June working on a client, warm lamp light, inside the studio.'],
  ['studio-bamboo-tools.webp',       'June-Saurin-Massage-Buxtehude.webp',                'June in the studio with the bamboo tools laid out on the table.'],
  ['studio-exterior-hautnah.webp',   'luma-wellness-massage-buxtehude.webp',              'The HAUTNAH storefront the copy points visitors to, in daylight.'],
  ['treatment-bamboo.webp',          'thai-massage-buxtehude-bambuswebp.webp',            'Bamboo stick massage in progress. The Balance Stone / Bambus treatment.'],
  ['treatment-back-warm.webp',       'rucken-ausgezeichnete-massage-buxtehude.webp',      'Oiled back massage under warm light. Stands in for Aroma-Luxus.'],
  ['treatment-back-neck.webp',       'nacken-rucken-massage-buxtehude.webp',              'Back and shoulder work, cooler light.'],
  ['treatment-shoulder-warm.webp',   'thai-rucken-massage.webp',                          'Shoulder massage beside a salt lamp. Warm and bright.'],
  ['treatment-cupping.webp',         'rucken-massage-buxtehude.webp',                     'Cupping / scraping on a back. The only Schroepfkopf frame, and it is small.'],
  ['treatment-pregnancy.webp',       'schwangerschaftsmassage-buxtehude.webp',            'Pregnancy massage. Stock, but the correct subject.'],
  ['treatment-facial.webp',          'GESICHTSMASSAGE-BUXTEHUDE..webp',                   'Facial treatment with a cotton pad. Gesichts- und Kopfmassage.'],
  ['treatment-foot.webp',            'Fuß-massage-buxtehude webp.webp',                   'Foot massage close-up.'],
  ['award-trophies.webp',            'massage-buxtehude-ausgezeichnete.webp',             'June holding trophies and medals at the World Championship.'],
  ['award-trophies-alt.webp',        'massage-buxtehude medal.webp',                      'Second frame from the same trophy set.'],
  ['award-certificate.webp',         'thai-massage-buxtehude-ausgezeichnete-therapeutin.webp', 'June holding her championship certificate with medals around her neck.'],
  ['award-competition-stage.webp',   'thai-buxtehude-massage.webp',                       'June competing under stage lighting, working on an arm.'],
  ['award-competition-stretch.webp', 'sportmassage-buxtehude.webp',                       'June performing a Thai stretch in competition, audience behind.'],
  ['award-competition-gold.webp',    'GOLD-MEDALIE-MASSAGE.webp',                         'June competing, flower in hair, audience behind. The Gold Medalie frame.'],
  ['june-with-nadine-stark.webp',    'june-nadine-massage-buxtehude.webp',                'June with Nadine Stark Chognon, who developed the STARK BALL method.'],
  ['logo-luma-mark.webp',            'luma-wellness-flat-logo-massage.webp',              'The gold droplet mark on transparency. Clean on porcelain.'],
  ['logo-luma-full.webp',            'luma-wellness-logo-massage.webp',                   'Droplet plus wordmark. Carries a baked dark shadow, so the site sets the wordmark as live type instead.'],
];

/** Files in the export that are not photography and never ship. */
const EXCLUDED = {
  'angebot-massage-buxtehude.webp': 'a "50% OFF" promo graphic',
  'ausgezeichnete-massage-buxtehude.webp': 'an "AWARD WINNING" laurel badge',
  'Gesundheitspflege.webp': 'a generic hands icon',
  'buxtehude-massage.png': 'the Google Maps pin glyph',
  'buxtehude-massage.webp': 'stock photo of people standing in a circle',
  'geschenkgutschein.webp': 'a stock gift-voucher envelope',
  'massage-buxtehude-QRCODE.webp': 'a QR code',
  'taplink round massage buxtehude.webp': 'a QR code',
  'massage.webp': 'the Google Reviews logo',
  'thai-solution-massage-buxtehude.webp': 'an acupuncture-point model',
  'uber-massage-in-buxtehude.webp': 'the words "Das erste Mal?" as an image',
  'stark-ball-massage-ausgezeichnete-nadine.webp': 'a trophy display under coloured gels',
  'stark-ball-massage-buxtehude.webp': 'a dark, hard-to-read stone-on-face frame',
};

const isLogo = (name) => name.startsWith('logo-');

fs.mkdirSync(OUT, { recursive: true });

let lifted = 0;
for (const [dest, source, shows] of MAP) {
  const from = path.join(SRC, source);
  if (!fs.existsSync(from)) {
    console.error(`missing source: ${source}`);
    process.exitCode = 1;
    continue;
  }

  let pipe = sharp(from).resize(CAP, CAP, { fit: 'inside', withoutEnlargement: true });

  // Logos are flat marks on transparency; tone-mapping them would only muddy
  // the gold. Photographs get measured a second time after the resize.
  let note = '';
  if (!isLogo(dest)) {
    const buf = await pipe.toBuffer();
    const st = await sharp(buf).stats();
    const mean = (st.channels[0].mean + st.channels[1].mean + st.channels[2].mean) / 3;

    if (mean < DARK) {
      // Scale the lift by how dark the frame is, so a 54-mean competition shot
      // gets more help than a 94-mean studio frame and neither goes flat.
      const t = Math.min(1, (DARK - mean) / DARK);
      // sharp's .tint() desaturates to greyscale before colourising, which
      // turned warm studio frames monochrome. Warmth comes from a channel
      // recombination instead, and saturation is nudged up rather than down so
      // the lift does not flatten the colour out of the picture.
      pipe = sharp(buf)
        .gamma(1 + 0.22 * t)                                    // open the shadows
        .modulate({ brightness: 1 + 0.1 * t, saturation: 1 + 0.06 * t })
        .recomb([                                               // gentle warm bias
          [1 + 0.03 * t, 0, 0],
          [0, 1 + 0.01 * t, 0],
          [0, 0, 1 - 0.04 * t],
        ]);
      lifted++;
      note = `  lifted (mean ${Math.round(mean)}, t=${t.toFixed(2)})`;
    } else {
      pipe = sharp(buf);
    }
  }

  await pipe.webp({ quality: 84, effort: 5 }).toFile(path.join(OUT, dest));
  const kb = (fs.statSync(path.join(OUT, dest)).size / 1024).toFixed(0);
  console.log(`${dest.padEnd(34)} ${kb.padStart(4)}KB${note}`);
}

console.log(`\n${MAP.length} assets written, ${lifted} tone-lifted.`);
console.log(`${Object.keys(EXCLUDED).length} files in the export are not photography and were skipped.`);
