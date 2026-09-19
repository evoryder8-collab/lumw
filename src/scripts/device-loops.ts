/** Silent product demonstrations play independently of sound and decorative motion. */
export function mountDeviceLoops(signal: AbortSignal) {
  const states = [...document.querySelectorAll<HTMLElement>('[data-device-loop]')].map((frame) => ({
    frame,
    video: frame.querySelector<HTMLVideoElement>('[data-device-video]')!,
    toggle: frame.querySelector<HTMLButtonElement>('[data-device-toggle]')!,
    visible: false, paused: false, pending: false, failed: false, reload: false,
    attempt: 0, retries: 0, progress: 0, timer: undefined as ReturnType<typeof setTimeout> | undefined,
  }));
  type State = typeof states[number];
  const allowed = (state: State) => {
    const modal = document.querySelector<HTMLDialogElement>('dialog[open]');
    const owner = state.frame.closest<HTMLDialogElement>('dialog');
    return (!owner || owner.open) && state.visible && !document.hidden && !signal.aborted
      && !state.paused && (!modal || modal.contains(state.frame));
  };
  const clearTimer = (state: State) => { clearTimeout(state.timer); state.timer = undefined; };
  const label = (state: State) => {
    const playing = !state.video.paused;
    const text = playing ? state.toggle.dataset.pause! : state.toggle.dataset.play!;
    state.toggle.setAttribute('aria-label', text);
    state.toggle.querySelector('[data-device-toggle-label]')!.textContent = text;
    state.toggle.querySelector('[data-device-toggle-symbol]')!.textContent = playing ? 'Ⅱ' : '▶';
  };
  const retry = (state: State, reload: boolean) => {
    ++state.attempt; state.pending = false; clearTimer(state);
    state.reload ||= reload;
    if (!allowed(state)) return;
    // Bound recovery on a broken connection. A later touch, viewport return or
    // restored connection may try again, without leaving a play-button overlay.
    if (state.retries >= 2) { state.failed = true; state.video.autoplay = false; return; }
    state.timer = setTimeout(() => { state.timer = undefined; sync(state); }, 250 * ++state.retries);
  };
  const watch = (state: State) => {
    clearTimer(state);
    const previous = state.video.currentTime;
    state.timer = setTimeout(() => {
      state.timer = undefined;
      if (!allowed(state)) return;
      if (!state.video.paused && state.video.readyState >= 2 && state.video.currentTime !== previous) return;
      retry(state, true);
    }, 6000);
  };
  const sync = (state: State) => {
    const video = state.video;
    if (state.visible && !video.poster) video.poster = video.dataset.devicePoster!;
    if (!allowed(state)) {
      ++state.attempt; state.pending = false; clearTimer(state);
      video.autoplay = false; video.pause(); return;
    }
    if (state.failed || state.pending || state.timer || (!video.paused && !state.reload)) return;
    const current = ++state.attempt;
    state.pending = true;
    video.defaultMuted = true; video.muted = true; video.playsInline = true;
    video.autoplay = true; video.preload = 'auto';
    // Direct src lets a failed mobile source selection be restarted reliably.
    if (!video.getAttribute('src')) { video.src = video.dataset.deviceSrc!; state.reload = true; }
    if (state.reload || video.error) { state.reload = false; state.progress = 0; video.load(); }
    watch(state);
    void video.play().then(() => {
      if (signal.aborted || state.attempt !== current) return;
      state.pending = false;
      if (!allowed(state)) video.pause();
    }).catch((error) => {
      if (signal.aborted || state.attempt !== current) return;
      retry(state, error.name !== 'NotAllowedError' && error.name !== 'AbortError');
    });
  };
  const syncAll = () => states.forEach(sync);
  const resume = () => states.forEach((state) => {
    if (state.failed) { state.failed = false; state.retries = 0; }
    if (allowed(state) && state.video.paused && !state.pending) clearTimer(state);
    sync(state);
  });
  const dialogs = new MutationObserver(resume);
  document.querySelectorAll('dialog').forEach(dialog => dialogs.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const state = states.find(s => s.frame === entry.target)!;
      const visible = entry.isIntersecting && entry.intersectionRatio >= .2;
      if (visible && !state.visible) { state.failed = false; state.retries = 0; }
      state.visible = visible;
      sync(state);
    }
  }, { threshold: [0, .2] });
  states.forEach((state) => {
    const video = state.video;
    video.controls = false; video.defaultMuted = true; video.muted = true;
    state.toggle.hidden = false;
    state.toggle.addEventListener('click', () => {
      state.paused = !video.paused;
      state.failed = false; state.retries = 0; clearTimer(state);
      sync(state);
    }, { signal });
    video.addEventListener('playing', () => {
      state.pending = false;
      if (!allowed(state)) video.pause();
      else if (!state.timer && !state.failed) watch(state);
      label(state);
    }, { signal });
    // WebKit can emit playing/waiting repeatedly with time frozen at zero.
    // Only actual progress proves recovery and clears the stall watchdog.
    video.addEventListener('timeupdate', () => {
      if (video.paused || video.currentTime <= 0 || video.currentTime === state.progress) return;
      state.progress = video.currentTime;
      clearTimer(state); state.pending = false; state.failed = false; state.retries = 0;
    }, { signal });
    ['pause', 'ended'].forEach(event => video.addEventListener(event, () => { label(state); sync(state); }, { signal }));
    ['waiting', 'stalled'].forEach(event => video.addEventListener(event, () => {
      if (allowed(state) && !state.timer && !state.failed) watch(state);
    }, { signal }));
    video.addEventListener('error', () => { if (!state.failed) retry(state, true); }, { signal });
    label(state); observer.observe(state.frame);
  });
  document.addEventListener('visibilitychange', () => document.hidden ? syncAll() : resume(), { signal });
  document.addEventListener('luma:dialog-change', resume, { signal });
  // These retries run inside a real interaction when a mobile browser requires
  // one. Neither the sound prompt nor a separate video button is needed.
  document.addEventListener('pointerup', resume, { signal, passive: true });
  document.addEventListener('touchend', resume, { signal, passive: true });
  document.addEventListener('keydown', resume, { signal });
  window.addEventListener('pageshow', resume, { signal });
  window.addEventListener('online', resume, { signal });
  return () => {
    observer.disconnect(); dialogs.disconnect();
    states.forEach(state => { ++state.attempt; clearTimer(state); state.video.autoplay = false; state.video.pause(); });
  };
}
