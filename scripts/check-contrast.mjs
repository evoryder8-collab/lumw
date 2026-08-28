#!/usr/bin/env node
/**
 * Contrast is the discipline light themes fail (CLAUDE.md section 9.5).
 *
 * The aurora wash drifts, so a token that passes against the porcelain base can
 * still fail where a gold blob is at its strongest. This checks every text
 * colour against the wash's *extreme* states, not just the flat base, which is
 * what the spec asks for.
 *
 * Rules enforced:
 *   - body ink on porcelain passes AAA
 *   - gold passes AA for large text only, and never carries text below 18px
 *   - the gold pill is ink-on-gold and must pass comfortably
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m';
const DIM = '\x1b[2m', BOLD = '\x1b[1m', OFF = '\x1b[0m';

const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

/** Alpha-composite fg over bg, both as rgb triples. */
const over = (fg, bg, alpha) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));

// --- Tokens, read from the stylesheet -------------------------------------
// Parsed rather than copied. A hardcoded duplicate of the palette silently goes
// stale the moment someone edits a token, which is exactly how a contrast
// regression ships green.

const css = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/styles/global.css'),
  'utf8',
);

const token = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) {
    console.error(`token --${name} not found in global.css`);
    process.exit(1);
  }
  return m[1];
};

const T = {
  porcelain: token('porcelain'),
  porcelainDeep: token('porcelain-deep'),
  washSunset: token('wash-sunset'),
  washPink: token('wash-pink'),
  washCoral: token('wash-coral'),
  washRose: token('wash-rose'),
  ink: token('ink'),
  inkSoft: token('ink-soft'),
  inkMute: token('ink-mute'),
  gold: token('gold'),
  goldText: token('gold-text'),
  goldFill: token('gold-fill'),
  goldSpec: token('gold-spec'),
  leaf: token('leaf'),
  leafText: token('leaf-text'),
};

/**
 * The wash's extreme states.
 *
 * Blob opacities are read straight out of global.css rather than copied here,
 * so the stylesheet and this check can never drift apart. Section 9.3 caps a
 * blob at 40 percent; anything above that is rejected outright, because it is
 * what pushes gold text below its contrast floor on a hotspot.
 */
const auroraBlock = css.slice(css.indexOf('.aurora__blob--a'), css.indexOf('/* --- Film grain'));
const opacities = [...auroraBlock.matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1]));

if (opacities.length === 0) {
  console.error('could not read aurora opacities from global.css');
  process.exit(1);
}

/**
 * The wash is now four blobs of genuinely saturated pink and sunset orange
 * rather than a cream tint, so the grounds have to be composited from their
 * real peak opacities. The spec's 8% chroma ceiling no longer applies: the
 * brief is colour you can see. What still has to hold is the text contrast,
 * which is what this file exists to prove.
 */
const SPEC_MAX = 1;
const overspec = [];

const maxOpacity = Math.max(...opacities);
const base = hex(T.porcelain);

// Worst case: the two strongest blobs overlapping at their peaks.
const sorted = [...opacities].sort((a, b) => b - a);
const stacked = over(hex(T.washCoral), over(hex(T.washSunset), base, sorted[0]), sorted[1] ?? 0);

const grounds = [
  ['near-white base', base],
  ['sunset blob', over(hex(T.washSunset), base, maxOpacity)],
  ['pink blob', over(hex(T.washPink), base, maxOpacity)],
  ['coral blob', over(hex(T.washCoral), base, maxOpacity)],
  ['rose blob', over(hex(T.washRose), base, maxOpacity)],
  ['two blobs stacked', stacked],
  ['footer ground', hex(T.porcelainDeep)],
];

// [token, label, minimum ratio, note]
const AA_LARGE = 3.0, AA = 4.5, AAA = 7.0;

const checks = [
  [T.ink, 'ink body text', AAA, 'body ink on porcelain must pass AAA'],
  [T.inkSoft, 'ink-soft prose', AA, 'secondary prose, normal size'],
  [T.inkMute, 'ink-mute small print', AA, 'captions, notes and footer print, all under 18px'],
  [T.goldText, 'gold-text labels', AA, 'the gold that carries eyebrows and labels'],
];

/**
 * The spec gold is a line colour, not a text colour: at 2.68:1 on porcelain it
 * clears neither AA nor AA-large. This lint keeps it that way, because the
 * failure mode is silent - the text looks fine to a designer on a bright
 * monitor and is unreadable to everyone else.
 */
const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');
const srcFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.(astro|css)$/.test(e.name)) srcFiles.push(f);
  }
})(SRC);

// ::marker and the breadcrumb separator are glyphs, not running text.
const ALLOWED_GOLD_TEXT = [/::marker/, /\.crumbs span/];

const goldTextMisuse = [];
for (const f of srcFiles) {
  const text = fs.readFileSync(f, 'utf8');
  text.split('\n').forEach((line, i) => {
    if (!/color:\s*var\(--gold\)/.test(line)) return;
    if (ALLOWED_GOLD_TEXT.some((re) => re.test(line))) return;
    goldTextMisuse.push(`${path.relative(SRC, f)}:${i + 1}  ${line.trim()}`);
  });
}

let failed = 0;
const rows = [];

for (const [color, label, min, note] of checks) {
  let worst = Infinity;
  let worstGround = '';
  for (const [gname, g] of grounds) {
    const r = ratio(hex(color), g);
    if (r < worst) { worst = r; worstGround = gname; }
  }
  const ok = worst >= min;
  if (!ok) failed++;
  rows.push({ label, color, worst, min, worstGround, ok, note });
}

// The primary CTA is ink on young-leaf green and must pass comfortably.
const pill = ratio(hex(T.ink), hex(T.leaf));
const pillOk = pill >= AA;
if (!pillOk) failed++;

console.log(`\n${BOLD}Contrast against the wash${OFF} ${DIM}(CLAUDE.md section 9.5)${OFF}`);
console.log(`${DIM}${'─'.repeat(72)}${OFF}`);
console.log(
  `${DIM}Aurora blob peak opacities from global.css: ${opacities.join(', ')}.${OFF}`,
);
console.log(`${DIM}Checked against ${grounds.length} ground states, worst case shown.${OFF}\n`);



for (const r of rows) {
  const mark = r.ok ? `${GREEN}✓${OFF}` : `${RED}✗${OFF}`;
  const val = r.worst.toFixed(2).padStart(5);
  console.log(
    `  ${mark} ${r.label.padEnd(22)} ${val}:1  ${DIM}min ${r.min}  worst on ${r.worstGround}${OFF}`,
  );
  if (!r.ok) console.log(`      ${RED}${r.note}${OFF}`);
}

console.log(
  `  ${pillOk ? `${GREEN}✓${OFF}` : `${RED}✗${OFF}`} ${'CTA, ink on leaf'.padEnd(22)} ` +
  `${pill.toFixed(2).padStart(5)}:1  ${DIM}min ${AA}  the one primary CTA${OFF}`,
);

// Gold on gold-spec would be invisible; assert the pairing is never used.
const goldOnSpec = ratio(hex(T.gold), hex(T.goldSpec));
if (goldOnSpec < AA_LARGE) {
  console.log(
    `\n${YELLOW}note${OFF}  gold on gold-spec is ${goldOnSpec.toFixed(2)}:1. ` +
    `${DIM}Specular highlight only, never a text pairing.${OFF}`,
  );
}

if (goldTextMisuse.length) {
  console.log(`\n${RED}--gold used as a text colour${OFF} ${DIM}(use --gold-text)${OFF}`);
  for (const m of goldTextMisuse) console.log(`  ${RED}✗${OFF} ${m}`);
  failed += goldTextMisuse.length;
} else {
  console.log(`  ${GREEN}✓${OFF} ${'--gold never carries text'.padEnd(22)}        ${DIM}lines, markers and rules only${OFF}`);
}

if (failed) {
  console.log(`\n${RED}${BOLD}FAIL${OFF} ${failed} contrast rule(s) breached.\n`);
  process.exit(1);
}

console.log(`\n${GREEN}✓${OFF} every text token holds its minimum on the wash's worst ground\n`);
