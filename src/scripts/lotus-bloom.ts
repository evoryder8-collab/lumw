/**
 * A lotus that blooms on the closed curtain, with June's logo rising out of
 * its heart. Drawn in the curtain's own WebGL context after the velvet:
 * twenty-two petals shaped on the CPU each frame (cupped, curled, each a
 * little different), lit with translucency from the light at the core, then
 * the logo as a depth-tested billboard so the petals genuinely hide it until
 * it rises. A halo with soft rays and drifting gold dust complete the scene.
 */
type GL = WebGLRenderingContext;
type V3 = [number, number, number];

const NU = 10, NV = 7;
const LAYERS = [
  // count, length, half-width, base radius, closed tilt, open tilt, cup
  { n: 6, len: 0.6, w: 0.25, r: 0.045, closed: 0.04, open: 0.38, cup: 0.62 },
  { n: 8, len: 0.84, w: 0.31, r: 0.07, closed: 0.12, open: 0.74, cup: 0.58 },
  { n: 10, len: 0.98, w: 0.33, r: 0.1, closed: 0.2, open: 1.1, cup: 0.5 },
];

const PETAL_VS = /* glsl */ `attribute vec3 p; attribute vec3 q; attribute vec3 k;
uniform mat4 m; varying vec3 vN, vP, vK;
void main() { vN = q; vP = p; vK = k; gl_Position = m * vec4(p, 1.); }`;

const PETAL_FS = /* glsl */ `#extension GL_OES_standard_derivatives : enable
precision mediump float;
varying vec3 vN, vP, vK;
uniform vec3 e;
uniform float g, f;
void main() {
  vec3 N = normalize(vN), V = normalize(e - vP);
  if (dot(N, V) < 0.) N = -N;
  float u = vK.x, w = vK.y, layer = vK.z;
  vec3 col;
  if (layer > 2.5) {
    // The seed pod: gold, dotted with seeds.
    float seed = smoothstep(.35, .2, length(fract(vP.xz * 30.) - .5));
    col = mix(vec3(.78, .6, .26), vec3(.98, .86, .5), .5 + .5 * N.y) * (1. - .35 * seed);
  } else {
    // A gold heart, an ivory-blush body and rose tips, as a sacred lotus.
    col = mix(vec3(.97, .82, .52), vec3(.99, .93, .92), smoothstep(0., .3, u));
    col = mix(col, vec3(.93, .6, .68), smoothstep(.38, 1., u) * (.55 + .18 * layer));
    col *= 1. - .07 * smoothstep(.5, 1., sin(w * 22.)) * (1. - u * .7);
    // Inner petals shade the bases of the outer ones.
    col *= mix(.58 + .12 * (2. - layer), 1., smoothstep(0., .42 + .08 * layer, u));
  }
  vec3 L = normalize(vec3(.35, 1., .7));
  float diff = .34 + .66 * max(dot(N, L), 0.);
  float rim = pow(1. - abs(dot(N, V)), 3.);
  float core = exp(-length(vP - vec3(0., .22, 0.)) * 2.4) * g;
  vec3 c = col * diff + vec3(1., .9, .78) * rim * .4 + vec3(1., .8, .62) * core * .45;
  c += vec3(1., .96, .88) * pow(max(dot(reflect(-L, N), V), 0.), 26.) * .3;
  // Soft petal edges instead of a hard, aliased silhouette.
  float edge = layer > 2.5 ? 1. : 1. - smoothstep(1. - fwidth(w) * 1.6, 1., abs(w));
  gl_FragColor = vec4(c, 1.) * f * edge;
}`;

const SPRITE_VS = /* glsl */ `attribute vec3 p; attribute vec3 k;
uniform mat4 m; uniform float s; varying vec3 vK;
void main() { vK = k; gl_Position = m * vec4(p, 1.); gl_PointSize = k.z * s; }`;

// k.z < 0 marks the logo quad, 0 the halo, > 0 a dust point.
const SPRITE_FS = /* glsl */ `precision mediump float;
varying vec3 vK;
uniform sampler2D t;
uniform float a, g;
void main() {
  if (vK.z < -.5) { vec4 c = texture2D(t, vK.xy); gl_FragColor = c * a; return; }
  if (vK.z < .5) {
    vec2 d = vK.xy * 2. - 1.;
    float r = length(d), ang = atan(d.y, d.x);
    float rays = pow(.5 + .5 * sin(ang * 14.) * sin(ang * 5. + 1.3), 4.) * exp(-r * 2.3);
    float halo = exp(-r * r * 6.) + rays * .55;
    gl_FragColor = vec4(vec3(1., .83, .52) * halo * g, 0.);
    return;
  }
  vec2 d = gl_PointCoord * 2. - 1.;
  float i = exp(-dot(d, d) * 3.5) * vK.x;
  gl_FragColor = vec4(vec3(1., .88, .58) * i, 0.);
}`;

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const spring = (t: number, omega: number, zeta: number) => {
  if (t <= 0) return 0;
  const wd = omega * Math.sqrt(1 - zeta * zeta), d = Math.exp(-zeta * omega * t);
  return 1 - d * (Math.cos(wd * t) + zeta * omega / wd * Math.sin(wd * t));
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function compile(gl: GL, vs: string, fs: string) {
  const p = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
}

export type Bloom = ReturnType<typeof createBloom>;

export function createBloom(gl: GL, logo: HTMLImageElement | undefined) {
  const petalProgram = compile(gl, PETAL_VS, PETAL_FS), spriteProgram = compile(gl, SPRITE_VS, SPRITE_FS);
  if (!petalProgram || !spriteProgram) return undefined;
  // Each petal is its own small variation of its layer.
  const petals = LAYERS.flatMap((layer, li) => Array.from({ length: layer.n }, (_, i) => ({
    li, ...layer, phi: (i / layer.n) * Math.PI * 2 + li * 0.4 + (Math.sin(i * 7.3 + li) * 0.06),
    len: layer.len * (1 + Math.sin(i * 3.1 + li * 2) * 0.06), jitter: Math.sin(i * 5.7 + li * 3) * 0.08, delay: Math.sin(i * 2.3 + li) * 0.05,
  })));
  const perPetal = NU * NV;
  const POD = 25;
  const vertexCount = petals.length * perPetal + POD + 1;
  const pos = new Float32Array(vertexCount * 3), nrm = new Float32Array(vertexCount * 3), key = new Float32Array(vertexCount * 3);
  const index: number[] = [];
  petals.forEach((_, pi) => {
    const o = pi * perPetal;
    for (let a = 0; a < NU - 1; a++) for (let b = 0; b < NV - 1; b++) {
      const i = o + a * NV + b;
      index.push(i, i + NV, i + 1, i + 1, i + NV, i + NV + 1);
    }
  });
  const podCentre = petals.length * perPetal;
  for (let s = 0; s < POD - 1; s++) index.push(podCentre, podCentre + 1 + s, podCentre + 1 + ((s + 1) % (POD - 1)));
  const indexBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW);
  const buffers = [gl.createBuffer()!, gl.createBuffer()!, gl.createBuffer()!];
  const spriteBuffers = [gl.createBuffer()!, gl.createBuffer()!];

  let texture: WebGLTexture | null = null, aspect = 1.5;
  if (logo) {
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, logo);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    aspect = logo.naturalWidth / logo.naturalHeight;
  }
  const dust = Array.from({ length: 64 }, (_, i) => ({ born: 0.55 + i * 0.03, a: i * 2.39996, r: 0.02 + (i % 7) * 0.012, v: 0.22 + (i % 5) * 0.05, size: 3 + (i % 4) * 1.6 }));

  /** b: seconds since the bloom began. e: seconds since the curtain began to open (negative before). */
  function shape(b: number, e: number) {
    const breath = Math.sin(b * 1.3);
    // The flower turns slowly as it opens, so its depth reads by parallax.
    const turn = b * 0.28 + e * 0.2;
    petals.forEach((pt, pi) => {
      const open = Math.min(1.08, spring(b - 0.22 - (2 - pt.li) * 0.16 - pt.delay, 6.2, 0.6));
      const exit = smooth(0, 0.7, e);
      const tilt = pt.closed + (pt.open - pt.closed) * open + pt.jitter * open + breath * 0.02 + exit * 0.35;
      const curl = 0.28 - 0.62 * open;
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const phi = pt.phi + turn;
      const d: V3 = [Math.sin(phi), 0, Math.cos(phi)], tan: V3 = [Math.cos(phi), 0, -Math.sin(phi)];
      const o = pi * perPetal;
      for (let a = 0; a < NU; a++) {
        const u = a / (NU - 1);
        const hw = pt.w * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.93 + 0.07)), 0.72) * (1 - 0.22 * u);
        for (let b2 = 0; b2 < NV; b2++) {
          const w = (b2 / (NV - 1)) * 2 - 1;
          const x = w * hw, y = u * pt.len;
          // Cupped like a spoon, the tip curling in while closed and out as it opens.
          const z = pt.cup * w * w * hw + curl * u * u * pt.len * 0.5;
          const yy = y * ct + z * st, zz = -y * st + z * ct;
          const i = (o + a * NV + b2) * 3;
          pos[i] = pt.r * d[0] + x * tan[0] - zz * d[0];
          pos[i + 1] = yy;
          pos[i + 2] = pt.r * d[2] + x * tan[2] - zz * d[2];
          key[i] = u; key[i + 1] = w; key[i + 2] = pt.li;
        }
      }
      // Normals from the shaped surface itself.
      for (let a = 0; a < NU; a++) for (let b2 = 0; b2 < NV; b2++) {
        const at = (aa: number, bb: number): V3 => { const j = (o + Math.max(0, Math.min(NU - 1, aa)) * NV + Math.max(0, Math.min(NV - 1, bb))) * 3; return [pos[j], pos[j + 1], pos[j + 2]]; };
        const pu1 = at(a + 1, b2), pu0 = at(a - 1, b2), pv1 = at(a, b2 + 1), pv0 = at(a, b2 - 1);
        const n = norm(cross([pu1[0] - pu0[0], pu1[1] - pu0[1], pu1[2] - pu0[2]], [pv1[0] - pv0[0], pv1[1] - pv0[1], pv1[2] - pv0[2]]));
        const i = (o + a * NV + b2) * 3;
        nrm[i] = n[0]; nrm[i + 1] = n[1]; nrm[i + 2] = n[2];
      }
    });
    // The seed pod: a low gold dome at the heart.
    const c = podCentre * 3;
    pos[c] = 0; pos[c + 1] = 0.085; pos[c + 2] = 0; nrm[c] = 0; nrm[c + 1] = 1; nrm[c + 2] = 0; key[c + 2] = 3;
    for (let s = 0; s < POD - 1; s++) {
      const ang = (s / (POD - 1)) * Math.PI * 2, j = (podCentre + 1 + s) * 3;
      pos[j] = Math.cos(ang) * 0.075; pos[j + 1] = 0.06; pos[j + 2] = Math.sin(ang) * 0.075;
      nrm[j] = Math.cos(ang) * 0.5; nrm[j + 1] = 0.85; nrm[j + 2] = Math.sin(ang) * 0.5; key[j + 2] = 3;
    }
  }

  const look = (eye: V3, target: V3) => {
    const z = norm([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]), x = norm(cross([0, 1, 0], z)), y = cross(z, x);
    return { x, y, m: [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]), -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]), -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]), 1] };
  };
  const mul = (a: number[], b: number[]) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };

  const attrib = (program: WebGLProgram, name: string, buffer: WebGLBuffer, data: Float32Array) => {
    const loc = gl.getAttribLocation(program, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    return loc;
  };

  /**
   * Draw over the velvet; w and h are the CSS size. Returns where the lotus
   * sits on screen, for the petals it lets go.
   */
  function draw(b: number, e: number, w: number, h: number) {
    if (b <= 0) return null;
    const appear = smooth(0, 0.45, b), leave = 1 - smooth(0.1, 0.75, e);
    const fade = appear * leave;
    if (fade <= 0.002) return null;
    shape(b, e);
    // The lotus fills about half the shorter side, a little below centre.
    const size = Math.min(w * 0.74, h * 0.56), fov = 0.5, focal = h / 2 / Math.tan(fov / 2);
    const dist = (2.15 * focal) / size, pitch = 0.5;
    const target: V3 = [0, 0.32 - smooth(0, 0.9, e) * 0.25, 0];
    const eye: V3 = [0, target[1] + dist * Math.sin(pitch), dist * Math.cos(pitch)];
    const view = look(eye, target);
    const f = 1 / Math.tan(fov / 2), near = dist * 0.2, far = dist * 3, nf = 1 / (near - far);
    const lift = -0.27;
    const proj = [f / (w / h), 0, 0, 0, 0, f, 0, 0, 0, -lift, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
    const mvp = mul(proj, view.m);
    // As the curtain parts the flower swells gently while it fades.
    const scale = 1 + smooth(0, 1, e) * 0.12;
    if (scale !== 1) for (let i = 0; i < pos.length; i++) pos[i] *= scale;

    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(petalProgram);
    gl.uniformMatrix4fv(gl.getUniformLocation(petalProgram!, 'm'), false, mvp);
    gl.uniform3f(gl.getUniformLocation(petalProgram!, 'e'), eye[0], eye[1], eye[2]);
    const glow = smooth(0.35, 1.4, b) * (1 + 1.2 * Math.exp(-Math.max(0, e) * 4) * smooth(-0.05, 0.05, e));
    gl.uniform1f(gl.getUniformLocation(petalProgram!, 'g'), glow);
    gl.uniform1f(gl.getUniformLocation(petalProgram!, 'f'), fade);
    const locs = [attrib(petalProgram!, 'p', buffers[0], pos), attrib(petalProgram!, 'q', buffers[1], nrm), attrib(petalProgram!, 'k', buffers[2], key)];
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0);
    locs.forEach((l) => gl.disableVertexAttribArray(l));

    // The logo rises out of the heart; depth keeps it inside the petals at first.
    gl.useProgram(spriteProgram);
    gl.uniformMatrix4fv(gl.getUniformLocation(spriteProgram!, 'm'), false, mvp);
    gl.uniform1f(gl.getUniformLocation(spriteProgram!, 's'), (size / 260) * (devicePixelRatio || 1));
    const rise = spring(b - 0.7, 4.6, 0.74);
    const logoY = 0.08 + rise * 1.13 + smooth(0, 1, e) * 0.35;
    const logoW = 0.7 + rise * 0.98, logoH = logoW / aspect;
    const sprites: number[] = [], keys: number[] = [];
    const quad = (cy: number, hw: number, hh: number, kz: number) => {
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
      for (const [sx, sy] of corners) {
        sprites.push(view.x[0] * hw * sx + view.y[0] * hh * sy, cy + view.x[1] * hw * sx + view.y[1] * hh * sy, view.x[2] * hw * sx + view.y[2] * hh * sy);
        keys.push((sx + 1) / 2, (1 - sy) / 2, kz);
      }
    };
    // Halo first, additive, then the logo, then the dust.
    quad(logoY * 0.85 + 0.25, 1.5, 1.5, 0);
    const haloCount = 6;
    if (texture) quad(logoY + logoH * 0.5, logoW, logoH, -1);
    const logoCount = texture ? 6 : 0;
    for (const p of dust) {
      const age = b - p.born;
      if (age <= 0) continue;
      const life = (age % 2.4) / 2.4;
      const y = 0.15 + life * (0.9 + p.v), rr = p.r + life * 0.25;
      sprites.push(Math.cos(p.a + life * 1.6) * rr, y, Math.sin(p.a + life * 1.6) * rr);
      keys.push(Math.sin(Math.PI * life) * 0.8 * fade * smooth(0.6, 1.2, b), 0, p.size);
    }
    const dustCount = sprites.length / 3 - haloCount - logoCount;
    const spriteLocs = [attrib(spriteProgram!, 'p', spriteBuffers[0], new Float32Array(sprites)), attrib(spriteProgram!, 'k', spriteBuffers[1], new Float32Array(keys))];
    gl.uniform1f(gl.getUniformLocation(spriteProgram!, 'g'), glow * 0.55 * fade);
    gl.depthMask(false);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.disable(gl.DEPTH_TEST);
    gl.drawArrays(gl.TRIANGLES, 0, haloCount);
    gl.enable(gl.DEPTH_TEST);
    if (texture) {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(gl.getUniformLocation(spriteProgram!, 't'), 2);
      gl.uniform1f(gl.getUniformLocation(spriteProgram!, 'a'), smooth(0.75, 1.25, b) * (1 - smooth(0.2, 0.8, e)));
      gl.drawArrays(gl.TRIANGLES, haloCount, logoCount);
    }
    gl.blendFunc(gl.ONE, gl.ONE);
    if (dustCount > 0) gl.drawArrays(gl.POINTS, haloCount + logoCount, dustCount);
    spriteLocs.forEach((l) => gl.disableVertexAttribArray(l));
    gl.depthMask(true); gl.disable(gl.DEPTH_TEST);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // The lotus's centre on screen, for the petals it releases.
    const cw = mvp[7] * 0.35 + mvp[15];
    const cy = (mvp[5] * 0.35 + mvp[13]) / cw;
    return { x: w / 2, y: (0.5 - cy * 0.5) * h, radius: size / 2 };
  }

  return { draw };
}
