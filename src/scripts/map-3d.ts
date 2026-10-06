/**
 * The studio's streets as a glass architectural model. Real OpenStreetMap
 * footprints and heights, served from this site (public/map/studio-3d.json),
 * so no visitor data reaches a map provider. Translucent buildings shaded by
 * height, sun shadows on the ground, a gold light above June's building, the
 * walk along Hauptstraße, then a slow orbit that pauses off screen.
 */
type City = { radius: number; buildings: number[][]; streets: number[][]; rivers: number[][]; water: number[][]; green: number[][]; route?: number[][] };
type GL = WebGLRenderingContext;
type Vec = [number, number, number];

const SUN: Vec = [-0.5, -0.56, 0.66]; // from the south-west, afternoon
const SHADOW = [SUN[0] / SUN[2], SUN[1] / SUN[2]];
const ALPHA = 0.9;

const VS = `attribute vec3 aPos; attribute vec4 aColor; attribute vec2 aUV;
uniform mat4 uMVP; varying vec4 vColor; varying vec2 vXY, vUV; varying float vDepth;
void main() { vColor = aColor; vXY = aPos.xy; vUV = aUV; gl_Position = uMVP * vec4(aPos, 1.0); vDepth = gl_Position.w; }`;
const FS = `precision mediump float;
varying vec4 vColor; varying vec2 vXY, vUV; varying float vDepth;
uniform float uR, uAlpha, uMode, uTime; uniform vec2 uHaze;
void main() {
  // Dissolve toward the frame edge and, like air, toward the horizon.
  float fade = (1.0 - smoothstep(0.52, 0.97, length(vXY) / uR)) * (1.0 - 0.85 * smoothstep(uHaze.x, uHaze.y, vDepth));
  if (uMode > 0.5 && uMode < 1.5) { gl_FragColor = vec4(mix(vec3(1.0), vColor.rgb, vColor.a * fade), 1.0); return; }
  vec3 gold = vec3(0.78, 0.6, 0.27), light = vec3(1.0, 0.94, 0.76);
  vec3 col = vColor.rgb; float a = vColor.a * uAlpha;
  if (uMode > 1.5 && uMode < 2.5) {
    float m = fract((vUV.x - uTime * 15.0) / 12.0);
    float dash = smoothstep(0.0, 0.08, m) * (1.0 - smoothstep(0.46, 0.56, m));
    a = (0.3 + 0.7 * dash) * (1.0 - smoothstep(0.5, 1.0, abs(vUV.y * 2.0 - 1.0)));
    col = mix(gold, light, dash * 0.45);
  } else if (uMode > 2.5 && uMode < 3.5) {
    float r = length(vUV); a = (1.0 - smoothstep(0.0, 0.3, r)) * 0.22;
    for (int i = 0; i < 3; i++) { float p = fract(uTime * 0.26 + float(i) / 3.0); a += (1.0 - smoothstep(0.0, 0.03, abs(r - p))) * (1.0 - p) * 0.8; }
    col = gold;
  } else if (uMode > 3.5) {
    float core = exp(-vUV.x * vUV.x * 7.0);
    a = core * pow(1.0 - vUV.y, 1.7) * (0.62 + 0.14 * sin(uTime * 2.1));
    col = mix(gold, light, core * 0.8);
  }
  a *= fade;
  gl_FragColor = vec4(col * a, a);
}`;

/** Growable interleaved geometry: position, colour, and a uv for effects. */
class Mesh {
  pos: number[] = []; col: number[] = []; uv: number[] = [];
  get count() { return this.pos.length / 3; }
  v(x: number, y: number, z: number, c: number[], u = 0, w = 0) { this.pos.push(x, y, z); this.col.push(c[0], c[1], c[2], c[3] ?? 255); this.uv.push(u, w); }
}

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const shade = (c: number[], k: number) => [c[0] * k, c[1] * k, c[2] * k, c[3]];

/** Ear clipping. Footprints are small; large water bodies are thinned first. */
function triangulate(xs: number[], ys: number[]) {
  let idx = xs.map((_, i) => i);
  let area = 0;
  for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) area += xs[j] * ys[i] - xs[i] * ys[j];
  if (area < 0) idx.reverse();
  const out: number[] = [];
  const inside = (p: number, a: number, b: number, c: number) => {
    const d = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
    const d1 = d(xs[p], ys[p], xs[a], ys[a], xs[b], ys[b]), d2 = d(xs[p], ys[p], xs[b], ys[b], xs[c], ys[c]), d3 = d(xs[p], ys[p], xs[c], ys[c], xs[a], ys[a]);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  let guard = idx.length * idx.length;
  while (idx.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
      if ((xs[b] - xs[a]) * (ys[c] - ys[a]) - (ys[b] - ys[a]) * (xs[c] - xs[a]) <= 1e-7) continue;
      if (idx.some((p) => p !== a && p !== b && p !== c && inside(p, a, b, c))) continue;
      out.push(a, b, c); idx.splice(i, 1); clipped = true; break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) out.push(...idx);
  return out;
}

/** Half-metre integers, y south, into metres with y north. */
function ring(list: number[], from: number, thin = 1) {
  const xs: number[] = [], ys: number[] = [];
  for (let i = from; i < list.length - 1; i += 2 * thin) { xs.push(list[i] / 2); ys.push(-list[i + 1] / 2); }
  return { xs, ys };
}

function polygon(m: Mesh, xs: number[], ys: number[], z: number, c: number[]) {
  for (const i of triangulate(xs, ys)) m.v(xs[i], ys[i], z, c);
}

/** A street as a ribbon, with round joins so turns never notch. */
function ribbon(m: Mesh, xs: number[], ys: number[], width: number, z: number, c: number[], route = false) {
  const h = width / 2;
  let along = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const dx = xs[i + 1] - xs[i], dy = ys[i + 1] - ys[i], len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len * h, ny = dx / len * h, a0 = along, a1 = along + len;
    const q = [[xs[i] + nx, ys[i] + ny, a0, 0], [xs[i] - nx, ys[i] - ny, a0, 1], [xs[i + 1] - nx, ys[i + 1] - ny, a1, 1], [xs[i + 1] + nx, ys[i + 1] + ny, a1, 0]];
    for (const k of [0, 1, 2, 0, 2, 3]) m.v(q[k][0], q[k][1], z, c, q[k][2], q[k][3]);
    along = a1;
    if (!route) for (let s = 0; s < 8; s++) {
      const t0 = s / 8 * Math.PI * 2, t1 = (s + 1) / 8 * Math.PI * 2;
      m.v(xs[i + 1], ys[i + 1], z, c); m.v(xs[i + 1] + Math.cos(t0) * h, ys[i + 1] + Math.sin(t0) * h, z, c); m.v(xs[i + 1] + Math.cos(t1) * h, ys[i + 1] + Math.sin(t1) * h, z, c);
    }
  }
}

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec): Vec => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function multiply(a: Float32Array, b: Float32Array) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
  return o;
}

export async function mountMap3d(plate: HTMLElement, signal: AbortSignal, onMarker: () => void): Promise<() => void> {
  const overlay = plate.querySelector<HTMLElement>('[data-map3d]');
  const marker = plate.querySelector<HTMLElement>('[data-map3d-marker]');
  if (!overlay || !marker) return () => {};
  const canvas = document.createElement('canvas');
  canvas.className = 'loc3d__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { antialias: true, stencil: true, premultipliedAlpha: true, alpha: true }) as GL | null;
  const uint = gl?.getExtension('OES_element_index_uint');
  if (!gl || !uint) return () => {};
  const masked = String(gl.getParameter(gl.RENDERER));
  const info = /webkit webgl/i.test(masked) ? gl.getExtension('WEBGL_debug_renderer_info') : null;
  // A software renderer would orbit a city on the CPU; the drawn map stays.
  if (/swiftshader|llvmpipe|software/i.test(info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : masked)) return () => {};
  const response = await fetch(`${import.meta.env.BASE_URL.replace(/\/?$/, '/')}map/studio-3d.json`, { signal }).catch(() => undefined);
  if (!response?.ok || signal.aborted) return () => {};
  const city = await response.json() as City;
  if (signal.aborted) return () => {};

  const R = city.radius;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Ground: base, parks, water, streets ----------------------------------
  const ground = new Mesh();
  const GROUND = [237, 240, 231], GREEN = [205, 220, 196], WATER = [166, 202, 210], CASING = [204, 208, 195], STREET = [253, 252, 248], LANE = [246, 245, 238];
  for (let s = 0; s < 72; s++) {
    const a0 = s / 72 * Math.PI * 2, a1 = (s + 1) / 72 * Math.PI * 2;
    ground.v(0, 0, 0, GROUND); ground.v(Math.cos(a0) * R * 1.05, Math.sin(a0) * R * 1.05, 0, GROUND); ground.v(Math.cos(a1) * R * 1.05, Math.sin(a1) * R * 1.05, 0, GROUND);
  }
  for (const g of city.green) { const { xs, ys } = ring(g, 0, g.length > 600 ? 2 : 1); polygon(ground, xs, ys, 0, GREEN); }
  for (const w of city.water) { const { xs, ys } = ring(w, 0, Math.max(1, Math.ceil(w.length / 500))); polygon(ground, xs, ys, 0, WATER); }
  for (const r of city.rivers) { const { xs, ys } = ring(r, 1); ribbon(ground, xs, ys, r[0] / 2, 0, WATER); }
  for (const s of city.streets) { const { xs, ys } = ring(s, 1); ribbon(ground, xs, ys, s[0] / 2 + 2.2, 0, CASING); }
  for (const s of city.streets) { const { xs, ys } = ring(s, 1); ribbon(ground, xs, ys, s[0] / 2, 0, s[0] <= 8 ? LANE : STREET); }

  const route = new Mesh();
  for (const r of city.route ?? []) { const { xs, ys } = ring(r, 0); ribbon(route, xs, ys, 2.6, 0, [0, 0, 0], true); }

  // --- Buildings: walls lit by the sun, darker toward the ground ------------
  const solid = new Mesh(), edges = new Mesh(), shadow = new Mesh();
  const parts: { start: number; count: number; cx: number; cy: number }[] = [];
  const indices: number[] = [];
  const LOW = [240, 238, 229], MID = [204, 218, 202], HIGH = [128, 164, 141], GOLD = [222, 192, 126];
  let studioHeight = 8;
  const sunFlat = norm([SUN[0], SUN[1], 0]);
  for (const b of city.buildings) {
    const h = b[0] / 2, base = b[1] / 2;
    const { xs, ys } = ring(b, 2);
    if (xs.length < 3) continue;
    let area = 0, cx = 0, cy = 0, contains = false;
    for (let i = 0, j = xs.length - 1; i < xs.length; j = i++) {
      area += xs[j] * ys[i] - xs[i] * ys[j]; cx += xs[i]; cy += ys[i];
      if ((ys[i] > 0) !== (ys[j] > 0) && 0 < (xs[j] - xs[i]) * -ys[i] / (ys[j] - ys[i]) + xs[i]) contains = !contains;
    }
    if (area < 0) { xs.reverse(); ys.reverse(); }
    if (contains) studioHeight = h;
    const t = Math.min(1, Math.max(0, (h - 3) / 19));
    const tone = contains ? GOLD : t < 0.5 ? mix(LOW, MID, t * 2) : mix(MID, HIGH, t * 2 - 1);
    const startIndex = indices.length, n = xs.length;
    const sx = -SHADOW[0] * h, sy = -SHADOW[1] * h, SHADE = [214, 218, 207, 255], EDGE = [255, 240, 205, 230];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, dx = xs[j] - xs[i], dy = ys[j] - ys[i], l = Math.hypot(dx, dy) || 1;
      const lit = 0.7 + 0.3 * Math.max(0, (dy / l) * sunFlat[0] - (dx / l) * sunFlat[1]);
      // Glass walls: denser at the eaves, thinning toward the street.
      const top = shade(tone, lit), bottom = [...shade(tone, lit * 0.8).slice(0, 3), 120];
      const k = solid.count;
      solid.v(xs[i], ys[i], base, bottom); solid.v(xs[j], ys[j], base, bottom); solid.v(xs[j], ys[j], h, top); solid.v(xs[i], ys[i], h, top);
      indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
      // Hairline edges: the roof outline bright, the corners fainter.
      edges.v(xs[i], ys[i], h, EDGE); edges.v(xs[j], ys[j], h, EDGE);
      edges.v(xs[i], ys[i], base, [255, 244, 220, 60]); edges.v(xs[i], ys[i], h, [255, 244, 220, 130]);
      // Shadow volume on the ground: each wall casts a quad away from the sun.
      for (const [x, y] of [[xs[i], ys[i]], [xs[j], ys[j]], [xs[j] + sx, ys[j] + sy], [xs[i], ys[i]], [xs[j] + sx, ys[j] + sy], [xs[i] + sx, ys[i] + sy]]) shadow.v(x, y, 0, SHADE);
    }
    const roofStart = solid.count;
    for (let i = 0; i < n; i++) solid.v(xs[i], ys[i], h, shade(tone, 1.04));
    const roof = triangulate(xs, ys);
    // The footprint and its displaced copy close the shadow; the stencil merges all.
    for (const i of roof) { indices.push(roofStart + i); shadow.v(xs[i], ys[i], 0, SHADE); }
    for (const i of roof) shadow.v(xs[i] + sx, ys[i] + sy, 0, SHADE);
    parts.push({ start: startIndex, count: indices.length - startIndex, cx: cx / n, cy: cy / n });
  }
  const studioTop = studioHeight;

  // --- Upload -------------------------------------------------------------
  const program = gl.createProgram()!;
  for (const [type, source] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]] as const) {
    const s = gl.createShader(type)!; gl.shaderSource(s, source); gl.compileShader(s); gl.attachShader(program, s);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return () => {};
  gl.useProgram(program);
  const loc = (name: string) => gl.getUniformLocation(program, name);
  const U = { mvp: loc('uMVP'), r: loc('uR'), alpha: loc('uAlpha'), mode: loc('uMode'), time: loc('uTime'), haze: loc('uHaze') };
  const A = { pos: gl.getAttribLocation(program, 'aPos'), color: gl.getAttribLocation(program, 'aColor'), uv: gl.getAttribLocation(program, 'aUV') };
  type Buffers = { pos: WebGLBuffer; col: WebGLBuffer; uv: WebGLBuffer; count: number };
  const upload = (m: Mesh, usage: number = gl.STATIC_DRAW): Buffers => {
    const make = (data: ArrayBufferView) => { const b = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data as BufferSource, usage); return b; };
    return { pos: make(new Float32Array(m.pos)), col: make(new Uint8Array(m.col.map((v) => Math.max(0, Math.min(255, Math.round(v)))))), uv: make(new Float32Array(m.uv)), count: m.count };
  };
  const bind = (b: Buffers) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, b.pos); gl.enableVertexAttribArray(A.pos); gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.col); gl.enableVertexAttribArray(A.color); gl.vertexAttribPointer(A.color, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.uv); gl.enableVertexAttribArray(A.uv); gl.vertexAttribPointer(A.uv, 2, gl.FLOAT, false, 0, 0);
  };
  const gGround = upload(ground), gRoute = upload(route), gSolid = upload(solid), gEdges = upload(edges), gShadow = upload(shadow);
  const ripple = new Mesh();
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) ripple.v(x * 38, y * 38, 0.05, [0, 0, 0], x, y);
  const gRipple = upload(ripple);
  const beacon = new Mesh();
  for (let i = 0; i < 6; i++) beacon.v(0, 0, 0, [0, 0, 0]);
  const gBeacon = upload(beacon, gl.DYNAMIC_DRAW);
  const indexBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  const order = new Uint32Array(indices.length);

  plate.prepend(canvas);
  overlay.hidden = false;
  const streets = [...overlay.querySelectorAll<HTMLElement>('[data-map3d-street]')];
  const compass = plate.querySelector<SVGElement>('.loc__compass svg');

  // --- Camera ---------------------------------------------------------------
  const mobile = () => plate.clientWidth < 620;
  const start = { d: 2400, pitch: 0, bearing: -1.25 };
  // Land close: the studio's own block and street fill the frame.
  const end = () => ({ d: mobile() ? 360 : 285, pitch: 1.0, bearing: -0.34 });
  let width = 1, height = 1, dpr = 1, flight = reduced ? 1 : 0, flying = false, bearing = start.bearing, spin = 0;
  let last = performance.now(), time = 0, frame = 0, visible = false, sortedAt = 99, dragging = false, dragX = 0, lastInput = -1e9;
  let mvp = new Float32Array(16);
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const resize = () => {
    width = Math.max(1, plate.clientWidth); height = Math.max(1, plate.clientHeight);
    dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(2.4e6 / (width * height)));
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    if (!frame) draw();
  };

  const project = (x: number, y: number, z: number) => {
    const w = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
    if (w <= 0) return null;
    return [((mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12]) / w * 0.5 + 0.5) * width, (0.5 - (mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13]) / w * 0.5) * height];
  };

  function sortBuildings(f: Vec) {
    const list = parts.slice().sort((a, b) => (b.cx * f[0] + b.cy * f[1]) - (a.cx * f[0] + a.cy * f[1]));
    let k = 0;
    for (const p of list) for (let i = 0; i < p.count; i++) order[k++] = indices[p.start + i];
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, order, gl.DYNAMIC_DRAW);
  }

  function draw() {
    // Dive at once and settle slowly; the camera tilts in behind the descent.
    const e = end(), q = ease(Math.min(1, flight)), p = 1 - (1 - q) * (1 - q), lift = ease(Math.min(1, Math.max(0, (flight - 0.1) / 0.9)));
    const d = start.d * Math.pow(e.d / start.d, p);
    const pitch = start.pitch + (e.pitch - start.pitch) * lift + (flight >= 1 && !reduced ? Math.sin(time * 0.21) * 0.03 : 0);
    const b = flight < 1 ? start.bearing + (e.bearing - start.bearing) * p : bearing;
    const f: Vec = [Math.sin(b), Math.cos(b), 0];
    // Frame the studio a little below centre, leaving air for its marker.
    const target: Vec = [f[0] * d * 0.1 * Math.sin(pitch + 0.3), f[1] * d * 0.1 * Math.sin(pitch + 0.3), studioTop * 0.4];
    const eye: Vec = [target[0] - f[0] * d * Math.sin(pitch), target[1] - f[1] * d * Math.sin(pitch), target[2] + d * Math.cos(pitch)];
    const z = norm(sub(eye, target)), x = norm(cross(f, z)), y = cross(z, x);
    const view = new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
    const fov = 1 / Math.tan(0.31), aspect = width / height, near = d * 0.05, far = d * 3 + R * 2, nf = 1 / (near - far);
    const proj = new Float32Array([fov / aspect, 0, 0, 0, 0, fov, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
    mvp = multiply(proj, view);
    if (Math.abs(b - sortedAt) > 0.3) { sortBuildings(f); sortedAt = b; }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.uniformMatrix4fv(U.mvp, false, mvp); gl.uniform1f(U.r, R); gl.uniform1f(U.time, time); gl.uniform2f(U.haze, d * 1.05, d * 2.6);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST);
    const pass = (buffers: Buffers, mode: number, alpha: number, kind: number = gl.TRIANGLES) => { gl.uniform1f(U.mode, mode); gl.uniform1f(U.alpha, alpha); bind(buffers); gl.drawArrays(kind, 0, buffers.count); };
    pass(gGround, 0, 1);
    // Shadows darken each ground pixel once, however many walls overlap there.
    gl.enable(gl.STENCIL_TEST); gl.colorMask(false, false, false, false);
    gl.stencilFunc(gl.ALWAYS, 1, 255); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE); pass(gShadow, 1, 1);
    gl.colorMask(true, true, true, true); gl.stencilFunc(gl.EQUAL, 1, 255); gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);
    gl.blendFunc(gl.DST_COLOR, gl.ZERO); pass(gShadow, 1, 1);
    gl.disable(gl.STENCIL_TEST); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (gRoute.count) pass(gRoute, 2, 1);
    pass(gRipple, 3, 1);
    // Buildings far to near, back faces culled, so the glass reads cleanly.
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
    gl.uniform1f(U.mode, 0); gl.uniform1f(U.alpha, ALPHA); bind(gSolid);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer); gl.drawElements(gl.TRIANGLES, order.length, gl.UNSIGNED_INT, 0);
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.disable(gl.CULL_FACE); gl.depthMask(false);
    pass(gEdges, 0, 0.55, gl.LINES);
    // The light above June's building faces the camera.
    const w = 7, top = studioTop + 64;
    const quad = [[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]];
    const pos = new Float32Array(quad.flatMap(([s, u]) => [x[0] * w * s, x[1] * w * s, studioTop + (top - studioTop) * u]));
    gl.bindBuffer(gl.ARRAY_BUFFER, gBeacon.pos); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, gBeacon.uv); gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(quad.flat()));
    pass(gBeacon, 4, 1);
    gl.depthMask(true);

    const pin = project(0, 0, studioTop + 3);
    if (pin) marker.style.transform = `translate3d(${pin[0].toFixed(1)}px, ${pin[1].toFixed(1)}px, 0)`;
    for (const label of streets) {
      const lx = Number(label.dataset.x), ly = Number(label.dataset.y), at = project(lx, ly, 1);
      const fade = at ? Math.max(0, Math.min(1, (0.75 - Math.hypot(lx, ly) / R) * 4)) * Math.max(0, Math.min(1, (flight - 0.6) * 3)) : 0;
      label.style.opacity = fade.toFixed(2);
      if (at) label.style.transform = `translate3d(${at[0].toFixed(1)}px, ${at[1].toFixed(1)}px, 0) translate(-50%, -50%)`;
    }
    if (compass) compass.style.rotate = `${(-b * 180 / Math.PI).toFixed(1)}deg`;
  }

  const tick = (now: number) => {
    frame = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!reduced) time += dt;
    if (flying && flight < 1) { flight = Math.min(1, flight + dt / (mobile() ? 5 : 5.6)); if (flight >= 1) bearing = end().bearing; }
    if (flight >= 1 && !reduced && !dragging) {
      // Inertia from a drag, then back to the slow orbit.
      spin *= Math.exp(-dt * 2.6);
      bearing += spin * dt + (now - lastInput > 1600 ? dt * Math.PI * 2 / 240 : 0);
    }
    draw();
    if (visible && !document.hidden && !reduced) frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    cancelAnimationFrame(frame); frame = 0;
    if (visible && !document.hidden && !reduced) { last = performance.now(); frame = requestAnimationFrame(tick); }
  };
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (entry.intersectionRatio > 0.3) flying = true;
    sync();
  }, { threshold: [0, 0.3, 0.6] });
  io.observe(plate);
  const ro = new ResizeObserver(resize); ro.observe(plate);
  document.addEventListener('visibilitychange', sync, { signal });

  // Horizontal drags turn the model; vertical movement stays page scrolling.
  canvas.addEventListener('pointerdown', (event) => { if (flight < 1) return; dragging = true; dragX = event.clientX; spin = 0; canvas.setPointerCapture(event.pointerId); }, { signal });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - dragX; dragX = event.clientX;
    bearing -= dx * 0.006; spin = -dx * 0.006 * 60; lastInput = performance.now();
    if (!frame) draw();
  }, { signal });
  const release = () => { dragging = false; lastInput = performance.now(); };
  canvas.addEventListener('pointerup', release, { signal });
  canvas.addEventListener('pointercancel', release, { signal });
  marker.addEventListener('click', onMarker, { signal });
  canvas.addEventListener('webglcontextlost', () => { dispose(); }, { signal });

  resize();
  requestAnimationFrame(() => plate.classList.add('is-3d'));
  function dispose() {
    cancelAnimationFrame(frame); io.disconnect(); ro.disconnect();
    plate.classList.remove('is-3d'); overlay!.hidden = true; canvas.remove(); compass?.style.removeProperty('rotate');
    gl!.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return dispose;
}
