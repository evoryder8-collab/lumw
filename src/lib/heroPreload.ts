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
  askedWidths: number[],
  sizes: string,
  quality = 62,
) {
  // Clamped the same way Photo.astro clamps, and for the same reason: asking
  // for more pixels than the file has produces a softer image in a larger
  // download. It matters twice over here, because a preload that names a width
  // the <picture> will not offer is a second download of the same photograph.
  const widths = [...new Set(askedWidths.map((w) => Math.min(w, src.width)))].sort((a, b) => a - b);

  const built = await Promise.all(
    widths.map((w) => getImage({ src, width: w, format: 'avif', quality })),
  );
  return {
    srcset: built.map((b, i) => `${b.src} ${widths[i]}w`).join(', '),
    sizes,
    type: 'image/avif',
  };
}
