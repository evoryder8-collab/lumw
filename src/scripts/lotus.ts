/** A bounded, optional portrait detail. No sensor readings are stored or sent. */
type Petal = { x: number; y: number; vx: number; vy: number; rotation: number; spin: number; size: number; phase: number; settled: boolean; age: number; burst: boolean; bounces: number };
type MotionPermission = typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };

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

  // Draw one pearlescent petal once, then reuse it at different angles.
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const ink = sprite.getContext('2d')!;
  const wash = ink.createLinearGradient(12, 50, 46, 8);
  wash.addColorStop(0, '#b89657'); wash.addColorStop(.4, '#e9c7a9');
  wash.addColorStop(.68, '#fff4db'); wash.addColorStop(1, '#e5cf91');
  ink.fillStyle = wash; ink.strokeStyle = '#e4ca8b'; ink.lineWidth = 1.1;
  ink.beginPath(); ink.moveTo(12, 51); ink.bezierCurveTo(7, 26, 24, 8, 51, 9);
  ink.bezierCurveTo(51, 32, 38, 56, 12, 51); ink.fill(); ink.stroke();
  ink.beginPath(); ink.moveTo(14, 49); ink.quadraticCurveTo(31, 30, 46, 14);
  ink.strokeStyle = '#fff6e1aa'; ink.lineWidth = .8; ink.stroke();

  const petals: Petal[] = [];
  let width = 1, height = 1, left = 0, top = 0, floor = 1, ledgeLeft = 0, ledgeWidth = 1;
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
    left = Math.max(0, Math.min(p.left, b.left) - g.left - 30);
    top = Math.max(0, p.top - g.top - 24);
    width = Math.min(g.width - left, Math.max(p.right, b.right) - g.left - left + 30);
    height = Math.min(g.height - top, b.bottom - g.top - top + 48);
    floor = b.top - g.top - top - 3;
    ledgeLeft = b.left - g.left - left; ledgeWidth = b.width;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    Object.assign(canvas.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    petals.length = 0; nextPetal = elapsed + .3;
  }

  function release() {
    const g = garden.getBoundingClientRect(), p = portrait!.getBoundingClientRect();
    // Release along the upper arc, so the petals travel over the photograph.
    const angle = -Math.PI * (.18 + Math.random() * .64);
    const x = p.left - g.left - left + p.width / 2 + Math.cos(angle) * p.width * .5;
    const y = p.top - g.top - top + p.height / 2 + Math.sin(angle) * p.height * .5;
    const target = ledgeLeft + ledgeWidth * (.1 + Math.random() * .8);
    const fallTime = Math.max(1, Math.sqrt(Math.max(1, floor - y) / 12));
    petals.push({ x, y: Math.min(y, floor - 20), vx: (target - x) / fallTime, vy: 5, rotation: Math.random() * 6.28, spin: (Math.random() - .5) * 1.5, size: 19 + Math.random() * 10, phase: Math.random() * 6.28, settled: false, age: 0, burst: false, bounces: 0 });
    if (petals.length > 48) petals.shift();
  }

  function scatter() {
    if (disposed || reduced.matches || !visible || document.hidden || document.querySelector('dialog[open]') || elapsed < scatterUntil) return;
    if (petals.length < 8) for (let i = 0; i < 8; i++) release();
    for (const petal of petals) {
      const angle = Math.random() * Math.PI * 2, speed = 65 + Math.random() * 90;
      petal.vx = Math.cos(angle) * speed; petal.vy = Math.sin(angle) * speed - 35;
      petal.settled = false; petal.burst = true; petal.age = 0; petal.spin *= 3;
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

  function tick(now: number) {
    frame = 0;
    if (!visible || document.hidden || reduced.matches || disposed) return;
    if (now - last < 32) { frame = requestAnimationFrame(tick); return; }
    const dt = Math.min((now - last) / 1000 || .033, .06); last = now;
    if (!document.querySelector('dialog[open]')) {
      elapsed += dt;
      if (elapsed >= scatterUntil && garden.dataset.petalState === 'scattering') garden.dataset.petalState = 'falling';
      if (elapsed > nextPetal) { release(); nextPetal = elapsed + .38 + Math.random() * .28; }
      ctx!.clearRect(0, 0, width, height);
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i]; p.age += dt;
        if (!p.settled) {
          p.vy += (p.burst ? 40 : 24) * dt;
          p.x += (p.vx + (p.burst ? 0 : Math.sin(elapsed * 1.7 + p.phase) * 12)) * dt;
          p.y += p.vy * dt; p.rotation += p.spin * dt;
          if (!p.burst && p.y >= floor && p.vy > 0 && p.x > ledgeLeft + 10 && p.x < ledgeLeft + ledgeWidth - 10) {
            if (p.bounces < 2 && p.vy > 14) {
              p.y = floor; p.vy *= -.2; p.vx *= .4; p.spin *= .5; p.bounces++;
            } else {
              p.settled = true; p.y = floor - Math.random() * 7; p.rotation = -.4 + Math.random() * .8; p.age = 0;
            }
          }
        }
        if (p.y > height + 30 || p.x < -30 || p.x > width + 30 || (p.burst && p.age > 2.8)) { petals.splice(petals.indexOf(p), 1); continue; }
        ctx!.save(); ctx!.translate(p.x, p.y); ctx!.rotate(p.rotation);
        ctx!.scale(p.settled ? 1 : .45 + Math.abs(Math.cos(p.age * 1.4 + p.phase)) * .55, 1);
        ctx!.globalAlpha = p.burst ? Math.max(0, 1 - p.age / 2.8) : Math.min(1, p.age * 3 + .4);
        ctx!.drawImage(sprite, -p.size / 2, -p.size / 2, p.size, p.size);
        // A small travelling highlight, not a flashing whole-screen effect.
        const glint = Math.max(0, Math.sin(elapsed * 1.5 + p.phase) - .93) * 10;
        if (glint > 0) { ctx!.globalAlpha *= glint; ctx!.fillStyle = '#fff4cb'; ctx!.fillRect(-3, -.45, 6, .9); ctx!.fillRect(-.45, -3, .9, 6); }
        ctx!.restore();
      }
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
