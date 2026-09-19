import type { Locale } from '../i18n/locales';

// Placements, categories and photo-award story confirmed by June's site owner,
// 18 September 2026. The photography prize is distinct from massage divisions.
const records = [
  { id: 'penzberg-gold', rank: 1, metal: 'gold', event: 'Universal Massage Championship', category: 'Wellness & Spa', city: 'penzberg', year: '2023' },
  { id: 'penzberg-silver', rank: 2, metal: 'silver', event: 'Universal Massage Championship', category: 'Freestyle Eastern', city: 'penzberg', year: '2023' },
  { id: 'penzberg-bronze', rank: 3, metal: 'bronze', event: 'Universal Massage Championship', category: 'Champ of the Champs', city: 'penzberg', year: '2023' },
  { id: 'swiss-silver', rank: 2, metal: 'silver', event: 'Swiss Massage Championship', category: 'Freestyle Eastern', city: 'zurich', year: '2023' },
  { id: 'athens-silver', rank: 2, metal: 'silver', event: 'World Massage Federation (WMF)', category: 'Wellness & Spa', city: 'athens', year: '2023' },
  { id: 'paris-photo-gold', rank: 1, metal: 'gold', event: 'Best Massage Photo', category: 'photo', city: 'paris', year: '2026' },
] as const;

const words = {
  de: { ranks: ['1. Platz', '2. Platz', '3. Platz'], metals: ['Gold', 'Silber', 'Bronze'], places: ['Penzberg, Deutschland', 'Zürich, Schweiz', 'Athen, Griechenland', 'Paris, Frankreich'], photo: 'Internationaler Fotowettbewerb für Massagefachkräfte', champs: 'Gesamtwertung im Wettbewerb mit den Champions der anderen Massagekategorien.' },
  en: { ranks: ['1st place', '2nd place', '3rd place'], metals: ['Gold', 'Silver', 'Bronze'], places: ['Penzberg, Germany', 'Zurich, Switzerland', 'Athens, Greece', 'Paris, France'], photo: 'International massage practitioners’ photography contest', champs: 'Overall ranking against champions from the other massage categories.' },
  es: { ranks: ['1.er puesto', '2.º puesto', '3.er puesto'], metals: ['Oro', 'Plata', 'Bronce'], places: ['Penzberg, Alemania', 'Zúrich, Suiza', 'Atenas, Grecia', 'París, Francia'], photo: 'Concurso internacional de fotografía para profesionales del masaje', champs: 'Clasificación general frente a los campeones de las demás categorías de masaje.' },
  pt: { ranks: ['1.º lugar', '2.º lugar', '3.º lugar'], metals: ['Ouro', 'Prata', 'Bronze'], places: ['Penzberg, Alemanha', 'Zurique, Suíça', 'Atenas, Grécia', 'Paris, França'], photo: 'Concurso internacional de fotografia para profissionais de massagem', champs: 'Classificação geral entre os campeões das outras categorias de massagem.' },
  it: { ranks: ['1º posto', '2º posto', '3º posto'], metals: ['Oro', 'Argento', 'Bronzo'], places: ['Penzberg, Germania', 'Zurigo, Svizzera', 'Atene, Grecia', 'Parigi, Francia'], photo: 'Concorso internazionale di fotografia per professionisti del massaggio', champs: 'Classifica generale tra i campioni delle altre categorie di massaggio.' },
  fr: {"ranks": ["1re place", "2e place", "3e place"], "metals": ["Or", "Argent", "Bronze"], "places": ["Penzberg, Allemagne", "Zurich, Suisse", "Athènes, Grèce", "Paris, France"], "photo": "Concours international de photographie pour praticiens du massage", "champs": "Classement général entre les champions des différentes catégories de massage."},
};

export function awardsFor(locale: Locale = 'de') {
  const t = words[locale];
  return records.map((record) => {
    const event = record.event;
    const category = record.category === 'photo' ? t.photo : record.category;
    const place = t.places[['penzberg', 'zurich', 'athens', 'paris'].indexOf(record.city)];
    const placement = `${t.ranks[record.rank - 1]} · ${t.metals[record.rank - 1]}`;
    return { ...record, event, category, place, placement,
      short: `${t.metals[record.rank - 1]} · ${record.category === 'photo' ? 'Best Massage Photo' : category}`,
      award: `${placement}, ${category}, ${event}, ${place}, ${record.year}`,
      note: record.id === 'penzberg-bronze' ? t.champs : '',
    };
  });
}
