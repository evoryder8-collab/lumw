/**
 * The velvet curtain. One full-screen shader draws both panels: folds lit by a
 * stage light, velvet sheen where the pile turns away from the eye, a lotus
 * damask woven into the ground, gold braid, fringe and an embroidered crest
 * split down the seam. Edge motion is a set of row springs computed here and
 * streamed to the GPU as a 64-texel strip, so tests and petals read the same
 * geometry the viewer sees.
 *
 * Loaded on intent only (a link hover or touch, or the sound question), never
 * during page load, so it costs nothing in a performance audit.
 */
import { createPetalLayer, type PetalLayer } from './petal-field';
import { AIR } from './petal-physics';

const ROWS = 64;
const OFF = 0.14; // how far past the screen edge a fully open panel travels

const VERTEX = `attribute vec2 aPos; uniform vec2 uRes; varying vec2 vPx;
void main() { vPx = vec2((aPos.x * 0.5 + 0.5) * uRes.x, (0.5 - aPos.y * 0.5) * uRes.y); gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAGMENT = `#extension GL_OES_standard_derivatives : enable
precision highp float;
varying vec2 vPx;
uniform vec2 uRes;
uniform float uDpr, uTime, uLight, uFlash, uFolds, uScale, uSway;
uniform vec2 uLift, uCrestSize;
uniform sampler2D uEdges, uCrest;
const float TAU = 6.2831853;

float decode(vec2 c) { return (c.x * 65280.0 + c.y * 255.0) / 65535.0 * 2.0 - 0.5; }
vec2 covers(float v) {
  float r = clamp(v, 0.0, 1.0) * 63.0, i = floor(r);
  vec4 a = texture2D(uEdges, vec2((i + 0.5) / 64.0, 0.5));
  vec4 b = texture2D(uEdges, vec2((min(i + 1.0, 63.0) + 0.5) / 64.0, 0.5));
  return mix(vec2(decode(a.rg), decode(a.ba)), vec2(decode(b.rg), decode(b.ba)), r - i);
}
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float petal(vec2 p, vec2 c, vec2 r, float a) {
  p -= c; float cs = cos(a), sn = sin(a);
  p = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y);
  // Pointed at the tip: narrow the ellipse as it rises.
  p.x *= 1.0 + max(0.0, -p.y / r.y) * 0.7;
  return length(p / r);
}
// A lotus in a dropped lattice, as woven into damask.
float damask(vec2 q) {
  float row = floor(q.y);
  q.x += mod(row, 2.0) * 0.5;
  vec2 p = fract(q) - 0.5;
  float e = petal(p, vec2(0.0, -0.05), vec2(0.085, 0.19), 0.0);
  e = min(e, petal(p, vec2(-0.12, 0.02), vec2(0.075, 0.16), 0.62));
  e = min(e, petal(p, vec2(0.12, 0.02), vec2(0.075, 0.16), -0.62));
  e = min(e, petal(p, vec2(-0.215, 0.1), vec2(0.055, 0.12), 1.15));
  e = min(e, petal(p, vec2(0.215, 0.1), vec2(0.055, 0.12), -1.15));
  float aa = fwidth(e) + 0.02;
  float fill = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, e);
  float arc = abs(length(p - vec2(0.0, -0.02)) - 0.25);
  float w = fwidth(arc) + 0.004;
  float bowl = (1.0 - smoothstep(0.006, 0.006 + w, arc)) * smoothstep(0.1, 0.16, p.y);
  float jewel = 1.0 - smoothstep(0.022, 0.022 + fwidth(p.x) * 2.0, length(abs(p) - vec2(0.5)));
  return max(fill, max(bowl * 0.85, jewel * 0.9));
}

void main() {
  vec2 px = vPx;
  float v = px.y / uRes.y, centre = uRes.x * 0.5, s = uScale;
  vec2 c = covers(v);
  float edgeL = c.x * centre + 0.5, edgeR = uRes.x - c.y * centre - 0.5;
  float side = px.x < centre ? 0.0 : 1.0;
  float cover = side < 0.5 ? c.x : c.y;
  float width = max(cover * centre, 1.0);
  float edge = side < 0.5 ? edgeL : edgeR;
  float dE = side < 0.5 ? edge - px.x : px.x - edge;
  float u = clamp(side < 0.5 ? px.x / width : (uRes.x - px.x) / width, 0.0, 1.4);
  float lift = side < 0.5 ? uLift.x : uLift.y;
  float hem = uRes.y * (1.0 - lift * pow(min(u, 1.0), 2.2)) + 6.0;
  float dH = hem - px.y;
  vec3 L = normalize(vec3(side < 0.5 ? 0.26 : -0.26, -0.48, 0.84));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float stage = (0.66 + 0.48 * exp(-pow((px.x / uRes.x - 0.5) * 2.3, 2.0))) * mix(1.08, 0.8, v);

  // --- Light through the gap: warm, brightest at the cloth's edge ---------
  float gap = min(px.x - edgeL, edgeR - px.x);
  float under = dH < 0.0 && u <= 1.0 ? -dH : 1e5;
  float d = max(0.0, min(gap > 0.0 ? gap : 1e5, under));
  vec2 ray = px - vec2(centre, -uRes.y * 0.4);
  float ang = atan(ray.x, ray.y);
  float beams = pow(0.5 + 0.5 * sin(ang * 44.0 + uTime * 0.7) * sin(ang * 17.0 - uTime * 0.43), 3.0) * exp(-length(ray) / (uRes.y * 1.3));
  float glow = uLight * (0.7 * exp(-d / (24.0 * s)) + 0.3 * exp(-d / (150.0 * s)) + beams * 0.5);
  vec3 light = mix(vec3(1.0, 0.955, 0.86), vec3(0.98, 0.85, 0.58), 0.3 + 0.4 * beams);
  vec4 outside = vec4(light, 1.0) * clamp(glow, 0.0, 0.92);

  // Gold fringe hanging from a lifted hem.
  float fy = px.y - hem;
  if (dE > 0.0 && fy > 0.0 && fy < 30.0 * s) {
    float spacing = 3.4 * s, fx = (px.x + uSway * fy * (side < 0.5 ? 1.0 : -1.0)) / spacing, id = floor(fx);
    float len = 26.0 * s * (0.8 + 0.2 * hash(vec2(id, side)));
    float thread = (1.0 - smoothstep(0.16, 0.4, abs(fract(fx) - 0.5))) * (1.0 - smoothstep(len - 3.0 * s, len, fy));
    vec3 gold = mix(vec3(0.5, 0.36, 0.15), vec3(0.93, 0.79, 0.48), 0.35 + 0.5 * hash(vec2(id, 7.0))) * (0.75 + 0.25 * stage);
    float a = thread * 0.95;
    outside = vec4(gold * a, a) + outside * (1.0 - a);
  }

  float inside = clamp(dE * uDpr + 0.5, 0.0, 1.0) * clamp(dH * uDpr + 0.5, 0.0, 1.0) * step(u, 1.0001);
  if (inside <= 0.0) { gl_FragColor = outside; return; }

  // --- Folds: fixed in cloth space, so they gather as the panel draws -------
  float compress = clamp(1.0 - cover, 0.0, 1.0);
  // Irregular fold spacing, as real cloth hangs: the phase itself is warped.
  float uu = 1.0 - u, w1 = TAU * uFolds * 0.31, warp = w1 * uu + 1.3 + side * 2.1;
  float ph = TAU * uFolds * uu + 0.9 * sin(warp);
  float dph = -(TAU * uFolds + 0.9 * w1 * cos(warp));
  float wave = 0.32 * sin(v * 2.4 + side * 1.9 + uTime * 0.55) * (0.4 + v);
  float a1 = ph + wave, a2 = ph * 0.5 + 1.9 + v * 1.25 + side * 2.0, a3 = ph * 2.0 + 0.7 - v * 2.0;
  float h = 0.62 * cos(a1) + 0.28 * cos(a2) + 0.1 * cos(a3);
  float dh = -(0.62 * sin(a1) + 0.14 * sin(a2) + 0.2 * sin(a3)) * dph;
  float relief = (9.0 + 26.0 * compress) * mix(0.8, 1.3, v) * s;
  float slope = clamp(relief * dh / (width + 40.0 * s) * (side < 0.5 ? 1.0 : -1.0), -3.2, 3.2);
  vec3 n = normalize(vec3(-slope, -0.1 * cos(ph) * v, 1.0));
  float diff = max(dot(n, L), 0.0), facing = n.z;
  float sheen = pow(1.0 - facing, 1.45);
  float spec = pow(max(dot(n, H), 0.0), 34.0);
  float ao = mix(0.5, 1.0, smoothstep(-0.95, 0.85, h));

  float cx = (1.0 - min(u, 1.0)) * centre;
  float m = damask(vec2(cx, px.y + 34.0 * s) / (vec2(112.0, 144.0) * s));
  vec3 deep = vec3(0.035, 0.115, 0.088), mid = vec3(0.098, 0.262, 0.2);
  vec3 col = mix(deep, mid, diff) * ao * stage * (1.0 - 0.1 * m);
  vec3 pile = mix(vec3(0.5, 0.66, 0.52), vec3(0.86, 0.76, 0.52), 0.42 + 0.25 * m);
  col += pile * sheen * (0.4 + 0.42 * m) * stage * ao;
  col += vec3(0.78, 0.8, 0.62) * m * (0.035 * diff + 0.2 * spec) * stage;
  // The valance shades the top; light spills onto the cloth beside the gap.
  col *= mix(0.62, 1.0, smoothstep(0.0, 0.16, v));
  col += vec3(1.0, 0.88, 0.66) * uLight * exp(-dE / (34.0 * s)) * (0.25 + 0.7 * sheen) * 0.7;
  col *= 0.955 + 0.07 * hash(floor(gl_FragCoord.xy));

  // --- Gold cord on the leading edge, braid and fringe on the hem ----------
  // The edges stay fine so the embroidered crest reads across the seam.
  vec2 trim = vec2(dE, dH);
  for (int k = 0; k < 2; k++) {
    float t = k == 0 ? trim.x : trim.y;
    float lip = (k == 0 ? 1.4 : 3.0) * s, band = (k == 0 ? 4.6 : 15.0) * s;
    if (t < band + 5.0 * s) {
      float across = clamp((t - lip) / (band - lip), 0.0, 1.0);
      float inBand = smoothstep(lip - 0.6, lip + 0.6, t) * (1.0 - smoothstep(band - 0.6, band + 0.6, t));
      float twist = fract((t * 0.8 + (k == 0 ? px.y : px.x) * 0.6) / (5.5 * s));
      // A round cord: its normal turns across the band, plus the rope's twist.
      vec3 bn = normalize(vec3(k == 0 ? (0.5 - across) * 1.7 * (side < 0.5 ? 1.0 : -1.0) : 0.0, (twist - 0.5) * 1.3 + (k == 1 ? (0.5 - across) * 1.7 : 0.0), 1.0) + vec3(n.xy * 0.5, 0.0));
      float gd = max(dot(bn, L), 0.0), gs = pow(max(dot(bn, H), 0.0), 24.0);
      vec3 gold = mix(vec3(0.38, 0.27, 0.11), vec3(0.9, 0.74, 0.42), gd) * (0.62 + 0.38 * sin(twist * 3.14159)) + vec3(1.0, 0.93, 0.76) * gs;
      gold *= 0.8 + 0.28 * stage;
      col = mix(col, gold, inBand);
      float pipe = (1.0 - smoothstep(0.35 * s, 1.1 * s, abs(t - band - 2.4 * s))) * float(k);
      col = mix(col, vec3(0.82, 0.67, 0.38) * (0.62 + 0.5 * diff), pipe * 0.8);
      col *= mix(0.42, 1.0, smoothstep(0.0, lip, t));
    }
  }

  // --- Embroidered crest across the seam ------------------------------------
  float X = side < 0.5 ? min(u, 1.0) * centre : uRes.x - min(u, 1.0) * centre;
  vec2 cuv = vec2((X - centre) / uCrestSize.x + 0.5, (px.y - uRes.y * 0.44) / uCrestSize.y + 0.5);
  if (cuv.x > 0.0 && cuv.x < 1.0 && cuv.y > 0.0 && cuv.y < 1.0) {
    float a = texture2D(uCrest, cuv).a;
    float shade = texture2D(uCrest, cuv - vec2(2.0, 2.6) * s / uCrestSize).a;
    col *= 1.0 - 0.42 * shade * (1.0 - a);
    vec2 st = cuv * uCrestSize;
    float stitch = 0.7 + 0.3 * sin((st.x * 0.85 + st.y * 1.35) * 1.7 / s);
    vec3 en = normalize(n + vec3(0.0, 0.0, 0.6));
    float ed = max(dot(en, L), 0.0), es = pow(max(dot(en, H), 0.0), 20.0);
    vec3 thread = mix(vec3(0.42, 0.31, 0.13), vec3(0.94, 0.8, 0.48), ed) * stitch + vec3(1.0, 0.93, 0.74) * es * 0.85;
    col = mix(col, thread * (0.82 + 0.3 * stage), a);
  }

  // A line of light runs down the seam the moment the panels meet.
  col += vec3(1.0, 0.86, 0.55) * uFlash * exp(-abs(px.x - centre) / (9.0 * s)) * 0.9;

  vec4 cloth = vec4(col, 1.0);
  gl_FragColor = cloth * inside + outside * (1.0 - inside);
}`;

type GL = WebGLRenderingContext;
type Uniforms = Record<'uRes' | 'uDpr' | 'uTime' | 'uLight' | 'uFlash' | 'uFolds' | 'uScale' | 'uSway' | 'uLift' | 'uCrestSize' | 'uEdges' | 'uCrest', WebGLUniformLocation | null>;
type Run = { stop: (adopt?: boolean) => void };

let canvas: HTMLCanvasElement | undefined;
let gl: GL | null = null;
let program: WebGLProgram | null = null;
let uniforms: Uniforms | undefined;
let edgeTexture: WebGLTexture | null = null;
let crestTexture: WebGLTexture | null = null;
let crestAspect = 1.2;
let software = false;
let linked = false;
let failed = false;
let warming: Promise<boolean> | undefined;
const edgeBytes = new Uint8Array(ROWS * 4);
const runs = new WeakMap<HTMLElement, Run>();

const spring = (t: number, omega: number, zeta: number) => {
  if (t <= 0) return 0;
  const wd = omega * Math.sqrt(1 - zeta * zeta), decay = Math.exp(-zeta * omega * t);
  return 1 - decay * (Math.cos(wd * t) + zeta * omega / wd * Math.sin(wd * t));
};
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Edge geometry at time t. Pure, so the shader, petals and tests agree. */
export function edgeAt(opening: boolean, duration: number, t: number, v: number, side: number) {
  const D = duration / 1000;
  if (opening) {
    // Tableau: the hem is drawn up and out first, the top follows.
    const delay = 0.5 * D * Math.pow(1 - v, 1.25) + side * 0.03;
    const s = spring(t - delay, 15 / D, 0.82);
    const ripple = 0.03 * Math.sin(5.5 * v - 9 * t + side) * Math.sin(Math.PI * Math.min(1, s));
    return 1 - (1 + OFF) * s + ripple;
  }
  // Travellers: the rings lead along the rail and the hem trails behind. The
  // panels meet, rebound a little off each other, then settle together.
  const delay = 0.15 * D * Math.pow(v, 1.2) + side * 0.012;
  const reach = -OFF + (1 + OFF) * spring(t - delay, 10.5 / D, 0.6);
  const cover = reach > 1 ? 1 - (reach - 1) * 0.14 : reach;
  // Guarantee a sealed seam by the end, however the last row is swinging.
  const seal = smooth(0.72 * D, D, t);
  return cover + (1 - cover) * seal;
}

function compile(context: GL, type: number, source: string) {
  const shader = context.createShader(type)!;
  context.shaderSource(shader, source); context.compileShader(shader);
  return shader;
}

function paintCrest() {
  // Embroidery is drawn as a white mask; the shader supplies the gold thread.
  const c = document.createElement('canvas');
  c.width = 512; c.height = 600;
  const x = c.getContext('2d')!;
  x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
  const drop = (scale: number, dx: number) => {
    const p = new Path2D();
    p.moveTo(256 + dx, 40 + (1 - scale) * 120);
    p.bezierCurveTo(256 + dx + 30 * scale, 120, 256 + dx + 118 * scale, 186, 256 + dx + 118 * scale, 262);
    p.bezierCurveTo(256 + dx + 118 * scale, 336, 256 + dx + 62 * scale, 384, 256 + dx, 384 - (1 - scale) * 30);
    p.bezierCurveTo(256 + dx - 62 * scale, 384, 256 + dx - 118 * scale, 336, 256 + dx - 118 * scale, 262);
    p.bezierCurveTo(256 + dx - 118 * scale, 186, 256 + dx - 30 * scale, 120, 256 + dx, 40 + (1 - scale) * 120);
    return p;
  };
  // The LUMA drop: a crescent, heavier on the left as in the mark.
  const outer = drop(1, 0), inner = drop(0.88, 9);
  x.save(); x.fill(outer); x.globalCompositeOperation = 'destination-out'; x.fill(inner); x.restore();
  // A lotus in the heart of the drop.
  x.lineWidth = 5.5;
  const leaf = (angle: number, length: number, width: number) => {
    x.save(); x.translate(256, 330); x.rotate(angle);
    x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(width, -length * 0.35, width * 0.7, -length * 0.8, 0, -length);
    x.bezierCurveTo(-width * 0.7, -length * 0.8, -width, -length * 0.35, 0, 0); x.stroke(); x.restore();
  };
  leaf(0, 120, 40); leaf(-0.62, 96, 30); leaf(0.62, 96, 30); leaf(-1.15, 70, 22); leaf(1.15, 70, 22);
  x.beginPath(); x.moveTo(176, 340); x.quadraticCurveTo(256, 362, 336, 340); x.stroke();
  const spaced = (text: string, font: string, y: number, tracking: number) => {
    x.font = font;
    const widths = [...text].map((ch) => x.measureText(ch).width);
    let cursor = 256 - (widths.reduce((a, b) => a + b, 0) + tracking * (text.length - 1)) / 2;
    [...text].forEach((ch, i) => { x.fillText(ch, cursor, y); cursor += widths[i] + tracking; });
  };
  x.textBaseline = 'alphabetic';
  spaced('LUMA', '400 92px "Hanken Grotesk", "Helvetica Neue", sans-serif', 500, 22);
  spaced('WELLNESS', '500 25px "Hanken Grotesk", "Helvetica Neue", sans-serif', 552, 13);
  x.fillRect(150, 574, 212, 2.5);
  crestAspect = c.height / c.width;
  return c;
}

function texture(context: GL) {
  const t = context.createTexture();
  context.bindTexture(context.TEXTURE_2D, t);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
  return t;
}

/** Create the context and compile in the background. Resolves to readiness. */
export function warm(): Promise<boolean> {
  if (warming) return warming;
  warming = (async () => {
    canvas = document.createElement('canvas');
    canvas.className = 'velvet';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'default' }) as GL | null;
    if (!context || !context.getExtension('OES_standard_derivatives')) { failed = true; return false; }
    gl = context;
    canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); linked = false; failed = true; });
    const masked = String(context.getParameter(context.RENDERER));
    const info = /webkit webgl/i.test(masked) ? context.getExtension('WEBGL_debug_renderer_info') : null;
    const renderer = info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : masked;
    software = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
    const p = context.createProgram()!;
    context.attachShader(p, compile(context, context.VERTEX_SHADER, VERTEX));
    context.attachShader(p, compile(context, context.FRAGMENT_SHADER, FRAGMENT));
    context.linkProgram(p);
    // Let the driver compile off the main thread where it can.
    const parallel = context.getExtension('KHR_parallel_shader_compile');
    if (parallel) {
      for (let i = 0; i < 120 && !context.getProgramParameter(p, parallel.COMPLETION_STATUS_KHR); i++) await new Promise((r) => setTimeout(r, 16));
    }
    if (!context.getProgramParameter(p, context.LINK_STATUS)) { failed = true; return false; }
    program = p;
    context.useProgram(p);
    const buffer = context.createBuffer();
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), context.STATIC_DRAW);
    const position = context.getAttribLocation(p, 'aPos');
    context.enableVertexAttribArray(position);
    context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);
    uniforms = Object.fromEntries(['uRes', 'uDpr', 'uTime', 'uLight', 'uFlash', 'uFolds', 'uScale', 'uSway', 'uLift', 'uCrestSize', 'uEdges', 'uCrest'].map((name) => [name, context.getUniformLocation(p, name)])) as Uniforms;
    edgeTexture = texture(context);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.NEAREST);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.NEAREST);
    context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, ROWS, 1, 0, context.RGBA, context.UNSIGNED_BYTE, edgeBytes);
    // The crest uses the site's own interface face once it is available.
    await Promise.race([document.fonts.load('400 92px "Hanken Grotesk"'), new Promise((r) => setTimeout(r, 400))]).catch(() => {});
    crestTexture = texture(context);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
    context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, paintCrest());
    context.uniform1i(uniforms.uEdges, 0);
    context.uniform1i(uniforms.uCrest, 1);
    // Some drivers finish compiling on first use. Pay that now, off-screen.
    context.uniform2f(uniforms.uRes, 1, 1); context.uniform1f(uniforms.uScale, 1); context.uniform1f(uniforms.uFolds, 4);
    context.viewport(0, 0, 1, 1); context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
    linked = true;
    return true;
  })().catch(() => { failed = true; return false; });
  return warming;
}

export const ready = () => linked && !failed;

function size(root: HTMLElement) {
  const { width, height } = root.getBoundingClientRect();
  const w = Math.max(1, width), h = Math.max(1, height);
  // Enough pixels for crisp gold thread, capped for phones' memory budgets.
  const dpr = software ? 0.5 : Math.min(devicePixelRatio || 1, 2, Math.sqrt(2.8e6 / (w * h)));
  canvas!.width = Math.round(w * dpr); canvas!.height = Math.round(h * dpr);
  return { w, h, dpr };
}

function upload(opening: boolean, duration: number, t: number) {
  for (let r = 0; r < ROWS; r++) {
    for (let side = 0; side < 2; side++) {
      const value = Math.max(-0.5, Math.min(1.5, edgeAt(opening, duration, t, r / (ROWS - 1), side)));
      const packed = Math.round((value + 0.5) / 2 * 65535);
      edgeBytes[r * 4 + side * 2] = packed >> 8; edgeBytes[r * 4 + side * 2 + 1] = packed & 255;
    }
  }
  gl!.activeTexture(gl!.TEXTURE0); gl!.bindTexture(gl!.TEXTURE_2D, edgeTexture);
  gl!.texSubImage2D(gl!.TEXTURE_2D, 0, 0, 0, ROWS, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, edgeBytes);
}

/** Cancel whatever the curtain is doing. Petals already in the air carry on. */
export function cancel(root: HTMLElement) { runs.get(root)?.stop(true); }

export function animate(root: HTMLElement, opening: boolean, duration: number): Promise<void> {
  cancel(root);
  if (!ready() || !canvas || !gl || !uniforms) return fallback(root, opening, duration);
  const context = gl, u = uniforms;
  root.prepend(canvas);
  root.classList.add('is-velvet');
  let { w, h, dpr } = size(root);
  const resize = () => ({ w, h, dpr } = size(root));
  addEventListener('resize', resize);
  const scale = Math.max(0.6, Math.min(1, Math.min(w, h * 1.25) / 1100));
  const folds = Math.max(4, Math.min(11, w / 2 / 64));
  const crestWidth = Math.min(300, w * 0.46) * (w < 700 ? 1 : 1.05);
  const D = duration / 1000;
  const start = performance.now();
  let frame = 0, last = start, petals: PetalLayer | undefined, released = 0, flashAt = -1, settled = false;
  const budget = opening ? Math.round(Number(root.dataset.petals || 16) * Math.max(0.45, Math.min(1, w / 1200))) : 0;
  const state = root as HTMLElement & { curtainState?: unknown };
  root.dataset.curtainPhase = opening ? 'opening' : 'closing';

  if (budget) {
    petals = createPetalLayer({ ...AIR, gravity: opening && duration > 1800 ? 520 : 700 });
    petals.canvas.style.zIndex = '3';
    root.append(petals.canvas);
  }

  const draw = (t: number) => {
    upload(opening, duration, Math.min(t, D));
    let mean = 0;
    for (let i = 0; i <= 8; i++) mean += 1 - edgeAt(opening, duration, Math.min(t, D), i / 8, 0);
    mean /= 9;
    // Light pours in as the gap opens; while closing it gathers to the seam,
    // where a faint line of it stays while the next page loads.
    const closed = Math.max(0, Math.min(1, 1 - mean));
    const light = opening
      ? (0.22 + 0.7 * smooth(0, 0.12, mean)) * (1 - smooth(0.45, 1.05, mean))
      : 0.25 + 0.75 * smooth(0.55, 0.96, closed) * (1 - smooth(0.7 * D, 1.15 * D, t));
    const hem = edgeAt(opening, duration, Math.min(t, D), 1, 0);
    const lift = opening ? 0.22 * smooth(0.02, 0.45, 1 - hem) * (1 - smooth(0.85, 1.1, 1 - hem)) : 0;
    if (!opening && flashAt < 0 && edgeAt(opening, duration, t, 0.5, 0) > 0.985) flashAt = t;
    const flash = flashAt < 0 ? 0 : Math.exp(-(t - flashAt) / 0.32) * 0.85;
    context.viewport(0, 0, canvas!.width, canvas!.height);
    context.uniform2f(u.uRes, w, h);
    context.uniform1f(u.uDpr, canvas!.width / w);
    context.uniform1f(u.uTime, t);
    context.uniform1f(u.uLight, light);
    context.uniform1f(u.uFlash, flash);
    context.uniform1f(u.uFolds, folds);
    context.uniform1f(u.uScale, scale);
    context.uniform1f(u.uSway, opening ? 0.35 * Math.sin(t * 6) * lift * 4 : 0);
    context.uniform2f(u.uLift, lift, lift * 0.94);
    context.uniform2f(u.uCrestSize, crestWidth, crestWidth * crestAspect);
    context.activeTexture(context.TEXTURE1); context.bindTexture(context.TEXTURE_2D, crestTexture);
    context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
    state.curtainState = { phase: root.dataset.curtainPhase, cover: (v: number, side = 0) => edgeAt(opening, duration, Math.min(t, D), v, side) };
  };

  const shed = (t: number, dt: number) => {
    if (!petals || released >= budget) return;
    // Spread the shower across the first two thirds of the opening.
    const due = Math.floor(budget * Math.min(1, Math.max(0, (t - 0.06 * D) / (0.62 * D))));
    for (; released < due; released++) {
      const side = released % 2;
      const size = (w < 700 ? 17 : 21) + Math.random() * 15;
      if (released % 4 < 2) {
        // Shaken loose from the cloth's edge as it sweeps outward, at whatever
        // height the edge is moving fastest right now.
        let v = 0.5, best = -1;
        for (let k = 0; k < 6; k++) {
          const probe = 0.08 + Math.random() * 0.84;
          const moved = edgeAt(true, duration, t - 0.05, probe, side) - edgeAt(true, duration, t, probe, side);
          if (moved > best) { best = moved; v = probe; }
        }
        const c0 = edgeAt(true, duration, t - dt, v, side), c1 = edgeAt(true, duration, t, v, side);
        const x = side ? w - c1 * w / 2 : c1 * w / 2;
        const speed = Math.min(420, (c0 - c1) / Math.max(dt, 0.008) * w / 2 * 0.35);
        petals.release(x + (side ? 8 : -8), v * h, side ? speed : -speed, -60 - Math.random() * 80, size);
      } else {
        // Falling from above into the light, wherever the gap has opened.
        const top = 0.08;
        const left = edgeAt(true, duration, t, top, 0) * w / 2, right = w - edgeAt(true, duration, t, top, 1) * w / 2;
        const span = Math.max(80, right - left);
        petals.release(Math.max(20, left) + Math.random() * Math.min(span, w - 40), -20 - Math.random() * 40, (Math.random() - 0.5) * 60, 130 + Math.random() * 90, size);
      }
    }
  };

  return new Promise<void>((resolve) => {
    let stopped = false;
    const stop = (adopt = false) => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame); runs.delete(root);
      removeEventListener('resize', resize);
      if (petals) { if (adopt && petals.count) { petals.canvas.style.zIndex = '9000'; petals.adopt(document.body); } else petals.clear(); }
      if (opening || !settled) { canvas!.width = canvas!.height = 1; canvas!.remove(); root.classList.remove('is-velvet'); }
      delete root.dataset.curtainPhase;
      resolve();
    };
    runs.set(root, { stop });
    const tick = (now: number) => {
      const t = (now - start) / 1000, dt = (now - last) / 1000; last = now;
      if (opening) shed(t, dt);
      // The opening is over once the last of the cloth has cleared the screen.
      const cleared = opening && t > 0.5 * D && edgeAt(true, duration, t, 0, 0) < -0.06 && edgeAt(true, duration, t, 0, 1) < -0.06;
      if (!settled && (t >= D || cleared)) {
        if (opening) { draw(t); stop(true); return; }
        // Closed: hand control back, but keep the cloth breathing while the
        // next page loads. The next animate() call takes over seamlessly.
        settled = true;
        root.dataset.curtainPhase = 'closed';
        runs.set(root, { stop: (adopt) => { settled = false; stop(adopt); } });
        resolve();
      }
      draw(t);
      frame = requestAnimationFrame(tick);
    };
    draw(0);
    frame = requestAnimationFrame(tick);
  });
}

/** No WebGL: two plain velvet panels on the same spring timing. */
function fallback(root: HTMLElement, opening: boolean, duration: number) {
  root.classList.add('is-flat');
  const panels = [0, 1].map((side) => {
    const el = document.createElement('div');
    el.className = `velvet-flat velvet-flat--${side ? 'right' : 'left'}`;
    root.prepend(el);
    return el;
  });
  const start = performance.now();
  return new Promise<void>((resolve) => {
    let frame = 0, stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true; cancelAnimationFrame(frame); runs.delete(root);
      panels.forEach((el) => el.remove()); root.classList.remove('is-flat'); resolve();
    };
    runs.set(root, { stop });
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      (root as HTMLElement & { curtainState?: unknown }).curtainState = { phase: opening ? 'opening' : 'closing', cover: (v: number, side = 0) => edgeAt(opening, duration, Math.min(t, duration / 1000), v, side) };
      panels.forEach((el, side) => {
        const cover = edgeAt(opening, duration, Math.min(t, duration / 1000), 0.5, side);
        el.style.transform = `translate3d(${side ? '' : '-'}${((1 - cover) * 100).toFixed(2)}%,0,0)`;
      });
      if (t >= duration / 1000) { if (opening) stop(); else { resolve(); runs.set(root, { stop }); } return; }
      frame = requestAnimationFrame(tick);
    };
    tick(start);
  });
}
