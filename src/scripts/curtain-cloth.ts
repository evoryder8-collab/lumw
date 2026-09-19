/** Connected spring rows transmit a hem-first pull upward through the fabric. */
const runs = new WeakMap<HTMLElement, () => void>();
const ROWS = 15, CLOSED = 606, OPEN = -82;
type Point = { x: number; y: number };
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const n = (x: number) => x.toFixed(2);
const curve = (points: Point[]) => {
  let d = `M${n(points[0].x)} ${n(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i], c = points[i + 1], z = points[Math.min(points.length - 1, i + 2)];
    d += `C${n(b.x + (c.x - a.x) / 6)} ${n(b.y + (c.y - a.y) / 6)} ${n(c.x - (z.x - b.x) / 6)} ${n(c.y - (z.y - b.y) / 6)} ${n(c.x)} ${n(c.y)}`;
  }
  return d;
};
export const cancelCurtain = (root: HTMLElement) => runs.get(root)?.();

export function animateCurtain(root: HTMLElement, opening: boolean, duration: number) {
  cancelCurtain(root);
  const initial = opening ? CLOSED : OPEN;
  const panels = [...root.querySelectorAll<SVGSVGElement>('[data-cloth-panel]')].map((svg) => ({
    width: Array<number>(ROWS).fill(initial), velocity: Array<number>(ROWS).fill(0),
    surfaces: [...svg.querySelectorAll<SVGPathElement>('[data-cloth-surface]')],
    folds: [...svg.querySelectorAll<SVGPathElement>('[data-cloth-fold]')],
    flowers: [...svg.querySelectorAll<SVGGElement>('[data-cloth-flower]')],
    edge: svg.querySelector<SVGPathElement>('[data-cloth-edge]')!,
    vine: svg.querySelector<SVGPathElement>('[data-cloth-vine]')!,
  }));
  const { width, height } = root.getBoundingClientRect();
  const petals = [...root.querySelectorAll<HTMLElement>('[data-cloth-petal]')].map((el, i) => {
    el.style.opacity = '0';
    return { el, side: i % 2, row: 2 + i * 7 % 12, born: -1, x: 0, y: 0, vx: 0, vy: 0, spin: (i % 2 ? 1 : -1) * (90 + i * 9) };
  });
  const point = (panel: typeof panels[number], row: number, u: number): Point => {
    const v = row / (ROWS - 1), gathering = clamp(1 - panel.width[row] / CLOSED);
    return { x: -72 + (panel.width[row] + 72) * u,
      y: v * 1000 - gathering * 38 * Math.pow(v, 1.5) + Math.sin(v * Math.PI) * panel.velocity[row] * .004 };
  };
  const draw = () => panels.forEach((panel) => {
    const edge = Array.from({length: ROWS}, (_, r) => point(panel, r, 1));
    const d = `${curve(edge)}L-90 1040L-90 -20Z`;
    panel.surfaces.forEach(path => path.setAttribute('d', d));
    panel.edge.setAttribute('d', curve(edge));
    panel.folds.forEach((path, i) => {
      const a = Array.from({length: ROWS}, (_, r) => point(panel, r, i / panel.folds.length));
      const b = Array.from({length: ROWS}, (_, r) => point(panel, ROWS - 1 - r, (i + 1) / panel.folds.length));
      path.setAttribute('d', `${curve(a)}${curve(b).replace('M', 'L')}Z`);
    });
    panel.vine.setAttribute('d', curve(Array.from({length: ROWS}, (_, r) => point(panel, r, .858 + Math.sin(r * 1.4) * .015))));
    panel.flowers.forEach((flower, i) => {
      const row = Math.round(Number(flower.dataset.clothFlower) * (ROWS - 1));
      const p = point(panel, row, .87);
      const slope = (panel.width[Math.min(ROWS - 1, row + 1)] - panel.width[Math.max(0, row - 1)]) / 140;
      const turn = -Math.atan(slope * width / height / 1.2) + (i % 2 ? 22 : -20) * Math.PI / 180;
      const size = Math.max(.42, Math.min(1.05, width / 900));
      const squeeze = .42 + clamp(panel.width[row] / CLOSED) * .58;
      const sx = size * 1200 / width, sy = size * 1000 / height;
      // Keep the embroidery's proportions on tall phones while letting its
      // horizontal threads gather with the cloth.
      flower.setAttribute('transform', `matrix(${n(Math.cos(turn)*sx*squeeze)} ${n(Math.sin(turn)*sy*squeeze)} ${n(-Math.sin(turn)*sx)} ${n(Math.cos(turn)*sy)} ${n(p.x)} ${n(p.y)})`);
      flower.style.opacity = panel.width[row] > 0 ? '.78' : '0';
    });
  });
  draw();
  return new Promise<void>((resolve) => {
    let frame = 0, start = 0, last = 0, stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true; cancelAnimationFrame(frame); runs.delete(root); resolve();
    };
    runs.set(root, stop);
    const tick = (time: number) => {
      if (!start) { start = time; last = time; }
      const elapsed = time - start, dt = Math.min((time - last) / 1000, .032); last = time;
      // Stable integration even when a slower phone misses a paint frame.
      const steps = Math.max(1, Math.ceil(dt * 120)), step = dt / steps;
      for (let substep = 0; substep < steps; substep++) panels.forEach((panel, side) => {
        const acceleration = panel.width.map((w, row) => {
          const v = row / (ROWS - 1);
          // Neighbouring rows resist a sharp, paper-like kink. The upper edge
          // lags the lower pull; the right panel follows a little later.
          const delay = opening ? (1 - Math.pow(v, 2.4)) * 330 + side * 22 : v * 35;
          const progress = smooth((elapsed - delay) / (duration * (opening ? .45 : .38)));
          const target = opening ? CLOSED + (OPEN - CLOSED) * progress : OPEN + (CLOSED - OPEN) * progress;
          const neighbours = panel.width[Math.max(0, row - 1)] + panel.width[Math.min(ROWS - 1, row + 1)] - 2 * w;
          return (target - w) * (opening ? 160 : 1000) - panel.velocity[row] * (opening ? 20 : 58) + neighbours * 28;
        });
        panel.width.forEach((_, row) => { panel.velocity[row] += acceleration[row] * step; panel.width[row] += panel.velocity[row] * step; });
      });
      draw();
      if (opening) petals.forEach((p, i) => {
        const panel = panels[p.side];
        if (p.born < 0 && elapsed > 150 + i * 12 && panel.velocity[p.row] < -100) {
          const origin = point(panel, p.row, .93);
          p.born = elapsed; p.x = p.side ? width - origin.x / 600 * width / 2 : origin.x / 600 * width / 2;
          p.y = origin.y / 1000 * height; p.vx = panel.velocity[p.row] * width / 1200 * .22 * (p.side ? -1 : 1); p.vy = -35 - i % 5 * 7;
        }
        if (p.born < 0) return;
        const age = (elapsed - p.born) / 1000;
        p.vx *= Math.exp(-dt * .9); p.vy += 620 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        p.el.style.opacity = String(Math.min(clamp(age * 8), clamp((duration - elapsed) / 250)) * .88);
        p.el.style.transform = `translate3d(${n(p.x + Math.sin(age * 4 + i) * 8)}px,${n(p.y)}px,0) rotate(${n(age * p.spin)}deg) rotateY(${n(age * 210 + i * 13)}deg)`;
      });
      if (elapsed >= duration) {
        panels.forEach(panel => { panel.width.fill(opening ? OPEN : CLOSED); panel.velocity.fill(0); }); draw(); stop();
      } else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  });
}
