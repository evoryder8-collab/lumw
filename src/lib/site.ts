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
  geo: { lat: 53.4761, lng: 9.6994 },
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=LUMA+Wellness+Hauptstra%C3%9Fe+19+21614+Buxtehude',
  sameAs: [
    'https://www.facebook.com/lumawellnessbuxtehude',
    'https://www.instagram.com/luma_wellness_buxtehude',
  ],
} as const;

/** Mo-Fr 10:00-18:00, Sa 11:00-16:00, Sunday closed. Must match the profile. */
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
    event: 'Universal Massage Championship 2023',
    place: 'Penzberg, Deutschland',
    year: '2023',
  },
  {
    award: 'Silbermedaille, Universal Massage Championship 2023, Kategorie Freestyle Eastern',
    short: 'Silber, Freestyle Eastern',
    event: 'Universal Massage Championship 2023',
    place: 'Penzberg, Deutschland',
    year: '2023',
  },
  {
    award: '3. Platz, Champ of the Champs Award, Universal Massage Championship 2023',
    short: '3. Platz, Champ of Champs',
    event: 'Universal Massage Championship 2023',
    place: 'Penzberg, Deutschland',
    year: '2023',
  },
  {
    award: 'Silbermedaille, Schweizer Massage-Meisterschaft Zürich 2023, Kategorie Wellness',
    short: 'Silber, Zürich',
    event: 'Schweizer Massage-Meisterschaft',
    place: 'Zürich, Schweiz',
    year: '2023',
  },
  {
    award: 'Silbermedaille, Intercontinental Massage Championship Athen 2023',
    short: 'Silber, Athen',
    event: 'Intercontinental Massage Championship',
    place: 'Athen, Griechenland',
    year: '2023',
  },
] as const;

/** Navigation. "UBER MICH" has no umlaut on the live site and stays that way
 *  at cutover: it is inconsistency 7 on the fix-later list, not a typo to fix
 *  in this release. */
export const NAV = [
  { label: 'MEINE ANGEBOTE & PREISE', href: '/meineangebote-preise' },
  { label: 'UBER MICH', href: '/about' },
  { label: 'FAQ', href: '/massage-buxtehude-faq' },
  { label: 'KONTAKT', href: '/contact' },
] as const;
