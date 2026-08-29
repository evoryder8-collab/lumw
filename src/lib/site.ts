/**
 * Single source of truth for NAP and business facts.
 *
 * CLAUDE.md section 7: name, address and phone must match the Google Business
 * Profile character for character. That consistency is what protects the number
 * one Maps position, so nothing here gets "tidied" without checking the profile
 * first.
 *
 * The live site spells the street three ways across pages (Hauptstraße,
 * Hauptstrasse, and with or without the trailing comma). Visible page copy stays
 * verbatim per the migration rule; structured data uses the one correct form
 * below so Google sees a single consistent NAP.
 */

export const SITE_URL = 'https://www.luma-wellness.com';

/**
 * Prefix an internal path with the deploy base. Canonicals and structured data
 * always use the production URL; only href attributes need the staging prefix.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (p: string) => (p === '/' ? `${BASE}/` : `${BASE}${p}`);

export const BUSINESS = {
  name: 'LUMA WELLNESS by June Saurin',
  shortName: 'LUMA Wellness',
  legalOwner: 'June Saurin',
  street: 'Hauptstraße 19',
  postalCode: '21614',
  city: 'Buxtehude',
  region: 'Niedersachsen',
  country: 'DE',
  phone: '+49 1788875085',
  phoneE164: '+491788875085',
  whatsapp: '+49 178 8875085',
  email: 'june@luma-wellness.com',
  priceRange: '€€',
  // Studio sits inside the HAUTNAH branch, which the copy points out on two pages.
  /* Geocoded via Nominatim from "hautnah, 19 Hauptstraße, 21614 Buxtehude",
     which is the branch the studio sits inside. The previous pair was roughly
     a kilometre out, which put the geo node in the wrong place for local
     search. Verify against the Business Profile before changing. */
  geo: { lat: 53.4679964, lng: 9.6892602 },
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=LUMA+Wellness+Hauptstra%C3%9Fe+19+21614+Buxtehude',
  sameAs: [
    'https://www.facebook.com/lumawellnessbuxtehude',
    'https://www.instagram.com/luma_wellness_buxtehude',
  ],
} as const;

/**
 * Retained for the Google Business Profile, which still carries hours, but no
 * longer rendered or marked up: the site states "Termine nur nach vorheriger
 * Absprache" and nothing else. Do not re-introduce it to a page without
 * re-checking the profile first.
 */
export const OPENING_HOURS = [
  { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '10:00', closes: '18:00' },
  { days: ['Saturday'], opens: '11:00', closes: '16:00' },
] as const;

/**
 * June's competition record.
 *
 * CLAUDE.md section 4: almost no massage studio has a verifiable award record
 * and almost none mark it up. This is the single strongest E-E-A-T signal on the
 * site, so it goes in Person.award and gets rendered as text as well.
 */
export const AWARDS = [
  {
    award: 'Goldmedaille, Universal Massage Championship 2023, Kategorie Wellness & Spa',
    short: 'Gold, Wellness & Spa',
    metal: 'gold' as const,
    event: 'Universal Massage Championship 2023',
    place: 'Penzberg, Deutschland',
    year: '2023',
  },
  {
    award: 'Silbermedaille, Universal Massage Championship 2023, Kategorie Freestyle Eastern',
    short: 'Silber, Freestyle Eastern',
    metal: 'silver' as const,
    event: 'Universal Massage Championship 2023',
    place: 'Penzberg, Deutschland',
    year: '2023',
  },
  {
    award: '3. Platz, Champ of the Champs Award, Universal Massage Championship 2023',
    short: '3. Platz, Champ of Champs',
    metal: 'bronze' as const,
    event: 'Universal Massage Championship 2023',
    place: 'Penzberg, Deutschland',
    year: '2023',
  },
  {
    award: 'Silbermedaille, Schweizer Massage-Meisterschaft Zürich 2023, Kategorie Wellness',
    short: 'Silber, Zürich',
    metal: 'silver' as const,
    event: 'Schweizer Massage-Meisterschaft',
    place: 'Zürich, Schweiz',
    year: '2023',
  },
  {
    award: 'Silbermedaille, Intercontinental Massage Championship Athen 2023',
    short: 'Silber, Athen',
    metal: 'silver' as const,
    event: 'Intercontinental Massage Championship',
    place: 'Athen, Griechenland',
    year: '2023',
  },
] as const;

/**
 * WhatsApp deep links, with the message already typed.
 *
 * wa.me accepts a ?text= parameter and WhatsApp drops it straight into the
 * compose field. Someone arriving from a service page should not have to
 * explain which treatment they were looking at - the message already says it,
 * and all they do is press send. Kept in German, in June's voice, and phrased
 * as an opening rather than a completed request so it never puts words in the
 * visitor's mouth about dates or times.
 */
export const WA_DEFAULT =
  'Hallo June, ich würde gerne einen Termin bei LUMA Wellness vereinbaren.';

export function whatsappUrl(message: string = WA_DEFAULT): string {
  const n = BUSINESS.phoneE164.replace('+', '');
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

/** Message for a specific treatment, so the enquiry arrives already framed. */
export function whatsappForService(name: string, durationMin?: number): string {
  const clean = name.replace(/^\d+\s*min\.?\s*/i, '').trim();
  const dur = durationMin ? ` (${durationMin} Min.)` : '';
  return whatsappUrl(
    `Hallo June, ich interessiere mich für die ${clean}${dur} und würde gerne einen Termin vereinbaren.`,
  );
}

/** Navigation. "UBER MICH" has no umlaut on the live site and stays that way
 *  at cutover: it is inconsistency 7 on the fix-later list, not a typo to fix
 *  in this release. */
export const NAV = [
  { label: 'MEINE ANGEBOTE & PREISE', href: '/meineangebote-preise' },
  { label: 'UBER MICH', href: '/about' },
  { label: 'FAQ', href: '/massage-buxtehude-faq' },
  { label: 'KONTAKT', href: '/contact' },
] as const;

/**
 * A treatment's name as a human should read it.
 *
 * Eight of the nine names arrived from the Wix scrape with a leading "| ",
 * which was a layout separator in the old page rather than part of the name.
 * It is not content: dropping it changes no keyword and loses no word that
 * meant anything. It was already being stripped at two render sites, so this
 * exists to stop a third copy of the regex drifting from the other two - the
 * structured data on the home page was advertising treatments called
 * "| STARK BALL MASSAGE".
 */
export const treatmentName = (raw: string): string => raw.replace(/^\|\s*/, '').trim();
