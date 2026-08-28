import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';

import treatmentBackWarm from '../assets/treatment-back-warm.webp';
import treatmentBackNeck from '../assets/treatment-back-neck.webp';
import treatmentBamboo from '../assets/treatment-bamboo.webp';
import treatmentCupping from '../assets/treatment-cupping.webp';
import treatmentFacial from '../assets/treatment-facial.webp';
import treatmentFoot from '../assets/treatment-foot.webp';
import treatmentPregnancy from '../assets/treatment-pregnancy.webp';
import awardCompetitionGold from '../assets/award-competition-gold.webp';
import awardCompetitionStretch from '../assets/award-competition-stretch.webp';
import juneWithNadineStark from '../assets/june-with-nadine-stark.webp';

/* The treatment cards read from a normalised set: one ratio, opaque, cropped to
   the subject. See scripts/normalize-cards.mjs for why. */
import cardBackWarm from '../assets/cards/treatment-back-warm.webp';
import cardBackNeck from '../assets/cards/treatment-back-neck.webp';
import cardBamboo from '../assets/cards/treatment-bamboo.webp';
import cardFacial from '../assets/cards/treatment-facial.webp';
import cardFoot from '../assets/cards/treatment-foot.webp';
import cardPregnancy from '../assets/cards/treatment-pregnancy.webp';
import cardCompetitionGold from '../assets/cards/award-competition-gold.webp';
import cardCompetitionStretch from '../assets/cards/award-competition-stretch.webp';
import cardNadineStark from '../assets/cards/june-with-nadine-stark.webp';


/**
 * Explicit map rather than `import.meta.glob(..., { eager: true })`.
 *
 * The glob imported all 22 assets on any page that used one, which made Astro
 * emit every original into dist - including the ones nothing renders. That put
 * half a megabyte of unused images into the deploy.
 *
 * Only images actually referenced by content collections belong here.
 */
const BY_NAME: Record<string, ImageMetadata> = {
  'treatment-back-warm.webp': treatmentBackWarm,
  'treatment-back-neck.webp': treatmentBackNeck,
  'treatment-bamboo.webp': treatmentBamboo,
  'treatment-cupping.webp': treatmentCupping,
  'treatment-facial.webp': treatmentFacial,
  'treatment-foot.webp': treatmentFoot,
  'treatment-pregnancy.webp': treatmentPregnancy,
  'award-competition-gold.webp': awardCompetitionGold,
  'award-competition-stretch.webp': awardCompetitionStretch,
  'june-with-nadine-stark.webp': juneWithNadineStark,
};

export const imageByName = (name?: string): ImageMetadata | undefined =>
  name ? BY_NAME[name] : undefined;

/**
 * A social/structured-data URL for an image.
 *
 * Referencing `img.src` directly would point at the untouched original and
 * force Astro to emit it, which is how a 502kB storefront photo ended up in the
 * bundle. This renders a sensible 1200px JPEG-quality WebP instead, which is
 * what og:image and schema `image` actually want.
 */
export async function socialImageUrl(
  img: ImageMetadata,
  site: URL | undefined,
  width = 1200,
): Promise<string> {
  const built = await getImage({
    src: img,
    width: Math.min(width, img.width),
    format: 'webp',
    quality: 76,
  });
  return site ? new URL(built.src, site).href : built.src;
}

/**
 * The card crop of a treatment photograph.
 *
 * Falls back to the original when a name has no normalised crop, so a new
 * treatment renders something rather than nothing until `npm run cards` runs.
 */
const CARD_BY_NAME: Record<string, ImageMetadata> = {
  'treatment-back-warm.webp': cardBackWarm,
  'treatment-back-neck.webp': cardBackNeck,
  'treatment-bamboo.webp': cardBamboo,
  'treatment-facial.webp': cardFacial,
  'treatment-foot.webp': cardFoot,
  'treatment-pregnancy.webp': cardPregnancy,
  'award-competition-gold.webp': cardCompetitionGold,
  'award-competition-stretch.webp': cardCompetitionStretch,
  'june-with-nadine-stark.webp': cardNadineStark,
};

export const cardImageByName = (name?: string): ImageMetadata | undefined =>
  name ? (CARD_BY_NAME[name] ?? BY_NAME[name]) : undefined;
