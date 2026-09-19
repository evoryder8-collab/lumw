/** One recommendation, based on the browser's primary language, not location. */
export function mountLanguageCountdown(dialog: HTMLDialogElement, signal: AbortSignal) {
  const links = [...dialog.querySelectorAll<HTMLAnchorElement>('[data-language-pick]')];
  const primary = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase().split(/[-_]/)[0];
  const suggested = links.find((link) => link.lang === primary) || links.find((link) => link.lang === 'en')!;
  const bar = dialog.querySelector<HTMLElement>('[data-language-countdown]')!;
  const label = bar.querySelector<HTMLElement>('[data-countdown-label]')!;
  const seconds = bar.querySelector<HTMLElement>('[data-countdown-seconds]')!;
  const arc = bar.querySelector<SVGCircleElement>('circle + circle')!;
  const toggle = bar.querySelector<HTMLButtonElement>('[data-countdown-toggle]')!;
  const title = dialog.querySelector<HTMLElement>('#language-title')!;
  const originalTitle = title.textContent;
  let active = false;
  let paused = false;
  let remaining = 5000;
  let previous = 0;
  let frame = 0;
  let paintedAt = 0;
  let paintedRemaining = -1;

  const renderClock = () => {
    if (paintedRemaining === remaining) return;
    paintedRemaining = remaining;
    const digit = String(Math.ceil(remaining / 1000));
    if (seconds.textContent !== digit) seconds.textContent = digit;
    arc.style.strokeDashoffset = String(1 - remaining / 5000);
  };
  const render = () => {
    renderClock();
    const status = paused ? suggested.dataset.paused! : suggested.dataset.countdown!;
    const action = paused ? suggested.dataset.resume! : suggested.dataset.pause!;
    if (label.textContent !== status) label.textContent = status;
    if (toggle.textContent !== action) toggle.textContent = action;
    toggle.setAttribute('aria-pressed', String(paused));
    dialog.classList.toggle('countdown-paused', paused);
  };
  const stop = () => {
    active = false;
    cancelAnimationFrame(frame);
    bar.hidden = true;
    dialog.classList.remove('has-language-suggestion', 'countdown-paused');
    suggested.classList.remove('is-suggested');
    title.textContent = originalTitle;
    title.removeAttribute('lang');
  };
  const tick = (now: number) => {
    if (!active) return;
    if (!paused && !document.hidden && dialog.open && previous) remaining = Math.max(0, remaining - (now - previous));
    previous = now;
    // Redraw only the small arc at 10 Hz. Labels and dialog classes change
    // only on an interaction, avoiding a full frosted-panel repaint per frame.
    if (now - paintedAt >= 100 || remaining === 0) { renderClock(); paintedAt = now; }
    if (remaining === 0) {
      stop();
      // Use the same navigation and sound-consent path as a real language tap.
      suggested.click();
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  const start = () => {
    stop(); active = true; paused = false; remaining = 5000; previous = 0; paintedAt = 0;
    bar.hidden = false; bar.lang = suggested.lang;
    dialog.classList.add('has-language-suggestion');
    suggested.classList.add('is-suggested');
    title.textContent = suggested.dataset.languageTitle!;
    title.lang = suggested.lang;
    suggested.focus({ preventScroll: true });
    render();
    frame = requestAnimationFrame(tick);
  };
  toggle.addEventListener('click', () => { paused = !paused; previous = 0; render(); }, { signal });
  // Honour a touch that begins just before expiry, even if release is later.
  links.forEach((link) => link.addEventListener('pointerdown', () => {
    if (active) { paused = true; render(); }
  }, { signal }));
  // A keyboard user must be able to explore the choices without a time limit.
  dialog.addEventListener('keydown', (event) => {
    if (active && (event.key === 'Tab' || event.key.startsWith('Arrow'))) { paused = true; render(); }
  }, { signal });
  document.addEventListener('visibilitychange', () => { previous = 0; }, { signal });
  dialog.addEventListener('close', stop, { signal });
  signal.addEventListener('abort', stop, { once: true });
  return { start, stop };
}
