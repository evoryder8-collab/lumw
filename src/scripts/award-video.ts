/** Open the photograph's own film without leaving its story. */
export function mountAwardVideo(signal: AbortSignal) {
  const trigger = document.querySelector<HTMLAnchorElement>('[data-award-video-open]');
  const dialog = document.querySelector<HTMLDialogElement>('[data-award-video-dialog]');
  const film = dialog?.querySelector<HTMLVideoElement>('[data-award-video]');
  if (!trigger || !dialog || !film) return () => {};
  let active = false;
  let overflow = '';
  dialog.id = 'photography-award-film';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', dialog.id);
  const release = () => {
    if (!active) return;
    active = false; film.pause();
    document.body.style.overflow = overflow;
    trigger.focus({ preventScroll: true });
  };
  const close = () => { dialog.close(); release(); };
  trigger.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (active) return;
    overflow = document.body.style.overflow;
    active = true; document.body.style.overflow = 'hidden';
    film.src ||= trigger.href;
    film.poster ||= film.dataset.awardPoster!;
    dialog.showModal();
    // Preserve the sound preference set by welcome. Native controls remain
    // available if a browser declines playback or the visitor wants audio.
    void film.play().catch(() => {});
  }, { signal });
  dialog.querySelector('[data-award-video-close]')?.addEventListener('click', close, { signal });
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); }, { signal });
  dialog.addEventListener('close', () => { if (!dialog.open) release(); }, { signal });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
  }, { signal });
  return () => {
    if (active) { active = false; document.body.style.overflow = overflow; }
    film.pause(); dialog.close();
  };
}
