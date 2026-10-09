import { isLocalWalineTrial, resolveWalineServerURL } from './waline-config.js';
import { transitionReplyLayout } from './reply-motion.js';
import { setupLikeMotion } from './like-motion.js';

if (document.readyState === 'loading') {
  await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

const host = document.querySelector('#waline-area');
const mount = document.querySelector('#waline');
const status = document.querySelector('[data-waline-status]');
const statusMessage = document.querySelector('[data-waline-message]');
const retryButton = document.querySelector('[data-waline-retry]');
const localNote = document.querySelector('[data-local-trial]');
const writeButton = document.querySelector('[data-open-note]');
const chromeTemplate = document.querySelector('#note-composer-chrome');
const feedback = document.querySelector('#wall-feedback');
const loadingSkeleton = document.querySelector('[data-waline-loading]');

// Keep Vue's form in its original parent; the browser popover supplies the top layer.
function setupNoteWall(initialRootCount, readRootCount) {
  if (!writeButton || !chromeTemplate) return;
  setupLikeMotion(mount, feedback);
  const decorated = new WeakSet();
  const states = new Map();
  let serial = 0;
  let replyRequest = null;
  let rootCount = initialRootCount;
  let nativeCountText = null;
  let countPending = false;
  let countDirty = false;
  const expandedReplies = new Map();
  let initialContentShown = false;

  async function refreshRootCount() {
    countDirty = true;
    if (countPending) return;
    countPending = true;
    try {
      while (countDirty) {
        countDirty = false;
        rootCount = await readRootCount();
        const label = mount.querySelector('.wall-root-count');
        if (label) label.textContent = `${rootCount} 条留言`;
      }
    } catch {
      // Keep the last confirmed count when the service cannot be reached.
    } finally {
      countPending = false;
    }
  }

  function reconcileWall() {
    if (!initialContentShown) {
      const widget = mount.querySelector('[data-waline]');
      const ready = widget && !widget.querySelector(':scope > .wl-loading') &&
        widget.querySelector('.wl-cards > .wl-card-item, :scope > .wl-empty, :scope > .wl-operation');
      if (ready) {
        initialContentShown = true;
        if (loadingSkeleton) loadingSkeleton.hidden = true;
        mount.setAttribute('aria-busy', 'false');
        mount.classList.add('content-ready');
      }
    }
    const nativeCount = mount.querySelector('.wl-count');
    if (nativeCount) {
      let label = mount.querySelector('.wall-root-count');
      if (!label) {
        label = document.createElement('span');
        label.className = 'wall-root-count';
        label.setAttribute('aria-live', 'polite');
        label.textContent = `${rootCount} 条留言`;
        nativeCount.before(label);
      }
      const text = nativeCount.textContent;
      if (nativeCountText !== null && text !== nativeCountText) refreshRootCount();
      nativeCountText = text;
    }
    for (const card of mount.querySelectorAll('.wl-cards > .wl-card-item')) {
      const quote = card.querySelector(':scope > .wl-card > .wl-quote');
      if (!quote) continue;
      const replies = quote.querySelectorAll(':scope > .wl-card-item');
      let toggle = card.querySelector(':scope > .wl-card > .wall-replies-toggle');
      if (replies.length > 1 && !toggle) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'wall-replies-toggle';
        quote.id ||= `note-replies-${card.id}`;
        toggle.setAttribute('aria-controls', quote.id);
        toggle.addEventListener('click', (event) => {
          transitionReplyLayout(() => {
            expandedReplies.set(card.id, !expandedReplies.get(card.id));
            reconcileWall();
          }, event);
        });
        quote.after(toggle);
      }
      const expanded = expandedReplies.get(card.id) === true;
      quote.dataset.repliesCollapsed = String(replies.length > 1 && !expanded);
      if (toggle) {
        toggle.hidden = replies.length <= 1;
        toggle.setAttribute('aria-expanded', String(expanded));
        const text = expanded ? '收起回复' : `展开其余 ${replies.length - 1} 条回复`;
        if (toggle.textContent !== text) toggle.textContent = text;
      }
    }
  }

  function syncExpanded() {
    writeButton.setAttribute('aria-expanded', String(Boolean(mount.querySelector('.note-composer:popover-open'))));
  }

  function decorate(panel) {
    if (decorated.has(panel)) return;
    decorated.add(panel);
    const chrome = chromeTemplate.content.firstElementChild.cloneNode(true);
    const heading = chrome.querySelector('h2');
    const context = chrome.querySelector('[data-compose-context]');
    const closeButton = chrome.querySelector('[data-close-note]');
    const cancelReply = chrome.querySelector('[data-cancel-reply]');
    const id = `note-composer-${++serial}`;
    panel.id = id;
    panel.classList.add('note-composer');
    panel.setAttribute('popover', 'auto');
    panel.setAttribute('role', 'dialog');
    heading.id = `${id}-title`;
    panel.setAttribute('aria-labelledby', heading.id);
    panel.prepend(chrome);
    const state = { opener: writeButton, returnFocus: false, attempt: null };
    states.set(panel, state);
    closeButton.popoverTargetElement = panel;
    closeButton.popoverTargetAction = 'hide';
    closeButton.addEventListener('click', (event) => {
      state.returnFocus = true;
      panel.dataset.keyboardOpen = String(event.detail === 0);
    });
    cancelReply.addEventListener('click', () => {
      // Use Waline's own cancellation to clear the reply target.
      panel.parentElement.querySelector(':scope > .wl-close')?.click();
      writeButton.focus({ preventScroll: true });
    });
    panel.addEventListener('beforetoggle', (event) => {
      if (event.newState !== 'open') return;
      const card = panel.closest('.wl-card-item');
      const author = card?.querySelector('.wl-head .wl-nick')?.textContent.trim();
      context.textContent = author ? `回应 ${author} 的便签` : '把今天的一句话，轻轻贴在这里。';
      cancelReply.hidden = !card;
      state.returnFocus = false;
    });
    panel.addEventListener('toggle', (event) => {
      syncExpanded();
      if (event.newState === 'open') {
        const nick = panel.querySelector('.wl-header input');
        const editor = panel.querySelector('.wl-editor');
        (nick?.value.trim() ? editor : nick)?.focus({ preventScroll: true });
      } else if (state.returnFocus) {
        (state.opener?.isConnected ? state.opener : writeButton).focus({ preventScroll: true });
      }
    });
  }

  function reconcile() {
    reconcileWall();
    const panels = [...mount.querySelectorAll('.wl-panel')];
    panels.forEach(decorate);
    const panel = panels.at(-1);
    if (panel) {
      writeButton.textContent = panel.closest('.wl-card-item') ? '继续回应' : '写一张便签';
      writeButton.popoverTargetElement = panel;
      writeButton.popoverTargetAction = 'show';
      writeButton.disabled = false;
    }
    if (replyRequest && panel?.closest('.wl-card-item')) {
      const state = states.get(panel);
      state.opener = replyRequest.source;
      panel.dataset.keyboardOpen = String(replyRequest.keyboard);
      replyRequest = null;
      panel.showPopover({ source: state.opener });
    }
    for (const [current, state] of states) {
      if (!current.isConnected) {
        states.delete(current);
        continue;
      }
      if (!state.attempt) continue;
      const submit = current.querySelector('.primary.wl-btn');
      const editor = current.querySelector('.wl-editor');
      if (submit?.disabled) state.attempt.started = true;
      if (!submit?.disabled && state.attempt.started) {
        const attempt = state.attempt;
        const saved = [...mount.querySelectorAll('.wl-card-item[id]')].some((item) => !attempt.ids.has(item.id));
        state.attempt = null;
        if (!attempt.edited && saved && editor?.value === '') {
          if (feedback) feedback.textContent = '便签已保存。';
          state.returnFocus = true;
          if (current.matches(':popover-open')) current.hidePopover();
        }
      }
    }
    syncExpanded();
  }

  function beginAttempt(panel) {
    if (!panel || !states.has(panel) || !panel.querySelector('.wl-editor')?.value.trim()) return;
    states.get(panel).attempt = {
      started: false,
      ids: new Set([...mount.querySelectorAll('.wl-card-item[id]')].map((item) => item.id)),
    };
    if (feedback) feedback.textContent = '';
  }

  writeButton.addEventListener('click', (event) => {
    const panel = writeButton.popoverTargetElement;
    if (!panel || !states.has(panel)) return;
    states.get(panel).opener = writeButton;
    panel.dataset.keyboardOpen = String(event.detail === 0);
  });
  mount.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button?.matches('.wl-reply') && button.title === '回应') {
      replyRequest = { source: button, keyboard: event.detail === 0 };
    }
    if (button?.matches('.primary.wl-btn')) beginAttempt(button.closest('.wl-panel'));
  }, true);
  mount.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    const panel = event.target.closest('.note-composer');
    if (event.key === 'Escape' && panel) {
      states.get(panel).returnFocus = true;
      panel.dataset.keyboardOpen = 'true';
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) beginAttempt(panel);
  }, true);
  mount.addEventListener('input', (event) => {
    const state = states.get(event.target.closest('.note-composer'));
    if (state?.attempt && event.target.matches('.wl-editor')) state.attempt.edited = true;
  }, true);
  const observer = new MutationObserver(reconcile);
  observer.observe(mount, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled'] });
  reconcile();
}

if (host && mount && status && statusMessage && retryButton) {
  let pending = false;
  let initialized = false;
  let clientModule;

  function showStatus(message, retryable = false) {
    statusMessage.textContent = message;
    status.hidden = false;
    retryButton.hidden = !retryable;
  }

  function stopLoading() {
    if (loadingSkeleton) loadingSkeleton.hidden = true;
    mount.setAttribute('aria-busy', 'false');
  }

  async function probeServer(baseURL) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    const query = new URLSearchParams({
      path: '/guestbook',
      page: '1',
      pageSize: '1',
      sortBy: 'insertedAt_desc',
      lang: 'zh-CN',
    });
    try {
      const response = await fetch(`${baseURL}/api/comment?${query}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Waline API returned ${response.status}`);
      const result = await response.json();
      if (result?.errno !== 0 || !Array.isArray(result.data?.data)) {
        throw new Error('Waline comment API returned an unexpected response');
      }
      if (result.data.pageSize !== 1 || !Number.isInteger(result.data.totalPages)) {
        throw new Error('Waline root pagination metadata is unavailable');
      }
      return result.data.count === 0 ? 0 : result.data.totalPages;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function connect() {
    if (pending || initialized) return;
    const baseURL = resolveWalineServerURL();
    const localTrial = isLocalWalineTrial();
    if (localNote) localNote.hidden = !localTrial;
    if (!baseURL) {
      stopLoading();
      showStatus('留言服务尚未配置。');
      return;
    }

    pending = true;
    if (loadingSkeleton) loadingSkeleton.hidden = false;
    mount.setAttribute('aria-busy', 'true');
    retryButton.hidden = true;
    showStatus('正在连接留言服务…');
    try {
      const rootCount = await probeServer(baseURL);
      clientModule ??= await import('./assets/vendor/waline/waline.js');
      mount.replaceChildren();
      const instance = clientModule.init({
        el: mount,
        serverURL: baseURL,
        path: '/guestbook',
        lang: 'zh-CN',
        meta: ['nick'],
        requiredMeta: ['nick'],
        login: 'disable',
        wordLimit: 1000,
        pageSize: 6,
        emoji: false,
        imageUploader: false,
        search: false,
        noRss: true,
        locale: {
          nick: '怎么称呼你',
          placeholder: '在这里写下留言…',
          comment: '条留言',
          submit: '贴上便签',
          reply: '回应',
          sofa: '这里还有空白，来贴第一张便签吧。',
        },
      });
      if (!instance) throw new Error('Waline did not return a mounted instance');
      setupNoteWall(rootCount, () => probeServer(baseURL));
      initialized = true;
      status.hidden = true;
    } catch {
      stopLoading();
      mount.replaceChildren();
      showStatus(
        localTrial ? '留言服务未连接，请启动本机留言服务后重试。' : '留言服务未连接，请稍后重试。',
        true,
      );
    } finally {
      pending = false;
    }
  }

  retryButton.addEventListener('click', connect);
  connect();
}
