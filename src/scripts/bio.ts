/** Small, interruptible glass interactions for the native Instagram landing page. */
export function mountBio(signal: AbortSignal) {
  if (document.body.dataset.page !== 'linkinbio') return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const animations = new Set<Animation>();
  const play = (element: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) => {
    const animation = element.animate(frames, options);
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
    return animation;
  };
  const observer = new IntersectionObserver((entries) => entries.forEach(({ target, isIntersecting }) => {
    const item = target as HTMLElement;
    item.dataset.bioVisible = String(isIntersecting);
    if (!isIntersecting || item.dataset.bioRevealed) return;
    item.dataset.bioRevealed = 'true';
    if (!reduced.matches) play(item, [{ opacity: 0.25, translate: '0 18px' }, { opacity: 1, translate: '0 0' }], { duration: 620, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  }), { threshold: 0.12, rootMargin: '0px 0px -20px 0px' });
  document.querySelectorAll<HTMLElement>('[data-bio-reveal]').forEach((item) => observer.observe(item));

  document.querySelectorAll<HTMLElement>('[data-bio-action]').forEach((link) => {
    link.addEventListener('pointermove', (event) => {
      if (reduced.matches || !fine.matches || event.pointerType === 'touch') return;
      const bounds = link.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      link.style.setProperty('--bio-x', `${x * 100}%`);
      link.style.setProperty('--bio-y', `${y * 100}%`);
      link.style.setProperty('--bio-rx', `${(0.5 - y) * 3}deg`);
      link.style.setProperty('--bio-ry', `${(x - 0.5) * 3}deg`);
    }, { signal, passive: true });
    link.addEventListener('pointerleave', () => {
      link.style.setProperty('--bio-rx', '0deg');
      link.style.setProperty('--bio-ry', '0deg');
    }, { signal });
    link.addEventListener('pointerdown', (event) => {
      if (reduced.matches || event.button !== 0) return;
      const bounds = link.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'bio-link__ripple';
      ripple.setAttribute('aria-hidden', 'true');
      ripple.style.setProperty('--tap-x', `${event.clientX - bounds.left}px`);
      ripple.style.setProperty('--tap-y', `${event.clientY - bounds.top}px`);
      link.append(ripple);
      const animation = play(ripple, [{ transform: 'scale(0.12)', opacity: 0.8 }, { transform: 'scale(2.8)', opacity: 0 }], { duration: 650, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      animation.finished.then(() => ripple.remove(), () => ripple.remove());
    }, { signal, passive: true });
  });
  const sleep = () => document.body.toggleAttribute('data-bio-sleep', document.hidden);
  document.addEventListener('visibilitychange', sleep, { signal });
  reduced.addEventListener('change', () => { if (reduced.matches) animations.forEach((animation) => animation.finish()); }, { signal });
  signal.addEventListener('abort', () => {
    observer.disconnect();
    animations.forEach((animation) => animation.cancel());
  }, { once: true });
}
