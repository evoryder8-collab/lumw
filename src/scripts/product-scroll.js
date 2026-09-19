/** Owner-supplied ScrollSummon rendering, adapted to Astro navigation and visibility. */
let body;
let controller;
function bootProductScroll() {
  if(body===document.body) return;
  controller?.abort();body=document.body;controller=new AbortController();
  const {signal}=controller;
  document.querySelectorAll('[data-ss]').forEach(root=>{
    if(!root.hasAttribute('data-ss-dialog')) { mountProductScroll(root,signal);return; }
    // A closed quick view needs no scene setup, layout reads or observers during
    // the welcome screen. Mount once, when the visitor actually opens it.
    let mounted=false;
    const activate=()=>{
      if(mounted || !root.closest('dialog')?.open) return;
      mounted=true;mountProductScroll(root,signal);
    };
    document.addEventListener('luma:dialog-change',activate,{signal});
    activate();
  });
}
function mountProductScroll(root,signal) {
    const blobs=JSON.parse(root.dataset.blobs);
    const q=s=>root.querySelector(s);
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const outQ = (t) => 1 - Math.pow(1 - t, 4);
    const lerp = (a, b, t) => a + (b - a) * t;
    const r3 = (n) => Math.round(n * 1000) / 1000;

    const el = {
      cam: q('[data-cam]'),
      player: q('[data-player]'),
      pointer: q('[data-pointer]'),
      pointerImg: q('[data-pointer-img]'),
      impact: q('[data-impact]'),
      bloom: q('[data-bloom]'),
      ringA: q('[data-ring-a]'),
      ringB: q('[data-ring-b]'),
      halo: q('[data-halo]'),
      boltGroup: q('[data-bolt-group]'),
      boltHalo: q('[data-bolt-halo]'),
      boltCore: q('[data-bolt-core]'),
      boltBranch: q('[data-bolt-branch]'),
      headline: q('[data-headline]'),
      ruleA: q('[data-rule-a]'),
      ruleB: q('[data-rule-b]'),
      closing: q('[data-closing]'),
      pointerCopy: q('[data-pointer-copy]'),
      playerCopy: Array.from(root.querySelectorAll('[data-player-copy]')),
      blobs: Array.from(root.querySelectorAll('[data-blob]')),
    };


    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const inDialog = root.hasAttribute('data-ss-dialog');
    const stage = q('.ss-stage');
    let target = 0, active = false, raf = 0, alive = true;
    let clock = 0, wasOpen = Boolean(root.closest('dialog')?.open);
    const sim = { p: 0, v: 0, ph: 0, vh: 0, pp: 0, vp: 0, last: performance.now() };
    const measure = () => {
      // Treatment panels are moved into native dialogs after enhancement.
      // Resolve their owner here instead of retaining their original ancestor.
      const dialog = root.closest('dialog');
      const rect = root.getBoundingClientRect();
      const top = dialog ? dialog.getBoundingClientRect().top + dialog.clientTop : 0;
      const bottom = top + (dialog ? dialog.clientHeight : innerHeight);
      const span = root.offsetHeight - stage.offsetHeight;
      // Play the entrance as the panel comes into view, so visitors do not
      // scroll through an empty stage before reaching its sticky position.
      // Include that approach in the span to keep the ending at the same edge.
      const approach = Math.min(stage.offsetHeight, bottom - top) * .7;
      target = span > 0 ? clamp((top + approach - rect.top) / (span + approach), 0, 1) : 0;
      const modal = document.querySelector('dialog[open]');
      active = (!inDialog || dialog?.open) && (!modal || modal === dialog)
        && rect.width > 0 && rect.top < bottom && rect.bottom > top;
      root.classList.toggle('is-visible', active);
      if (inDialog && target > .22) root.classList.add('has-scrolled');
    };
    const step = (pos, vel, goal, k, c, dt) => {
      const v2 = vel + ((goal-pos)*k-vel*c)*dt;
      return [pos+v2*dt, v2];
    };
    const frame = now => {
      raf = 0;
      if (!alive || !active || document.hidden || reduced.matches || (inDialog && !root.closest('dialog')?.open)) return;
      const dt = Math.min((now-sim.last)/1000, 1/30);
      sim.last=now;clock+=dt;
      const n=Math.max(1,Math.ceil(dt/(1/120))), h=dt/n;
      for(let i=0;i<n;i++) {
        [sim.p,sim.v]=step(sim.p,sim.v,target,130,19,h);
        [sim.ph,sim.vh]=step(sim.ph,sim.vh,sim.p,70,11,h);
        [sim.pp,sim.vp]=step(sim.pp,sim.vp,sim.p,48,9,h);
      }
      render(sim.p,clock,sim.v,sim.ph,sim.pp,sim.vh,sim.vp);
      raf=requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!active || document.hidden || reduced.matches || !alive) { cancelAnimationFrame(raf);raf=0;return; }
      if (!raf) { sim.last=performance.now();raf=requestAnimationFrame(frame); }
    };
    const sync = () => { measure();wake(); };
    const mode = () => {
      root.classList.toggle('is-active',!reduced.matches);
      if(reduced.matches) {
        root.querySelectorAll('[data-cam], [data-player], [data-pointer], [data-headline], [data-player-copy], [data-pointer-copy], [data-closing]').forEach(el=>el.removeAttribute('style'));
      } else { measure();sim.p=sim.ph=sim.pp=target;render(target,clock,0,target,target,0,0); }
      wake();
    };
    const observer=new IntersectionObserver(sync);
    observer.observe(root);
    const resize=new ResizeObserver(sync);
    resize.observe(stage);
    addEventListener('scroll',sync,{passive:true,signal});
    // Scroll does not bubble, so capture the popup's own scroll events.
    document.addEventListener('scroll',event=>{
      if(inDialog && event.target===root.closest('dialog')) sync();
    },{capture:true,passive:true,signal});
    addEventListener('resize',sync,{passive:true,signal});
    document.addEventListener('visibilitychange',wake,{signal});
    document.addEventListener('luma:dialog-change',()=>{
      const open=Boolean(root.closest('dialog')?.open);
      if(inDialog && open && !wasOpen) {
        clock=0;Object.assign(sim,{p:0,v:0,ph:0,vh:0,pp:0,vp:0});
        root.classList.remove('has-scrolled');
        if(!reduced.matches) render(0,0,0,0,0,0,0);
      }
      wasOpen=open;sync();
    },{signal});
    // Skip only the choreography, without changing the page URL or its scroll.
    q('.ss-skip').addEventListener('click',event=>{
      if(!inDialog) return;
      const destination=document.getElementById(event.currentTarget.hash.slice(1));
      const dialog=root.closest('dialog');
      if(!destination || !dialog?.open) return;
      event.preventDefault();event.stopPropagation();
      dialog.scrollTop+=destination.getBoundingClientRect().top-dialog.getBoundingClientRect().top-24;
      destination.focus({preventScroll:true});
    },{signal});
    reduced.addEventListener('change',mode,{signal});
    mode();
    signal.addEventListener('abort',()=>{alive=false;cancelAnimationFrame(raf);observer.disconnect();resize.disconnect();},{once:true});
    function render(p, t, v, ph, pp, vh, vp) {
      // living ground
      el.blobs.forEach((node, i) => {
        const b = blobs[i] || { period: 15, phase: i };
        const a = (t / b.period + b.phase) * Math.PI * 2;
        const dx = Math.sin(a) * (b.driftX ?? 60) + p * (i % 2 ? -40 : 40);
        const dy = Math.cos(a * 0.8) * (b.driftY ?? 46) - p * 30;
        const s = 1 + 0.08 * Math.sin(a * 0.7) + p * 0.06;
        node.style.transform = `translate(-50%, -50%) translate(${r3(dx)}px, ${r3(dy)}px) scale(${r3(s)})`;
      });

      const a1 = outQ(seg(ph, 0.02, 0.34));
      const a2 = ease(seg(pp, 0.24, 0.44));
      const spinP = ease(seg(pp, 0.26, 0.46));
      const a3 = ease(seg(p, 0.55, 0.92));
      const landedH = seg(ph, 0.24, 0.4);
      const landedP = seg(pp, 0.46, 0.62);
      const bobH = (Math.sin(t * 0.72) * 4.2 + Math.sin(t * 1.13 + 2) * 1.6) * landedH;
      const swayH = Math.sin(t * 0.51 + 0.7) * 3.2 * landedH;
      const bobP = (Math.sin(t * 0.63 + 1.3) * 7 + Math.sin(t * 0.97) * 2.6) * landedP;
      const swayP = Math.sin(t * 0.44 + 2.1) * 5 * landedP;
      const tiltH = clamp(vh * 26, -14, 14);
      const tiltP = clamp(vp * 34, -18, 18);

      const hx = lerp(-46, 0, a1) + lerp(0, -5, a3) + swayH;
      const hy = lerp(78, 0, a1) + lerp(0, -6, a3) + bobH - clamp(vh * 30, -10, 10);
      const hr = lerp(-175, -6, a1) + lerp(0, 352, a3) + tiltH + Math.sin(t * 0.58 + 1.1) * 3.4 * landedH;
      const hs = lerp(0.55, 1, a1) * lerp(1, 0.94, a3) * (1 + 0.018 * Math.sin(t * 0.8) * landedH);
      el.player.style.opacity = r3(outQ(seg(ph, 0.02, 0.2)));
      el.player.style.transform =
        `translate(-50%, -50%) translate(${r3(hx)}%, ${r3(hy)}%) rotate(${r3(hr)}deg) scale(${r3(hs)})`;

      // pointer: arrival, one spin, then scroll-orchestrated acupressure jabs
      const jab = seg(pp, 0.46, 0.56);
      const jp = (clamp((pp - 0.46) / 0.54, 0, 1) * 9) % 1;
      const thrust = jp < 0.18
        ? 1 - Math.pow(1 - jp / 0.18, 3)
        : 1 - ease(clamp((jp - 0.18) / 0.52, 0, 1));
      const recoil = (jp < 0.18 ? -(jp / 0.18) : 1 - clamp((jp - 0.18) / 0.52, 0, 1)) * 2.6 * jab;
      const px = lerp(88, 0, a2) + lerp(0, 6, a3) + swayP * 0.6;
      const py = lerp(120, 0, a2) + lerp(0, 10, a3) + bobP - clamp(vp * 40, -14, 14);
      const pr = lerp(200, -90, a2) + lerp(0, -360, spinP) + tiltP * (1 - jab * 0.7) + recoil
        + Math.sin(t * 0.49 + 0.4) * 4 * landedP;
      const ps = lerp(0.6, 1, a2) * lerp(1, 1.04, a3) * (1 + 0.022 * Math.sin(t * 0.67 + 1) * landedP);
      const pj = -thrust * 15 * jab;
      el.pointer.style.opacity = r3(outQ(seg(pp, 0.26, 0.44)));
      el.pointer.style.transform =
        `translate(-50%, -50%) translate(${r3(px)}%, ${r3(py)}%) rotate(${r3(pr)}deg) translateX(${r3(pj)}%) scale(${r3(ps)})`;

      // rod flashes ON contact — same envelope as the shockwave
      const flash = jab * (jp < 0.18
        ? Math.pow(jp / 0.18, 7)
        : Math.pow(1 - clamp((jp - 0.18) / 0.34, 0, 1), 2.4));
      el.pointerImg.style.filter =
        `drop-shadow(0 30px 44px rgba(4,12,6,0.55)) drop-shadow(0 0 ${r3(4 + flash * 40)}px rgba(234,247,176,${r3(0.06 + flash * 0.75)})) brightness(${r3(1 + flash * 0.5)}) saturate(${r3(1 + flash * 0.35)})`;

      // impact layer tracks the tip (square box → vertical % rescaled)
      el.impact.style.transform =
        `translate(-50%, -50%) translate(${r3(px)}%, ${r3(py * (86 / 806))}%) translateY(${r3(-pj)}%)`;
      const wave = (delay, life) => clamp((jp - delay) / life, 0, 1);
      const w1 = wave(0.18, 0.5);
      const e1 = 1 - Math.pow(1 - w1, 3);
      el.ringA.style.opacity = r3(jab * (w1 > 0 ? 1 : 0) * Math.pow(1 - w1, 1.6) * 0.85);
      el.ringA.style.transform = `scale(${r3(0.25 + e1 * 2.1)}, ${r3(0.25 + e1 * 1.05)})`;
      const w2 = wave(0.3, 0.55);
      const e2 = 1 - Math.pow(1 - w2, 3);
      el.ringB.style.opacity = r3(jab * (w2 > 0 ? 1 : 0) * Math.pow(1 - w2, 2) * 0.45);
      el.ringB.style.transform = `scale(${r3(0.25 + e2 * 1.5)}, ${r3(0.25 + e2 * 0.75)})`;
      el.bloom.style.opacity = r3(jab * Math.pow(thrust, 2.2) * 0.75);
      el.bloom.style.transform = `scale(${r3(0.5 + thrust * 0.85)}, ${r3(0.35 + thrust * 0.4)})`;

      // EMS lightning on the headset — one strike at a time
      const gate = outQ(seg(p, 0.36, 0.43)) * (1 - ease(seg(p, 0.6, 0.7)));
      const ringPh = (t * 0.6) % 1;
      el.halo.style.opacity = r3(gate * (1 - ringPh) * 0.45);
      el.halo.style.transform = `scale(${r3(0.6 + ringPh * 0.6)})`;
      const strike = Math.floor(t * 1.6);
      const local = (t * 1.6) % 1;
      const rnd = (n2) => {
        const x2 = Math.sin(strike * 91.7 + n2 * 12.9898) * 43758.5453;
        return x2 - Math.floor(x2);
      };
      let bxp = 200 + (rnd(0) - 0.5) * 120;
      let byp = 40 + rnd(1) * 30;
      let d = `M${bxp.toFixed(1)} ${byp.toFixed(1)}`;
      const pts = [[bxp, byp]];
      for (let i = 1; i <= 7; i++) {
        bxp += (rnd(i * 2) - 0.5) * 78;
        byp += 24 + rnd(i * 2 + 1) * 16;
        pts.push([bxp, byp]);
        d += ` L${bxp.toFixed(1)} ${byp.toFixed(1)}`;
      }
      let [cx, cy] = pts[4];
      let d2 = `M${cx.toFixed(1)} ${cy.toFixed(1)}`;
      for (let i = 0; i < 3; i++) {
        cx += (rnd(20 + i) - 0.3) * 60;
        cy += 16 + rnd(30 + i) * 12;
        d2 += ` L${cx.toFixed(1)} ${cy.toFixed(1)}`;
      }
      el.boltHalo.setAttribute('d', d);
      el.boltCore.setAttribute('d', d);
      el.boltBranch.setAttribute('d', d2);
      const env = Math.sin(Math.PI * clamp(local / .48, 0, 1)) ** 2;
      el.boltGroup.setAttribute('opacity', r3(gate * env));

      // typography
      const fade = (inA, inB, outA, outB) => outQ(seg(p, inA, inB)) * (1 - ease(seg(p, outA, outB)));
      const o4 = (inDialog ? 1 : outQ(seg(p, 0, 0.07))) * (1 - ease(seg(p, 0.2, 0.32)));
      el.headline.style.opacity = r3(o4);
      el.headline.style.transform =
        `translateY(${r3((inDialog ? 0 : lerp(46, 0, outQ(seg(p, 0, 0.09)))) - ease(seg(p, 0.2, 0.32)) * 30)}px)`;
      el.ruleA.style.width = `${r3(lerp(0, 100, ease(seg(p, 0.22, 0.38))) * (1 - ease(seg(p, 0.62, 0.78))))}%`;
      el.ruleB.style.width = `${r3(lerp(0, 100, ease(seg(p, 0.33, 0.5))) * (1 - ease(seg(p, 0.6, 0.76))))}%`;
      const o1 = fade(0.24, 0.36, 0.6, 0.76);
      const y1 = lerp(32, 0, outQ(seg(p, 0.24, 0.36)));
      el.playerCopy.forEach((node) => {
        node.style.opacity = r3(o1);
        node.style.transform = `translateY(${r3(y1)}px)`;
      });
      el.pointerCopy.style.opacity = r3(fade(0.33, 0.47, 0.6, 0.76));
      el.pointerCopy.style.transform = `translateY(${r3(lerp(32, 0, outQ(seg(p, 0.33, 0.47))))}px)`;
      el.closing.style.opacity = r3(outQ(seg(p, 0.7, 0.86)) * 0.9);
      el.closing.style.transform = `translateY(${r3(lerp(28, 0, outQ(seg(p, 0.7, 0.86))))}px)`;

      // camera
      const cam = lerp(1.14, 1, a1) * lerp(1, 1.1, a3);
      const camX = lerp(0, -26, a3);
      const camY = lerp(30, 0, a1) + Math.sin(t * 0.33) * 6 - clamp(v * 22, -12, 12);
      el.cam.style.transform = `scale(${r3(cam)}) translate(${r3(camX)}px, ${r3(camY)}px)`;
    }

}
bootProductScroll();
document.addEventListener('astro:page-load',bootProductScroll);
document.addEventListener('astro:before-swap',()=>{controller?.abort();body=undefined;});
