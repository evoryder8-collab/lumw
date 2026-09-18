import type { TransitionBeforePreparationEvent, TransitionBeforeSwapEvent } from 'astro:transitions/client';
import { routeKeyForPath } from '../i18n/locales';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let active: { curtain: HTMLElement; signal: AbortSignal } | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let frame = 0;
const finish = () => {
  clearTimeout(timer); cancelAnimationFrame(frame);
  if (active) { active.curtain.hidden = true; active.curtain.classList.remove('is-closing', 'is-opening'); }
  active = undefined;
};
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

document.addEventListener('astro:before-preparation', (raw) => {
  finish();
  const event = raw as TransitionBeforePreparationEvent;
  const link = event.sourceElement?.closest('a');
  const path = decodeURI(event.to.pathname).slice(base.length) || '/';
  if (reduced.matches || event.navigationType === 'traverse' || !link || link.hasAttribute('data-language-pick') || event.from.pathname === event.to.pathname || !routeKeyForPath(path.replace(/\/$/, '') || '/')) return;
  const curtain = document.querySelector<HTMLElement>('[data-page-curtain]');
  if (!curtain || document.querySelector('dialog[open]')) return;
  active = { curtain, signal: event.signal };
  curtain.hidden = false;
  curtain.classList.add('is-closing');
  // Fetch the destination while the fabric closes. Only the short visual cover
  // delays the swap; no extra network round trip is introduced.
  const loader = event.loader;
  const covered = new Promise<void>((resolve) => setTimeout(resolve, 410));
  event.loader = async () => {
    try { await Promise.all([loader(), covered]); }
    catch (error) { if (active?.signal === event.signal) finish(); throw error; }
  };
  event.signal.addEventListener('abort', () => { if (active?.signal === event.signal) finish(); }, { once: true });
  timer = setTimeout(finish, 6000);
});

document.addEventListener('astro:before-swap', (raw) => {
  if (!active) return;
  // The persistent fabric covers the DOM swap, so a second native crossfade
  // would capture a duplicate curtain and obscure its opening.
  (raw as TransitionBeforeSwapEvent).viewTransition?.skipTransition();
});

document.addEventListener('astro:after-swap', () => {
  if (!active || active.signal.aborted) return;
  const current = active;
  current.curtain.classList.remove('is-closing');
  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      if (active !== current) return;
      current.curtain.classList.add('is-opening');
      clearTimeout(timer); timer = setTimeout(finish, 1330);
    });
  });
});
reduced.addEventListener('change', () => { if (reduced.matches) finish(); });
window.addEventListener('pagehide', finish);
