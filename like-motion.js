const DOT_COLORS = ['#c57081', '#d89aa5', '#9ebbd4', '#b7cadd', '#d8a7b0', '#8eacc7'];
const MOTION_MS = 290;

export function setupLikeMotion(mount, feedback) {
  if (!mount) return;

  const activations = new Map();
  const effects = new Map();
  const pendingLikes = new Set();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function findLike(id) {
    if (!id) return null;
    const button = document.querySelector(`#${CSS.escape(id)} > .wl-card > .wl-head .wl-like`);
    return button && mount.contains(button) ? button : null;
  }

  function clearEffect(id) {
    const cleanup = effects.get(id);
    if (cleanup) cleanup();
  }

  function playEffect(id, button, liked) {
    clearEffect(id);
    const svg = button.querySelector(':scope > svg');
    const animations = [];
    const svgAnimation = svg?.animate?.(
      liked
        ? [
            { transform: 'scale(0.94)' },
            { transform: 'scale(1.18)', offset: 0.52 },
            { transform: 'scale(1)' },
          ]
        : [
            { transform: 'scale(0.94)' },
            { transform: 'scale(1)' },
          ],
      {
        duration: liked ? MOTION_MS : 150,
        easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)',
        fill: 'both',
      },
    );
    if (svgAnimation) animations.push(svgAnimation);

    const buttonRect = button.getBoundingClientRect();
    const svgRect = svg?.getBoundingClientRect();
    const hasCenter = buttonRect.width > 0 && buttonRect.height > 0 && svgRect?.width > 0 && svgRect?.height > 0;
    const centerX = hasCenter ? svgRect.left - buttonRect.left + svgRect.width / 2 : 0;
    const centerY = hasCenter ? svgRect.top - buttonRect.top + svgRect.height / 2 : 0;
    const decorations = [];

    if (liked && hasCenter) {
      const ring = document.createElement('span');
      ring.className = 'wall-like-ring';
      ring.style.left = `${centerX}px`;
      ring.style.top = `${centerY}px`;
      ring.setAttribute('aria-hidden', 'true');
      button.append(ring);
      decorations.push(ring);
      if (typeof ring.animate === 'function') {
        animations.push(ring.animate([
          { opacity: 0.72, transform: 'translate(-50%, -50%) scale(0.34)' },
          { opacity: 0.38, transform: 'translate(-50%, -50%) scale(1.16)', offset: 0.68 },
          { opacity: 0, transform: 'translate(-50%, -50%) scale(1.34)' },
        ], { duration: MOTION_MS, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)', fill: 'both' }));
      }

      for (let index = 0; index < DOT_COLORS.length; index += 1) {
        const dot = document.createElement('span');
        const angle = -90 + index * 60;
        dot.className = 'wall-like-dot';
        dot.style.left = `${centerX}px`;
        dot.style.top = `${centerY}px`;
        dot.style.setProperty('--wall-like-dot-color', DOT_COLORS[index]);
        dot.setAttribute('aria-hidden', 'true');
        button.append(dot);
        decorations.push(dot);
        if (typeof dot.animate === 'function') {
          animations.push(dot.animate([
            { opacity: 0.82, transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-15px) scale(0.55)` },
            { opacity: 0.55, transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-23px) scale(1)`, offset: 0.25 },
            { opacity: 0, transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-30px) scale(0.35)` },
          ], { duration: MOTION_MS, easing: 'cubic-bezier(0.18, 0.7, 0.3, 1)', fill: 'both' }));
        }
      }
    }

    let timer;
    const cleanup = () => {
      window.clearTimeout(timer);
      animations.forEach((animation) => animation.cancel());
      decorations.forEach((decoration) => decoration.remove());
      if (effects.get(id) === cleanup) effects.delete(id);
    };
    effects.set(id, cleanup);
    if (animations.length) {
      animations.at(-1).onfinish = cleanup;
      timer = window.setTimeout(cleanup, (liked ? MOTION_MS : 150) + 40);
    } else {
      cleanup();
    }
  }

  mount.addEventListener('click', (event) => {
    const button = event.target.closest('button.wl-like');
    const card = button?.closest('.wl-card-item[id]');
    if (!card || !mount.contains(card)) return;

    const now = performance.now();
    for (const [id, activation] of activations) {
      if (now - activation.time > 1200) activations.delete(id);
    }
    activations.set(card.id, { keyboard: event.detail === 0, time: now });
  }, true);

  document.addEventListener('waline:like-state', (event) => {
    const { id, phase, liked } = event.detail || {};
    if (typeof id !== 'string' || !['start', 'success', 'error'].includes(phase)) return;

    if (phase === 'start') {
      pendingLikes.add(id);
      clearEffect(id);
      if (feedback) feedback.textContent = '';
      const button = findLike(id);
      if (!button) return;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      const activation = activations.get(id);
      activations.delete(id);
      queueMicrotask(() => {
        const updatedButton = findLike(id);
        if (updatedButton && activation && !activation.keyboard && !reducedMotion.matches && typeof liked === 'boolean') {
          playEffect(id, updatedButton, liked);
        }
      });
      return;
    }

    pendingLikes.delete(id);
    const button = findLike(id);
    if (button) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
    if (phase === 'error') {
      clearEffect(id);
      if (feedback) feedback.textContent = '点赞未保存，请再试一次。';
    }
  });

  // Sorting can replace a card while its request is still running.
  new MutationObserver(() => {
    for (const id of pendingLikes) {
      const button = findLike(id);
      if (button) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
      }
    }
  }).observe(mount, { childList: true, subtree: true });
}
