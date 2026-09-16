import { mountScrollHint } from './scroll-hint';

export function mountReviews(signal: AbortSignal) {
  const section = document.querySelector<HTMLElement>('[data-reviews]');
  const track = section?.querySelector<HTMLElement>('[data-reviews-track]');
  if (!section || !track) return;
  const previous = section.querySelector<HTMLButtonElement>('[data-review-prev]')!;
  const next = section.querySelector<HTMLButtonElement>('[data-review-next]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  section.querySelector<HTMLElement>('[data-review-controls]')!.hidden = false;
  const sync = () => {
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  };
  const stopNudge = mountScrollHint(track, signal, sync);
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
