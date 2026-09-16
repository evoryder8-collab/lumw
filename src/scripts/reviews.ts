export function mountReviews(signal: AbortSignal) {
  const section = document.querySelector<HTMLElement>('[data-reviews]');
  const track = section?.querySelector<HTMLElement>('[data-reviews-track]');
  if (!section || !track) return;
  const previous = section.querySelector<HTMLButtonElement>('[data-review-prev]')!;
  const next = section.querySelector<HTMLButtonElement>('[data-review-next]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let nudgeFrame = 0;
  let nudging = false;
  let touched = false;
  const stopNudge = () => {
    touched = true;
    cancelAnimationFrame(nudgeFrame);
    if (nudging) {
      nudging = false;
      track.classList.remove('is-nudging');
      track.dataset.nudge = 'cancelled';
    }
  };
  section.querySelector<HTMLElement>('[data-review-controls]')!.hidden = false;
  const sync = () => {
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  };
  const move = (direction: number) => {
    stopNudge();
    const width = track.querySelector('article')!.getBoundingClientRect().width + 24;
    track.scrollBy({ left: width * direction, behavior: reduced.matches ? 'instant' : 'smooth' });
  };
  previous.addEventListener('click', () => move(-1), { signal });
  next.addEventListener('click', () => move(1), { signal });
  track.addEventListener('scroll', sync, { signal, passive: true });
  window.addEventListener('resize', sync, { signal, passive: true });
  sync();
  // A real, small scroll previews the next card, then returns to the beginning.
  // One demonstration only, and any visitor input immediately takes precedence.
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
      if (progress < 1) nudgeFrame = requestAnimationFrame(frame);
      else {
        nudging = false;
        track.classList.remove('is-nudging');
        track.dataset.nudge = 'done';
        sync();
      }
    };
    nudgeFrame = requestAnimationFrame(frame);
  }, { threshold: 0.35 });
  observer.observe(track);
  track.addEventListener('pointerdown', stopNudge, { signal, passive: true });
  track.addEventListener('keydown', stopNudge, { signal });
  track.addEventListener('wheel', (event) => { if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) stopNudge(); }, { signal, passive: true });
  reduced.addEventListener('change', () => { if (reduced.matches) stopNudge(); }, { signal });
  signal.addEventListener('abort', () => { observer.disconnect(); cancelAnimationFrame(nudgeFrame); }, { once: true });
  if (!reduced.matches && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    section.querySelectorAll<HTMLElement>('[data-depth-card]').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const bounds = card.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width;
        const y = (event.clientY - bounds.top) / bounds.height;
        card.style.setProperty('--review-rx', `${(0.5 - y) * 5}deg`);
        card.style.setProperty('--review-ry', `${(x - 0.5) * 5}deg`);
        card.style.setProperty('--review-light-x', `${x * 100}%`);
        card.style.setProperty('--review-light-y', `${y * 100}%`);
      }, { signal, passive: true });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--review-rx', '0deg'); card.style.setProperty('--review-ry', '0deg');
      }, { signal });
    });
  }
}
