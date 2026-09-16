/** Welcome choices are session-only. No media plays before an explicit choice. */
const memory = new Map<string, string>();
const read = (key: string) => { try { return sessionStorage.getItem(key) ?? memory.get(key); } catch { return memory.get(key); } };
const write = (key: string, value: string) => { memory.set(key, value); try { sessionStorage.setItem(key, value); } catch { /* Private storage can be unavailable. */ } };

export function mountWelcome(signal: AbortSignal) {
  const language = document.querySelector<HTMLDialogElement>('[data-language-dialog]');
  const sound = document.querySelector<HTMLDialogElement>('[data-sound-dialog]');
  const intro = document.querySelector<HTMLVideoElement>('[data-intro-film]');
  const play = document.querySelector<HTMLButtonElement>('[data-intro-play]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-intro-sound]');
  const films = [...document.querySelectorAll<HTMLVideoElement>('[data-film]')];
  // Browsers eagerly fetch video posters even with preload="none". Keep the
  // lower films from competing with the introduction and portrait on mobile.
  const posters = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      const film = target as HTMLVideoElement;
      film.poster = film.dataset.lazyPoster!;
      posters.unobserve(film);
    });
  }, { rootMargin: '600px' });
  films.filter((film) => film.dataset.lazyPoster).forEach((film) => posters.observe(film));
  let welcoming = false;
  let previousOverflow = '';
  let disposed = false;

  const lock = () => { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; };
  const unlock = () => { document.body.style.overflow = previousOverflow; };
  const setSound = (enabled: boolean) => {
    write('luma-sound', enabled ? 'yes' : 'no');
    films.forEach((film) => { film.muted = !enabled; });
  };
  films.forEach((film) => { film.muted = read('luma-sound') !== 'yes'; });

  const syncPlayer = () => {
    if (!intro) return;
    if (play) play.hidden = !intro.paused;
    if (toggle) {
      toggle.hidden = false;
      const audible = !intro.muted && intro.volume > 0;
      const label = audible ? toggle.dataset.labelOff! : toggle.dataset.labelOn!;
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('aria-pressed', String(audible));
      toggle.querySelector('[data-intro-sound-label]')!.textContent = label;
    }
  };
  const playIntro = () => {
    if (!intro) return;
    // Keep play() directly inside the consent tap for Safari and mobile Chrome.
    const started = intro.play();
    started?.catch(() => { if (!disposed) syncPlayer(); });
  };
  const finish = (enabled: boolean) => {
    write('luma-welcome-done', 'yes');
    document.documentElement.dataset.welcomeComplete = 'true';
    document.dispatchEvent(new Event('luma:welcome-complete'));
    welcoming = false;
    setSound(enabled);
    if (enabled || !matchMedia('(prefers-reduced-motion: reduce)').matches) playIntro();
    sound?.close();
    unlock();
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector<HTMLElement>('[data-intro-frame]')?.focus({ preventScroll: true });
    syncPlayer();
  };
  const askSound = () => {
    if (!sound || sound.open || disposed) return;
    lock();
    sound.showModal();
  };
  const showLanguage = (firstVisit = false) => {
    if (!language || language.open) return;
    welcoming = firstVisit;
    language.classList.toggle('is-welcome', firstVisit);
    lock(); language.showModal();
  };

  document.querySelectorAll<HTMLButtonElement>('[data-portal-open]').forEach((button) => {
    button.hidden = false;
    button.addEventListener('click', () => showLanguage(), { signal });
  });
  language?.querySelector('[data-language-close]')?.addEventListener('click', () => language.close(), { signal });
  language?.addEventListener('close', () => {
    unlock();
    if (welcoming && !disposed) { welcoming = false; write('luma-welcome-language', 'yes'); askSound(); }
  }, { signal });
  language?.addEventListener('click', (event) => {
    if (event.target === language && !welcoming) {
      const r = language.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) language.close();
    }
  }, { signal });
  language?.querySelectorAll<HTMLAnchorElement>('[data-language-pick]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const samePage = new URL(link.href).pathname === location.pathname;
      if (samePage) event.preventDefault();
      if (welcoming) write('luma-welcome-language', 'yes');
      if (!samePage) welcoming = false;
      language.close();
    }, { signal });
  });
  sound?.querySelector('[data-sound-yes]')?.addEventListener('click', () => finish(true), { signal });
  sound?.querySelector('[data-sound-no]')?.addEventListener('click', () => finish(false), { signal });
  sound?.addEventListener('cancel', (event) => { event.preventDefault(); finish(false); }, { signal });
  play?.addEventListener('click', playIntro, { signal });
  toggle?.addEventListener('click', () => { if (intro) setSound(intro.muted || intro.volume === 0); if (intro && intro.volume === 0) intro.volume = 1; syncPlayer(); }, { signal });
  ['play', 'pause', 'ended', 'volumechange'].forEach((event) => intro?.addEventListener(event, syncPlayer, { signal }));
  films.forEach((film) => film.addEventListener('play', () => films.forEach((other) => { if (other !== film) other.pause(); }), { signal }));
  syncPlayer();
  if (matchMedia('(pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const panel = language?.querySelector<HTMLElement>('.language-dialog__inner');
    panel?.addEventListener('pointermove', (event) => {
      const bounds = panel.getBoundingClientRect();
      panel.style.setProperty('--portal-x', `${(event.clientX - bounds.left) / bounds.width * 100}%`);
      panel.style.setProperty('--portal-y', `${(event.clientY - bounds.top) / bounds.height * 100}%`);
    }, { signal, passive: true });
  }

  if (read('luma-welcome-done')) document.documentElement.dataset.welcomeComplete = 'true';
  if (intro?.hasAttribute('data-bio-film')) {
    // Some in-app browsers permit audible autoplay. Let the actual play()
    // result decide; preserve an existing No and fall back when audio is blocked.
    intro.muted = read('luma-sound') === 'no';
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      intro.play().catch(() => {
        if (disposed) return;
        intro.muted = true;
        intro.play().catch(() => { if (!disposed) syncPlayer(); });
        syncPlayer();
      });
    }
    syncPlayer();
  } else if (intro && !read('luma-welcome-done')) {
    if (read('luma-welcome-language')) askSound();
    else showLanguage(true);
  }

  return () => {
    disposed = true;
    posters.disconnect();
    films.forEach((film) => film.pause());
    if (language?.open || sound?.open) { language?.close(); sound?.close(); unlock(); }
  };
}
