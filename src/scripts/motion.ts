/**
 * The motion layer. Stage 6.
 *
 * This is the only JavaScript on the site. It loads from a single deferred
 * island after LCP, and everything it does is an enhancement: the page is
 * complete, readable and navigable before this file arrives, and stays that way
 * if it never does.
 *
 * Rules from section 9.5 that are enforced in code, not by convention:
 *   - one sunbeam on screen at a time
 *   - two haloed elements per viewport maximum
 *   - 6s sheen cooldown per element
 *   - tilt, magnetic and glare only behind (pointer: fine) and (hover: hover)
 *   - prefers-reduced-motion is a full alternate grammar, not a switch
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE_POINTER = matchMedia('(hover: hover) and (pointer: fine)').matches;
const MOBILE = matchMedia('(max-width: 900px)').matches;

/**
 * Section 9.4 keeps pinned chapters on mobile at a 60vh pin distance and only
 * drops to in-view reveals "if a real low-end Android stutters". So the pin
 * stays, and the fallback is gated on the device actually being weak rather
 * than on the viewport merely being narrow.
 */
const LOW_END =
  (navigator.hardwareConcurrency ?? 8) <= 4 &&
  ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;

/** Everything registered here is torn down before a View Transition swap. */
const cleanups: Array<() => void> = [];
const onCleanup = (fn: () => void) => cleanups.push(fn);

/* ------------------------------------------------------------------ scroll */

let lenis: Lenis | null = null;

function initScroll() {
  if (REDUCED) return; // Lenis off entirely under reduced motion.

  lenis = new Lenis({
    duration: 1.05,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false, // never fight a touch device's native scrolling
  });

  // One shared ticker. ScrollTrigger reads from Lenis rather than running its
  // own rAF, so the page never detaches from the finger.
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  onCleanup(() => {
    gsap.ticker.remove(tick);
    lenis?.destroy();
    lenis = null;
  });
}

/* -------------------------------------------------------- scroll velocity */

/**
 * Let the page feel the speed it is being scrolled at.
 *
 * Everything else in this file responds to scroll *position*: where you are
 * decides what has revealed. Nothing responded to how fast you were moving, so
 * a flick and a crawl produced identical frames and the page felt like it was
 * being stepped through rather than moved.
 *
 * Lenis already computes velocity, so this costs one custom property write per
 * frame and no measurement. The value is normalised, clamped and eased back to
 * rest, and the CSS that consumes it stays deliberately quiet - a fraction of a
 * degree of skew and a percent of stretch on photographs only. Past about a
 * degree this stops reading as momentum and starts reading as a broken
 * transform, which is the failure mode of every site that overdoes it.
 */
function initScrollVelocity() {
  if (REDUCED || !lenis) return;

  const root = document.documentElement;
  let smoothed = 0;

  // Lenis hands the callback its own instance, not an event object, and reads
  // velocity off it. Destructuring a { velocity } argument happens to work for
  // that reason, but it describes an event shape Lenis does not have.
  const onScroll = (instance: { velocity: number }) => {
    // Pixels per frame. Normalising against a brisk flick keeps the property in
    // roughly -1..1 whatever the device's scroll granularity is.
    const target = Math.max(-1, Math.min(1, instance.velocity / 55));

    // Rise quickly, fall slowly: the page should answer a flick at once and
    // then settle, rather than snapping flat the moment the finger lifts.
    const k = Math.abs(target) > Math.abs(smoothed) ? 0.28 : 0.08;
    smoothed += (target - smoothed) * k;

    if (Math.abs(smoothed) < 0.001) smoothed = 0;
    root.style.setProperty('--scroll-v', smoothed.toFixed(3));
  };

  // on() returns its own unsubscribe, which cannot go stale the way passing the
  // handler back to off() can.
  const unsubscribe = lenis.on('scroll', onScroll);
  root.classList.add('has-scroll-velocity');

  onCleanup(() => {
    unsubscribe();
    root.classList.remove('has-scroll-velocity');
    root.style.removeProperty('--scroll-v');
  });
}

/* ----------------------------------------------------------- line reveals */

function initReveals() {
  // Display headings split into lines inside overflow-hidden masks.
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    if (REDUCED) {
      gsap.set(el, { opacity: 1 });
      return;
    }

    const split = new SplitText(el, {
      type: 'lines',
      linesClass: 'line-inner',
      // SplitText's own mask wrapper gives us the overflow:hidden line box.
      mask: 'lines',
    });

    gsap.set(split.lines, { yPercent: 110 });

    const tl = gsap.to(split.lines, {
      yPercent: 0,
      duration: 1.05,
      stagger: 0.08,
      ease: 'power4.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });

    onCleanup(() => {
      tl.scrollTrigger?.kill();
      tl.kill();
      split.revert();
    });
  });

  // Body copy fades up as blocks.
  document.querySelectorAll<HTMLElement>('[data-fade]').forEach((el, i) => {
    if (REDUCED) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }
    const tw = gsap.fromTo(
      el,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.85,
        ease: 'power3.out',
        delay: (i % 3) * 0.05,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      },
    );
    onCleanup(() => {
      tw.scrollTrigger?.kill();
      tw.kill();
    });
  });
}

/* --------------------------------------------------------- pinned chapters */

function initChapters() {
  const chapters = document.querySelectorAll<HTMLElement>('[data-chapter]');
  if (!chapters.length) return;

  chapters.forEach((chapter) => {
    const media = chapter.querySelector<HTMLElement>('[data-chapter-media] img, [data-chapter-media] picture');
    const frame = chapter.querySelector<HTMLElement>('[data-chapter-media]');
    const copy = chapter.querySelectorAll<HTMLElement>('[data-chapter-copy] > *');
    const price = chapter.querySelector<HTMLElement>('[data-chapter-price]');

    // Reduced motion and genuinely weak hardware get in-view reveals instead
    // of a pin. Section 5 wins every argument, but a mid-range phone is not a
    // reason to throw the scroll narrative away.
    if (REDUCED || LOW_END) {
      if (frame) gsap.set(frame, { clipPath: 'inset(0%)' });
      const tw = gsap.fromTo(
        [...copy, price].filter(Boolean) as HTMLElement[],
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: REDUCED ? 0.2 : 0.7,
          stagger: REDUCED ? 0 : 0.06,
          ease: 'power3.out',
          scrollTrigger: { trigger: chapter, start: 'top 82%', once: true },
        },
      );
      onCleanup(() => {
        tw.scrollTrigger?.kill();
        tw.kill();
      });
      return;
    }

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: chapter,
        start: 'top top',
        // 60vh on mobile per section 9.4, a full viewport on desktop.
        end: MOBILE ? '+=60%' : '+=100%',
        pin: true,
        pinSpacing: true,
        scrub: true, // no smoothing, so the page never detaches from the finger
        anticipatePin: 1,
      },
    });

    if (frame) {
      tl.fromTo(
        frame,
        { clipPath: 'inset(12%)' },
        { clipPath: 'inset(0%)', ease: 'none', duration: 1 },
        0,
      );
    }
    if (media) {
      tl.fromTo(media, { scale: MOBILE ? 1.09 : 1.14 }, { scale: 1, ease: 'none', duration: 1 }, 0);
    }
    if (copy.length) {
      tl.fromTo(
        copy,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, stagger: 0.08, ease: 'power2.out', duration: 0.45 },
        0.05,
      );
    }
    if (price) {
      tl.fromTo(price, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.35 }, 0.4);
    }

    onCleanup(() => {
      tl.scrollTrigger?.kill();
      tl.kill();
    });
  });
}

/* --------------------------------------------------------------- 3D tilt */

/**
 * Section 9.3 specifies a 6deg cap and a 12px translateZ lift. On a real
 * pointer at these card sizes that read as far too much, so both are tuned to
 * 30 percent of the spec figures at Constantin's direction. Deliberate
 * deviation, not drift: raise these two numbers to 6 and 12 to get the spec
 * behaviour back.
 */
const TILT_MAX_DEG = 1.8;
const TILT_LIFT_PX = 3.6;

function initTilt() {
  if (!FINE_POINTER || REDUCED) return;

  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((card) => {
    const glare = card.querySelector<HTMLElement>('.tilt__glare');
    const shadow = card.querySelector<HTMLElement>('.tilt__shadow');

    const rotX = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3' });
    const rotY = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3' });
    const lift = gsap.quickTo(card, 'z', { duration: 0.5, ease: 'power3' });

    const move = (e: PointerEvent) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      rotY((px - 0.5) * 2 * TILT_MAX_DEG);
      rotX((0.5 - py) * 2 * TILT_MAX_DEG);
      lift(TILT_LIFT_PX);
      if (glare) {
        glare.style.setProperty('--glare-x', `${px * 100}%`);
        glare.style.setProperty('--glare-y', `${py * 100}%`);
      }
    };

    const enter = () => {
      if (glare) glare.style.opacity = '1';
      if (shadow) shadow.style.opacity = '1';
    };

    const leave = () => {
      // Elastic return over 0.9s.
      gsap.to(card, { rotationX: 0, rotationY: 0, z: 0, duration: 0.9, ease: 'elastic.out(1, 0.55)' });
      if (glare) glare.style.opacity = '0';
      if (shadow) shadow.style.opacity = '0';
    };

    card.addEventListener('pointermove', move);
    card.addEventListener('pointerenter', enter);
    card.addEventListener('pointerleave', leave);

    onCleanup(() => {
      card.removeEventListener('pointermove', move);
      card.removeEventListener('pointerenter', enter);
      card.removeEventListener('pointerleave', leave);
      gsap.set(card, { clearProps: 'transform' });
    });
  });
}

/* ------------------------------------------------------------------ sheen */

const SHEEN_COOLDOWN = 6000;

function sweep(el: HTMLElement) {
  const last = Number(el.dataset.sheenAt || 0);
  if (Date.now() - last < SHEEN_COOLDOWN) return;
  el.dataset.sheenAt = String(Date.now());
  el.classList.remove('is-sweeping');
  void el.offsetWidth; // restart the animation
  el.classList.add('is-sweeping');
}

function initSheen() {
  if (REDUCED) return;

  const targets = document.querySelectorAll<HTMLElement>('.sheen');

  // Once on scroll-enter.
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) sweep(e.target as HTMLElement);
      }
    },
    { threshold: 0.45 },
  );
  targets.forEach((t) => io.observe(t));

  // Once on hover, fine pointers only.
  const handlers: Array<[HTMLElement, () => void]> = [];
  if (FINE_POINTER) {
    targets.forEach((t) => {
      const h = () => sweep(t);
      t.addEventListener('pointerenter', h);
      handlers.push([t, h]);
    });
  }

  onCleanup(() => {
    io.disconnect();
    handlers.forEach(([el, h]) => el.removeEventListener('pointerenter', h));
  });
}

/* ------------------------------------------------------------- halo bloom */

function initHalo() {
  // Two haloed elements per viewport maximum. The observer lights whichever
  // primary CTAs are actually on screen and never more than two at once.
  const halos = [...document.querySelectorAll<HTMLElement>('.halo')];
  if (!halos.length) return;

  const visible = new Set<HTMLElement>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) visible.add(el);
        else {
          visible.delete(el);
          el.classList.remove('is-lit');
        }
      }
      // Two haloed elements per viewport, maximum.
      [...visible].slice(0, 2).forEach((el) => el.classList.add('is-lit'));
      [...visible].slice(2).forEach((el) => el.classList.remove('is-lit'));
    },
    { threshold: 0.6 },
  );
  halos.forEach((h) => io.observe(h));

  // A touch device never hovers, so the bloom would sit at one static value
  // forever. On touch it breathes instead: the same pooled sunlight, slowly
  // rising and falling, which is what makes the CTA feel alive in the hand.
  if (!FINE_POINTER && !REDUCED) {
    halos.forEach((h) => h.classList.add('halo--breathing'));
  }

  onCleanup(() => io.disconnect());
}

/* ------------------------------------------------------- mobile parallax */

/**
 * Touch gets the scroll grammar, and that has to be worth having. Chapter
 * media drifts against its frame as the chapter passes, which is the effect
 * that makes a phone feel like it is moving through a scene rather than paging
 * down a list.
 */
function initScrollDrift() {
  if (REDUCED || LOW_END) return;

  document.querySelectorAll<HTMLElement>('[data-drift]').forEach((el) => {
    const inner = el.querySelector<HTMLElement>('img, picture') ?? el;
    const st = gsap.fromTo(
      inner,
      { yPercent: -4 },
      {
        yPercent: 4,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      },
    );
    onCleanup(() => {
      st.scrollTrigger?.kill();
      st.kill();
    });
  });
}

/* --------------------------------------------------------- magnetic pills */

function initMagnetic() {
  if (!FINE_POINTER || REDUCED) return;

  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((btn) => {
    const label = btn.querySelector<HTMLElement>('[data-magnetic-label]');
    const toX = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3' });
    const toY = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3' });
    const lx = label ? gsap.quickTo(label, 'x', { duration: 0.45, ease: 'power3' }) : null;
    const ly = label ? gsap.quickTo(label, 'y', { duration: 0.45, ease: 'power3' }) : null;

    const RADIUS = 28;

    const move = (e: PointerEvent) => {
      const r = btn.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      const reach = Math.max(r.width, r.height) / 2 + RADIUS;
      if (dist > reach) return;
      const pull = Math.min(1, 1 - dist / reach);
      toX(dx * 0.28 * pull * (6 / 6));
      toY(dy * 0.28 * pull);
      lx?.(dx * 0.14 * pull);
      ly?.(dy * 0.14 * pull);
    };

    const leave = () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' });
      if (label) gsap.to(label, { x: 0, y: 0, duration: 0.85, ease: 'elastic.out(1, 0.4)' });
    };

    const scope = btn.parentElement ?? btn;
    scope.addEventListener('pointermove', move);
    scope.addEventListener('pointerleave', leave);

    onCleanup(() => {
      scope.removeEventListener('pointermove', move);
      scope.removeEventListener('pointerleave', leave);
      gsap.set(btn, { clearProps: 'transform' });
    });
  });
}

/* ----------------------------------------------------------- sunbeam pass */

function initSunbeams() {
  if (REDUCED) return;

  const sections = [...document.querySelectorAll<HTMLElement>('[data-sunbeam]')];
  if (!sections.length) return;

  // One sunbeam on screen at a time. The token is held by whichever section is
  // currently scrubbing; no other beam is allowed to paint.
  let holder: HTMLElement | null = null;

  sections.forEach((section) => {
    const ray = document.createElement('div');
    ray.className = 'sunbeam__ray';
    section.classList.add('sunbeam');
    section.prepend(ray);

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
      onToggle: (self) => {
        if (self.isActive && holder === null) holder = section;
        else if (!self.isActive && holder === section) holder = null;
      },
      onUpdate: (self) => {
        if (holder !== section) {
          gsap.set(ray, { opacity: 0 });
          return;
        }
        const p = self.progress;
        // Fades in, crosses the wall, fades out. Never two beams at once.
        const fade = Math.sin(Math.PI * p);
        gsap.set(ray, {
          xPercent: -120 + p * 320,
          opacity: fade * 0.9,
        });
      },
    });

    onCleanup(() => {
      st.kill();
      ray.remove();
    });
  });
}

/* -------------------------------------------------------------- light motes */

function initMotes() {
  if (REDUCED) return;

  document.querySelectorAll<HTMLCanvasElement>('canvas.motes').forEach((canvas) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const DPR = Math.min(devicePixelRatio || 1, 1.5); // capped per section 9.3
    const COUNT = MOBILE ? 90 : 180;

    let w = 0;
    let h = 0;
    let raf = 0;
    let running = false;
    let scrollY = window.scrollY;

    type Mote = { x: number; y: number; r: number; a: number; sp: number; sw: number; ph: number; warm: boolean };
    let motes: Mote[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * DPR);
      canvas.height = Math.round(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };

    const seed = () => {
      motes = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 2 + Math.random() * 3,             // 2 to 5px
        a: 0.2 + Math.random() * 0.25,        // 20 to 45 percent alpha
        sp: 0.12 + Math.random() * 0.28,      // rising slowly
        sw: 0.4 + Math.random() * 1.1,        // sinusoidal sway
        ph: Math.random() * Math.PI * 2,
        warm: Math.random() > 0.45,
      }));
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const par = (window.scrollY - scrollY) * 0.3; // 0.3x scroll parallax

      for (const m of motes) {
        m.y -= m.sp;
        if (m.y < -10) {
          m.y = h + 10;
          m.x = Math.random() * w;
        }
        const x = m.x + Math.sin(t / 2400 + m.ph) * m.sw * 12;
        const y = m.y - par;
        if (y < -20 || y > h + 20) continue;

        // Gentle twinkle.
        const tw = 0.7 + 0.3 * Math.sin(t / 900 + m.ph * 2.3);
        const alpha = m.a * tw;

        const g = ctx.createRadialGradient(x, y, 0, x, y, m.r * 2.6);
        const core = m.warm ? '255, 250, 240' : '232, 213, 168';
        g.addColorStop(0, `rgba(${core}, ${alpha})`);
        g.addColorStop(1, `rgba(${core}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, m.r * 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    const start = () => {
      if (running) return;
      running = true;
      scrollY = window.scrollY;
      raf = requestAnimationFrame(draw);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    seed();

    // Paused offscreen, dead under reduced motion.
    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? start() : stop()),
      { threshold: 0 },
    );
    io.observe(canvas);

    const onResize = () => {
      resize();
      seed();
    };
    window.addEventListener('resize', onResize, { passive: true });

    onCleanup(() => {
      stop();
      io.disconnect();
      window.removeEventListener('resize', onResize);
    });
  });
}

/* --------------------------------------------------------- float pausing */

function initFloatPausing() {
  const floats = document.querySelectorAll<HTMLElement>('.float');
  if (!floats.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) e.target.classList.toggle('is-onscreen', e.isIntersecting);
    },
    { threshold: 0 },
  );
  floats.forEach((f) => io.observe(f));
  onCleanup(() => io.disconnect());
}

/* ------------------------------------------------------- pointer spotlight */

/**
 * The card tracks the pointer and pools warm light under it. Two CSS custom
 * properties, no per-frame JS work beyond writing them, and the whole
 * appearance stays in the stylesheet.
 */
function initSpotlight() {
  if (!FINE_POINTER || REDUCED) return;

  document.querySelectorAll<HTMLElement>('.spot').forEach((el) => {
    let raf = 0;
    let x = 0;
    let y = 0;

    const write = () => {
      raf = 0;
      el.style.setProperty('--mx', `${x}px`);
      el.style.setProperty('--my', `${y}px`);
    };

    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(write);
    };

    el.addEventListener('pointermove', move, { passive: true });
    onCleanup(() => {
      el.removeEventListener('pointermove', move);
      if (raf) cancelAnimationFrame(raf);
    });
  });
}

/* --------------------------------------------------- CSS-owned reveals */

/**
 * The stylesheet owns how a reveal looks; this only flips data-state when the
 * element arrives. Because the resting state in CSS is *visible* and only
 * .motion-ready hides it, nothing can be stranded invisible by a trigger that
 * never fires - which is the failure mode of driving opacity from JS.
 */
function initStateReveals() {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal2], [data-settle]');
  if (!targets.length) return;

  if (REDUCED) {
    targets.forEach((el) => (el.dataset.state = 'in'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).dataset.state = 'in';
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
  );

  targets.forEach((t) => io.observe(t));
  onCleanup(() => io.disconnect());
}

/* ------------------------------------------------------------- progress */

/**
 * A hairline of gold across the top that tracks read position. On a page that
 * is thirteen screens tall with six pinned chapters, it is the difference
 * between scrolling and knowing where you are.
 */
function initProgress() {
  const bar = document.querySelector<HTMLElement>('[data-progress]');
  if (!bar || REDUCED) return;

  const st = ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
  });
  onCleanup(() => st.kill());
}

/* ------------------------------------------------------ chapter counter */

/**
 * While the pinned sequence is running, a small fixed counter names which
 * chapter is on screen. It appears with the first chapter and leaves with the
 * last, so it never sits over the rest of the page.
 */
function initChapterCounter() {
  const chapters = [...document.querySelectorAll<HTMLElement>('[data-chapter]')];
  const counter = document.querySelector<HTMLElement>('[data-chapter-counter]');
  if (!counter || chapters.length === 0 || REDUCED) return;

  const now = counter.querySelector<HTMLElement>('[data-chapter-now]');
  const total = counter.querySelector<HTMLElement>('[data-chapter-total]');
  if (total) total.textContent = String(chapters.length).padStart(2, '0');

  const triggers = chapters.map((ch, i) =>
    ScrollTrigger.create({
      trigger: ch,
      start: 'top 60%',
      end: 'bottom 40%',
      onToggle: (self) => {
        if (!self.isActive) return;
        counter.classList.add('is-visible');
        if (now) now.textContent = String(i + 1).padStart(2, '0');
      },
    }),
  );

  // Leave when the sequence does.
  const bounds = ScrollTrigger.create({
    trigger: chapters[0],
    endTrigger: chapters[chapters.length - 1],
    start: 'top 70%',
    end: 'bottom 30%',
    onToggle: (self) => counter.classList.toggle('is-visible', self.isActive),
  });

  onCleanup(() => {
    triggers.forEach((t) => t.kill());
    bounds.kill();
  });
}

/* -------------------------------------------------------------------- boot */

/**
 * Hiding copy before it is revealed is the one genuinely dangerous thing the
 * motion layer does: if a trigger never fires, that text is invisible for good.
 * This sweeps up anything still hidden a few seconds in, and does the same
 * immediately before printing.
 */
function installRevealFailsafe() {
  const showAll = () => {
    document.querySelectorAll<HTMLElement>('[data-fade]').forEach((el) => {
      if (Number(getComputedStyle(el).opacity) < 0.99) {
        gsap.set(el, { opacity: 1, y: 0, clearProps: 'transform' });
      }
    });
    document.querySelectorAll<HTMLElement>('[data-reveal] .line-inner').forEach((el) => {
      gsap.set(el, { yPercent: 0 });
    });
    document
      .querySelectorAll<HTMLElement>('[data-reveal2]:not([data-state])')
      .forEach((el) => (el.dataset.state = 'in'));
  };

  const t = window.setTimeout(showAll, 6000);
  const onPrint = () => showAll();
  addEventListener('beforeprint', onPrint);

  onCleanup(() => {
    clearTimeout(t);
    removeEventListener('beforeprint', onPrint);
  });
}

function boot() {
  document.documentElement.classList.add('motion-ready');

  initScroll();
  initScrollVelocity(); // after initScroll: it needs the Lenis instance
  initReveals();
  initChapters();
  initTilt();
  initSheen();
  initHalo();
  initMagnetic();
  initSunbeams();
  initMotes();
  initFloatPausing();
  initScrollDrift();
  initSpotlight();
  initStateReveals();
  initProgress();
  initChapterCounter();
  installRevealFailsafe();

  ScrollTrigger.refresh();
}

function teardown() {
  while (cleanups.length) cleanups.pop()?.();
  ScrollTrigger.getAll().forEach((t) => t.kill());
  document.documentElement.classList.remove('motion-ready');
}

boot();

// View Transitions swap the DOM under us, so the whole layer is rebuilt per
// page rather than left holding references to nodes that no longer exist.
document.addEventListener('astro:before-swap', teardown);
document.addEventListener('astro:page-load', () => {
  if (!document.documentElement.classList.contains('motion-ready')) boot();
});
