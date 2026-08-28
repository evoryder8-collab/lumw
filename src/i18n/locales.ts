/**
 * The six locales.
 *
 * German is canonical and keeps the twenty-five live URLs exactly as they are:
 * `/about`, not `/de/about`. That is not a style choice, it is the entire
 * migration strategy (CLAUDE.md section 7) and nothing may move it. The other
 * five sit under a prefix and translate their slugs, per section 4.
 *
 * Because `/` must keep serving the German home page byte-identically, the
 * language portal cannot be a page at the root the way it is on
 * iConstantine-Packages-v2. It is an overlay instead: the HTML at `/` is still
 * the full German page for crawlers and for anyone arriving from search, and
 * the portal is a layer on top shown once per visitor.
 */

export const LOCALES = ['de', 'en', 'th', 'es', 'pt', 'it'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'de';

export interface LocaleMeta {
  code: Locale;
  /** BCP 47 tag for `lang` and `hreflang`. */
  tag: string;
  /** Endonym: the language's name in its own language, never translated. */
  name: string;
  /** Regional flag, as an emoji sequence. */
  flag: string;
  /** URL prefix. German has none. */
  prefix: string;
  /** The line the portal shows while that tile is focused. */
  greeting: string;
  /**
   * Whether the pages for this locale actually exist yet.
   *
   * The portal will not link to a locale that is not built. Offering a tile
   * that 404s is worse than not offering it, and section 7 is unambiguous that
   * no path on this site may fail to resolve. Flip to true in the same change
   * that adds the pages.
   */
  available: boolean;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  de: { code: 'de', tag: 'de-DE', name: 'Deutsch',   flag: '🇩🇪', prefix: '',    greeting: 'Herzlich willkommen',  available: true },
  en: { code: 'en', tag: 'en',    name: 'English',   flag: '🇬🇧', prefix: '/en', greeting: 'A very warm welcome',  available: false },
  th: { code: 'th', tag: 'th',    name: 'ไทย',       flag: '🇹🇭', prefix: '/th', greeting: 'ยินดีต้อนรับ',          available: false },
  es: { code: 'es', tag: 'es',    name: 'Español',   flag: '🇪🇸', prefix: '/es', greeting: 'Bienvenido de corazón', available: false },
  pt: { code: 'pt', tag: 'pt',    name: 'Português', flag: '🇵🇹', prefix: '/pt', greeting: 'Seja muito bem-vindo',  available: false },
  it: { code: 'it', tag: 'it',    name: 'Italiano',  flag: '🇮🇹', prefix: '/it', greeting: 'Un caloroso benvenuto', available: false },
};

/** Locales whose pages exist. The only ones anything may link to. */
export const AVAILABLE = LOCALES.filter((l) => LOCALE_META[l].available);

/** Locales other than German, in the order the portal lists them. */
export const ALTERNATES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

/**
 * Translated slugs.
 *
 * Section 4: "Translate slugs, not just body copy." The German keys are the
 * live paths and never change; each locale supplies its own path for the same
 * page, so hreflang can pair them up.
 */
export const ROUTES = {
  home:     { de: '/',                       en: '/en',                          th: '/th',                          es: '/es',                             pt: '/pt',                             it: '/it' },
  about:    { de: '/about',                  en: '/en/about',                    th: '/th/about',                    es: '/es/sobre-mi',                    pt: '/pt/sobre-mim',                   it: '/it/chi-sono' },
  services: { de: '/meineangebote-preise',   en: '/en/treatments-prices',        th: '/th/treatments-prices',        es: '/es/tratamientos-precios',        pt: '/pt/tratamentos-precos',          it: '/it/trattamenti-prezzi' },
  faq:      { de: '/massage-buxtehude-faq',  en: '/en/massage-buxtehude-faq',    th: '/th/massage-buxtehude-faq',    es: '/es/masaje-buxtehude-faq',        pt: '/pt/massagem-buxtehude-faq',      it: '/it/massaggio-buxtehude-faq' },
  contact:  { de: '/contact',                en: '/en/contact',                  th: '/th/contact',                  es: '/es/contacto',                    pt: '/pt/contacto',                    it: '/it/contatti' },
} as const satisfies Record<string, Record<Locale, string>>;

export type RouteKey = keyof typeof ROUTES;

export const routePath = (key: RouteKey, locale: Locale): string => ROUTES[key][locale];

/** Every locale's version of one page, for reciprocal hreflang. */
export const alternatesFor = (key: RouteKey) =>
  LOCALES.map((l) => ({ locale: l, tag: LOCALE_META[l].tag, path: ROUTES[key][l] }));
