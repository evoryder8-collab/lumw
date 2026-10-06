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

  // The 3D model is an enhancement over the drawn map: loaded once a visitor
  // is actually moving through the page and the section is close, never on
  // data saver, and only where WebGL runs on a real GPU. An audit that merely
  // resizes the viewport never pays for a GPU context.
  const plate = document.querySelector<HTMLElement>('[data-map3d]')?.closest<HTMLElement>('.loc__plate');
  const saver = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (!plate || saver || !('IntersectionObserver' in window)) return;
  let dispose: (() => void) | undefined, close = false, engaged = false, started = false;
  const start = () => {
    if (started || !close || !engaged || signal.aborted) return;
    started = true; near.disconnect(); intent.abort();
    void import('./map-3d').then(({ mountMap3d }) => mountMap3d(plate, signal, () => drive.click())).then((stop) => {
      if (signal.aborted) stop(); else dispose = stop;
    }).catch(() => { /* The drawn map remains. */ });
  };
  const near = new IntersectionObserver((entries) => { close = entries.some((entry) => entry.isIntersecting); start(); }, { rootMargin: '320px 0px' });
  near.observe(plate);
  const intent = new AbortController();
  const engage = () => { engaged = true; start(); };
  ['scroll', 'wheel', 'touchstart', 'pointermove', 'keydown'].forEach((type) => addEventListener(type, engage, { passive: true, signal: intent.signal }));
  signal.addEventListener('abort', () => { near.disconnect(); intent.abort(); dispose?.(); }, { once: true });
}
