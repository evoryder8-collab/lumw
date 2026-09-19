import { mountLanguageCountdown } from './language-countdown';
import { animateCurtain, cancelCurtain } from './curtain-cloth';
/** Welcome choices are session-only. No media plays before an explicit sound choice. */
const memory = new Map<string, string>();
const read = (key: string) => { try { return sessionStorage.getItem(key) ?? memory.get(key); } catch { return memory.get(key); } };
const write = (key: string, value: string) => { memory.set(key, value); try { sessionStorage.setItem(key, value); } catch { /* Private storage can be unavailable. */ } };

export function mountWelcome(signal: AbortSignal) {
  const language = document.querySelector<HTMLDialogElement>('[data-language-dialog]');
  const sound = document.querySelector<HTMLDialogElement>('[data-sound-dialog]');
  const curtain = document.querySelector<HTMLDialogElement>('[data-welcome-curtain]');
  const intro = document.querySelector<HTMLVideoElement>('[data-intro-film]');
  const play = document.querySelector<HTMLButtonElement>('[data-intro-play]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-intro-sound]');
  const films = [...document.querySelectorAll<HTMLVideoElement>('[data-film]')];
  const countdown = language ? mountLanguageCountdown(language, signal) : undefined;
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
  let locked = false;
  let disposed = false;
  let curtainTimer: ReturnType<typeof setTimeout> | undefined;
  let curtainFrame = 0;

  const lock = () => {
    if (locked) return;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; locked = true;
  };
  const unlock = () => {
    if (!locked) return;
    document.body.style.overflow = previousOverflow; locked = false;
  };
  const setSound = (enabled: boolean) => {
    write('luma-sound', enabled ? 'yes' : 'no');
    films.forEach((film) => { film.muted = !enabled; if (enabled && film.volume === 0) film.volume = 1; });
  };
  films.forEach((film) => { film.muted = read('luma-sound') !== 'yes'; });

  const syncPlayer = () => {
    if (!intro) return;
    if (play) {
      play.hidden = !intro.paused;
      const label = read('luma-sound') === 'no' ? play.dataset.labelPlay! : play.dataset.labelSound!;
      play.querySelector('[data-intro-play-label]')!.textContent = label;
    }
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
  const finishCurtain = () => {
    clearTimeout(curtainTimer); cancelAnimationFrame(curtainFrame);
    if (curtain) cancelCurtain(curtain);
    curtain?.close(); curtain?.classList.remove('is-opening');
    if (disposed) return;
    document.documentElement.dataset.welcomeComplete = 'true';
    document.dispatchEvent(new Event('luma:welcome-complete'));
    unlock();
    document.querySelector<HTMLElement>('[data-intro-frame]')?.focus({ preventScroll: true });
    syncPlayer();
  };
  const openCurtain = () => {
    if (!curtain || matchMedia('(prefers-reduced-motion: reduce)').matches) { finishCurtain(); return; }
    curtain.showModal();
    // Paint the closed fabric before opening its separate folds onto the film.
    curtainFrame = requestAnimationFrame(() => {
      curtainFrame = requestAnimationFrame(() => {
        curtain.classList.add('is-opening');
        void animateCurtain(curtain, true, 1850).then(() => { if (!disposed && curtain.open) finishCurtain(); });
      });
    });
    // A cancelled animation must never leave the entrance blocking the page.
    curtainTimer = setTimeout(finishCurtain, 2150);
  };
  const finish = (enabled: boolean) => {
    write('luma-welcome-done', 'yes');
    welcoming = false;
    setSound(enabled);
    // Playback must happen in this tap, before any animation or awaited work.
    if (enabled || !matchMedia('(prefers-reduced-motion: reduce)').matches) playIntro();
    sound?.close(); language?.close();
    window.scrollTo({ top: 0, behavior: 'instant' });
    openCurtain();
  };
  const askSound = () => {
    countdown?.stop();
    if (!sound || sound.open || disposed) return;
    lock();
    sound.showModal();
  };
  curtain?.addEventListener('cancel', (event) => { event.preventDefault(); finishCurtain(); }, { signal });
  const showLanguage = (firstVisit = false) => {
    if (!language || language.open) return;
    welcoming = firstVisit;
    language.classList.toggle('is-welcome', firstVisit);
    lock(); language.showModal();
    if (firstVisit && !read('luma-welcome-language')) countdown?.start();
  };

  document.querySelectorAll<HTMLButtonElement>('[data-portal-open]').forEach((button) => {
    button.hidden = false;
    button.addEventListener('click', () => showLanguage(), { signal });
  });
  const confirmCurrentLanguage = () => {
    write('luma-welcome-language', 'yes'); askSound();
  };
  language?.querySelector('[data-language-close]')?.addEventListener('click', () => {
    if (welcoming) confirmCurrentLanguage(); else language.close();
  }, { signal });
  language?.addEventListener('cancel', (event) => {
    if (welcoming) { event.preventDefault(); confirmCurrentLanguage(); }
  }, { signal });
  language?.addEventListener('close', () => {
    if (!sound?.open && !curtain?.open) unlock();
  }, { signal });
  language?.addEventListener('click', (event) => {
    if (event.target === language && !welcoming) {
      const r = language.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) language.close();
    }
  }, { signal });
  language?.querySelectorAll<HTMLAnchorElement>('[data-language-pick]').forEach((link) => {
    link.addEventListener('click', (event) => {
      countdown?.stop();
      const samePage = new URL(link.href).pathname === location.pathname;
      if (samePage) event.preventDefault();
      if (welcoming) {
        write('luma-welcome-language', 'yes');
        // Keep the selected-language portal behind the sound question. Across
        // locales the new page reopens that same stack after Astro swaps it in.
        if (samePage) askSound();
      } else language.close();
    }, { signal });
  });
  sound?.querySelector('[data-sound-yes]')?.addEventListener('click', () => finish(true), { signal });
  sound?.querySelector('[data-sound-no]')?.addEventListener('click', () => finish(false), { signal });
  sound?.addEventListener('cancel', (event) => { event.preventDefault(); finish(false); }, { signal });
  play?.addEventListener('click', () => {
    if (read('luma-sound') !== 'no') setSound(true);
    playIntro();
  }, { signal });
  toggle?.addEventListener('click', () => {
    if (!intro) return;
    const enable = intro.muted || intro.volume === 0;
    setSound(enable);
    // A sound tap is also a playback gesture when autoplay was blocked or paused.
    if (enable) playIntro();
    syncPlayer();
  }, { signal });
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
    showLanguage(true);
    if (read('luma-welcome-language')) askSound();
  }

  return () => {
    disposed = true;
    countdown?.stop();
    clearTimeout(curtainTimer); cancelAnimationFrame(curtainFrame); if (curtain) cancelCurtain(curtain); curtain?.close();
    posters.disconnect();
    films.forEach((film) => film.pause());
    language?.close(); sound?.close(); unlock();
  };
}
