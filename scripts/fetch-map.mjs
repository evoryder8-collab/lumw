#!/usr/bin/env node
/**
 * Build the vector map of the streets around the studio.
 *
 * Why not an embed or a static tile image: both are a third-party request on
 * page load, which is exactly what CLAUDE.md section 6 says to avoid so the
 * site needs no consent banner. This pulls the real geometry from
 * OpenStreetMap once, projects it, and writes a plain data file that is
 * committed. The site then renders actual streets and building footprints as
 * inline SVG, with no runtime request to anyone.
 *
 * Run with `npm run map`. The output is checked in, so a build never depends
 * on Overpass being reachable.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/data/map.json');

/** The studio, geocoded from "hautnah, 19 Hauptstraße, 21614 Buxtehude". */
const CENTRE = { lat: 53.4679964, lon: 9.6892602 };
/** Half-width of the frame in metres. Enough to show the street pattern. */
const RADIUS = 320;

const UA = 'luma-wellness-build/1.0 (constantine@official.productions)';

const M_PER_DEG_LAT = 111_320;
const mPerDegLon = (lat) => 111_320 * Math.cos((lat * Math.PI) / 180);

const bbox = () => {
  const dLat = RADIUS / M_PER_DEG_LAT;
  const dLon = RADIUS / mPerDegLon(CENTRE.lat);
  return [CENTRE.lat - dLat, CENTRE.lon - dLon, CENTRE.lat + dLat, CENTRE.lon + dLon];
};

/** Local equirectangular projection into a 0..1000 square. Fine at this scale. */
function project(lat, lon) {
  const x = ((lon - CENTRE.lon) * mPerDegLon(CENTRE.lat)) / RADIUS; // -1..1
  const y = ((CENTRE.lat - lat) * M_PER_DEG_LAT) / RADIUS;          // -1..1, y down
  return [+(500 + x * 500).toFixed(1), +(500 + y * 500).toFixed(1)];
}

/** Street classes we draw, widest first. Anything else is skipped. */
/* Footpaths, cycleways and desire lines are dropped: at this scale they read
   as noise over the street pattern and were a third of the payload. */
const ROAD_WEIGHT = {
  motorway: 9, trunk: 8, primary: 7, secondary: 6, tertiary: 5,
  unclassified: 3.4, residential: 3.4, living_street: 3,
  pedestrian: 2.6, service: 1.8,
};

const query = () => {
  const [s, w, n, e] = bbox();
  const box = `${s},${w},${n},${e}`;
  return `[out:json][timeout:60];
(
  way["highway"](${box});
  way["building"](${box});
  way["natural"="water"](${box});
  way["waterway"="river"](${box});
  way["leisure"="park"](${box});
);
out geom;`;
};

async function overpass() {
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  let lastErr;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', 'User-Agent': UA },
        body: query(),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      console.error(`  ${url} failed: ${err.message}`);
    }
  }
  throw lastErr;
}

const inFrame = (pts) => pts.some(([x, y]) => x > -80 && x < 1080 && y > -80 && y < 1080);

console.log('Fetching OpenStreetMap geometry around the studio…');
const data = await overpass();
console.log(`  ${data.elements.length} elements returned`);

const roads = [];
const buildings = [];
const water = [];
const green = [];

for (const el of data.elements) {
  if (!el.geometry || el.geometry.length < 2) continue;
  const pts = el.geometry.map((g) => project(g.lat, g.lon));
  if (!inFrame(pts)) continue;

  const t = el.tags ?? {};

  if (t.building) {
    // Footprints only; a two-point "building" is bad data.
    if (pts.length < 4) continue;
    // Sheds and bin stores add bytes and nothing else.
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      a += x1 * y2 - x2 * y1;
    }
    if (Math.abs(a / 2) < 70) continue;
    buildings.push({ p: pts, h: Number(t['building:levels'] ?? 0) || 2 });
  } else if (t.highway) {
    const w = ROAD_WEIGHT[t.highway];
    if (!w) continue;
    roads.push({ p: pts, w, n: t.name ?? null, cls: t.highway });
  } else if (t.natural === 'water' || t.waterway === 'river') {
    water.push({ p: pts });
  } else if (t.leisure === 'park') {
    green.push({ p: pts });
  }
}

// Longest first, so the big streets sit under the small ones and the labels
// we keep are the ones worth naming.
roads.sort((a, b) => b.w - a.w);

const named = [...new Set(roads.filter((r) => r.n).map((r) => r.n))];

const out = {
  _comment:
    'Street and building geometry around the studio, from OpenStreetMap via Overpass, projected into a 0-1000 square. Regenerate with `npm run map`. Committed so the build never depends on Overpass. Data © OpenStreetMap contributors, ODbL.',
  centre: CENTRE,
  radiusMetres: RADIUS,
  attribution: '© OpenStreetMap contributors',
  roads,
  buildings,
  water,
  green,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));

console.log(`  roads      ${roads.length}`);
console.log(`  buildings  ${buildings.length}`);
console.log(`  water      ${water.length}`);
console.log(`  parks      ${green.length}`);
console.log(`  named streets: ${named.slice(0, 8).join(', ')}${named.length > 8 ? ' …' : ''}`);
console.log(`\nwrote ${path.relative(ROOT, OUT)}  ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
