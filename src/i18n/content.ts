import en from './en.json';
import es from './es.json';
import pt from './pt.json';
import it from './it.json';
import fr from './fr.json';
import type { Locale, RouteKey } from './locales';
import { routePath } from './locales';

export const translations = { en, fr, es, pt, it };
export type TranslatedLocale = keyof typeof translations;
export type Translation = typeof en;

const de: typeof en.ui = {
  home: 'Startseite', book: 'Termin anfragen', appointment: 'Nur nach Terminvereinbarung',
  language: 'Sprache wählen', close: 'Schließen', skip: 'Zum Inhalt springen', menu: 'Menü',
  phone: 'Anrufen', email: 'E-Mail', address: 'Adresse', follow: 'June folgen',
  privacy: 'Datenschutzrichtlinie', terms: 'Nutzungsbedingungen', all: 'Alle Angebote & Preise',
  details: 'Details & Termin', minutes: 'Min.', from: 'ab', awards: 'International ausgezeichnet',
  directions: 'Route planen', firstName: 'Vorname', lastName: 'Nachname',
  preferred: 'Wunschtermin oder Zeitraum', message: 'Ihre Nachricht', select: 'Massage auswählen',
  optional: 'Optional', requestTitle: 'Schreiben Sie June.',
  requestIntro: 'Erzählen Sie June, was Sie sich wünschen. Sie hilft Ihnen bei der Auswahl einer Massage und findet mit Ihnen einen passenden Termin.',
  whatsapp: 'Weiter zu WhatsApp', sendEmail: 'Weiter zur E-Mail',
  enquiryNote: 'Das Formular bereitet Ihre Nachricht vor. Anschließend senden Sie sie per WhatsApp oder E-Mail. June bestätigt Ihren Termin persönlich.',
  prepared: 'Ihre Nachricht ist fertig. Wählen Sie WhatsApp oder E-Mail, um sie an June zu senden.',
  unsure: 'Ich wünsche mir eine Empfehlung', back: 'Zurück zu den Angeboten',
  legal: 'Rechtliche Informationen', journey: 'Ihr Besuch. In Ihrem Tempo.',
  signature: 'Ausgewählte Massagen', studio: 'Das Studio in Buxtehude',
  scroll: 'LUMA entdecken', portrait: 'June Saurin mit ihrer Medaille bei einer internationalen Massage-Meisterschaft',
  gold: 'Gold · Wellness & Spa', greeting: 'Hallo June, ich möchte gerne einen Termin bei LUMA Wellness anfragen.',
};

export const labels = (locale: Locale = 'de'): typeof en.ui => locale === 'de' ? de : translations[locale].ui;
export function navigation(locale: Locale) {
  const names = locale === 'de' ? ['MEINE ANGEBOTE & PREISE', 'ÜBER JUNE', 'FAQ', 'KONTAKT'] : translations[locale].nav;
  return (['services', 'about', 'faq', 'contact'] as RouteKey[]).map((key, i) => ({ label: names[i], href: routePath(key, locale) }));
}
