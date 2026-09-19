/** Silent product demonstrations never participate in the site's sound choice. */
export function mountDeviceLoops(signal: AbortSignal) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const states = [...document.querySelectorAll<HTMLElement>('[data-device-loop]')].map((frame) => ({
    frame,
    video: frame.querySelector<HTMLVideoElement>('video')!,
    toggle: frame.querySelector<HTMLButtonElement>('[data-device-toggle]')!,
    visible: false, paused: false, manual: false, pending: false, failed: false,
  }));
  const allowed = (state: typeof states[number]) => {
    const modal = document.querySelector<HTMLDialogElement>('dialog[open]');
    const owner = state.frame.closest<HTMLDialogElement>('dialog');
    if (owner && !owner.open) return false;
    return state.visible && !document.hidden && !signal.aborted && !state.paused && !state.failed && (!reduced.matches || state.manual) && (!modal || modal.contains(state.frame));
  };
  const label = (state: typeof states[number]) => {
    const playing = !state.video.paused;
    const text = playing ? state.toggle.dataset.pause! : state.toggle.dataset.play!;
    state.toggle.setAttribute('aria-label', text);
    state.toggle.querySelector('[data-device-toggle-label]')!.textContent = text;
    state.toggle.querySelector('[data-device-toggle-symbol]')!.textContent = playing ? 'Ⅱ' : '↻';
    state.frame.classList.toggle('device-loop--still', !playing && (reduced.matches || state.failed || state.paused));
  };
  const sync = (state: typeof states[number]) => {
    if (state.visible && !state.video.poster) state.video.poster = state.video.dataset.devicePoster!;
    if (!allowed(state)) { state.video.pause(); return; }
    if (state.pending || !state.video.paused) return;
    state.pending = true;
    state.video.muted = true;
    void state.video.play().then(() => {
      if (!allowed(state)) state.video.pause();
    }).catch((error) => {
      // Leaving the viewport or backgrounding the tab can cancel an in-flight
      // play(). That is normal lifecycle work, not a permanent playback failure.
      if (!(error instanceof DOMException && error.name === 'AbortError')) state.failed = true;
      label(state);
    }).finally(() => {
      state.pending = false;
      if (allowed(state) && state.video.paused) sync(state);
    });
  };
  const syncAll = () => states.forEach(sync);
  const dialogs = new MutationObserver(syncAll);
  document.querySelectorAll('dialog').forEach((dialog) => dialogs.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const state = states.find((s) => s.frame === entry.target)!;
      state.visible = entry.isIntersecting && entry.intersectionRatio >= .2;
      sync(state);
    }
  }, { threshold: [0, .2] });
  states.forEach((state) => {
    state.video.controls = false;
    state.video.muted = true;
    state.toggle.hidden = false;
    state.toggle.addEventListener('click', () => {
      state.paused = !state.video.paused;
      state.manual = true;
      state.failed = false;
      sync(state);
    }, { signal });
    ['play', 'pause', 'ended'].forEach((event) => state.video.addEventListener(event, () => label(state), { signal }));
    state.video.addEventListener('error', () => { state.failed = true; state.video.controls = true; }, { signal });
    label(state);
    observer.observe(state.frame);
  });
  document.addEventListener('visibilitychange', syncAll, { signal });
  document.addEventListener('luma:dialog-change', syncAll, { signal });
  reduced.addEventListener('change', syncAll, { signal });
  return () => { observer.disconnect(); dialogs.disconnect(); states.forEach((state) => state.video.pause()); };
}
