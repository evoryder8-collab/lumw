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
}
