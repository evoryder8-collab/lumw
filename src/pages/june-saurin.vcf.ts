import type { APIRoute } from 'astro';
import { BUSINESS, SITE_URL } from '../lib/site';

export const GET: APIRoute = () => {
  const vcard = [
    'BEGIN:VCARD', 'VERSION:3.0', 'N:Saurin;June;;;', 'FN:June Saurin',
    `ORG:${BUSINESS.shortName}`, `TEL;TYPE=CELL:${BUSINESS.phoneE164}`,
    `EMAIL;TYPE=WORK:${BUSINESS.email}`,
    `ADR;TYPE=WORK:;;${BUSINESS.street};${BUSINESS.city};;${BUSINESS.postalCode};Deutschland`,
    `URL:${SITE_URL}`, 'END:VCARD', '',
  ].join('\r\n');
  return new Response(vcard, { headers: {
    'Content-Type': 'text/vcard; charset=utf-8',
    'Content-Disposition': 'attachment; filename="June-Saurin.vcf"',
  } });
};
