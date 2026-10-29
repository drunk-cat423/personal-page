/* Apply before styles paint; keep the switch independent of page modules. */
(() => {
  'use strict';
  const key = 'lyw-theme';
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  let choice = readChoice();
  let button;

  function readChoice() {
    try {
      const value = localStorage.getItem(key);
      return value === 'light' || value === 'dark' ? value : null;
    } catch { return null; }
  }

  function apply() {
    const dark = (choice || (system.matches ? 'dark' : 'light')) === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    root.style.colorScheme = root.dataset.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#18232f' : '#fdfefe';
    if (!button) return;
    const label = dark ? '切换到浅色模式' : '切换到深色模式';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(dark));
    button.title = label;
    button.querySelector('[data-theme-icon="sun"]').toggleAttribute('hidden', !dark);
    button.querySelector('[data-theme-icon="moon"]').toggleAttribute('hidden', dark);
  }

  function mount() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    button = document.createElement('button');
    button.className = 'theme-toggle';
    button.type = 'button';
    button.innerHTML = '<svg class="theme-toggle-icon" data-theme-icon="sun" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg><svg class="theme-toggle-icon" data-theme-icon="moon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M20.6 14.1A8.8 8.8 0 0 1 9.9 3.4 8.8 8.8 0 1 0 20.6 14.1Z"/></svg>';
    button.addEventListener('click', () => {
      choice = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, choice); } catch { /* Switching still works without storage. */ }
      apply();
    });
    header.append(button);
    apply();
  }

  apply();
  system.addEventListener('change', () => { if (!choice) apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { choice = readChoice(); apply(); }
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) { choice = readChoice(); apply(); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
