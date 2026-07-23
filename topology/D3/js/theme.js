/**
 * theme.js — Phase 8
 *
 * §11.6 Theme mode toggle — switches `document.documentElement.dataset.theme`
 * between "dark" (default, §11.1's canonical dark surface) and "light" (the
 * reintroduced Canonical/Ubuntu light-mode palette). Every colour consumed by
 * layout.js/render.js/interaction.js/tooltip.js is a CSS var() reference
 * resolved against `:root[data-theme="…"]` in style.css, so flipping this one
 * attribute re-colours the entire SVG chart and HTML chrome with no
 * JS-side re-render — the browser's CSS cascade does all the work.
 *
 * Persistence: the chosen theme is stored in localStorage so it survives a
 * page reload. Falls back to "dark" (this project's default) if nothing is
 * stored yet, ignoring OS-level prefers-color-scheme — the toggle is the
 * single source of truth once a user has interacted with it.
 *
 * Exports: initThemeToggle(buttonSelector?)
 */

const STORAGE_KEY = 'topology-theme';
const DEFAULT_THEME = 'dark';

/**
 * initThemeToggle(buttonSelector = '#theme-toggle')
 * Applies the stored/default theme immediately, then wires the toggle
 * button's click handler. Safe to call once at page load.
 */
export function initThemeToggle(buttonSelector = '#theme-toggle') {
  const stored = safeGet(STORAGE_KEY);
  const initial = stored === 'light' || stored === 'dark' ? stored : DEFAULT_THEME;
  applyTheme(initial, buttonSelector);

  const btn = document.querySelector(buttonSelector);
  btn?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(next, buttonSelector);
    safeSet(STORAGE_KEY, next);
  });

  console.log(`[topology] Phase 8 theme toggle initialised — §11.6 (starting theme: ${initial})`);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function applyTheme(theme, buttonSelector) {
  document.documentElement.dataset.theme = theme;

  const btn = document.querySelector(buttonSelector);
  if (!btn) return;

  const icon = btn.querySelector('.theme-toggle-icon');
  // Icon shows the mode you'd SWITCH TO, matching common toggle UX; the
  // button is icon-only, so aria-label carries the equivalent text for
  // assistive tech.
  if (theme === 'dark') {
    if (icon) icon.textContent = '☀';
    btn.setAttribute('aria-label', 'Switch to light theme');
  } else {
    if (icon) icon.textContent = '☾';
    btn.setAttribute('aria-label', 'Switch to dark theme');
  }
  btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
}

/** localStorage can throw (privacy mode, disabled storage) — degrade quietly. */
function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

