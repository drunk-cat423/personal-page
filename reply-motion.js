let nextTransitionId = 0;
let activeTransitionState = null;

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function restoreTransitionState(state) {
  if (state.restored) return;
  state.restored = true;
  for (const [card, previous] of state.cards) {
    if (previous.value) {
      card.style.setProperty('view-transition-name', previous.value, previous.priority);
    } else {
      card.style.removeProperty('view-transition-name');
    }
  }
  if (document.documentElement.dataset.replyTransition === state.id) {
    delete document.documentElement.dataset.replyTransition;
  }
}

export function transitionReplyLayout(update, event) {
  if (activeTransitionState) {
    const previous = activeTransitionState;
    activeTransitionState = null;
    try {
      previous.transition?.skipTransition();
    } catch {
      // A transition may already have completed between input events.
    }
    restoreTransitionState(previous);
  }

  const startTransition = document.startViewTransition;
  if (event?.detail === 0 || prefersReducedMotion() || typeof startTransition !== 'function') {
    update();
    return;
  }

  const cards = [...document.querySelectorAll('.waline-wall .wl-cards > .wl-card-item')];
  if (!cards.length) {
    update();
    return;
  }

  const id = String(++nextTransitionId);
  const state = {
    id,
    restored: false,
    transition: null,
    cards: cards.map((card) => [card, {
      value: card.style.getPropertyValue('view-transition-name'),
      priority: card.style.getPropertyPriority('view-transition-name'),
    }]),
  };
  document.documentElement.dataset.replyTransition = id;
  cards.forEach((card, index) => {
    card.style.setProperty('view-transition-name', `wall-reply-card-${id}-${index}`);
  });

  let updateCalled = false;
  let transition;
  try {
    transition = startTransition.call(document, () => {
      updateCalled = true;
      return update();
    });
  } catch {
    restoreTransitionState(state);
    if (!updateCalled) update();
    return;
  }

  state.transition = transition;
  transition.ready.catch(() => {});
  activeTransitionState = state;
  const cleanup = () => {
    if (activeTransitionState !== state) return;
    activeTransitionState = null;
    restoreTransitionState(state);
  };
  transition.finished.then(cleanup, cleanup);
}
