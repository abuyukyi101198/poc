/**
 * help.js
 *
 * Wires the symbol-only "?" help-toggle button (next to the theme toggle,
 * §8.7-style page-level control) to show/hide the toggleable Help side
 * panel (#help-panel). The panel itself is static markup in index.html;
 * this module only owns open/close state + a11y attributes.
 *
 * No persistence — the panel always starts closed on page load, unlike the
 * theme toggle (§11.6), since it's a transient explanatory aid rather than
 * a durable display preference.
 *
 * Exports: initHelpPanel(buttonSelector?, panelSelector?, closeSelector?)
 */

export function initHelpPanel(
  buttonSelector = '#help-toggle',
  panelSelector = '#help-panel',
  closeSelector = '#help-close'
) {
  const btn = document.querySelector(buttonSelector);
  const panel = document.querySelector(panelSelector);
  const closeBtn = document.querySelector(closeSelector);
  if (!btn || !panel) return;

  const setOpen = (open) => {
    panel.toggleAttribute('hidden', !open);
    btn.setAttribute('aria-pressed', String(open));
    btn.setAttribute('aria-label', open ? 'Close help panel' : 'Open help panel');
  };

  btn.addEventListener('click', () => setOpen(panel.hasAttribute('hidden')));
  closeBtn?.addEventListener('click', () => setOpen(false));

  // Escape key closes the panel when open — standard dismiss affordance
  // for a dialog-role side panel.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hasAttribute('hidden')) setOpen(false);
  });

  setOpen(false);

  console.log('[topology] Help panel initialised');
}

