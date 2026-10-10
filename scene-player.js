const players = new WeakMap();
const holdDuration = 500;
const dissolveDuration = 500;
const poseDuration = holdDuration + dissolveDuration;
const poseCount = 6;

export function sampleScenePose(elapsed) {
  const time = ((elapsed % (poseCount * poseDuration)) + poseCount * poseDuration) % (poseCount * poseDuration);
  const current = Math.floor(time / poseDuration);
  const progress = Math.max(0, (time % poseDuration - holdDuration) / dissolveDuration);
  const blend = progress * progress * (3 - 2 * progress);
  return { current, next: (current + 1) % poseCount, blend };
}

export function drawScenePose(context, poses, elapsed, width, height) {
  const { current, next, blend } = sampleScenePose(elapsed);
  context.clearRect(0, 0, width, height);
  // Add weighted premultiplied pixels, including alpha, instead of darkening
  // translucent ink edges with two source-over layers.
  context.globalCompositeOperation = 'lighter';
  context.globalAlpha = 1 - blend;
  context.drawImage(poses[current], 0, 0, width, height);
  if (blend > 0) {
    context.globalAlpha = blend;
    context.drawImage(poses[next], 0, 0, width, height);
  }
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
}

function parseSources(value) {
  try {
    const sources = JSON.parse(value);
    return Array.isArray(sources) && sources.length === poseCount && sources.every(source => typeof source === 'string' && source.trim()) ? sources : null;
  } catch { return null; }
}

export function setupPoseScene(image) {
  if (players.has(image)) return players.get(image);
  const doc = image.ownerDocument;
  const win = doc.defaultView;
  const preference = win.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = win.matchMedia('(max-width: 600px)').matches;
  const desktopSources = parseSources(image.dataset.scenePoses);
  const mobileSources = image.dataset.scenePosesMobile ? parseSources(image.dataset.scenePosesMobile) : desktopSources;
  let sources;
  const surface = image.parentElement;
  const posterAriaHidden = image.getAttribute('aria-hidden');
  let poses = [];
  let canvas;
  let context;
  let loading = false;
  let failed = !desktopSources;
  let destroyed = false;
  let pageHidden = false;
  let running = false;
  let frame = 0;
  let startedAt = 0;
  let lastDraw = 0;

  function wantsMovement() {
    const bounds = surface.getBoundingClientRect();
    return !destroyed && !failed && !pageHidden && !doc.hidden && !preference.matches && bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < win.innerHeight && bounds.right > 0 && bounds.left < win.innerWidth;
  }

  function showPoster() {
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    running = false;
    if (canvas) canvas.hidden = true;
    image.classList.remove('scene-poster-hidden');
    if (posterAriaHidden === null) image.removeAttribute('aria-hidden');
    else image.setAttribute('aria-hidden', posterAriaHidden);
  }

  function closePoses() {
    poses.forEach(pose => pose.close?.());
    poses = [];
  }

  async function loadPose(source) {
    const response = await win.fetch(new URL(source, doc.baseURI).href);
    if (!response.ok) throw new Error('Scene pose unavailable');
    const blob = await response.blob();
    let pose;
    if (win.createImageBitmap) {
      pose = await win.createImageBitmap(blob);
    } else {
      const blobUrl = win.URL.createObjectURL(blob);
      try {
        pose = new win.Image();
        if (pose.decode) {
          pose.src = blobUrl;
          await pose.decode();
        } else {
          await new Promise((resolve, reject) => {
            pose.onload = resolve;
            pose.onerror = reject;
            pose.src = blobUrl;
          });
        }
      } finally { win.URL.revokeObjectURL(blobUrl); }
    }
    if (destroyed || failed) {
      pose.close?.();
      throw new Error('Scene player stopped');
    }
    poses.push(pose);
    return pose;
  }

  function tick(now) {
    frame = 0;
    if (!running) return;
    if (now - lastDraw >= 1000 / 30) {
      drawScenePose(context, poses, now - startedAt, canvas.width, canvas.height);
      lastDraw = now;
    }
    frame = win.requestAnimationFrame(tick);
  }

  function sync() {
    if (!wantsMovement()) {
      showPoster();
      image.dataset.motionState = failed ? 'failed' : 'still';
      return;
    }
    if (!context) {
      image.dataset.motionState = 'loading';
      if (loading) return;
      // Match the responsive poster before locking the resource set: desktop
      // can select 960, while a high-DPR phone can select 1280.
      if (image.getAttribute('srcset') && !image.currentSrc && !image.complete) return;
      if (image.currentSrc === new URL(desktopSources[0], doc.baseURI).href) sources = desktopSources;
      else if (mobileSources && image.currentSrc === new URL(mobileSources[0], doc.baseURI).href) sources = mobileSources;
      else sources = mobile ? mobileSources : desktopSources;
      if (!sources) {
        failed = true;
        sync();
        return;
      }
      loading = true;
      Promise.all(sources.map(loadPose)).then(loaded => {
        if (destroyed || failed) return;
        poses = loaded;
        const { width, height } = poses[0];
        if (!width || !height || poses.some(pose => pose.width !== width || pose.height !== height)) throw new Error('Scene poses must share dimensions');
        canvas = doc.createElement('canvas');
        canvas.className = 'scene-image scene-canvas';
        canvas.width = width;
        canvas.height = height;
        canvas.hidden = true;
        if (image.alt && posterAriaHidden !== 'true') {
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', image.alt);
        } else canvas.setAttribute('aria-hidden', 'true');
        context = canvas.getContext('2d');
        if (!context) throw new Error('Scene canvas unavailable');
        surface.classList.add('scene-player-surface');
        image.after(canvas);
        sync();
      }).catch(() => {
        failed = true;
        closePoses();
        sync();
      });
      return;
    }
    if (!running) {
      // Returning to A matches the poster before its first 500 ms hold.
      startedAt = win.performance.now();
      lastDraw = startedAt;
      drawScenePose(context, poses, 0, canvas.width, canvas.height);
      canvas.hidden = false;
      image.classList.add('scene-poster-hidden');
      image.setAttribute('aria-hidden', 'true');
      running = true;
      frame = win.requestAnimationFrame(tick);
    }
    image.dataset.motionState = 'running';
  }

  const onPageHide = () => { pageHidden = true; sync(); };
  const onPageShow = () => { pageHidden = false; sync(); };
  const observer = win.IntersectionObserver ? new win.IntersectionObserver(sync) : null;
  observer?.observe(surface);
  preference.addEventListener('change', sync);
  doc.addEventListener('visibilitychange', sync);
  win.addEventListener('scroll', sync, { passive: true });
  win.addEventListener('resize', sync);
  win.addEventListener('pagehide', onPageHide);
  win.addEventListener('pageshow', onPageShow);
  image.addEventListener('load', sync);
  image.addEventListener('error', sync);
  const player = {
    destroy() {
      destroyed = true;
      showPoster();
      closePoses();
      canvas?.remove();
      surface.classList.remove('scene-player-surface');
      observer?.disconnect();
      preference.removeEventListener('change', sync);
      doc.removeEventListener('visibilitychange', sync);
      win.removeEventListener('scroll', sync);
      win.removeEventListener('resize', sync);
      win.removeEventListener('pagehide', onPageHide);
      win.removeEventListener('pageshow', onPageShow);
      image.removeEventListener('load', sync);
      image.removeEventListener('error', sync);
    }
  };
  players.set(image, player);
  sync();
  return player;
}
