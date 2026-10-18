(() => {
  const DURATION = 24;
  const NS = 'http://www.w3.org/2000/svg';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const ease = value => {
    value = clamp(value);
    return value * value * (3 - 2 * value);
  };
  const mix = (from, to, amount) => from + (to - from) * amount;

  function startFigure(figure) {
    const svg = figure.querySelector('svg');
    const toggle = figure.querySelector('[data-animation-toggle]');
    const replay = figure.querySelector('[data-animation-replay]');
    if (!svg || !toggle || !replay) return;

    const get = id => svg.querySelector(`#${id}`);
    const history = get('history');
    const snapshot = get('snapshot');
    const summary = get('summary');
    const newHistory = get('new-history');
    const usageNumber = get('usage-number');
    const usageBar = get('usage-bar');
    const windowLabel = get('window-label');
    if (![history, snapshot, summary, newHistory, usageNumber, usageBar, windowLabel].every(Boolean)) return;

    const oldRows = Array.from(history.querySelectorAll(':scope > g'));
    const newRows = Array.from(newHistory.querySelectorAll(':scope > g'));
    let time = reducedMotion.matches ? 13 : 0;
    let playing = !reducedMotion.matches;
    let visible = false;
    let frameId = 0;
    let lastFrameTime = 0;

    function render(value) {
      time = clamp(value, 0, DURATION);
      const phase = time < 3 ? 0 : time < 9 ? 1 : time < 12 ? 2 : 3;
      const collapse = ease((time - 10.3) / 1.55);
      const count = Math.min(9, 3 + Math.floor(clamp((time - 3) / 5.4) * 6));

      oldRows.forEach((row, index) => {
        const enter = ease((time - (3 + (index - 3) * 0.9)) / 0.5);
        const shown = index < 3 || index < count;
        row.style.opacity = shown ? (1 - collapse) * (index < 3 ? 1 : enter) : 0;
        row.setAttribute('transform', `translate(${mix(0, 20, collapse)},${mix(0, -index * 33, collapse) + (index < 3 ? 0 : mix(10, 0, enter))}) scale(${mix(1, 0.93, collapse)})`);
      });
      history.style.opacity = time >= 12 ? 0 : 1;
      snapshot.style.opacity = time < 9 || time >= 12 ? 0 : 1 - collapse;
      summary.style.opacity = ease((time - 10.8) / 1.15);
      summary.setAttribute('transform', `translate(0,${mix(24, 0, ease((time - 10.8) / 1.15))})`);

      const postCount = time < 12 ? 0 : Math.min(6, 1 + Math.floor((time - 12) / 1.4));
      newRows.forEach((row, index) => {
        const enter = ease((time - (12 + index * 1.4)) / 0.55);
        row.style.opacity = index < postCount ? enter : 0;
        row.setAttribute('transform', `translate(0,${mix(12, 0, enter)})`);
      });
      const growth = time < 3 ? 0 : clamp((time - 3) / 5.4);
      const usage = time < 9 ? mix(28, 85, growth) : time < 10.3 ? 85 : time < 12 ? mix(85, 18, collapse) : 18 + postCount * 6;
      const roundedUsage = Math.round(usage);
      usageNumber.replaceChildren(document.createTextNode(String(roundedUsage)), svg.ownerDocument.createElementNS(NS, 'tspan'));
      usageNumber.lastElementChild.setAttribute('font-size', '22');
      usageNumber.lastElementChild.textContent = '%';
      const height = 228 * usage / 100;
      usageBar.setAttribute('y', String(539 - height));
      usageBar.setAttribute('height', String(height));
      usageBar.setAttribute('fill', phase === 2 ? '#c6a075' : 'url(#ink)');
      usageNumber.setAttribute('fill', phase === 2 ? '#b38c5f' : '#477798');
      windowLabel.textContent = phase === 2 ? '快照固定 · 正在整理' : phase === 3 ? '摘要在前 · 新消息继续追加' : '持续追加';

      figure.dataset.time = time.toFixed(2);
      figure.dataset.phase = String(phase);
      figure.dataset.usage = String(roundedUsage);
    }

    function syncButton() {
      toggle.textContent = playing ? '暂停' : '播放';
      toggle.setAttribute('aria-label', playing ? '暂停动画' : '播放动画');
    }

    function shouldAnimate() {
      return visible && playing && !document.hidden;
    }

    function stopFrame() {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
      lastFrameTime = 0;
    }

    function scheduleFrame() {
      if (!shouldAnimate() || frameId) return;
      frameId = requestAnimationFrame(onFrame);
    }

    function onFrame(now) {
      frameId = 0;
      if (!shouldAnimate()) return;
      if (lastFrameTime) time = (time + (now - lastFrameTime) / 1000) % DURATION;
      lastFrameTime = now;
      render(time);
      scheduleFrame();
    }

    toggle.addEventListener('click', () => {
      if (!playing && time >= DURATION) time = 0;
      playing = !playing;
      syncButton();
      if (playing) scheduleFrame();
      else stopFrame();
    });

    replay.addEventListener('click', () => {
      time = 0;
      playing = true;
      render(time);
      syncButton();
      scheduleFrame();
    });

    function onVisibilityChange() {
      if (shouldAnimate()) scheduleFrame();
      else stopFrame();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target !== figure) continue;
        visible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
      }
      onVisibilityChange();
    }, { threshold: 0.15 });
    observer.observe(figure);

    function onMotionPreferenceChange(event) {
      if (event.matches) {
        playing = false;
        render(13);
        stopFrame();
      }
      syncButton();
      onVisibilityChange();
    }
    reducedMotion.addEventListener('change', onMotionPreferenceChange);

    render(time);
    syncButton();
    toggle.hidden = false;
    replay.hidden = false;
  }

  document.querySelectorAll('figure[data-context-animation]').forEach(startFigure);
})();
