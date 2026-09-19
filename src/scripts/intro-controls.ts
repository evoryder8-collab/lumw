type InlineVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/** Keep inline playback clear of the browser's startup scrim. */
export function mountIntroControls(video: InlineVideo, signal: AbortSignal, play: () => void, pause: () => void) {
  const frame = video.closest<HTMLElement>('[data-intro-frame]')!;
  const rail = frame.querySelector<HTMLElement>('[data-intro-transport]')!;
  const toggle = rail.querySelector<HTMLButtonElement>('[data-intro-toggle]')!;
  const seek = rail.querySelector<HTMLInputElement>('[data-intro-seek]')!;
  const fullscreen = rail.querySelector<HTMLButtonElement>('[data-intro-fullscreen]')!;
  let scrubbing = false;
  const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const sync = () => {
    const playing = !video.paused && !video.ended;
    toggle.dataset.playing = String(playing);
    toggle.setAttribute('aria-label', video.ended ? toggle.dataset.labelReplay! : playing ? toggle.dataset.labelPause! : toggle.dataset.labelPlay!);
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    seek.disabled = duration <= 0;
    // Round up so the slider's End key can reach the end of a fractional second.
    seek.max = String(Math.ceil(duration) || 1);
    if (!scrubbing) seek.value = String(video.currentTime);
    seek.setAttribute('aria-valuetext', `${time(video.currentTime)} / ${time(duration)}`);
    seek.style.setProperty('--played', `${duration ? Math.min(100, video.currentTime / duration * 100) : 0}%`);
    fullscreen.hidden = !(document.fullscreenEnabled && frame.requestFullscreen) && !video.webkitEnterFullscreen;
    fullscreen.disabled = video.readyState === 0;
    fullscreen.setAttribute('aria-label', document.fullscreenElement === frame ? fullscreen.dataset.labelExit! : fullscreen.dataset.labelEnter!);
  };
  toggle.addEventListener('click', () => { if (video.paused || video.ended) play(); else pause(); }, { signal });
  seek.addEventListener('pointerdown', () => { scrubbing = true; }, { signal });
  const finishSeek = () => { scrubbing = false; sync(); };
  window.addEventListener('pointerup', finishSeek, { signal });
  window.addEventListener('pointercancel', finishSeek, { signal });
  seek.addEventListener('blur', finishSeek, { signal });
  seek.addEventListener('input', () => {
    if (seek.disabled) return;
    const position = Math.min(Number(seek.value), video.duration);
    // Finishing via the slider must cancel pending playback before seeking.
    // Otherwise WebKit can resume an earlier play request at the beginning.
    if (position === video.duration) pause();
    video.currentTime = position;
    sync();
  }, { signal });
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement === frame) await document.exitFullscreen();
      else if (document.fullscreenEnabled && frame.requestFullscreen) await frame.requestFullscreen();
      else video.webkitEnterFullscreen?.();
    } catch { /* A browser may decline fullscreen. Inline playback stays usable. */ }
  }, { signal });
  ['loadedmetadata', 'durationchange', 'timeupdate', 'play', 'pause', 'ended', 'emptied'].forEach(event => video.addEventListener(event, sync, { signal }));
  document.addEventListener('fullscreenchange', sync, { signal });
  video.controls = false;
  rail.hidden = false;
  sync();
}
