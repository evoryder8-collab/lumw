/** A bounded, optional portrait detail. No sensor readings are stored or sent. */
import { AIR, createPetal, easeOrientation, restingQuaternion, step, type Air, type Petal } from './petal-physics';
import { drawPetal, pickKind } from './petal-render';

type GardenPetal = Petal & { settled: boolean; burst: boolean; bounces: number; rest?: [number, number, number, number] };
type MotionPermission = typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };

// Slower air than the curtain shower: these petals are watched, not glimpsed.
const AIR_GARDEN: Air = { ...AIR, gravity: 430, gust: 18, breeze: 0 };
// The rim's three gold lotus reliefs, in degrees around the portrait.
const BLOSSOMS = [-90, 42, 138];

export function mountLotus(garden: HTMLElement) {
  const portrait = garden.querySelector<HTMLElement>('.hero-winner');
  const ledge = garden.querySelector<HTMLElement>('.winner-caption');
  const button = garden.querySelector<HTMLButtonElement>('[data-lotus-scatter]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (!portrait || !ledge || !button || reduced.matches) return () => {};
  const controller = new AbortController();
  const { signal } = controller;
  const canvas = document.createElement('canvas');
  canvas.className = 'lotus-fall';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', pointerEvents: 'none', zIndex: '3' });
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  garden.append(canvas);

  const petals: GardenPetal[] = [];
  let width = 1, height = 1, left = 0, top = 0, floor = 1, ledgeLeft = 0, ledgeWidth = 1, dpr = 1;
  let visible = false, frame = 0, last = 0, elapsed = 0, nextPetal = .3, scatterUntil = 0, disposed = false;
  let motionEnabled = false, permissionAsked = false;
  let lastPeak = 0, lastSign = 0, cooldown = 0;
  let gravity: number[] | undefined;
  const Motion = window.DeviceMotionEvent as MotionPermission | undefined;
  const label = (value?: string) => { if (value) button.ariaLabel = value; };
  label(Motion?.requestPermission ? button.dataset.labelMotion : button.dataset.labelTap);
  button.hidden = false;
  garden.dataset.petalState = 'falling';

  function measure() {
    const g = garden.getBoundingClientRect(), p = portrait!.getBoundingClientRect(), b = ledge!.getBoundingClientRect();
    // Room around the portrait for petals that swing wide of the rim.
    left = Math.max(0, Math.min(p.left, b.left) - g.left - 60);
    top = Math.max(0, p.top - g.top - 40);
    width = Math.min(g.width - left, Math.max(p.right, b.right) - g.left - left + 60);
    height = Math.min(g.height - top, b.bottom - g.top - top + 48);
    floor = b.top - g.top - top - 2;
    ledgeLeft = b.left - g.left - left; ledgeWidth = b.width;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    Object.assign(canvas.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    petals.length = 0; nextPetal = elapsed + .3;
  }

  function release() {
    const g = garden.getBoundingClientRect(), p = portrait!.getBoundingClientRect();
    const cx = p.left - g.left - left + p.width / 2, cy = p.top - g.top - top + p.height / 2, r = p.width / 2;
    // Most petals come loose from the gold lotus at the crown of the rim; the
    // rest from along its upper arc, so the fall frames the photograph.
    const crown = Math.random() < 0.55;
    const angle = (crown ? BLOSSOMS[0] + (Math.random() - .5) * 26 : -170 + Math.random() * 160) * Math.PI / 180;
    const x = cx + Math.cos(angle) * r * 1.04, y = Math.min(cy + Math.sin(angle) * r * 1.04, floor - 40);
    // Sized to the portrait, so a phone and a desktop show the same blossom.
    const petal = createPetal(x, y, (Math.random() - .5) * 120, Math.max(17, r * (.085 + Math.random() * .05)), pickKind(.16)) as GardenPetal;
    // Steer gently toward the glass ledge; the air still decides the path.
    const target = ledgeLeft + ledgeWidth * (.08 + Math.random() * .84);
    const fallTime = Math.max(2, (floor - y) / 120);
    petal.drift = (target - x) / fallTime;
    petal.vx = Math.cos(angle) * 18; petal.vy = 6;
    Object.assign(petal, { settled: false, burst: false, bounces: 0 });
    petals.push(petal);
    if (petals.length > 48) petals.shift();
  }

  function scatter() {
    if (disposed || reduced.matches || !visible || document.hidden || document.querySelector('dialog[open]') || elapsed < scatterUntil) return;
    if (petals.length < 16) for (let i = 0; i < 16; i++) release();
    for (const petal of petals) {
      // An outward breath from the ledge, strongest upward, then the air takes over.
      const angle = -Math.PI / 2 + (Math.random() - .5) * 2.4, speed = 160 + Math.random() * 220;
      petal.vx = Math.cos(angle) * speed; petal.vy = Math.sin(angle) * speed; petal.vz = (Math.random() - .5) * 160;
      petal.wx = (Math.random() - .5) * 14; petal.wy = (Math.random() - .5) * 14; petal.wz = (Math.random() - .5) * 8;
      petal.settled = false; petal.burst = true; petal.age = 0; petal.drift = 0; petal.rest = undefined;
    }
    scatterUntil = elapsed + 3; nextPetal = scatterUntil + .2;
    garden.dataset.petalState = 'scattering';
  }

  function onMotion(event: DeviceMotionEvent) {
    if (!visible || document.hidden || reduced.matches || document.querySelector('dialog[open]')) return;
    const value = event.acceleration?.x != null ? event.acceleration : event.accelerationIncludingGravity;
    if (!value || value.x == null || value.y == null || value.z == null) return;
    let axes = [value.x, value.y, value.z];
    if (event.acceleration?.x == null) {
      if (!gravity) { gravity = [...axes]; return; }
      axes = axes.map((v, i) => { gravity![i] = gravity![i] * .85 + v * .15; return v - gravity![i]; });
    }
    const strongest = axes.reduce((a, b) => Math.abs(a) > Math.abs(b) ? a : b);
    const now = performance.now(), sign = Math.sign(strongest);
    // Require two opposing impulses: ordinary scrolling/tilting is not a shake.
    if (Math.abs(strongest) < 12 || now < cooldown) return;
    if (now - lastPeak < 550 && now - lastPeak > 55 && sign !== lastSign) { scatter(); cooldown = now + 3500; lastPeak = 0; }
    else { lastPeak = now; lastSign = sign; }
  }
  function enableMotion() {
    if (disposed || motionEnabled) return;
    motionEnabled = true;
    window.addEventListener('devicemotion', onMotion, { passive: true, signal });
  }
  button.addEventListener('click', () => {
    scatter();
    if (!Motion || permissionAsked) return;
    permissionAsked = true;
    if (Motion.requestPermission) {
      // Call synchronously within the trusted tap, as required by iOS.
      void Motion.requestPermission().then((result) => {
        if (disposed) return;
        label(button.dataset.labelTap);
        if (result === 'granted') {
          enableMotion();
          const status = garden.querySelector('[data-lotus-status]');
          if (status) status.textContent = button.dataset.labelEnabled ?? '';
        }
      }).catch(() => { if (!disposed) label(button.dataset.labelTap); });
    } else enableMotion();
  }, { signal });
  if (Motion && !Motion.requestPermission) enableMotion();

  function land(p: GardenPetal) {
    // A soft first contact can bounce once or twice before the petal lies down.
    if (p.bounces < 2 && p.vy > 70) {
      p.y = floor; p.vy *= -.22; p.vx *= .5; p.wx *= .4; p.wy *= .4; p.wz *= .4; p.bounces++;
      return;
    }
    p.settled = true; p.y = floor - Math.random() * 5; p.age = 0;
    p.vx *= .25; p.vy = 0; p.vz = 0; p.wx = p.wy = p.wz = 0;
    p.rest = restingQuaternion(Math.random() * Math.PI * 2);
  }

  function tick(now: number) {
    frame = 0;
    if (!visible || document.hidden || reduced.matches || disposed) return;
    const dt = Math.min((now - last) / 1000 || .016, .05); last = now;
    if (!document.querySelector('dialog[open]')) {
      elapsed += dt;
      if (elapsed >= scatterUntil && garden.dataset.petalState === 'scattering') garden.dataset.petalState = 'falling';
      if (elapsed > nextPetal) { release(); nextPetal = elapsed + .3 + Math.random() * .24; }
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i];
        if (p.settled) {
          // Slide to rest and lie down on the glass.
          p.x += p.vx * dt; p.vx *= Math.exp(-dt * 6); p.z *= Math.exp(-dt * 6);
          if (p.rest) easeOrientation(p, p.rest, 1 - Math.exp(-dt * 9));
          p.age += dt;
        } else {
          step(p, dt, elapsed, AIR_GARDEN);
          if (!p.burst && p.y >= floor && p.vy > 0 && p.x > ledgeLeft + 10 && p.x < ledgeLeft + ledgeWidth - 10) land(p);
        }
        if (p.y > height + 30 || p.x < -40 || p.x > width + 40 || (p.burst && p.age > 2.8)) { petals.splice(i, 1); continue; }
        p.alpha = p.burst ? Math.max(0, 1 - p.age / 2.8) : Math.min(1, p.age * 2.5 + (p.settled ? 1 : .15));
        drawPetal(ctx!, p, dpr);
      }
      ctx!.globalAlpha = 1;
      // Trim the pile after traversal so removing an older petal cannot shift
      // the current index and update another petal twice in one frame.
      const pile = petals.filter((p) => p.settled);
      for (const older of pile.slice(0, Math.max(0, pile.length - 18))) petals.splice(petals.indexOf(older), 1);
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; last = performance.now();
    canvas.hidden = reduced.matches;
    button.hidden = reduced.matches;
    if (visible && !document.hidden && !reduced.matches && !disposed) frame = requestAnimationFrame(tick);
  }
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: .1 });
  intersection.observe(portrait);
  const resize = new ResizeObserver(measure); resize.observe(garden); resize.observe(ledge);
  document.addEventListener('visibilitychange', sync, { signal });
  reduced.addEventListener('change', sync, { signal });
  measure();
  return () => { disposed = true; cancelAnimationFrame(frame); controller.abort(); intersection.disconnect(); resize.disconnect(); canvas.remove(); button.hidden = true; delete garden.dataset.petalState; };
}
