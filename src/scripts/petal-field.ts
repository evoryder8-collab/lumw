/**
 * Free-flying petals. A layer exists only while it has petals in the air, then
 * removes its canvas, so nothing keeps drawing behind a page at rest.
 */
import { AIR, createPetal, step, type Air, type Petal } from './petal-physics';
import { drawPetal, pickKind } from './petal-render';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export type PetalLayer = ReturnType<typeof createPetalLayer>;

/** A fixed, full-viewport overlay. The curtain hands it to the page when done. */
export function createPetalLayer(air: Air = AIR) {
  const canvas = document.createElement('canvas');
  canvas.className = 'petal-layer';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '2' });
  const ctx = canvas.getContext('2d')!;
  const petals: Petal[] = [];
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let width = 0, height = 0, frame = 0, last = 0, time = 0;
  const resize = () => {
    width = innerWidth; height = innerHeight;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; };
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; time += dt;
    if (!canvas.isConnected) { stop(); petals.length = 0; return; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i];
      step(p, dt, time, air);
      // Fade through the lower part of the screen, as if settling out of view.
      const fall = Math.min(1, Math.max(0, (p.y - height * 0.62) / (height * 0.36)));
      p.alpha = Math.min(1, p.age * 5) * (1 - fall);
      if (p.y > height + 60 || p.x < -80 || p.x > width + 80 || (p.age > 0.3 && p.alpha <= 0.01)) { petals.splice(i, 1); continue; }
      drawPetal(ctx, p, dpr);
    }
    ctx.globalAlpha = 1;
    if (petals.length) frame = requestAnimationFrame(tick);
    else { stop(); canvas.remove(); }
  };
  resize();
  return {
    canvas,
    get count() { return petals.length; },
    /** Release a petal with an initial velocity, in viewport pixels. */
    release(x: number, y: number, vx: number, vy: number, size = 15 + Math.random() * 12) {
      if (reduced()) return;
      const p = createPetal(x, y, (Math.random() - 0.35) * 420, size, pickKind());
      p.vx = vx; p.vy = vy;
      petals.push(p);
      if (!frame) { last = performance.now(); frame = requestAnimationFrame(tick); }
    },
    /** Keep drawing after the curtain closes, in the page's own stacking. */
    adopt(parent: Element) { if (petals.length && canvas.parentElement !== parent) parent.append(canvas); else if (!petals.length) canvas.remove(); },
    resize,
    clear() { stop(); petals.length = 0; canvas.remove(); },
  };
}

/**
 * A slow drift through a closing section. Sparse on purpose: a handful of
 * petals in the air at once, released only while the section is on screen.
 */
export function mountPetalDrift(section: HTMLElement) {
  if (reduced()) return () => {};
  const canvas = document.createElement('canvas');
  canvas.className = 'petal-drift';
  canvas.setAttribute('aria-hidden', 'true');
  section.prepend(canvas);
  const ctx = canvas.getContext('2d')!;
  const air: Air = { ...AIR, gravity: 190, gust: 18, breeze: 5 };
  const petals: Petal[] = [];
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let width = 1, height = 1, frame = 0, last = 0, time = 0, next = 0.2, visible = false;
  const measure = () => {
    width = section.clientWidth; height = section.clientHeight;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  };
  const tick = (now: number) => {
    frame = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; time += dt;
    if (time > next && petals.length < (width < 700 ? 6 : 10)) {
      next = time + 0.9 + Math.random() * 1.1;
      const p = createPetal(Math.random() * width, -24, (Math.random() - 0.3) * 500, 13 + Math.random() * 11, pickKind(0.3));
      p.vy = 30; petals.push(p);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i];
      step(p, dt, time, air);
      const fall = Math.min(1, Math.max(0, (p.y - height * 0.7) / (height * 0.3)));
      p.alpha = Math.min(1, p.age * 2) * (1 - fall) * 0.92;
      if (p.y > height + 30 || p.x < -60 || p.x > width + 60) { petals.splice(i, 1); continue; }
      drawPetal(ctx, p, dpr);
    }
    ctx.globalAlpha = 1;
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    cancelAnimationFrame(frame); frame = 0;
    if (visible && !document.hidden && !reduced()) { last = performance.now(); frame = requestAnimationFrame(tick); }
  };
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
  io.observe(section);
  const ro = new ResizeObserver(measure); ro.observe(section);
  document.addEventListener('visibilitychange', sync);
  measure();
  return () => { cancelAnimationFrame(frame); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', sync); canvas.remove(); };
}
