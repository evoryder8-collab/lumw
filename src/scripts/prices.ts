/** Keep the actual price in accessible text and reserve its width throughout. */
export function mountPrices() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const prices = [...document.querySelectorAll<HTMLElement>('[data-price-counter]')];
  const frames = new Map<HTMLElement, number>();
  const settle = (element: HTMLElement, glow = false) => {
    const frame = frames.get(element);
    if (frame) cancelAnimationFrame(frame);
    frames.delete(element);
    element.textContent = element.dataset.price!;
    element.dataset.counted = 'true';
    if (glow) element.classList.add('is-price-complete');
  };
  const reveal = (element: HTMLElement) => {
    if (element.dataset.counted || frames.has(element)) return;
    if (reduced.matches) { settle(element); return; }
    const amount = Number(element.dataset.price);
    const started = performance.now();
    const frame = (now: number) => {
      const progress = Math.min(1, (now - started) / 650);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = String(Math.floor(amount * eased));
      if (progress < 1) frames.set(element, requestAnimationFrame(frame));
      else settle(element, true);
    };
    frames.set(element, requestAnimationFrame(frame));
  };
  const observer = new IntersectionObserver((entries) => entries.forEach(({ target, isIntersecting }) => {
    if (isIntersecting) { observer.unobserve(target); reveal(target as HTMLElement); }
  }), { threshold: 0.6, rootMargin: '0px 0px -8% 0px' });
  prices.forEach((price) => observer.observe(price));
  const preferenceChanged = () => { if (reduced.matches) prices.forEach((price) => settle(price)); };
  reduced.addEventListener('change', preferenceChanged);
  return () => {
    observer.disconnect();
    reduced.removeEventListener('change', preferenceChanged);
    prices.forEach((price) => settle(price));
  };
}
