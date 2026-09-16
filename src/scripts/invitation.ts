const key = 'luma-invitation-seen';
let seenInMemory = false;

/** Count actual visible homepage time after the welcome choices. */
export function mountInvitation(signal: AbortSignal) {
  const card = document.querySelector<HTMLElement>('[data-june-invitation]');
  if (!card || seenInMemory) return;
  try { if (sessionStorage.getItem(key)) return; } catch { /* The in-memory guard still works. */ }
  let remaining = 20_000;
  let started: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let shown = false;
  const stop = () => {
    if (started !== undefined) remaining = Math.max(0, remaining - (performance.now() - started));
    clearTimeout(timer); started = undefined;
  };
  const dismiss = () => { card.hidden = true; };
  const schedule = () => {
    stop();
    if (shown || signal.aborted || document.hidden || document.documentElement.dataset.welcomeComplete !== 'true' || document.querySelector('dialog[open]') || document.querySelector<HTMLInputElement>('#nav-toggle')?.checked) return;
    started = performance.now();
    timer = setTimeout(() => {
      shown = true;
      seenInMemory = true;
      try { sessionStorage.setItem(key, 'yes'); } catch { /* Session-only memory fallback. */ }
      card.hidden = false;
      // Showing a greeting never moves the visitor's keyboard focus.
    }, remaining);
  };
  card.querySelector('[data-invitation-close]')?.addEventListener('click', dismiss, { signal });
  card.querySelector('[data-invitation-book]')?.addEventListener('click', dismiss, { signal });
  document.addEventListener('visibilitychange', schedule, { signal });
  document.addEventListener('luma:welcome-complete', () => queueMicrotask(schedule), { signal });
  document.querySelector('#nav-toggle')?.addEventListener('change', schedule, { signal });
  const modalChanges = new MutationObserver(schedule);
  document.querySelectorAll('dialog').forEach((dialog) => modalChanges.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  signal.addEventListener('abort', () => { stop(); modalChanges.disconnect(); }, { once: true });
  schedule();
}
