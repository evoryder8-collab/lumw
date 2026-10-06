/**
 * Painted once, drawn many times. Each petal kind is pre-shaded at four light
 * levels for both faces, so a frame costs one image draw per petal plus an
 * occasional glint when a face turns into the light.
 */
import { axes, type Petal } from './petal-physics';

type Sheet = { faces: HTMLCanvasElement[][]; glint: HTMLCanvasElement; width: number; height: number };
const LEVELS = 4;
// Viewed from about 34 degrees above, so a petal falling flat still reads as
// a petal instead of a sliver seen exactly edge-on.
const PITCH = 0.6, COS = Math.cos(PITCH), SIN = Math.sin(PITCH);
// Light from the upper left, slightly in front.
const LX = -0.38, LY = -0.7, LZ = 0.6;
const HX = LX, HY = LY, HZ = LZ + 1, HL = Math.hypot(HX, HY, HZ);

/** Frangipani, lotus and gold leaf: June's flower, the brand flower, the medal. */
export const KINDS = 3;
let sheets: Sheet[] | undefined;

function canvas(width: number, height: number) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  return c;
}

function frangipani(ctx: CanvasRenderingContext2D, back: boolean) {
  const path = new Path2D('M6 41C24 40 39 10 76 8C103 6 122 22 120 41C118 61 95 74 66 70C40 66 22 48 6 41Z');
  const along = ctx.createLinearGradient(6, 41, 120, 40);
  if (back) { along.addColorStop(0, '#e8d6a6'); along.addColorStop(0.35, '#f3e9d3'); along.addColorStop(1, '#f6eee2'); }
  else { along.addColorStop(0, '#e4ac38'); along.addColorStop(0.22, '#f0cf73'); along.addColorStop(0.46, '#fbf0d4'); along.addColorStop(1, '#fffbf3'); }
  ctx.fillStyle = along; ctx.fill(path);
  // The petal is cupped: lighter along the upper edge, warmer in the curl.
  ctx.save(); ctx.clip(path);
  const cup = ctx.createLinearGradient(0, 8, 0, 72);
  cup.addColorStop(0, 'rgb(255 255 255 / 0.32)'); cup.addColorStop(0.5, 'rgb(255 255 255 / 0)'); cup.addColorStop(1, back ? 'rgb(150 112 60 / 0.18)' : 'rgb(170 120 50 / 0.16)');
  ctx.fillStyle = cup; ctx.fillRect(0, 0, 128, 80);
  const blush = ctx.createRadialGradient(118, 38, 2, 112, 38, 34);
  blush.addColorStop(0, 'rgb(244 206 192 / 0.32)'); blush.addColorStop(1, 'rgb(244 206 192 / 0)');
  ctx.fillStyle = blush; ctx.fillRect(0, 0, 128, 80);
  ctx.restore();
  ctx.strokeStyle = back ? 'rgb(190 160 110 / 0.35)' : 'rgb(255 255 255 / 0.5)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(10, 41); ctx.quadraticCurveTo(60, 34, 108, 36); ctx.stroke();
  ctx.strokeStyle = 'rgb(120 92 40 / 0.28)'; ctx.lineWidth = 1; ctx.stroke(path);
}

function lotus(ctx: CanvasRenderingContext2D, back: boolean) {
  const path = new Path2D('M4 40C30 12 84 6 124 40C84 74 30 68 4 40Z');
  const along = ctx.createLinearGradient(4, 40, 124, 40);
  along.addColorStop(0, back ? '#efdcce' : '#f5e5d6'); along.addColorStop(0.5, back ? '#f7ebe3' : '#fdf6ee'); along.addColorStop(1, back ? '#e8bfb1' : '#efcabd');
  ctx.fillStyle = along; ctx.fill(path);
  ctx.save(); ctx.clip(path);
  const cup = ctx.createLinearGradient(0, 14, 0, 66);
  cup.addColorStop(0, 'rgb(255 255 255 / 0.4)'); cup.addColorStop(0.55, 'rgb(255 255 255 / 0)'); cup.addColorStop(1, 'rgb(150 100 80 / 0.16)');
  ctx.fillStyle = cup; ctx.fillRect(0, 0, 128, 80);
  ctx.strokeStyle = back ? 'rgb(190 140 120 / 0.28)' : 'rgb(255 255 255 / 0.42)'; ctx.lineWidth = 0.8;
  for (const bend of [-14, -7, 0, 7, 14]) { ctx.beginPath(); ctx.moveTo(8, 40); ctx.quadraticCurveTo(64, 40 + bend * 1.3, 116, 40 + bend * 0.25); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = 'rgb(130 90 70 / 0.26)'; ctx.lineWidth = 1; ctx.stroke(path);
}

function leaf(ctx: CanvasRenderingContext2D, back: boolean) {
  // A torn fleck of gold leaf: irregular, faceted and very bright when turned.
  const path = new Path2D('M30 22L58 10L84 18L106 14L118 34L110 56L88 66L62 70L36 62L14 50L18 32Z');
  const metal = ctx.createLinearGradient(14, 10, 118, 70);
  metal.addColorStop(0, back ? '#94712f' : '#a8823a'); metal.addColorStop(0.38, back ? '#d6b56e' : '#e7c97f'); metal.addColorStop(0.55, back ? '#efd9a3' : '#fff0c2'); metal.addColorStop(0.75, '#c9a256'); metal.addColorStop(1, '#8f6d2c');
  ctx.fillStyle = metal; ctx.fill(path);
  ctx.save(); ctx.clip(path);
  ctx.strokeStyle = 'rgb(255 244 210 / 0.45)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(30, 30); ctx.lineTo(70, 46); ctx.lineTo(96, 28); ctx.moveTo(44, 60); ctx.lineTo(72, 48); ctx.stroke();
  ctx.strokeStyle = 'rgb(90 62 20 / 0.3)';
  ctx.beginPath(); ctx.moveTo(58, 12); ctx.lineTo(66, 40); ctx.lineTo(104, 50); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgb(255 236 180 / 0.6)'; ctx.lineWidth = 0.8; ctx.stroke(path);
}

const painters = [frangipani, lotus, leaf];

function paint(kind: number, back: boolean, level: number) {
  const c = canvas(128, 80), ctx = c.getContext('2d')!;
  painters[kind](ctx, back);
  // Shade the finished petal in place, preserving its silhouette.
  ctx.globalCompositeOperation = 'source-atop';
  const amount = [0.34, 0.16, 0, 0.14][level];
  ctx.fillStyle = level < 2 ? `rgb(40 34 18 / ${amount})` : `rgb(255 250 235 / ${amount})`;
  if (amount) ctx.fillRect(0, 0, 128, 80);
  return c;
}

function glint(kind: number) {
  const c = canvas(128, 80), ctx = c.getContext('2d')!;
  painters[kind](ctx, false);
  ctx.globalCompositeOperation = 'source-atop';
  const light = ctx.createRadialGradient(70, 34, 2, 64, 40, 64);
  light.addColorStop(0, kind === 2 ? '#fffbe8' : '#ffffff'); light.addColorStop(0.5, kind === 2 ? '#fde9b0' : '#fff6e2'); light.addColorStop(1, 'rgb(255 240 210 / 0.5)');
  ctx.fillStyle = light; ctx.fillRect(0, 0, 128, 80);
  return c;
}

export function petalSheets() {
  return sheets ??= Array.from({ length: KINDS }, (_, kind) => ({
    faces: [false, true].map((back) => Array.from({ length: LEVELS }, (_, level) => paint(kind, back, level))),
    glint: glint(kind), width: kind === 2 ? 0.72 : 1, height: kind === 2 ? 0.48 : 0.62,
  }));
}

/** Pick a kind: mostly frangipani, some lotus, a few flecks of gold. */
export const pickKind = (gold = 0.18) => { const r = Math.random(); return r < gold ? 2 : r < gold + 0.27 ? 1 : 0; };

/**
 * Draw with an orthographic camera pitched down, plus mild perspective from z.
 * Returns false once the petal is fully transparent.
 */
export function drawPetal(ctx: CanvasRenderingContext2D, p: Petal, dpr: number, alpha = p.alpha) {
  if (alpha <= 0.004) return false;
  const sheet = petalSheets()[p.kind];
  const a = axes(p);
  const depth = 760 / (760 + p.z), s = p.size * depth;
  // Rotate the scene about the horizontal axis into the camera's frame.
  const e1y = a.e1y * COS + a.e1z * SIN, e2y = a.e2y * COS + a.e2z * SIN;
  const nx = a.nx, ny = a.ny * COS + a.nz * SIN, nz = -a.ny * SIN + a.nz * COS;
  const front = nz >= 0, f = front ? 1 : -1;
  const diffuse = Math.max(0, (nx * LX + ny * LY + nz * LZ) * f);
  const level = Math.min(LEVELS - 1, Math.round(diffuse * 1.15 * (LEVELS - 1)));
  const haze = 1 - Math.min(0.5, Math.max(0, p.z) / 1100);
  ctx.globalAlpha = alpha * haze;
  ctx.setTransform(a.e1x * s * dpr, e1y * s * dpr, a.e2x * s * dpr, e2y * s * dpr, p.x * dpr, p.y * dpr);
  const w = sheet.width, h = sheet.height;
  ctx.drawImage(sheet.faces[front ? 0 : 1][level], -w / 2, -h / 2, w, h);
  // A brief satin glint as the face passes through the reflected light.
  const spec = Math.max(0, (nx * HX + ny * HY + nz * HZ) * f / HL);
  const glow = Math.pow(spec, p.kind === 2 ? 10 : 22);
  if (glow > 0.03) { ctx.globalAlpha = alpha * haze * Math.min(1, glow * (p.kind === 2 ? 1.1 : 0.8)); ctx.drawImage(sheet.glint, -w / 2, -h / 2, w, h); }
  return true;
}
