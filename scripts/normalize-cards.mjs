/**
 * Normalise the treatment card photographs.
 *
 * The nine card images arrived in wildly different shapes and states. Their
 * aspect ratios span 0.67 to 1.91, and several carry a soft alpha vignette
 * baked into the file by an earlier pass. Dropped into one fixed card slot with
 * `object-fit: cover`, that produced nine different results: the portraits were
 * cropped to a narrow band, the opaque ones ended in a hard rectangular edge,
 * and june-with-nadine-stark - a portrait whose subject sits inside a small
 * oval with a mean alpha of 0.15 - rendered as a little floating blob with two
 * heads in the middle of an empty card.
 *
 * This pass gives every card one identical starting point:
 *   1. crop away the baked vignette, back to the solid core of the picture
 *   2. flatten onto an opaque ground, so no file fades on its own any more
 *   3. cover-crop to a single card ratio, framed on the subject
 *
 * The fade into the card is then owned entirely by one CSS mask, so every card
 * behaves the same way. Re-run with `npm run cards` when a photograph changes.
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

/** 7:6. Tall enough to fill the top half of the card at every breakpoint. */
const CARD_W = 1400;
const CARD_H = 1200;

const SRC = 'src/assets';
const OUT = 'src/assets/cards';

/**
 * `attention` picks the region with the most going on, which frames the
 * subject well for most of these. Where it chose badly on inspection, the
 * gravity is named explicitly instead.
 */
const IMAGES = [
  { name: 'treatment-back-warm',        pos: 'attention' },
  { name: 'treatment-bamboo',           pos: 'attention' },
  { name: 'award-competition-stretch',  pos: 'attention' },
  { name: 'treatment-pregnancy',        pos: 'attention' },
  { name: 'award-competition-gold',     pos: 'attention' },
  { name: 'june-with-nadine-stark',     pos: 'attention' },
  { name: 'treatment-facial',           pos: 'attention' },
  { name: 'treatment-back-neck',        pos: 'attention' },
  { name: 'treatment-foot',             pos: 'attention' },

  /**
   * The about page has the same problem in a different frame.
   *
   * These three are portraits carrying the same baked vignette, and the page
   * puts them in landscape 3:2 and 2:3 plates. A portrait cover-cropped to 3:2
   * keeps a narrow horizontal band, and with the vignette on top the subject
   * ends up small in a white surround - the floating blob again, just in a
   * frame instead of a card. Cropped here to the shape the page actually
   * renders them at.
   */
  // Gravity named rather than left to `attention`, which goes for detail and
  // contrast and picked the wrong thing in both portraits: it cropped June out
  // of her own certificate photograph entirely, and reduced the Nadine Stark
  // photograph to two arms and a ball with both faces outside the frame.
  //
  // Centre is what holds June's face and a legible certificate at the same
  // time; north is what keeps both faces in the Nadine photograph.
  { name: 'award-certificate',       pos: 'centre',    w: 1500, h: 1000, out: 'about' },
  { name: 'award-trophies',          pos: 'attention', w: 1000, h: 1500, out: 'about' },
  { name: 'award-competition-stage', pos: 'attention', w: 1500, h: 1000, out: 'about' },
  { name: 'june-with-nadine-stark',  pos: 'north',     w: 1500, h: 1000, out: 'about' },

  /**
   * The home page chapters, which run full-bleed at 100vw by 100svh.
   *
   * There the vignette is at its worst: a transparent edge over a viewport-sized
   * element lets the page background through, so the photograph stops short of
   * the edges it is supposed to own. june-with-nadine-stark, at a mean alpha of
   * 0.146, was a small blob adrift in a whole screen.
   *
   * 16:9 and opaque. object-fit: cover takes it from there, cropping the sides
   * on a phone, which is why each crop is centred on its subject rather than
   * left to the entropy heuristic.
   */
  { name: 'treatment-back-warm',       pos: 'centre',    w: 1920, h: 1080, out: 'chapter' },
  // Named 'gold' but the picture is June working at a competition, not holding
  // a medal. North found the flower in her hair against a dark crowd and lost
  // her entirely; centre holds her face, her hands and the treatment.
  { name: 'award-competition-gold',    pos: 'centre',    w: 1920, h: 1080, out: 'chapter' },
  { name: 'award-competition-stretch', pos: 'attention', w: 1920, h: 1080, out: 'chapter' },
  { name: 'treatment-pregnancy',       pos: 'centre',    w: 1920, h: 1080, out: 'chapter' },
  { name: 'june-with-nadine-stark',    pos: 'north',     w: 1920, h: 1080, out: 'chapter' },
  { name: 'treatment-facial',          pos: 'centre',    w: 1920, h: 1080, out: 'chapter' },
];

/** The box holding every pixel solid enough to be picture rather than fade. */
async function solidCore(file) {
  const meta = await sharp(file).metadata();
  if (!meta.hasAlpha) return null;

  const S = 160;
  const { data } = await sharp(file)
    .extractChannel(3)
    .resize(S, S, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let x0 = S, y0 = S, x1 = -1, y1 = -1;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (data[y * S + x] > 200) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;

  // Back to source pixels, clamped inside the image.
  const left = Math.max(0, Math.round((x0 / S) * meta.width));
  const top = Math.max(0, Math.round((y0 / S) * meta.height));
  const width = Math.min(meta.width - left, Math.round(((x1 + 1 - x0) / S) * meta.width));
  const height = Math.min(meta.height - top, Math.round(((y1 + 1 - y0) / S) * meta.height));

  // A core that is essentially the whole frame means there was no vignette
  // worth trimming, and cropping it would only shave real picture away.
  const covers = (width * height) / (meta.width * meta.height);
  if (covers > 0.93) return null;

  // Pull in off the core's own edge. The threshold finds where the picture is
  // solid, but the ring just inside it is still partly faded, and flattening
  // that against the ground leaves a dark rim around the crop.
  const inset = 0.045;
  const dx = Math.round(width * inset);
  const dy = Math.round(height * inset);

  return {
    left: left + dx,
    top: top + dy,
    width: Math.max(1, width - dx * 2),
    height: Math.max(1, height - dy * 2),
  };
}

mkdirSync(OUT, { recursive: true });

mkdirSync('src/assets/about', { recursive: true });
mkdirSync('src/assets/chapter', { recursive: true });

for (const { name, pos, w = CARD_W, h = CARD_H, out = 'cards' } of IMAGES) {
  const file = `${SRC}/${name}.webp`;
  let pipe = sharp(file);

  const core = await solidCore(file);
  if (core) pipe = pipe.extract(core);

  const position = pos === 'attention' ? sharp.strategy.attention : pos;
  const dir = out === 'cards' ? OUT : `src/assets/${out}`;

  await pipe
    .flatten({ background: '#f3ece6' })
    .resize(w, h, { fit: 'cover', position })
    .webp({ quality: 84 })
    .toFile(`${dir}/${name}.webp`);

  const trimmed = core ? `trimmed ${core.width}x${core.height}` : 'no vignette';
  console.log(`  ${name.padEnd(28)} ${String(w).padStart(4)}x${String(h).padEnd(4)} ${trimmed}`);
}

console.log(`\n${IMAGES.length} images normalised into ${OUT}/, src/assets/about/ and src/assets/chapter/`);
