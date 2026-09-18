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
    const release = () => {
      if (active !== dialog) return;
      active = undefined;
      document.body.style.overflow = previousOverflow;
      trigger.focus({ preventScroll: true });
    };
    const closeDialog = () => { dialog.close(); release(); };
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      active = dialog;
      dialog.showModal();
    }, { signal });
    close.addEventListener('click', closeDialog, { signal });
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault(); closeDialog();
    }, { signal });
    dialog.addEventListener('close', () => {
      // Native close events are queued. Ignore one from an earlier opening if
      // the visitor has already reopened this dialog in the meantime.
      if (!dialog.open) release();
    }, { signal });
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog();
    }, { signal });
  });
  return () => {
    if (active) { document.body.style.overflow = previousOverflow; active = undefined; }
    dialogs.forEach((dialog) => { dialog.close(); dialog.remove(); });
  };
}
