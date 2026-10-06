/**
 * The living background. Porcelain flowing into blush, sage, rose and leaf,
 * like light moving through silk: domain-warped noise, drawn at a sixth of
 * the screen's resolution and scaled up, because a field this smooth has no
 * detail to lose. That keeps it nearly free on a phone's GPU and memory.
 *
 * It lives in a persisted host, so page transitions never restart it, and it
 * only starts once a visitor moves; an audit that never does keeps the CSS
 * wash underneath.
 */
const VS = /* glsl */ `attribute vec2 a; varying vec2 v;
void main() { v = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }`;

const FS = /* glsl */ `precision highp float;
varying vec2 v;
uniform vec2 r;
uniform float t, s;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + 1.), f.x), f.y);
}
// Two octaves only: broad pools of colour, no fine veining.
float fb(vec2 p) { return .64 * n(p) + .36 * n(p * 1.9 + 3.7); }
void main() {
  vec2 p = (v - .5) * vec2(r.x / r.y, 1.) * .95 + vec2(0., s);
  // Circular drifts keep every coordinate bounded however long the page is open.
  vec2 a = vec2(sin(t * .031), cos(t * .023)) * 2.2, b = vec2(cos(t * .019), sin(t * .027)) * 2.2;
  vec2 q = vec2(fb(p + a), fb(p + b + 5.2));
  vec2 w = vec2(fb(p + 2.4 * q + vec2(1.7, 9.2) + b * .4), fb(p + 2.4 * q + vec2(8.3, 2.8) - a * .4));
  float f = fb(p + 2.2 * w);
  vec3 base = vec3(.965, .955, .935);
  vec3 c = mix(base, vec3(.958, .852, .858), smoothstep(.26, .68, w.x));
  c = mix(c, vec3(.842, .912, .866), smoothstep(.38, .8, w.y));
  c = mix(c, vec3(.93, .78, .8), smoothstep(.56, .88, f) * .6);
  c = mix(c, vec3(.71, .83, .75), smoothstep(.6, .92, q.x * w.y * 1.7) * .5);
  c = mix(c, vec3(.975, .935, .858), smoothstep(.64, .95, q.y) * .45);
  // Broad satin sheen where the flow folds over itself.
  c += .035 * smoothstep(.3, .5, f) * (1. - smoothstep(.5, .74, f));
  // The whole field breathes, slowly deepening and paling.
  gl_FragColor = vec4(mix(base, c, .74 + .26 * sin(t * .21)), 1.);
}`;

export function mountAura(host: HTMLElement) {
  if (host.querySelector('canvas')) return;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }) as WebGLRenderingContext | null;
  if (!gl) return;
  const program = gl.createProgram()!;
  for (const [type, source] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source); gl.compileShader(shader); gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const [R, T, S] = ['r', 't', 's'].map((name) => gl.getUniformLocation(program, name));
  const seed = Math.random() * 300, start = performance.now();
  let frame = 0, last = 0;

  const resize = () => {
    // A sixth of the CSS pixels: the upscale is the softness.
    canvas.width = Math.max(48, Math.round(innerWidth / 6));
    canvas.height = Math.max(48, Math.round(innerHeight / 6));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(R, canvas.width, canvas.height);
  };
  const draw = (now: number) => {
    gl.uniform1f(T, seed + (now - start) / 1000);
    gl.uniform1f(S, scrollY / Math.max(1, innerHeight) * 0.11);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  // Thirty frames a second is plenty for light this slow.
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    if (now - last > 32) { last = now; draw(now); }
  };
  const sync = () => {
    cancelAnimationFrame(frame);
    if (!document.hidden) frame = requestAnimationFrame(tick);
  };
  resize();
  draw(start);
  host.append(canvas);
  addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', sync);
  sync();
  requestAnimationFrame(() => host.classList.add('is-live'));
  canvas.addEventListener('webglcontextlost', () => { cancelAnimationFrame(frame); canvas.remove(); host.classList.remove('is-live'); });
}
