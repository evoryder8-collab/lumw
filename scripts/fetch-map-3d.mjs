#!/usr/bin/env node
/**
 * Build the 3D city data around the studio for the location map.
 *
 * Same principle as fetch-map.mjs: OpenStreetMap geometry is fetched once,
 * projected and committed, so visitors never request anything from a third
 * party (CLAUDE.md section 6). This file adds what the 3D view needs: a wider
 * area for the fly-in and a height for every building, from its `height` tag
 * where mapped, otherwise from its storeys.
 *
 * Output: public/map/studio-3d.json. Coordinates are metres from the studio,
 * x east and y south, in half-metre integers. Run with `npm run map:3d`.
 *
 * Data © OpenStreetMap contributors, ODbL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/map/studio-3d.json');
const CENTRE = { lat: 53.4679964, lon: 9.6892602 };
const RADIUS = 620;
const UA = 'luma-wellness-build/1.0 (constantine@official.productions)';
const M_LAT = 111_320, M_LON = 111_320 * Math.cos((CENTRE.lat * Math.PI) / 180);
const project = (lat, lon) => [Math.round((lon - CENTRE.lon) * M_LON * 2), Math.round((CENTRE.lat - lat) * M_LAT * 2)];
const WIDTH = { motorway: 16, trunk: 14, primary: 12, secondary: 11, tertiary: 9, unclassified: 6.5, residential: 6.5, living_street: 5.5, pedestrian: 5, service: 3.5 };

const dLat = RADIUS / M_LAT, dLon = RADIUS / M_LON;
const box = `${CENTRE.lat - dLat},${CENTRE.lon - dLon},${CENTRE.lat + dLat},${CENTRE.lon + dLon}`;
const query = `[out:json][timeout:90];
(
  way["building"](${box});
  way["building:part"](${box});
  way["highway"](${box});
  way["natural"="water"](${box});
  way["waterway"~"river|canal"](${box});
  way["leisure"="park"](${box});
  way["landuse"="grass"](${box});
);
out geom;`;

async function overpass() {
  let last;
  for (const url of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain', 'User-Agent': UA }, body: query });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (error) { last = error; console.error(`  ${url} failed: ${error.message}`); }
  }
  throw last;
}

const metres = (value) => { const n = parseFloat(String(value ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };
/** Height in metres: the mapped height, else storeys plus a pitched roof, else by use. */
function heightOf(t) {
  const mapped = metres(t.height);
  if (mapped) return Math.min(mapped, 90);
  const levels = metres(t['building:levels']), roof = metres(t['roof:levels']);
  if (levels) return levels * 3.1 + roof * 2.2 + 1.8;
  const kind = t.building ?? '';
  if (/church|cathedral/.test(kind)) return 22;
  if (/garage|shed|carport|roof/.test(kind)) return 3;
  if (/apartments|commercial|retail|office|school|public/.test(kind)) return 10.5;
  return 7.5;
}

console.log('Fetching OpenStreetMap geometry for the 3D map…');
const data = await overpass();
const buildings = [], roads = [], water = [], green = [], route = [];
for (const el of data.elements) {
  if (!el.geometry || el.geometry.length < 2) continue;
  const t = el.tags ?? {};
  const pts = el.geometry.map((g) => project(g.lat, g.lon));
  const flat = pts.flat();
  if (t.building || t['building:part']) {
    if (pts.length < 4) continue;
    let area = 0;
    for (let i = 0; i < pts.length - 1; i++) area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
    if (Math.abs(area / 8) < 12) continue; // under 12 m², in half-metre units squared
    // Drop the closing duplicate; the renderer closes rings itself.
    const ring = flat.slice(0, -2);
    buildings.push([Math.round(heightOf(t) * 2), Math.round(metres(t.min_height) * 2), ...ring]);
  } else if (t.highway && WIDTH[t.highway]) {
    roads.push([Math.round(WIDTH[t.highway] * 2), ...flat]);
    // The studio's own street carries the animated approach.
    if (t.name === 'Hauptstraße') route.push(flat);
  } else if (t.natural === 'water' || t.waterway) {
    (t.waterway && !t.natural ? roads : water).push(t.waterway && !t.natural ? [t.waterway === 'river' ? 24 : 12, ...flat, -1] : flat);
  } else if (t.leisure === 'park' || t.landuse === 'grass') {
    green.push(flat);
  }
}
// Waterway lines were tagged with a trailing -1; separate them.
const rivers = roads.filter((r) => r.at(-1) === -1).map((r) => r.slice(0, -1));
const streets = roads.filter((r) => r.at(-1) !== -1).sort((a, b) => b[0] - a[0]);
const out = {
  _comment: 'OpenStreetMap geometry around LUMA Wellness for the 3D location map. Metres from the studio in half-metre integers, x east, y south. Buildings: [height, base, x0, y0, ...]. Streets and rivers: [width, x0, y0, ...]. Route: Hauptstraße polylines. Regenerate with `npm run map:3d`. Data © OpenStreetMap contributors, ODbL.',
  attribution: '© OpenStreetMap contributors',
  radius: RADIUS,
  buildings, streets, rivers, water, green, route,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`  route ${route.length}, buildings ${buildings.length}, streets ${streets.length}, rivers ${rivers.length}, water ${water.length}, green ${green.length}`);
console.log(`  tallest ${Math.max(...buildings.map((b) => b[0])) / 2} m`);
console.log(`wrote ${path.relative(ROOT, OUT)} ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
