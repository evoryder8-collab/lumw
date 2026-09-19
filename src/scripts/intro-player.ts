/** Start media in the consent gesture, and never mistake a pending play for
 * actual playback. A failed or suspended first load gets one fresh attempt. */
export function mountIntroPlayer(video: HTMLVideoElement, signal: AbortSignal, changed: () => void) {
  const screen = video.closest<HTMLElement>('.intro-film__screen')!;
  const poster = screen.querySelector<HTMLImageElement>('[data-intro-poster]')!;
  const loading = screen.querySelector<HTMLElement>('[data-intro-loading]')!;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = false;
  let retry = false;
  let recovered = false;
  let disposed = false;
  let wantsPlayback = false;
  let hasFrame = false;

  const render = () => {
    screen.dataset.playback = retry ? 'retry' : pending ? 'loading' : hasFrame ? 'ready' : 'idle';
    poster.hidden = hasFrame || (!pending && !retry);
    loading.hidden = !pending;
    changed();
  };
  const stopWaiting = () => { clearTimeout(timer); timer = undefined; };
  const showRetry = () => {
    stopWaiting(); pending = false; retry = true; wantsPlayback = false;
    video.pause(); render();
  };
  const recover = () => {
    if (disposed || !wantsPlayback || hasFrame) return;
    if (recovered) { showRetry(); return; }
    recovered = true;
    start(true);
  };
  const watchStart = () => {
    stopWaiting();
    timer = setTimeout(() => {
      if (document.hidden) return;
      if (video.currentTime > .03 && video.readyState >= 2) { showFrame(); return; }
      recover();
    }, 8000);
  };
  const showFrame = () => {
    if (video.currentTime <= .03 || video.readyState < 2) return;
    hasFrame = true; pending = false; retry = false;
    stopWaiting(); render();
  };
  const start = (reload: boolean, allowMutedFallback = false) => {
    if (disposed) return;
    const current = ++attempt;
    stopWaiting(); pending = true; retry = false; wantsPlayback = true;
    // Direct src avoids a failed <source> selection leaving Safari's play()
    // promise pending. Source selection and load stay in the original tap.
    const source = (matchMedia('(max-width: 760px)').matches ? video.dataset.mobileSrc : undefined) ?? video.dataset.introSrc;
    if (source && video.getAttribute('src') !== source) { video.src = source; reload = true; }
    video.preload = 'auto';
    if (reload || video.error || video.readyState === 0) video.load();
    render(); watchStart();
    void video.play().then(() => {
      if (!disposed && current === attempt) showFrame();
    }).catch((error) => {
      if (disposed || current !== attempt || !wantsPlayback) return;
      if (error.name === 'NotAllowedError') {
        if (allowMutedFallback && !video.muted) { video.muted = true; start(false); }
        else showRetry();
      } else recover();
    });
  };

  video.addEventListener('timeupdate', showFrame, { signal });
  video.addEventListener('playing', showFrame, { signal });
  video.addEventListener('error', () => { if (wantsPlayback && !hasFrame) recover(); }, { signal });
  video.addEventListener('pause', () => {
    // load() can queue a pause from the previous attempt. Only a current pause
    // cancels the visitor's playback intent.
    if (!video.paused || video.readyState === 0) return;
    wantsPlayback = false; pending = false; stopWaiting(); render();
  }, { signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopWaiting();
    else if (pending && wantsPlayback) watchStart();
  }, { signal });
  return {
    get needsRetry() { return retry; },
    play(allowMutedFallback = false) {
      recovered = false;
      hasFrame = video.currentTime > .03 && video.readyState >= 2;
      start(retry, allowMutedFallback);
    },
    dispose() { disposed = true; ++attempt; wantsPlayback = false; stopWaiting(); },
  };
}
