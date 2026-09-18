/** Direct manipulation with a damped return to the ribbon's cruising speed. */
export function mountAwardRibbon(strip: HTMLElement) {
  const viewport = strip.querySelector<HTMLElement>('.strip__viewport')!;
  const track = strip.querySelector<HTMLElement>('.strip__track')!;
  const pass = strip.querySelector<HTMLElement>('.strip__pass')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const { signal } = controller;
  let period = pass.getBoundingClientRect().width;
  const matrix = new DOMMatrixReadOnly(getComputedStyle(track).transform);
  let offset = -matrix.m41 + viewport.scrollLeft;
  let speed = period / 52;
  let frame = 0, last = 0, visible = false, disposed = false;
  let pointer: number | undefined, previousX = 0, previousTime = 0, dragSpeed = 0;
  const normalize = () => { if (period) offset = ((offset % period) + period) % period; };
  const paint = () => { normalize(); track.style.transform = `translate3d(${-offset}px,0,0)`; };
  function tick(now: number) {
    frame = 0;
    if (disposed || !visible || document.hidden || reduced.matches) return;
    const dt = Math.min((now - last) / 1000 || .016, .05); last = now;
    if (pointer === undefined && !document.querySelector('dialog[open]')) {
      // Exponential damping preserves the release velocity and approaches the
      // original speed smoothly, including after dragging in the other direction.
      const cruise = period / 52;
      speed = cruise + (speed - cruise) * Math.exp(-dt / .72);
      offset += speed * dt;
      paint();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; last = performance.now();
    strip.toggleAttribute('data-ribbon-ready', !reduced.matches);
    if (reduced.matches) { track.style.transform = ''; pointer = undefined; viewport.style.cursor = ''; }
    else { viewport.scrollLeft = 0; paint(); }
    if (!disposed && visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
  }
  viewport.addEventListener('pointerdown', (event) => {
    if (reduced.matches || !event.isPrimary || event.button !== 0) return;
    pointer = event.pointerId; previousX = event.clientX; previousTime = performance.now();
    dragSpeed = 0; speed = 0; viewport.style.cursor = 'grabbing';
    viewport.setPointerCapture(pointer);
  }, { signal });
  viewport.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointer) return;
    const now = performance.now(), delta = previousX - event.clientX;
    const dt = Math.max(8, now - previousTime) / 1000;
    offset += delta;
    dragSpeed = dragSpeed * .3 + Math.max(-900, Math.min(900, delta / dt)) * .7;
    previousX = event.clientX; previousTime = now;
    paint();
  }, { signal });
  const release = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    speed = performance.now() - previousTime > 90 ? 0 : dragSpeed;
    pointer = undefined; viewport.style.cursor = '';
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  };
  viewport.addEventListener('pointerup', release, { signal });
  viewport.addEventListener('pointercancel', release, { signal });
  viewport.addEventListener('lostpointercapture', release, { signal });
  viewport.addEventListener('dragstart', (event) => event.preventDefault(), { signal });
  viewport.addEventListener('wheel', (event) => {
    if (reduced.matches || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault(); offset += event.deltaX; speed = 0; paint();
  }, { signal, passive: false });
  viewport.addEventListener('keydown', (event) => {
    if (reduced.matches || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); speed = event.key === 'ArrowRight' ? 480 : -480;
  }, { signal });
  const resize = new ResizeObserver(() => {
    const next = pass.getBoundingClientRect().width;
    if (period && next) offset *= next / period;
    period = next; if (!reduced.matches) paint();
  });
  resize.observe(pass);
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
  observer.observe(viewport);
  document.addEventListener('visibilitychange', sync, { signal });
  reduced.addEventListener('change', sync, { signal });
  sync();
  return () => { disposed = true; controller.abort(); cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); track.style.transform = ''; delete strip.dataset.ribbonReady; };
}
