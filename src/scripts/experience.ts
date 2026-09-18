/** Small functional enhancements are independent of the optional motion bundle. */
import { mountWelcome } from './welcome';
import { mountPrices } from './prices';
import { mountReviews } from './reviews';
import { mountScrollHint } from './scroll-hint';
import { mountBio } from './bio';
import { mountLocation } from './location';
import { mountInvitation } from './invitation';
import { mountTreatmentDetails } from './treatment-details';
let activeBody: HTMLElement | undefined;
let cleanup: (() => void) | undefined;

function bootExperience() {
  if (activeBody === document.body) return;
  cleanup?.();
  activeBody = document.body;
  const controller = new AbortController();
  const { signal } = controller;
  const observers: IntersectionObserver[] = [];
  const disposeWelcome = mountWelcome(signal);
  const disposePrices = mountPrices();
  const disposeTreatmentDetails = mountTreatmentDetails(signal);
  mountReviews(signal);
  document.querySelectorAll<HTMLElement>('[data-gallery-track], [data-film-track]').forEach((track) => mountScrollHint(track, signal));
  mountBio(signal);
  mountLocation(signal);
  mountInvitation(signal);

  const gallery = document.querySelector<HTMLDialogElement>('[data-gallery-dialog]');
  const photos = [...document.querySelectorAll<HTMLAnchorElement>('[data-gallery-open]')];
  let photoIndex = 0;
  let galleryOverflow = '';
  const showPhoto = (index: number) => {
    if (!gallery || photos.length === 0) return;
    photoIndex = (index + photos.length) % photos.length;
    const photo = photos[photoIndex];
    const image = gallery.querySelector<HTMLImageElement>('[data-gallery-image]')!;
    image.src = photo.href;
    image.alt = photo.querySelector('img')?.alt ?? 'June Saurin';
    gallery.querySelector<HTMLElement>('[data-gallery-caption]')!.textContent = `${photoIndex + 1} / ${photos.length} · ${photo.dataset.caption}`;
  };
  photos.forEach((photo, index) => photo.addEventListener('click', (event) => {
    if (!gallery) return;
    event.preventDefault(); showPhoto(index);
    galleryOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; gallery.showModal();
  }, { signal }));
  gallery?.querySelector('[data-gallery-close]')?.addEventListener('click', () => gallery.close(), { signal });
  gallery?.querySelector('[data-gallery-prev]')?.addEventListener('click', () => showPhoto(photoIndex - 1), { signal });
  gallery?.querySelector('[data-gallery-next]')?.addEventListener('click', () => showPhoto(photoIndex + 1), { signal });
  gallery?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); showPhoto(photoIndex - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); showPhoto(photoIndex + 1); }
  }, { signal });
  gallery?.addEventListener('close', () => { document.body.style.overflow = galleryOverflow; }, { signal });

  const nav = document.querySelector<HTMLInputElement>('#nav-toggle');
  const menu = document.querySelector<HTMLElement>('.nav');
  const mobile = matchMedia('(max-width: 1180px)');
  const syncMenu = () => {
    if (menu) menu.inert = mobile.matches && !nav?.checked;
    if (nav) nav.setAttribute('aria-expanded', String(!!nav.checked));
  };
  nav?.addEventListener('change', syncMenu, { signal });
  mobile.addEventListener('change', syncMenu, { signal });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav?.checked) { nav.checked = false; syncMenu(); nav.focus(); }
  }, { signal });
  menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { if (nav) nav.checked = false; syncMenu(); }, { signal }));
  syncMenu();

  document.querySelectorAll<HTMLFormElement>('[data-enquiry]').forEach((form) => {
    form.hidden = false;
    const select = form.elements.namedItem('treatment') as HTMLSelectElement;
    const chosen = new URLSearchParams(location.search).get('treatment');
    if (chosen && [...select.options].some((o) => o.value === chosen)) select.value = chosen;
    const result = form.querySelector<HTMLElement>('[data-enquiry-result]')!;
    form.addEventListener('input', () => { result.hidden = true; }, { signal });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const read = (name: string) => String(data.get(name) ?? '').trim();
      const name = [read('firstName'), read('lastName')].filter(Boolean).join(' ');
      const lines = [form.dataset.greeting!, '', name, read('email'), select.selectedOptions[0]?.textContent ?? '', read('preferred'), read('message')].filter(Boolean);
      const message = lines.join('\n');
      form.querySelector<HTMLElement>('[data-enquiry-preview]')!.textContent = message;
      form.querySelector<HTMLAnchorElement>('[data-enquiry-whatsapp]')!.href = `https://wa.me/${form.dataset.phone}?text=${encodeURIComponent(message)}`;
      form.querySelector<HTMLAnchorElement>('[data-enquiry-email]')!.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent('LUMA Wellness · ' + name)}&body=${encodeURIComponent(message)}`;
      result.hidden = false;
      result.focus({ preventScroll: true });
      result.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
    }, { signal });
  });

  const bar = document.querySelector<HTMLElement>('[data-thumb-bar]');
  if (bar) {
    let heroGone = false;
    let closingHere = false;
    const sync = () => {
      const visible = heroGone && !closingHere;
      bar.classList.toggle('is-up', visible);
      bar.inert = !visible;
      bar.setAttribute('aria-hidden', String(!visible));
    };
    const observe = (selector: string, update: (visible: boolean) => void) => {
      const target = document.querySelector(selector);
      if (!target) return;
      const observer = new IntersectionObserver(([entry]) => { update(entry.isIntersecting); sync(); }, { threshold: 0 });
      observer.observe(target); observers.push(observer);
    };
    observe('.hero', (visible) => { heroGone = !visible; });
    observe('.close', (visible) => { closingHere = visible; });
    sync();
  }

  document.querySelectorAll<HTMLButtonElement>('[data-collapse]').forEach((button) => {
    button.addEventListener('click', () => {
      const details = button.closest('details');
      if (details) { details.open = false; details.querySelector('summary')?.focus({ preventScroll: true }); }
    }, { signal });
  });

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll<HTMLElement>('[data-card]').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const bounds = card.getBoundingClientRect();
        card.style.setProperty('--image-x', `${((event.clientX - bounds.left) / bounds.width - 0.5) * -8}px`);
        card.style.setProperty('--image-y', `${((event.clientY - bounds.top) / bounds.height - 0.5) * -6}px`);
      }, { signal, passive: true });
      card.addEventListener('pointerleave', () => { card.style.setProperty('--image-x', '0px'); card.style.setProperty('--image-y', '0px'); }, { signal });
    });
  }
  // Ambient movement pauses on phones too, and while the tab is in the background.
  const ambient = document.querySelectorAll<HTMLElement>('.hero-winner, .winner-caption, .way, .strip, .loc, .brand-symbol');
  const ambientObserver = new IntersectionObserver((entries) => entries.forEach(({ target, isIntersecting }) => target.classList.toggle('is-offscreen', !isIntersecting)));
  ambient.forEach((el) => ambientObserver.observe(el)); observers.push(ambientObserver);
  const syncAmbient = () => document.body.toggleAttribute('data-ambient-sleep', document.hidden);
  document.addEventListener('visibilitychange', syncAmbient, { signal });
  syncAmbient();
  cleanup = () => {
    disposeWelcome();
    disposePrices();
    disposeTreatmentDetails();
    activeBody = undefined;
    if (gallery?.open) { gallery.close(); document.body.style.overflow = galleryOverflow; }
    controller.abort(); observers.forEach((o) => o.disconnect());
  };
}
bootExperience();
// Astro 5 owns DOM-update completion but leaves the native animation's `ready`
// rejection unobserved. Cancelling an animation is valid during navigation.
// Acknowledge that AbortError without concealing any other transition failure.
const observedTransitions = new WeakSet<ViewTransition>();
function observeTransition(transition?: ViewTransition | null) {
  if (!transition || observedTransitions.has(transition)) return;
  observedTransitions.add(transition);
  void transition.ready.catch((error) => {
    if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
  });
}
document.addEventListener('astro:before-preparation', () => {
  observeTransition((document as Document & { activeViewTransition?: ViewTransition | null }).activeViewTransition);
});
document.addEventListener('astro:before-swap', (event) => {
  observeTransition((event as Event & { viewTransition?: ViewTransition }).viewTransition);
  cleanup?.();
});
document.addEventListener('astro:page-load', bootExperience);
