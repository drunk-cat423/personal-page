import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleScenePose, drawScenePose, setupPoseScene } from '../scene-player.js';

class Events {
  listeners = new Map();
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type) { this.listeners.get(type)?.forEach(callback => callback()); }
}

function classList() {
  const values = new Set();
  return { add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value) };
}

function mockScene({ reduced = false, visible = true, mobile = false, fetcher } = {}) {
  const preference = Object.assign(new Events(), { matches: reduced });
  const win = new Events();
  const doc = Object.assign(new Events(), { hidden: false, baseURI: 'https://scene.test/', defaultView: win });
  const requests = [];
  const frames = new Map();
  const decoded = [];
  const draws = [];
  let frameId = 0;
  let clock = 100;
  const context = {
    clearRect: (...args) => draws.push({ clear: args }),
    drawImage(pose) { draws.push({ pose: pose.source, alpha: this.globalAlpha, operation: this.globalCompositeOperation }); }
  };
  Object.assign(win, {
    innerWidth: 1200, innerHeight: 800,
    matchMedia: query => query.includes('reduced') ? preference : { matches: mobile },
    fetch: async source => {
      requests.push(source);
      return fetcher ? fetcher(source) : { ok: true, blob: async () => ({ source }) };
    },
    createImageBitmap: async blob => {
      const bitmap = { width: 1280, height: 512, source: blob.source, closed: false, close() { this.closed = true; } };
      decoded.push(bitmap);
      return bitmap;
    },
    performance: { now: () => clock },
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id)
  });
  const surface = {
    classList: classList(), visible,
    getBoundingClientRect() { return { width: 960, height: 384, top: this.visible ? 100 : 900, bottom: this.visible ? 484 : 1284, left: 0, right: 960 }; }
  };
  const attributes = new Map([['src', 'a.webp'], ['srcset', 'a.webp 1280w, mobile-a.webp 960w'], ['sizes', '100vw']]);
  const image = Object.assign(new Events(), {
    ownerDocument: doc, parentElement: surface, alt: 'A tree in a meadow', classList: classList(), complete: true, currentSrc: '',
    dataset: { scenePoses: JSON.stringify(['a', 'b', 'c', 'd', 'e', 'f']), scenePosesMobile: JSON.stringify(['ma', 'mb', 'mc', 'md', 'me', 'mf']) },
    getAttribute: name => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: name => attributes.delete(name),
    after: canvas => surface.canvas = canvas
  });
  let canvasCount = 0;
  doc.createElement = tag => {
    assert.equal(tag, 'canvas');
    canvasCount++;
    return { attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, getContext: () => context, remove() { surface.canvas = null; } };
  };
  return {
    win, doc, preference, image, surface, requests, frames, decoded, draws, attributes,
    get canvasCount() { return canvasCount; },
    advance(now) {
      clock = now;
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach(callback => callback(now));
    }
  };
}

const settled = () => new Promise(resolve => setImmediate(resolve));

test('six 500 ms holds and 500 ms smoothstep dissolves wrap F back to A at 6 seconds', () => {
  for (let index = 0; index < 6; index++) {
    assert.deepEqual(sampleScenePose(index * 1000), { current: index, next: (index + 1) % 6, blend: 0 });
    assert.equal(sampleScenePose(index * 1000 + 500).blend, 0);
    assert.equal(sampleScenePose(index * 1000 + 750).blend, 0.5);
    assert.equal(sampleScenePose(index * 1000 + 625).blend, 0.15625);
  }
  assert.equal(sampleScenePose(5999).next, 0);
  assert.ok(sampleScenePose(5999).blend > 0.9999);
  assert.deepEqual(sampleScenePose(6000), sampleScenePose(0));
});

test('draw uses complementary additive premultiplied alpha and resets context state', () => {
  const calls = [];
  const context = {
    clearRect: (...args) => calls.push(['clear', ...args]),
    drawImage(pose) { calls.push([pose, this.globalAlpha, this.globalCompositeOperation]); }
  };
  drawScenePose(context, ['a', 'b', 'c', 'd', 'e', 'f'], 5750, 1280, 512);
  assert.deepEqual(calls, [['clear', 0, 0, 1280, 512], ['f', 0.5, 'lighter'], ['a', 0.5, 'lighter']]);
  // Identical translucent edges retain their original alpha (source-over gives .4375).
  assert.equal(0.5 * 0.5 + 0.5 * 0.5, 0.5);
  assert.equal(context.globalAlpha, 1);
  assert.equal(context.globalCompositeOperation, 'source-over');
});

test('visible scene loads all poses once, preserves responsive poster, and reuses one canvas', async () => {
  const scene = mockScene();
  const player = setupPoseScene(scene.image);
  assert.equal(setupPoseScene(scene.image), player);
  await settled();
  assert.equal(scene.requests.length, 6);
  assert.equal(scene.image.dataset.motionState, 'running');
  assert.equal(scene.canvasCount, 1);
  assert.equal(scene.frames.size, 1);
  assert.equal(scene.image.getAttribute('aria-hidden'), 'true');
  assert.equal(scene.surface.canvas.attributes['aria-label'], scene.image.alt);
  assert.equal(scene.image.getAttribute('srcset'), 'a.webp 1280w, mobile-a.webp 960w');
  scene.advance(850);
  assert.deepEqual(scene.draws.slice(-2).map(draw => [draw.pose, draw.alpha]), [['https://scene.test/a', 0.5], ['https://scene.test/b', 0.5]]);
  scene.surface.visible = false;
  scene.win.emit('scroll');
  assert.equal(scene.frames.size, 0);
  assert.equal(scene.surface.canvas.hidden, true);
  assert.equal(scene.image.classList.contains('scene-poster-hidden'), false);
  scene.surface.visible = true;
  scene.win.emit('scroll');
  assert.equal(scene.canvasCount, 1);
  assert.equal(scene.requests.length, 6);
  assert.equal(scene.frames.size, 1);
  assert.equal(scene.draws.at(-1).pose, 'https://scene.test/a');
  player.destroy();
  assert.equal(scene.frames.size, 0);
  assert.ok(scene.decoded.every(bitmap => bitmap.closed));
});

test('reduced motion and offscreen scene never fetch until visible with motion allowed', async () => {
  const scene = mockScene({ reduced: true, visible: false, mobile: true });
  const player = setupPoseScene(scene.image);
  assert.equal(scene.requests.length, 0);
  scene.preference.matches = false;
  scene.preference.emit('change');
  assert.equal(scene.requests.length, 0);
  scene.surface.visible = true;
  scene.win.emit('scroll');
  await settled();
  assert.deepEqual(scene.requests.map(source => source.split('/').at(-1)), ['ma', 'mb', 'mc', 'md', 'me', 'mf']);
  scene.preference.matches = true;
  scene.preference.emit('change');
  assert.equal(scene.frames.size, 0);
  assert.equal(scene.image.dataset.motionState, 'still');
  scene.preference.matches = false;
  scene.preference.emit('change');
  scene.doc.hidden = true;
  scene.doc.emit('visibilitychange');
  assert.equal(scene.frames.size, 0);
  scene.doc.hidden = false;
  scene.doc.emit('visibilitychange');
  assert.equal(scene.frames.size, 1);
  scene.win.emit('pagehide');
  assert.equal(scene.frames.size, 0);
  scene.win.emit('pageshow');
  assert.equal(scene.frames.size, 1);
  assert.equal(scene.requests.length, 6);
  player.destroy();
});

test('failed fetch leaves poster visible, closes bitmaps, and never retries or schedules frames', async () => {
  const scene = mockScene({ fetcher: async source => ({ ok: !source.endsWith('/c'), blob: async () => ({ source }) }) });
  const player = setupPoseScene(scene.image);
  await settled();
  assert.equal(scene.image.dataset.motionState, 'failed');
  assert.equal(scene.frames.size, 0);
  assert.equal(scene.canvasCount, 0);
  assert.ok(scene.decoded.every(bitmap => bitmap.closed));
  for (const event of ['scroll', 'resize', 'pageshow']) scene.win.emit(event);
  assert.equal(scene.requests.length, 6);
  assert.equal(scene.image.getAttribute('src'), 'a.webp');
  player.destroy();
});

test('visibility changes while loading cannot start an animation in a hidden tab', async () => {
  let release;
  const gate = new Promise(resolve => release = resolve);
  const scene = mockScene({ fetcher: async source => { await gate; return { ok: true, blob: async () => ({ source }) }; } });
  const player = setupPoseScene(scene.image);
  scene.doc.hidden = true;
  scene.doc.emit('visibilitychange');
  release();
  await settled();
  assert.equal(scene.frames.size, 0);
  assert.equal(scene.surface.canvas.hidden, true);
  scene.doc.hidden = false;
  scene.doc.emit('visibilitychange');
  assert.equal(scene.frames.size, 1);
  player.destroy();
});

test('high-DPR mobile waits for the poster candidate and locks matching desktop poses', async () => {
  const scene = mockScene({ mobile: true });
  scene.image.complete = false;
  const player = setupPoseScene(scene.image);
  assert.equal(scene.requests.length, 0);
  scene.image.currentSrc = 'https://scene.test/a';
  scene.image.complete = true;
  scene.image.emit('load');
  await settled();
  assert.deepEqual(scene.requests.map(source => source.split('/').at(-1)), ['a', 'b', 'c', 'd', 'e', 'f']);
  scene.image.currentSrc = 'https://scene.test/ma';
  scene.win.emit('resize');
  scene.image.emit('load');
  assert.equal(scene.requests.length, 6);
  assert.equal(scene.canvasCount, 1);
  player.destroy();
});

test('desktop waits for the poster candidate and uses matching 960 poses without loading 1280', async () => {
  const scene = mockScene();
  scene.image.complete = false;
  const player = setupPoseScene(scene.image);
  assert.equal(scene.requests.length, 0);
  scene.image.currentSrc = 'https://scene.test/ma';
  scene.image.complete = true;
  scene.image.emit('load');
  await settled();
  assert.deepEqual(scene.requests.map(source => source.split('/').at(-1)), ['ma', 'mb', 'mc', 'md', 'me', 'mf']);
  scene.image.currentSrc = 'https://scene.test/a';
  scene.win.emit('resize');
  scene.image.emit('load');
  assert.equal(scene.requests.length, 6);
  assert.equal(scene.canvasCount, 1);
  player.destroy();
});

test('destroying a loading player closes late bitmaps without creating canvas or frames', async () => {
  let release;
  const gate = new Promise(resolve => release = resolve);
  const scene = mockScene({ fetcher: async source => { await gate; return { ok: true, blob: async () => ({ source }) }; } });
  const player = setupPoseScene(scene.image);
  player.destroy();
  release();
  await settled();
  assert.equal(scene.frames.size, 0);
  assert.equal(scene.canvasCount, 0);
  assert.ok(scene.decoded.every(bitmap => bitmap.closed));
});
