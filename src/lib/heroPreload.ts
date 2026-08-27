import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

/**
 * Build the AVIF srcset Photo.astro will render for a hero, so Layout can
 * preload exactly the candidate the browser is about to pick. Keeping the
 * widths and sizes in one call stops the preload and the <picture> drifting
 * apart, which would download the image twice.
 */
export async function heroPreload(
  src: ImageMetadata,
  widths: number[],
  sizes: string,
  quality = 62,
) {
  const built = await Promise.all(
    widths.map((w) => getImage({ src, width: w, format: 'avif', quality })),
  );
  return {
    srcset: built.map((b, i) => `${b.src} ${widths[i]}w`).join(', '),
    sizes,
    type: 'image/avif',
  };
}
