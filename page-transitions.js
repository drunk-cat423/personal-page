/* Register before the first render: cross-document transitions can precede DOMContentLoaded. */
(() => {
  'use strict';
  const receiptKey = 'qingyu:wind-navigation:v1';
  const receiptLifetime = 15000;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const homeUrl = new URL('index.html', document.currentScript.src);
  const homeDirectory = new URL('.', homeUrl).pathname;
  const isHome = url => url.pathname === homeUrl.pathname || url.pathname === homeDirectory;
  let pending = null;
  let layer = null;
  let cleanupTimer = 0;
  let pendingTimer = 0;
  let activeTransition = null;
  let revealed = false;

  const route = (url) => `${url.origin}${url.pathname}${url.search}`;
  function clearReceipt() {
    try { sessionStorage.removeItem(receiptKey); } catch { /* Storage may be unavailable. */ }
  }
  function writeReceipt(receipt) {
    try { sessionStorage.setItem(receiptKey, JSON.stringify(receipt)); return true; } catch { return false; }
  }
  function takeReceipt() {
    let receipt;
    try { receipt = JSON.parse(sessionStorage.getItem(receiptKey)); } catch { /* Ignore invalid or blocked storage. */ }
    clearReceipt();
    const now = Date.now();
    const navigationEntry = performance.getEntriesByType('navigation')[0];
    const activation = window.navigation?.activation;
    if (!receipt || receipt.version !== 1 || !Number.isFinite(receipt.created) || now < receipt.created || now - receipt.created > receiptLifetime) return null;
    if (receipt.target !== route(new URL(location.href)) || location.hash || navigationEntry?.type === 'reload' || navigationEntry?.type === 'back_forward') return null;
    if (activation) {
      if (!['push', 'replace'].includes(activation.navigationType) || !activation.from || route(new URL(activation.from.url)) !== receipt.source) return null;
    } else if (!document.referrer || route(new URL(document.referrer)) !== receipt.source) return null;
    return receipt;
  }
  function cleanup() {
    clearTimeout(cleanupTimer);
    layer?.remove();
    layer = null;
    delete root.dataset.windTransition;
    delete root.dataset.windHome;
    document.querySelectorAll('[data-wind-pending]').forEach(link => link.removeAttribute('data-wind-pending'));
  }
  function resetPending() {
    clearTimeout(pendingTimer);
    pending = null;
    cleanup();
  }
  // Reuse one navigation seed so the outgoing and incoming leaf snapshots stay aligned.
  function createLeafLayout(seed = 0) {
    let state = seed >>> 0;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    return Array.from({ length: 5 }, (_, index) => [
      8 + index * 16 + random() * 10,
      19 + random() * 30,
      27 + random() * 12,
      -38 + random() * 72,
    ]);
  }
  function makeLeaves(renderer, seed, mode) {
    cleanup();
    layer = document.createElement('div');
    layer.className = 'wind-layer';
    layer.dataset.renderer = renderer;
    if (mode === 'home') root.dataset.windHome = '';
    layer.setAttribute('aria-hidden', 'true');
    createLeafLayout(seed).forEach(([left, top, size, angle], index) => {
      const leaf = document.createElement('span');
      leaf.className = 'wind-leaf';
      leaf.style.cssText = `left:${mode === 'home' ? 100 - left : left}%;top:clamp(112px,${top}vh,380px);width:clamp(24px,${size / 10}vw,${size}px);aspect-ratio:5/7;--leaf-angle:${angle}deg;--wind-x:clamp(160px,${24 + index * 2}vw,${300 + index * 20}px);--wind-y:${-32 - index * 8}px;--wind-turn:${46 + index * 8}deg;--wind-delay:${index * 55}ms`;
      if (renderer === 'native') leaf.style.viewTransitionName = `wind-leaf-${index + 1}`;
      leaf.innerHTML = '<svg viewBox="0 0 24 34" focusable="false"><path class="wind-leaf-shape" d="M19 3C9 3 2 11 4 19c1 5 5 7 9 4C20 18 21 10 19 3Z"/><path class="wind-leaf-vein" d="M3 30C8 23 13 14 18 5M8 22l-2-7M12 16l6-3"/></svg>';
      layer.append(leaf);
    });
    document.body.append(layer);
    // A rejected transition or a stalled navigation must never leave temporary UI behind.
    cleanupTimer = setTimeout(cleanup, 2100);
    return layer;
  }
  function enterWithWind(transition, seed, mode) {
    if (!document.body) return;
    if (!transition) {
      makeLeaves('dom', seed, mode);
      root.dataset.windTransition = 'enter';
      return;
    }
    const nativeLayer = makeLeaves('native', seed, mode);
    root.dataset.windTransition = 'native';
    activeTransition = transition;
    let nativeAnimation = true;
    // Named elements are painted through the native transition; hiding them also hides its live new image.
    transition.ready.catch(() => {
      if (layer !== nativeLayer || motion.matches) return;
      nativeAnimation = false;
      enterWithWind(null, seed, mode);
    });
    transition.finished.then(() => {
      if (nativeAnimation && layer === nativeLayer) cleanup();
      if (activeTransition === transition) activeTransition = null;
    }).catch(() => { if (layer === nativeLayer) cleanup(); });
  }
  function reveal(transition) {
    revealed = true;
    const receipt = takeReceipt();
    if (motion.matches) { transition?.skipTransition(); cleanup(); return; }
    if (receipt) enterWithWind(transition, receipt.leafSeed, receipt.mode);
  }

  // Observe the completed click dispatch without preventing or delaying the link's default action.
  window.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link || event.defaultPrevented) return;
    resetPending();
    clearReceipt();
    const destination = new URL(link.href, location.href);
    const target = link.target || document.querySelector('base[target]')?.target || '';
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || (target && target !== '_self') || link.hasAttribute('download') || destination.origin !== location.origin) return;
    const differentRoute = destination.pathname !== location.pathname;
    const returningHome = isHome(destination);
    const previewEntry = link.closest('.view-all') || (document.body.dataset.page === 'home' && link.closest('.article-title, .work-cover-link, .work-title'));
    pending = { skip: event.detail === 0 || Boolean(destination.hash) || !differentRoute || (returningHome && isHome(location)), target: route(destination), wind: false, mode: returningHome ? 'home' : 'section' };
    if (differentRoute && !pending.skip && !motion.matches && (link.closest('#site-nav') || previewEntry || returningHome)) {
      pending.leafSeed = Math.floor(Math.random() * 4294967296);
      pending.wind = writeReceipt({ version: 1, source: route(new URL(location.href)), target: pending.target, created: Date.now(), leafSeed: pending.leafSeed, mode: pending.mode });
      if (pending.wind) {
        link.setAttribute('data-wind-pending', '');
      }
    }
    pendingTimer = setTimeout(() => { clearReceipt(); resetPending(); }, receiptLifetime);
  });
  window.addEventListener('pageswap', (event) => {
    const transition = event.viewTransition;
    if (motion.matches || pending?.skip) { transition?.skipTransition(); return; }
    if (!pending?.wind || !transition) return;
    // Verify the actual destination as well as the observed click (e.g. another handler may redirect).
    if (!event.activation?.entry || route(new URL(event.activation.entry.url)) !== pending.target) { clearReceipt(); return; }
    makeLeaves('native', pending.leafSeed, pending.mode);
    root.dataset.windTransition = 'native';
    transition.ready.catch(() => {});
    transition.finished.then(cleanup).catch(cleanup);
  });
  window.addEventListener('pagereveal', event => reveal(event.viewTransition));
  function fallbackReveal() {
    requestAnimationFrame(() => { if (!revealed) reveal(null); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fallbackReveal, { once: true });
  else fallbackReveal();
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) { resetPending(); revealed = false; }
    fallbackReveal();
  });
  motion.addEventListener('change', () => {
    if (motion.matches) { activeTransition?.skipTransition(); clearReceipt(); resetPending(); }
  });
})();
