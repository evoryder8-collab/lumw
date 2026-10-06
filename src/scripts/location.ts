/** Mount on every Astro navigation, including Contact to link-in-bio. */
export function mountLocation(signal: AbortSignal) {
  const drive = document.querySelector<HTMLButtonElement>('[data-drive]');
  const choice = document.querySelector<HTMLDialogElement>('#route-choice');
  if (!drive || !choice) return;
  drive.hidden = false;
  let previousOverflow = '';
  drive.addEventListener('click', () => {
    previousOverflow = document.body.style.overflow;
    choice.showModal();
    drive.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    choice.querySelector<HTMLAnchorElement>('[data-choice-option]')?.focus();
  }, { signal });
  choice.querySelector('[data-choice-close]')?.addEventListener('click', () => choice.close(), { signal });
  choice.querySelectorAll('[data-choice-option]').forEach((option) => option.addEventListener('click', () => choice.close(), { signal }));
  choice.addEventListener('click', (event) => { if (event.target === choice) choice.close(); }, { signal });
  choice.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    drive.setAttribute('aria-expanded', 'false');
  }, { signal });
  signal.addEventListener('abort', () => {
    if (choice.open) { choice.close(); document.body.style.overflow = previousOverflow; }
  }, { once: true });

  // The 3D model is an enhancement over the drawn map: loaded as the section
  // approaches, never on data saver, and only where WebGL runs on a real GPU.
  const plate = document.querySelector<HTMLElement>('[data-map3d]')?.closest<HTMLElement>('.loc__plate');
  const saver = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (!plate || saver || !('IntersectionObserver' in window)) return;
  let dispose: (() => void) | undefined;
  const near = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    near.disconnect();
    void import('./map-3d').then(({ mountMap3d }) => mountMap3d(plate, signal, () => drive.click())).then((stop) => {
      if (signal.aborted) stop(); else dispose = stop;
    }).catch(() => { /* The drawn map remains. */ });
  }, { rootMargin: '320px 0px' });
  near.observe(plate);
  signal.addEventListener('abort', () => { near.disconnect(); dispose?.(); }, { once: true });
}
