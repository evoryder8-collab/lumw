/**
 * The curtain's public face. The velvet renderer is a separate chunk loaded on
 * intent, so page load never pays for a GPU context or a shader compile.
 */
type Velvet = typeof import('./curtain-velvet');
let velvet: Velvet | undefined;
let loading: Promise<Velvet | undefined> | undefined;

/** Start loading and compiling. Safe to call repeatedly. */
export function prepareCurtain() {
  return loading ??= import('./curtain-velvet')
    .then(async (module) => { velvet = module; await module.warm(); return module; })
    .catch(() => undefined);
}

export const cancelCurtain = (root: HTMLElement) => velvet?.cancel(root);

export function animateCurtain(root: HTMLElement, opening: boolean, duration: number): Promise<void> {
  if (velvet?.ready()) return velvet.animate(root, opening, duration);
  // Not warm yet: wait briefly for it rather than show a different curtain.
  // The velvet module draws its own flat fallback if WebGL is unavailable.
  const wait = new Promise<undefined>((resolve) => setTimeout(resolve, 320));
  return Promise.race([prepareCurtain(), wait]).then((module) => (module ?? velvet)?.animate(root, opening, duration));
}
