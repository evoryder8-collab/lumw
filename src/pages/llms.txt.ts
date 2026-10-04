/**
 * Plain-text description of the business for AI search, per CLAUDE.md section 4.
 * Generated from the same content collections the pages render, so prices here
 * can never drift from prices on the site.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { BUSINESS, AWARDS, SITE_URL } from '../lib/site';
import faceCopy from '../i18n/face-care.json';

export const GET: APIRoute = async () => {
  const treatments = (await getCollection('treatments')).sort((a, b) => a.data.order - b.data.order);
  const faq = (await getCollection('faq')).sort((a, b) => a.data.order - b.data.order);

  const body = `# LUMA WELLNESS by June Saurin

> Massagestudio in Buxtehude, Niedersachsen. Geleitet von June Saurin, einer
> international ausgezeichneten Massagetherapeutin aus Thailand. Termine nur
> nach vorheriger Absprache.

## Kontakt und Standort

- Name: ${BUSINESS.name}
- Adresse: ${BUSINESS.street}, ${BUSINESS.postalCode} ${BUSINESS.city}, Deutschland
- Hinweis: Das Studio befindet sich in der Filiale HAUTNAH.
- Telefon: ${BUSINESS.phone}
- WhatsApp: ${BUSINESS.whatsapp}
- E-Mail: ${BUSINESS.email}
- Website: ${SITE_URL}
- Termin anfragen: ${SITE_URL}/contact

## Termine

- Termine nur nach vorheriger Absprache.
- Anfragen per Telefon, WhatsApp oder E-Mail.

## Auszeichnungen

June Saurin hat 2023 bei drei internationalen Massage-Meisterschaften Medaillen
gewonnen:

${AWARDS.map((a) => `- ${a.award} (${a.place})`).join('\n')}

## Massagen und Preise

${treatments
  .map((t) => {
    const name = t.data.name.replace(/^\|\s*/, '').trim();
    const prices = t.data.prices.map((p) => `${p.variant ? faceCopy.de.variants[p.variant] + ': ' : ''}${p.durationMin} Min. ${p.priceEur} EUR`).join(', ');
    const intro = t.data.body.find((b) => b.type === 'p');
    return `### ${name}\n${prices}\n${intro && intro.type === 'p' ? intro.text : ''}`;
  })
  .join('\n\n')}

## Häufige Fragen

${faq.map((f) => `- ${f.data.question}`).join('\n')}

Vollständige Antworten: ${SITE_URL}/massage-buxtehude-faq

## Hinweise

- Stornierungen bitte mindestens 24 Stunden im Voraus. Bei kurzfristiger Absage
  oder Nichterscheinen werden 100% des vereinbarten Terminpreises berechnet, abzüglich
  ersparter Aufwendungen und Einnahmen aus einer Ersatzbuchung. Der Nachweis keines
  oder eines wesentlich geringeren Schadens bleibt möglich. Eine einmalige Kulanz
  liegt im Ermessen der Massageanbieterin und setzt einen aktiven Kontaktversuch spätestens am
  Vormittag des Termintags voraus. Bei erstmaligem Kontakt weniger als eine Stunde
  vor dem Termin ist sie ausgeschlossen. Gilt für Buchungen ab 4. Oktober 2026.
  Details: https://www.luma-wellness.com/nutzungsbedingungen#cancellation-policy
- Alle Preise in Euro, Stand der Website.
- Diese Seite dient der maschinellen Zusammenfassung. Verbindlich sind die
  Angaben auf ${SITE_URL}.
`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
