/** Preview horizontal movement once, yielding immediately to visitor input. */
export function mountScrollHint(track: HTMLElement, signal: AbortSignal, onFinish = () => {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frameId = 0;
  let nudging = false;
  let touched = false;
  const stop = () => {
    touched = true;
    cancelAnimationFrame(frameId);
    if (nudging) {
      nudging = false;
      track.classList.remove('is-nudging');
      track.dataset.nudge = 'cancelled';
    }
  };
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    if (reduced.matches || touched || track.scrollLeft > 2 || track.scrollWidth - track.clientWidth < 30) return;
    const distance = Math.min(48, track.scrollWidth - track.clientWidth);
    const started = performance.now();
    nudging = true;
    track.dataset.nudge = 'running';
    track.classList.add('is-nudging');
    const frame = (now: number) => {
      const progress = Math.min(1, (now - started) / 1300);
      const step = progress < 0.42
        ? 1 - Math.pow(1 - progress / 0.42, 3)
        : progress < 0.62 ? 1 : (1 + Math.cos(Math.PI * (progress - 0.62) / 0.38)) / 2;
      track.scrollTo({ left: distance * step, behavior: 'instant' });
      if (progress < 1) frameId = requestAnimationFrame(frame);
      else {
        nudging = false;
        track.classList.remove('is-nudging');
        track.dataset.nudge = 'done';
        onFinish();
      }
    };
    frameId = requestAnimationFrame(frame);
  }, { threshold: 0.35 });
  observer.observe(track);
  track.addEventListener('pointerdown', stop, { signal, passive: true });
  track.addEventListener('keydown', stop, { signal });
  track.addEventListener('wheel', (event) => { if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) stop(); }, { signal, passive: true });
  reduced.addEventListener('change', () => { if (reduced.matches) stop(); }, { signal });
  signal.addEventListener('abort', () => { observer.disconnect(); stop(); }, { once: true });
  return stop;
}
