/**
 * One @graph per page, not scattered snippets (CLAUDE.md section 4).
 *
 * Nodes are @id-linked so Google reads one connected entity rather than a pile
 * of unrelated objects. The Person node carries June's competition record in
 * `award`, which is the single strongest E-E-A-T signal on the site: almost no
 * massage studio has a verifiable award record and almost none mark it up.
 *
 * No AggregateRating and no Review anywhere. Fake review markup earns a manual
 * action, and separately it is a misleading commercial practice under German
 * UWG, which means a competitor can send an abmahnung with costs attached.
 */

import { SITE_URL, BUSINESS, AWARDS } from './site';

type Node = Record<string, unknown>;

export const ID = {
  business: `${SITE_URL}/#business`,
  june: `${SITE_URL}/#june`,
  website: `${SITE_URL}/#website`,
  org: `${SITE_URL}/#organization`,
  page: (path: string) => `${SITE_URL}${path === '/' ? '/' : path}#webpage`,
  breadcrumb: (path: string) => `${SITE_URL}${path === '/' ? '/' : path}#breadcrumb`,
  service: (family: string) => `${SITE_URL}/#service-${family}`,
} as const;

const abs = (path: string) => `${SITE_URL}${path === '/' ? '/' : path}`;

/** The studio. Hours, NAP and service names must match the Business Profile. */
export function businessNode(imageUrls: string[] = []): Node {
  return {
    '@type': 'HealthAndBeautyBusiness',
    '@id': ID.business,
    name: BUSINESS.name,
    alternateName: BUSINESS.shortName,
    url: SITE_URL,
    telephone: BUSINESS.phone,
    email: BUSINESS.email,
    priceRange: BUSINESS.priceRange,
    currenciesAccepted: 'EUR',
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS.street,
      postalCode: BUSINESS.postalCode,
      addressLocality: BUSINESS.city,
      addressRegion: BUSINESS.region,
      addressCountry: BUSINESS.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: BUSINESS.geo.lat,
      longitude: BUSINESS.geo.lng,
    },
    hasMap: BUSINESS.mapUrl,
    /* No openingHoursSpecification: the site states "Termine nur nach
       vorheriger Absprache" and nothing else, so publishing hours in the
       markup would contradict the page. Note this drops one of the
       Business Profile corroboration signals section 4 asks for. */
    areaServed: [
      'Buxtehude', 'Stade', 'Harburg', 'Neu Wulmstorf',
      'Jork', 'Horneburg', 'Apensen', 'Landkreis Stade',
    ].map((name) => ({ '@type': 'City', name })),
    ...(imageUrls.length ? { image: imageUrls } : {}),
    sameAs: [...BUSINESS.sameAs],
    founder: { '@id': ID.june },
    employee: { '@id': ID.june },
    knowsLanguage: ['de', 'en', 'th'],
  };
}

/** June. The award array is the point of this node. */
export function personNode(imageUrl?: string): Node {
  return {
    '@type': 'Person',
    '@id': ID.june,
    name: 'June Saurin',
    givenName: 'June',
    familyName: 'Saurin',
    jobTitle: 'Massagetherapeutin',
    description:
      'International ausgezeichnete Massage-Expertin, ursprünglich in Thailand geboren und heute in Buxtehude ansässig. Gewinnerin mehrerer internationaler Massage-Meisterschaften 2023.',
    url: abs('/about'),
    ...(imageUrl ? { image: imageUrl } : {}),
    worksFor: { '@id': ID.business },
    nationality: { '@type': 'Country', name: 'Thailand' },
    award: AWARDS.map((a) => a.award),
    hasCredential: AWARDS.map((a) => ({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'award',
      name: a.award,
      dateCreated: a.year,
      recognizedBy: { '@type': 'Organization', name: a.event },
    })),
    knowsAbout: [
      'Thai-Massage', 'Aromatherapie-Massage', 'Hot-Stone-Massage',
      'Schwangerschaftsmassage', 'Schröpftherapie', 'Gua Sha',
      'Sportmassage', 'Faszienbehandlung',
    ],
  };
}

export function websiteNode(): Node {
  return {
    '@type': 'WebSite',
    '@id': ID.website,
    url: SITE_URL,
    name: BUSINESS.name,
    inLanguage: 'de-DE',
    publisher: { '@id': ID.business },
  };
}

export function webPageNode(opts: {
  path: string;
  title: string;
  description: string;
  imageUrl?: string;
  hasBreadcrumb?: boolean;
}): Node {
  return {
    '@type': 'WebPage',
    '@id': ID.page(opts.path),
    url: abs(opts.path),
    name: opts.title,
    description: opts.description,
    inLanguage: 'de-DE',
    isPartOf: { '@id': ID.website },
    about: { '@id': ID.business },
    ...(opts.imageUrl ? { primaryImageOfPage: opts.imageUrl } : {}),
    ...(opts.hasBreadcrumb ? { breadcrumb: { '@id': ID.breadcrumb(opts.path) } } : {}),
  };
}

/** BreadcrumbList on every page below the root. */
export function breadcrumbNode(path: string, trail: { name: string; path: string }[]): Node {
  return {
    '@type': 'BreadcrumbList',
    '@id': ID.breadcrumb(path),
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: abs(t.path),
    })),
  };
}

/**
 * A Service per treatment, each with an Offer per duration carrying price and
 * priceCurrency exactly as they appear in the copy.
 */
export function serviceNode(opts: {
  family: string;
  name: string;
  description: string;
  offers: { durationMin: number; priceEur: number; url?: string }[];
  imageUrl?: string;
  url?: string;
}): Node {
  return {
    '@type': 'Service',
    '@id': ID.service(opts.family),
    name: opts.name,
    description: opts.description,
    serviceType: 'Massage',
    category: 'Massage',
    provider: { '@id': ID.business },
    areaServed: { '@type': 'City', name: BUSINESS.city },
    ...(opts.url ? { url: opts.url } : {}),
    ...(opts.imageUrl ? { image: opts.imageUrl } : {}),
    offers: opts.offers.map((o) => ({
      '@type': 'Offer',
      price: String(o.priceEur),
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      category: `${o.durationMin} Minuten`,
      eligibleDuration: {
        '@type': 'QuantitativeValue',
        value: o.durationMin,
        unitCode: 'MIN',
      },
      ...(o.url ? { url: o.url } : {}),
      seller: { '@id': ID.business },
    })),
  };
}

/** FAQPage built from the eleven live entries. */
export function faqNode(path: string, entries: { question: string; answerText: string }[]): Node {
  return {
    '@type': 'FAQPage',
    '@id': `${abs(path)}#faq`,
    mainEntity: entries.map((e) => ({
      '@type': 'Question',
      name: e.question,
      acceptedAnswer: { '@type': 'Answer', text: e.answerText },
    })),
  };
}

/** Wrap a set of nodes as the page's single @graph. */
export function graph(nodes: Node[]) {
  return { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) };
}
