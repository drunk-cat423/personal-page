(() => {
  'use strict';

  const definitions = [
    ['ease', 'ease-in-out', '缓动', '先慢、再快、再慢；与匀速小球同时出发、同时到达。'],
    ['spring', 'spring', '弹簧', '越过目标后回弹；阻尼越大，来回振荡越少。竖线标出目标位置。'],
    ['stagger', 'stagger', '依次错开', '动作相同，只把开始时间依次推迟：下排每项间隔 160 ms。'],
    ['parallax', 'parallax', '视差', '拖动模拟滚动滑块：同一滚动量，近景移动多、远景移动少。'],
    ['scroll', 'scroll-triggered', '滚动触发', '拖动模拟滚动滑块：卡片顶边越过虚线才入场；向回拖动可再次触发。'],
    ['layout', 'layout animation', '布局动画', '在四列和两列之间切换，观察同一组元素的位置和尺寸一起变化。'],
    ['shared', 'shared element', '共享元素', '同一个封面在列表与详情两个状态之间连续移动、缩放并改变圆角。'],
    ['marquee', 'marquee', '跑马灯', '两份相同内容首尾衔接，以恒定速度连续循环；可暂停观察。'],
    ['micro', 'micro-interaction', '微交互', '点击保存，观察按压、处理中和成功反馈。仅本地演示，不写入数据。']
  ];
  const springPosition = (seconds, damping) => {
    const naturalFrequency = 12;
    const ratio = Math.sqrt(1 - damping * damping);
    return 1 - Math.exp(-damping * naturalFrequency * seconds) *
      (Math.cos(naturalFrequency * ratio * seconds) + damping / ratio * Math.sin(naturalFrequency * ratio * seconds));
  };

  document.querySelectorAll('[data-motion-vocabulary]').forEach(init);

  function init(root) {
    if (root.dataset.mvReady) return;
    root.dataset.mvReady = 'true';
    const q = selector => root.querySelector(selector);
    const scene = q('[data-mv-scene]');
    const playButton = q('[data-mv-play]');
    const pauseButton = q('[data-mv-pause]');
    const slider = q('[data-mv-scroll]');
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const events = new AbortController();
    const animations = new Set();
    let current = 'ease';
    let speed = 1;
    let reduced = preference.matches;
    let direction = false;
    let scrollValue = 0;
    let userPaused = false;
    let destroyed = false;
    let pageSuspended = false;
    let inView = root.getBoundingClientRect().bottom > 0 && root.getBoundingClientRect().top < innerHeight;
    let runner = null;
    let frameId = 0;
    let lastTime = null;
    let sceneWidth = scene.clientWidth;
    let marqueeWidth = 0;

    const on = (element, name, callback) => element.addEventListener(name, callback, { signal: events.signal });
    const canRun = () => !destroyed && inView && !document.hidden && !pageSuspended && !userPaused;

    function syncPlayback() {
      if (destroyed) return;
      animations.forEach(animation => {
        if (animation.playState === 'finished' || animation.playState === 'idle') return;
        if (canRun()) animation.play(); else animation.pause();
      });
      cancelAnimationFrame(frameId);
      frameId = 0;
      lastTime = null;
      if (runner && canRun()) frameId = requestAnimationFrame(tick);
    }

    function tick(now) {
      frameId = 0;
      if (!runner || !canRun()) return;
      const active = runner;
      if (lastTime !== null) active.elapsed += (now - lastTime) * speed;
      lastTime = now;
      const progress = Math.min(1, active.elapsed / active.duration);
      active.draw(progress);
      if (runner !== active) return;
      if (progress === 1) {
        runner = null;
        lastTime = null;
        if (active.done) active.done();
      } else frameId = requestAnimationFrame(tick);
    }

    function stopTimeline() {
      cancelAnimationFrame(frameId);
      frameId = 0;
      runner = null;
      lastTime = null;
    }

    function clearMotion() {
      stopTimeline();
      animations.forEach(animation => animation.cancel());
      animations.clear();
    }

    function timeline(duration, draw, done) {
      stopTimeline();
      runner = { duration: reduced ? Math.min(duration, 350) : duration, elapsed: 0, draw, done };
      draw(0);
      syncPlayback();
    }

    function animate(element, frames, options) {
      // Keep the final state in ordinary styles, so completed animations can be released.
      const finalFrame = frames[frames.length - 1];
      Object.entries(finalFrame).forEach(([key, value]) => {
        if (!['offset', 'easing', 'composite'].includes(key)) element.style[key] = value;
      });
      const animation = element.animate(frames, {
        fill: 'backwards', ...options,
        duration: reduced ? Math.min(options.duration, 350) : options.duration,
        delay: reduced ? 0 : (options.delay || 0)
      });
      animation.playbackRate = speed;
      animations.add(animation);
      animation.onfinish = () => { animations.delete(animation); animation.cancel(); };
      if (!canRun()) animation.pause();
      return animation;
    }

    function lane(label, name, secondary = false, target = false) {
      return `<div class="mv-lane"><span>${label}</span><div class="mv-track" data-mv-track="${name}">${target ? '<span class="mv-target"></span>' : ''}<span class="mv-dot${secondary ? ' mv-secondary' : ''}"></span></div></div>`;
    }

    function render() {
      if (current === 'ease') scene.innerHTML = lane('匀速 linear', 'linear', true) + lane('缓动 ease-in-out', 'eased') + '<div class="mv-endpoints"><span>起点</span><span>终点 · 同为 2 秒</span></div>';
      if (current === 'spring') scene.innerHTML = lane('低阻尼 · 回弹明显', 'bouncy', false, true) + lane('高阻尼 · 更快稳定', 'damped', true, true);
      if (current === 'stagger') scene.innerHTML = ['同时开始', '依次延迟 160 ms'].map((label, row) => `<div class="mv-lane"><span>${label}</span><div class="mv-items" data-mv-row="${row}">${[1, 2, 3, 4, 5].map(number => `<span class="mv-item">${number}</span>`).join('')}</div></div>`).join('');
      if (current === 'parallax') scene.innerHTML = '<div class="mv-landscape"><div class="mv-layer mv-far" data-mv-layer="0.2"><div class="mv-sun"></div><div class="mv-mountain"></div><span class="mv-layer-label">远景 ×0.2</span></div><div class="mv-layer mv-mid" data-mv-layer="0.5"><div class="mv-mountain"></div><span class="mv-layer-label">中景 ×0.5</span></div><div class="mv-layer mv-near" data-mv-layer="1"><div class="mv-mountain"></div><span class="mv-layer-label">近景 ×1.0</span></div></div>';
      if (current === 'scroll') scene.innerHTML = '<div class="mv-scroll-window"><div class="mv-scroll-page"><div class="mv-content-block">上方内容</div><div class="mv-content-block">继续向下</div><div class="mv-reveal" data-mv-reveal>越过触发线 · 动画入场</div></div><div class="mv-trigger"><span>触发线</span></div><span class="mv-scroll-status" aria-live="polite">等待越线</span></div>';
      if (current === 'layout') scene.innerHTML = '<div class="mv-state-label"><span>4 列 ⇄ 2 列</span><span>位置 + 尺寸</span></div><div class="mv-layout">' + [1, 2, 3, 4].map(number => `<span class="mv-item">${number}</span>`).join('') + '</div>';
      if (current === 'shared') scene.innerHTML = '<div class="mv-state-label"><span>列表</span><span>详情</span></div><div class="mv-share-origin" aria-hidden="true"></div><div class="mv-share-dest" aria-hidden="true"></div><div class="mv-cover">封面</div><span class="mv-share-caption">同一个封面</span>';
      if (current === 'marquee') scene.innerHTML = '<div class="mv-state-label"><span>连续循环</span><span>← 匀速移动</span></div><div class="mv-marquee-window"><div class="mv-marquee-belt"><div class="mv-marquee-copy"></div><div class="mv-marquee-copy" aria-hidden="true"></div></div></div>';
      if (current === 'micro') {
        scene.innerHTML = '<div class="mv-micro"><button type="button" class="mv-button mv-primary" data-mv-save>点击保存</button><span class="mv-feedback" aria-live="polite">等待点击</span></div>';
      }
    }

    function select(id) {
      clearMotion();
      current = id;
      direction = false;
      userPaused = false;
      scrollValue = 0;
      const definition = definitions.find(item => item[0] === id);
      q('[data-mv-title]').textContent = `${definition[1]} · ${definition[2]}`;
      q('[data-mv-count]').textContent = `${definitions.indexOf(definition) + 1} / 9`;
      q('[data-mv-detail]').textContent = definition[3];
      q('[data-mv-choices]').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mvEffect === id)));
      q('[data-mv-scroll-controls]').hidden = !['parallax', 'scroll'].includes(id);
      playButton.hidden = id === 'micro';
      playButton.textContent = ['layout', 'shared'].includes(id) ? '切换状态' : '重播动画';
      if (['layout', 'shared'].includes(id)) playButton.setAttribute('aria-pressed', 'false');
      else playButton.removeAttribute('aria-pressed');
      pauseButton.hidden = id !== 'marquee';
      pauseButton.textContent = reduced ? '继续' : '暂停';
      render();
      if (id === 'shared') positionCover();
      if (['parallax', 'scroll'].includes(id)) setScroll(0, false);
      if (id === 'marquee') buildMarquee();
      if (reduced) {
        rest();
      } else if (!['layout', 'shared', 'micro'].includes(id)) play(false);
    }

    function rest() {
      if (current === 'ease') scene.querySelectorAll('.mv-track').forEach(track => { track.querySelector('.mv-dot').style.transform = `translateX(${track.clientWidth - 36}px)`; });
      if (current === 'spring') drawSpring(1, true);
      if (current === 'marquee') { userPaused = true; pauseButton.textContent = '继续'; }
    }

    function drawSpring(progress, settled = false) {
      ['bouncy', 'damped'].forEach((name, index) => {
        const track = q(`[data-mv-track="${name}"]`);
        // Target at 58% leaves room for the low-damping overshoot, including on mobile.
        const travel = track.clientWidth * .58 - 18;
        const position = settled || progress === 1 ? 1 : reduced ? progress : springPosition(progress * 3.6, index ? .75 : .22);
        track.querySelector('.mv-dot').style.transform = `translateX(${travel * position}px)`;
      });
    }

    function setScroll(value, allowMotion = true) {
      scrollValue = Math.max(0, Math.min(100, value));
      slider.value = String(scrollValue);
      q('[data-mv-scroll-value]').textContent = `${Math.round(scrollValue)}%`;
      if (current === 'parallax') scene.querySelectorAll('[data-mv-layer]').forEach(layer => { layer.style.transform = `translateY(${-scrollValue * Number(layer.dataset.mvLayer)}px)`; });
      if (current !== 'scroll') return;
      const page = q('.mv-scroll-page');
      const reveal = q('[data-mv-reveal]');
      const shift = scrollValue * 1.65;
      page.style.transform = `translateY(${-shift}px)`;
      const hit = page.offsetTop + reveal.offsetTop - shift <= q('.mv-trigger').offsetTop;
      const previous = reveal.dataset.hit === 'true';
      reveal.dataset.hit = String(hit);
      q('.mv-scroll-status').textContent = hit ? '已越线 · 入场' : '等待越线';
      if (!hit) {
        animations.forEach(animation => animation.cancel());
        animations.clear();
        reveal.style.opacity = '0';
        reveal.style.transform = 'none';
      } else if (!previous) {
        if (allowMotion) animate(reveal, [{ opacity: 0, transform: reduced ? 'none' : 'translateY(22px)' }, { opacity: 1, transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)' });
        else reveal.style.opacity = '1';
      }
    }

    function flip(toggle) {
      const container = q('.mv-layout');
      const items = [...container.children];
      const before = items.map(element => element.getBoundingClientRect());
      clearMotion();
      if (toggle) direction = !direction;
      playButton.setAttribute('aria-pressed', String(direction));
      container.classList.toggle('is-expanded', direction);
      items.forEach((element, index) => {
        const after = element.getBoundingClientRect();
        const first = before[index];
        animate(element, [{ transform: `translate(${first.left - after.left}px,${first.top - after.top}px) scale(${first.width / after.width},${first.height / after.height})` }, { transform: 'none' }], { duration: 900, easing: 'cubic-bezier(.4,0,.2,1)' });
      });
    }

    function coverTarget() {
      const anchor = q(direction ? '.mv-share-dest' : '.mv-share-origin');
      return { left: `${anchor.offsetLeft}px`, top: `${anchor.offsetTop}px`, width: `${anchor.offsetWidth}px`, height: `${anchor.offsetHeight}px`, borderRadius: direction ? '5px' : '12px' };
    }

    function positionCover() { Object.assign(q('.mv-cover').style, coverTarget()); }

    function shared(toggle) {
      const cover = q('.mv-cover');
      const before = cover.getBoundingClientRect();
      const bounds = scene.getBoundingClientRect();
      const previous = { left: `${before.left - bounds.left - scene.clientLeft}px`, top: `${before.top - bounds.top - scene.clientTop}px`, width: `${before.width}px`, height: `${before.height}px`, borderRadius: getComputedStyle(cover).borderRadius };
      clearMotion();
      if (toggle) direction = !direction;
      playButton.setAttribute('aria-pressed', String(direction));
      animate(cover, [previous, coverTarget()], { duration: 1050, easing: 'cubic-bezier(.4,0,.2,1)' });
    }

    function buildMarquee() {
      const copies = scene.querySelectorAll('.mv-marquee-copy');
      const words = '<span class="mv-word">DESIGN</span><span class="mv-word">MOTION</span><span class="mv-word">HELLO</span><span class="mv-word">动起来</span>';
      copies[0].innerHTML = words;
      const baseWidth = copies[0].getBoundingClientRect().width;
      // Hidden instances have no geometry yet; ResizeObserver will build them when shown.
      if (!baseWidth || !scene.clientWidth) { marqueeWidth = 0; return; }
      const repetitions = Math.ceil((scene.clientWidth + 140) / baseWidth);
      for (let index = 1; index < repetitions; index++) copies[0].insertAdjacentHTML('beforeend', words);
      copies[1].innerHTML = copies[0].innerHTML;
      marqueeWidth = copies[0].getBoundingClientRect().width;
    }

    function runMarquee() {
      if (!marqueeWidth) return;
      const belt = q('.mv-marquee-belt');
      const distance = reduced ? Math.min(marqueeWidth, 60) : marqueeWidth;
      // The two copies have identical widths, including their trailing gap.
      const animation = animate(belt, [{ transform: 'translateX(0)' }, { transform: `translateX(${-distance}px)` }], { duration: marqueeWidth / 60 * 1000, iterations: reduced ? 1 : Infinity, easing: 'linear' });
      if (!reduced) belt.style.transform = 'none';
      if (reduced) animation.onfinish = () => { animations.delete(animation); animation.cancel(); userPaused = true; pauseButton.textContent = '继续'; };
    }

    function play(explicit = true) {
      if (current === 'layout') { flip(true); return; }
      if (current === 'shared') { shared(true); return; }
      clearMotion();
      userPaused = false;
      if (current === 'ease') {
        scene.querySelectorAll('.mv-track').forEach((track, index) => animate(track.querySelector('.mv-dot'), [{ transform: 'translateX(0)' }, { transform: `translateX(${track.clientWidth - 36}px)` }], { duration: 2000, easing: index ? 'ease-in-out' : 'linear' }));
      }
      if (current === 'spring') timeline(3600, progress => drawSpring(progress));
      if (current === 'stagger') scene.querySelectorAll('[data-mv-row]').forEach((row, rowIndex) => [...row.children].forEach((element, index) => animate(element, [{ opacity: 0, transform: reduced ? 'none' : 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { duration: 650, delay: rowIndex * index * 160, easing: 'cubic-bezier(.2,.8,.2,1)' })));
      if (['parallax', 'scroll'].includes(current)) {
        setScroll(0, false);
        if (!reduced || explicit) timeline(5200, progress => setScroll(progress * 100));
      }
      if (current === 'marquee') {
        buildMarquee();
        runMarquee();
        pauseButton.textContent = '暂停';
      }
    }

    function save() {
      clearMotion();
      const button = q('[data-mv-save]');
      const feedback = q('.mv-feedback');
      button.disabled = true;
      button.textContent = '保存中…';
      feedback.textContent = '正在处理';
      animate(button, [{ transform: 'scale(1)' }, { transform: reduced ? 'scale(1)' : 'scale(.93)' }, { transform: 'scale(1)' }], { duration: 240 });
      timeline(700, () => {}, () => {
        button.disabled = false;
        button.textContent = '已保存 ✓';
        feedback.textContent = '保存成功 · 仅本地演示';
        animate(feedback, [{ opacity: .25, transform: reduced ? 'none' : 'translateY(7px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'ease-out' });
      });
    }

    const choices = q('[data-mv-choices]');
    definitions.forEach(definition => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mv-button';
      button.dataset.mvEffect = definition[0];
      button.textContent = definition[1];
      on(button, 'click', () => select(definition[0]));
      choices.append(button);
    });
    choices.hidden = false;
    q('[data-mv-controls]').hidden = false;
    q('[data-mv-motion-note]').hidden = !reduced;
    on(playButton, 'click', () => play());
    on(scene, 'click', event => {
      if (current === 'micro' && event.target.closest('[data-mv-save]') && !q('[data-mv-save]').disabled) save();
    });
    on(q('[data-mv-speed]'), 'change', event => {
      speed = Number(event.target.value);
      animations.forEach(animation => animation.updatePlaybackRate(speed));
    });
    on(slider, 'input', event => {
      stopTimeline();
      setScroll(Number(event.target.value));
    });
    on(pauseButton, 'click', () => {
      if (userPaused && !animations.size) { play(); return; }
      userPaused = !userPaused;
      pauseButton.textContent = userPaused ? '继续' : '暂停';
      syncPlayback();
    });
    on(document, 'visibilitychange', syncPlayback);
    on(window, 'pagehide', event => { if (event.persisted) { pageSuspended = true; syncPlayback(); } else destroy(); });
    on(window, 'pageshow', () => { pageSuspended = false; syncPlayback(); });
    on(preference, 'change', event => {
      reduced = event.matches;
      q('[data-mv-motion-note]').hidden = !reduced;
      clearMotion();
      if (current === 'shared') positionCover();
      else if (current === 'micro') { const button = q('[data-mv-save]'); button.disabled = false; button.textContent = '点击保存'; q('.mv-feedback').textContent = '等待点击'; }
      else if (['scroll', 'parallax'].includes(current)) setScroll(scrollValue, false);
      if (reduced) rest();
      else if (current === 'marquee') play(false);
    });
    const visibility = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; syncPlayback(); }, { threshold: 0 });
    visibility.observe(root);
    const resize = new ResizeObserver(() => {
      if (destroyed || scene.clientWidth === sceneWidth) return;
      sceneWidth = scene.clientWidth;
      if (current === 'shared') shared(false);
      if (current === 'layout') flip(false);
      if (current === 'spring') drawSpring(runner ? runner.elapsed / runner.duration : 1, !runner);
      if (current === 'ease') {
        scene.querySelectorAll('.mv-track').forEach(track => {
          const dot = track.querySelector('.mv-dot');
          const end = `translateX(${track.clientWidth - 36}px)`;
          dot.style.transform = end;
          animations.forEach(animation => { if (animation.effect.target === dot) animation.effect.setKeyframes([{ transform: 'translateX(0)' }, { transform: end }]); });
        });
      }
      if (['scroll', 'parallax'].includes(current)) setScroll(scrollValue, false);
      if (current === 'marquee') {
        const wasPaused = userPaused;
        clearMotion();
        buildMarquee();
        if (!reduced) runMarquee();
        userPaused = wasPaused;
        syncPlayback();
      }
    });
    resize.observe(scene);
    const removal = new MutationObserver(() => { if (!root.isConnected) destroy(); });
    removal.observe(document.body, { childList: true, subtree: true });

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      clearMotion();
      events.abort();
      visibility.disconnect();
      resize.disconnect();
      removal.disconnect();
    }

    select('ease');
  }
})();
