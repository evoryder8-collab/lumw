/** Native details remain available when JavaScript is disabled. */
export function mountTreatmentDetails(signal: AbortSignal) {
  const dialogs: HTMLDialogElement[] = [];
  let active: HTMLDialogElement | undefined;
  let previousOverflow = '';
  document.querySelectorAll<HTMLDetailsElement>('[data-treatment-details]').forEach((details) => {
    const trigger = details.querySelector('summary')!;
    const panel = details.querySelector<HTMLElement>('[data-treatment-panel]')!;
    const title = panel.querySelector<HTMLElement>('[data-treatment-title]')!;
    const dialog = document.createElement('dialog');
    dialog.className = 'treatment-dialog';
    dialog.id = `${title.id}-dialog`;
    dialog.setAttribute('aria-labelledby', title.id);
    dialog.append(panel);
    document.body.append(dialog);
    dialogs.push(dialog);
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', dialog.id);
    const close = panel.querySelector<HTMLButtonElement>('[data-treatment-close]')!;
    close.hidden = false;
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      active = dialog;
      dialog.showModal();
    }, { signal });
    close.addEventListener('click', () => dialog.close(), { signal });
    dialog.addEventListener('close', () => {
      if (active === dialog) {
        active = undefined;
        document.body.style.overflow = previousOverflow;
        trigger.focus({ preventScroll: true });
      }
    }, { signal });
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    }, { signal });
  });
  return () => {
    if (active) { document.body.style.overflow = previousOverflow; active = undefined; }
    dialogs.forEach((dialog) => { dialog.close(); dialog.remove(); });
  };
}
