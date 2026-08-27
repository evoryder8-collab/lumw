import { defineCollection, z } from 'astro:content';
import { file, glob } from 'astro/loaders';

/**
 * The 18 Wix Bookings entries behind /service-page/.
 *
 * Names, durations, prices and descriptions are the live values, verbatim,
 * including the four where the name and the configured duration disagree. Those
 * are known inconsistencies on the fix-later list (CLAUDE.md section 7) and are
 * deliberately NOT corrected at cutover.
 *
 * `slug` carries the real URL segment, umlauts included, because it must survive
 * byte-identically. It is stored in the entry data rather than taken from the
 * filename so macOS never gets a chance to write it decomposed into git.
 */
const services = defineCollection({
  loader: file('src/content/services.json', {
    parser: (text) => JSON.parse(text).services,
  }),
  schema: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    tagline: z.string(),
    description: z.string(),
    durationMin: z.number().int().positive(),
    priceEur: z.number().nonnegative(),
    /** Groups the duration variants of one treatment together. */
    family: z.string(),
    familyName: z.string(),
    /** Which of the 48 photographs actually depicts this treatment. */
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    /** Live per-page title and description, copied exactly. */
    seoTitle: z.string(),
    seoDescription: z.string(),
    sortOrder: z.number().int(),
  }),
});

/** The eleven live FAQ entries. Feeds both the page and the FAQPage graph. */
const faq = defineCollection({
  loader: file('src/content/faq.json', { parser: (text) => JSON.parse(text).faq }),
  schema: z.object({
    id: z.string(),
    question: z.string(),
    /** Plain-text answer for JSON-LD. */
    answerText: z.string(),
    /** Rendered answer, which may carry a list. */
    answerHtml: z.string(),
    order: z.number().int(),
  }),
});

/** Long-form legal prose that Constantin edits directly. */
const legal = defineCollection({
  loader: glob({ base: 'src/content/legal', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    heading: z.string(),
    seoTitle: z.string(),
    seoDescription: z.string(),
    path: z.string(),
  }),
});

/** The nine treatments on the Angebote & Preise page, with their price lines. */
const treatments = defineCollection({
  loader: file('src/content/treatments.json', {
    parser: (text) => JSON.parse(text).treatments,
  }),
  schema: z.object({
    id: z.string(),
    number: z.string(),
    name: z.string(),
    body: z.array(z.union([
      z.object({ type: z.literal('p'), text: z.string() }),
      z.object({ type: z.literal('benefit'), label: z.string(), text: z.string() }),
      z.object({ type: z.literal('ul'), items: z.array(z.string()) }),
    ])),
    priceLine: z.string(),
    prices: z.array(z.object({ durationMin: z.number(), priceEur: z.number() })),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    order: z.number().int(),
  }),
});

export const collections = { services, faq, legal, treatments };
