import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile, mkdir, stat, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Six unique drawn poses, in one forward loop. No displacement/wave field.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'assets', 'illustrations');
const outDir = path.join(sourceDir, 'cel-six');
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const width = 1280, fps = 24, holdFrames = 12, dissolveFrames = 12;
const frameCount = 144;
const only = process.argv.find(a => a.startsWith('--only='))?.split('=')[1];
const names = only ? [only] : ['meadow', 'coast'];
if (names.some(n => !['meadow', 'coast'].includes(n))) throw new Error('Use --only=meadow or --only=coast');
const prepareOnly = process.argv.includes('--prepare-only');
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const band = (n, a, b, f) => smooth((n - a) / f) * smooth((b - n) / f);
const rect = (x, y, a, b, c, d, f = .018) => band(x, a, b, f) * band(y, c, d, f);

async function capture(args, input) {
  const child = spawn(ffmpeg, args, { windowsHide: true });
  const chunks = [], errors = [];
  child.stdout.on('data', c => chunks.push(c));
  child.stderr.on('data', c => errors.push(c));
  child.on('error', e => errors.push(Buffer.from(e.message)));
  const done = once(child, 'close');
  if (input) child.stdin.end(input); else child.stdin.end();
  const [code] = await done;
  if (code) throw new Error(Buffer.concat(errors).toString());
  return Buffer.concat(chunks);
}

function premultiply(raw) {
  const p = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i += 4) {
    const a = raw[i + 3] / 255;
    p[i] = raw[i] * a; p[i + 1] = raw[i + 1] * a; p[i + 2] = raw[i + 2] * a; p[i + 3] = raw[i + 3];
  }
  return p;
}

function sample(p, w, h, x, y, out) {
  out.fill(0);
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const px = ix + dx, py = iy + dy;
    if (px < 0 || py < 0 || px >= w || py >= h) continue;
    const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy), i = (py * w + px) * 4;
    for (let c = 0; c < 4; c++) out[c] += p[i + c] * weight;
  }
}

function anchorRegion(name, x, y) {
  return name === 'meadow'
    ? (x > .61 && x < .69 && y > .64 && y < .87) || (y > .81 && y < .855 && (x < .55 || x > .73))
    : (x > .765 && x < .9 && y > .35 && y < .73) || (x > .65 && x < .96 && y > .71 && y < .755);
}

function align(name, raw, pose, h) {
  const original = premultiply(raw), moving = premultiply(pose), anchors = [], sampled = new Float32Array(4);
  for (let y = 0; y < h; y += 7) for (let x = 0; x < width; x += 7) {
    if (!anchorRegion(name, x / width, y / h)) continue;
    const i = (y * width + x) * 4;
    // Include both the ink and transparent silhouette around protected anchors.
    anchors.push({ x, y, i, weight: raw[i + 3] > 16 ? 1 : .25 });
  }
  const score = (scale, dx, dy) => {
    let error = 0, weights = 0;
    for (const a of anchors) {
      sample(moving, width, h, (a.x - width / 2 - dx) / scale + width / 2, (a.y - h / 2 - dy) / scale + h / 2, sampled);
      error += a.weight * (Math.abs(original[a.i] - sampled[0]) + Math.abs(original[a.i + 1] - sampled[1]) + Math.abs(original[a.i + 2] - sampled[2]) + 2 * Math.abs(original[a.i + 3] - sampled[3]));
      weights += a.weight * 5;
    }
    return error / weights;
  };
  const initial = score(1, 0, 0);
  let best = { scale: 1, dx: 0, dy: 0, score: initial };
  for (let s = 96; s <= 104; s++) for (let dy = -32; dy <= 32; dy += 4) for (let dx = -40; dx <= 40; dx += 4) {
    const e = score(s / 100, dx, dy);
    if (e < best.score) best = { scale: s / 100, dx, dy, score: e };
  }
  const coarse = best;
  for (let s = -4; s <= 4; s++) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const scale = coarse.scale + s * .001, tx = coarse.dx + dx, ty = coarse.dy + dy, e = score(scale, tx, ty);
    if (e < best.score) best = { scale, dx: tx, dy: ty, score: e };
  }
  const aligned = Buffer.alloc(raw.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < width; x++) {
    sample(moving, width, h, (x - width / 2 - best.dx) / best.scale + width / 2, (y - h / 2 - best.dy) / best.scale + h / 2, sampled);
    const i = (y * width + x) * 4, a = sampled[3];
    aligned[i + 3] = Math.round(a);
    for (let c = 0; c < 3; c++) aligned[i + c] = a > .01 ? Math.round(sampled[c] * 255 / a) : 0;
  }
  // Match the small global watercolor color shift from stationary opaque anchors.
  const offsets = [[], [], []];
  for (const a of anchors) if (raw[a.i + 3] > 240 && aligned[a.i + 3] > 240) {
    for (let c = 0; c < 3; c++) offsets[c].push(raw[a.i + c] - aligned[a.i + c]);
  }
  const colorOffsets = offsets.map(values => {
    values.sort((a, b) => a - b);
    return Math.max(-12, Math.min(12, values[Math.floor(values.length / 2)] || 0));
  });
  for (let i = 0; i < aligned.length; i += 4) if (aligned[i + 3]) for (let c = 0; c < 3; c++) aligned[i + c] = Math.max(0, Math.min(255, aligned[i + c] + colorOffsets[c]));
  return { aligned, registration: { ...best, initialScore: initial, anchorSamples: anchors.length, colorOffsets, searchBoundary: Math.abs(best.dx) >= 39 || Math.abs(best.dy) >= 31 || best.scale <= .961 || best.scale >= 1.039 } };
}

function staticWindSupport(raw, poses, h) {
  const protectedPixels = new Uint8Array(width * h);
  for (const pixels of [raw, ...poses]) {
    const seen = new Uint8Array(width * h), queue = new Int32Array(width * h);
    for (let y = Math.floor(h * .57); y < h * .75; y++) for (let x = Math.floor(width * .878); x < width; x++) {
      const seed = y * width + x;
      if (seen[seed] || pixels[seed * 4 + 3] <= 8) continue;
      let start = 0, end = 1, minX = x, minY = y, maxX = x, maxY = y;
      queue[0] = seed; seen[seed] = 1;
      while (start < end) {
        const n = queue[start++], px = n % width, py = Math.floor(n / width);
        minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);
        for (const next of [px ? n - 1 : -1, px < width - 1 ? n + 1 : -1, py ? n - width : -1, py < h - 1 ? n + width : -1]) {
          if (next < 0 || seen[next] || pixels[next * 4 + 3] <= 8) continue;
          seen[next] = 1; queue[end++] = next;
        }
      }
      // Whole alpha components, rather than a rectangle through the crown tips.
      if (minX < width * .878 || minY < h * .57 || maxY > h * .75 || end > 12000) continue;
      for (let j = 0; j < end; j++) {
        const px = queue[j] % width, py = Math.floor(queue[j] / width);
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (px + dx >= 0 && px + dx < width && py + dy >= 0 && py + dy < h) protectedPixels[(py + dy) * width + px + dx] = 1;
      }
    }
  }
  return protectedPixels;
}

function trunkProtection(raw, poses, h) {
  // Curved trunk/branch corridors follow the original skeleton. Round caps and
  // feathered edges avoid a rectangular patch through the watercolor canopy.
  const corridors = [
    [.642, .864, .645, .786, 34], [.645, .786, .634, .674, 40], [.634, .674, .618, .585, 36],
    [.618, .585, .606, .49, 35], [.606, .49, .610, .382, 31], [.610, .382, .602, .27, 25],
    [.610, .435, .642, .34, 25], [.642, .34, .665, .29, 20],
    [.615, .58, .577, .519, 30], [.577, .519, .545, .459, 26], [.545, .459, .504, .407, 22],
    [.624, .62, .672, .533, 32], [.672, .533, .712, .492, 26],
    [.672, .533, .693, .434, 22], [.693, .434, .68, .39, 18],
  ].map(([x1, y1, x2, y2, radius]) => [x1 * width, y1 * h, x2 * width, y2 * h, radius]);
  const protection = new Float32Array(width * h), ink = [];
  for (let y = Math.floor(h * .20); y < Math.min(h, h * .94); y++) for (let x = Math.floor(width * .46); x < width * .835; x++) {
    let distance = Infinity;
    for (const [x1, y1, x2, y2, radius] of corridors) {
      const vx = x2 - x1, vy = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * vx + (y - y1) * vy) / (vx * vx + vy * vy)));
      distance = Math.min(distance, Math.hypot(x - x1 - t * vx, y - y1 - t * vy) - radius);
    }
    const n = y * width + x, i = n * 4;
    protection[n] = 1 - smooth(distance / 14);
    // Protect the union of dark structural ink in the vicinity of the main
    // skeleton too, so a shifted pose's branch cannot remain as a second line.
    if (distance < 18 && [raw, ...poses].some(p => p[i + 3] > 16 && p[i] < 145 && p[i + 2] - p[i] > 24)) ink.push([x, y]);
  }
  for (const [x, y] of ink) for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) {
    const px = x + dx, py = y + dy;
    if (px < 0 || px >= width || py < 0 || py >= h) continue;
    const n = py * width + px, weight = 1 - smooth((Math.hypot(dx, dy) - 5) / 7);
    protection[n] = Math.max(protection[n], weight);
  }
  return protection;
}

function motionMask(name, raw, poses, h, trunk) {
  const mask = new Float32Array(width * h);
  const protectedWind = name === 'meadow' ? staticWindSupport(raw, poses, h) : null;
  const unionBounds = (domain, fallback, skip) => {
    let minX = width, maxX = -1, minY = h, maxY = -1;
    for (let y = Math.floor(domain[2] * h); y < Math.min(h, domain[3] * h); y++) for (let x = Math.floor(domain[0] * width); x < Math.min(width, domain[1] * width); x++) {
      const n = y * width + x;
      if (skip?.(x / width, y / h, n)) continue;
      if (![raw, ...poses].some(p => p[n * 4 + 3] > 8)) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return maxX < 0 ? fallback : [Math.min(fallback[0], minX / width - .025), Math.max(fallback[1], maxX / width + .025), Math.min(fallback[2], minY / h - .025), Math.max(fallback[3], maxY / h + .025)];
  };
  const canopyBounds = name === 'meadow' ? unionBounds([.34, .95, 0, .758], [.355, .918, -.06, .758], (x, y, n) => protectedWind[n]) : null;
  // Preserve the ground below the crown while expanding its left/right silhouette.
  if (canopyBounds) canopyBounds[3] = .758;
  const leftCloudBounds = name === 'coast' ? unionBounds([.01, .30, .3, .665], [.018, .256, .34, .637], (x, y) => x > .20 && y > .59) : null;
  const rightCloudBounds = name === 'coast' ? unionBounds([.55, .765, .43, .665], [.578, .739, .475, .629]) : null;
  for (let y = 0; y < h; y++) for (let x = 0; x < width; x++) {
    const nx = x / width, ny = y / h, n = y * width + x, i = n * 4;
    let m;
    // Grass uses only darker ink: the pale ground wash stays stationary.
    const grassInk = Math.max(...[raw, ...poses].map(p => smooth((208 - p[i]) / 70) * (p[i + 3] / 255)));
    if (name === 'meadow') {
      const canopy = rect(nx, ny, ...canopyBounds, .025);
      const clouds = Math.max(rect(nx, ny, .015, .213, .475, .666), rect(nx, ny, .22, .353, .594, .736));
      const grass = rect(nx, ny, .018, .985, .862, .975, .018) * (1 - rect(nx, ny, .585, .72, .79, .999, .025)) * grassInk;
      const leaves = Math.max(rect(nx, ny, .345, .535, .51, .75), rect(nx, ny, .715, .80, .665, .76), rect(nx, ny, .84, .932, .475, .572));
      m = Math.max(canopy, clouds, grass, leaves);
      if (protectedWind[n]) m = 0; // Original wind doodle, whole connected contours.
      m *= 1 - trunk[n];
    } else {
      // Keep the left curl and cloud together as complete independent artwork.
      const clouds = Math.max(rect(nx, ny, ...leftCloudBounds), rect(nx, ny, ...rightCloudBounds)) * (nx > .20 && nx < .30 && ny > .59 ? 0 : 1);
      const sea = rect(nx, ny, .04, .61, .756, .881, .018) * (1 - rect(nx, ny, .435, .535, .77, .897, .02));
      const grass = rect(nx, ny, .645, .96, .767, .922, .018) * grassInk;
      m = Math.max(clouds, sea, grass);
    }
    mask[n] = m;
  }
  return mask;
}

function mixPixel(out, i, a, b, t) {
  const alpha = a[i + 3] * (1 - t) + b[i + 3] * t;
  out[i + 3] = Math.round(alpha);
  for (let c = 0; c < 3; c++) out[i + c] = alpha > .01 ? Math.round((a[i + c] * a[i + 3] * (1 - t) + b[i + c] * b[i + 3] * t) / alpha) : 0;
}

function restoreFixed(raw, aligned, mask) {
  const out = Buffer.from(raw);
  for (let n = 0; n < mask.length; n++) if (mask[n] > 0) mixPixel(out, n * 4, raw, aligned, mask[n]);
  return out;
}

function render(poses, sequence, frame, mask) {
  const f = ((frame % frameCount) + frameCount) % frameCount, segment = Math.floor(f / (holdFrames + dissolveFrames));
  const local = f % (holdFrames + dissolveFrames), a = poses[sequence[segment]], b = poses[sequence[(segment + 1) % sequence.length]];
  if (local < holdFrames) return Buffer.from(a);
  const t = smooth((local - holdFrames + 1) / dissolveFrames), out = Buffer.from(a);
  if (t === 1) return Buffer.from(b);
  for (let n = 0; n < mask.length; n++) if (mask[n] > 0) mixPixel(out, n * 4, a, b, t);
  return out;
}

function inspectWebP(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error('Not a WebP container');
  let offset = 12, flags = 0, canvas, animation; const frames = [];
  while (offset + 8 <= bytes.length) {
    const tag = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4), p = offset + 8;
    if (p + size > bytes.length) throw new Error('Truncated WebP');
    if (tag === 'VP8X') { flags = bytes[p]; canvas = { width: 1 + bytes.readUIntLE(p + 4, 3), height: 1 + bytes.readUIntLE(p + 7, 3) }; }
    if (tag === 'ANIM') animation = { loopCount: bytes.readUInt16LE(p + 4) };
    if (tag === 'ANMF') frames.push({ durationMs: bytes.readUIntLE(p + 12, 3) });
    offset = p + size + (size & 1);
  }
  if (!(flags & 2) || !(flags & 16) || !animation || frames.length < 2) throw new Error('Expected transparent animated WebP');
  return { canvas, hasAlpha: true, animation, encodedFrames: frames.length, durationMs: frames.reduce((n, f) => n + f.durationMs, 0) };
}

async function savePNG(raw, h, name, w = width) {
  await capture(['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', 'pipe:0', '-frames:v', '1', path.join(outDir, name)], raw);
}

async function build(name) {
  const source = path.join(sourceDir, `${name}-static.png`);
  const raw = await capture(['-v', 'error', '-i', source, '-vf', `scale=${width}:-1:flags=lanczos`, '-frames:v', '1', '-pix_fmt', 'rgba', '-f', 'rawvideo', 'pipe:1']);
  const h = raw.length / width / 4;
  if (!Number.isInteger(h)) throw new Error('Unexpected image dimensions');
  const poseNames = ['b', 'c', 'd', 'e', 'f'], registered = [], registration = [];
  const sourcePoseHashes = [{ pose: 'a', sha256: createHash('sha256').update(raw).digest('hex') }];
  for (const letter of poseNames) {
    const file = path.join(outDir, `${name}-pose-${letter}.png`); await stat(file);
    const pose = await capture(['-v', 'error', '-i', file, '-vf', `scale=${width}:${h}:flags=lanczos`, '-frames:v', '1', '-pix_fmt', 'rgba', '-f', 'rawvideo', 'pipe:1']);
    sourcePoseHashes.push({ pose: letter, sha256: createHash('sha256').update(pose).digest('hex') });
    let transparent = 0; for (let i = 3; i < pose.length; i += 4) if (!pose[i]) transparent++;
    if (transparent < width * h * .15) throw new Error(`${name} pose ${letter} lacks the transparent source background; ask for a corrected pose`);
    const result = align(name, raw, pose, h); registered.push(result.aligned); registration.push({ pose: letter, ...result.registration });
  }
  const trunk = name === 'meadow' ? trunkProtection(raw, registered, h) : null;
  const mask = motionMask(name, raw, registered, h, trunk);
  const poses = [raw, ...registered.map(p => restoreFixed(raw, p, mask))];
  const sequence = name === 'meadow' ? [0, 3, 2, 1, 4, 5] : [0, 2, 1, 3, 4, 5];
  const preparedPoseHashes = poses.map((p, i) => ({ pose: String.fromCharCode(97 + i), sha256: createHash('sha256').update(p).digest('hex') }));
  if (new Set(sourcePoseHashes.map(p => p.sha256)).size !== 6 || new Set(preparedPoseHashes.map(p => p.sha256)).size !== 6) throw new Error('All six source and prepared poses must be unique');
  if (sequence.length !== 6 || new Set(sequence).size !== 6 || (holdFrames + dissolveFrames) * sequence.length !== frameCount) throw new Error('Expected exactly six non-repeated one-second pose segments');
  const adjacentPoseDifferences = sequence.map((pose, index) => {
    const next = sequence[(index + 1) % sequence.length], a = poses[pose], b = poses[next];
    let error = 0, alphaError = 0, count = 0;
    for (let n = 0; n < mask.length; n++) if (mask[n] > 0) {
      const i = n * 4; count++;
      for (let c = 0; c < 3; c++) error += Math.abs(a[i + c] * a[i + 3] - b[i + c] * b[i + 3]) / 255;
      alphaError += Math.abs(a[i + 3] - b[i + 3]);
    }
    return { from: String.fromCharCode(65 + pose), to: String.fromCharCode(65 + next), meanMovingPremultipliedRGBDifference: error / count / 3, meanMovingAlphaDifference: alphaError / count };
  });
  if (adjacentPoseDifferences.some(p => p.meanMovingPremultipliedRGBDifference < .01)) throw new Error('Adjacent prepared poses have no visible difference');
  for (let i = 0; i < poses.length; i++) await savePNG(poses[i], h, `${name}-aligned-${String.fromCharCode(97 + i)}.png`);
  const strip = Buffer.alloc(raw.length * poses.length);
  for (let y = 0; y < h; y++) for (let p = 0; p < poses.length; p++) poses[sequence[p]].copy(strip, ((y + Math.floor(p / 3) * h) * width * 3 + (p % 3) * width) * 4, y * width * 4, (y + 1) * width * 4);
  await savePNG(strip, h * 2, `${name}-pose-grid.png`, width * 3);
  let trunkVerification;
  if (trunk) {
    let protectedPixels = 0, maxError = 0;
    const perPoseErrors = poses.map((p, i) => ({ pose: String.fromCharCode(65 + i), maxRGBAError: 0 }));
    for (let n = 0; n < trunk.length; n++) if (trunk[n] === 1) {
      protectedPixels++;
      for (let i = 0; i < poses.length; i++) for (let c = 0; c < 4; c++) {
        const error = Math.abs(raw[n * 4 + c] - poses[i][n * 4 + c]);
        maxError = Math.max(maxError, error); perPoseErrors[i].maxRGBAError = Math.max(perPoseErrors[i].maxRGBAError, error);
      }
    }
    if (maxError) throw new Error('Main trunk, roots or forks changed in a prepared pose');
    const protectionPreview = Buffer.alloc(raw.length);
    for (let n = 0; n < trunk.length; n++) if (trunk[n] > 0) { protectionPreview[n * 4] = 37; protectionPreview[n * 4 + 1] = 70; protectionPreview[n * 4 + 2] = 99; protectionPreview[n * 4 + 3] = Math.round(trunk[n] * 255); }
    await savePNG(protectionPreview, h, `${name}-trunk-protection.png`);
    const x0 = Math.floor(width * .46), y0 = Math.floor(h * .20), cropWidth = Math.ceil(width * .375), cropHeight = Math.ceil(h * .74);
    const grid = Buffer.alloc(cropWidth * 3 * cropHeight * 2 * 4);
    for (let p = 0; p < poses.length; p++) {
      const crop = Buffer.alloc(cropWidth * cropHeight * 4);
      for (let y = 0; y < cropHeight; y++) {
        const start = ((y + y0) * width + x0) * 4;
        poses[sequence[p]].copy(crop, y * cropWidth * 4, start, start + cropWidth * 4);
        crop.copy(grid, ((y + Math.floor(p / 3) * cropHeight) * cropWidth * 3 + p % 3 * cropWidth) * 4, y * cropWidth * 4, (y + 1) * cropWidth * 4);
      }
      await savePNG(crop, cropHeight, `${name}-trunk-crop-${String.fromCharCode(97 + sequence[p])}.png`, cropWidth);
    }
    await savePNG(grid, cropHeight * 2, `${name}-trunk-crop-grid.png`, cropWidth * 3);
    trunkVerification = { protectedPixels, maxRGBAErrorAcrossAllSixPreparedPoses: maxError, perPoseErrors, scope: 'entire main trunk, roots and principal forks; source-skeleton round corridors and union of structural ink; 14px soft corridor edges', cropGrid: `assets/illustrations/cel-six/${name}-trunk-crop-grid.png`, protectionPreview: `assets/illustrations/cel-six/${name}-trunk-protection.png`, visualAcceptance: 'pending' };
  }
  let fixedPixels = 0, maxFixedError = 0, movingPixels = 0, poseDifference = 0;
  for (let n = 0; n < mask.length; n++) {
    if (mask[n] === 0) fixedPixels++; else movingPixels++;
    for (const p of poses.slice(1)) for (let c = 0; c < 4; c++) {
      const diff = Math.abs(raw[n * 4 + c] - p[n * 4 + c]);
      if (!mask[n]) maxFixedError = Math.max(maxFixedError, diff);
      else if (c < 3) poseDifference += diff * raw[n * 4 + 3] / 255;
    }
  }
  const exactPeriodicClosure = render(poses, sequence, 0, mask).equals(render(poses, sequence, frameCount, mask));
  const adjacentLoopSeamExact = render(poses, sequence, frameCount - 1, mask).equals(render(poses, sequence, 0, mask));
  if (maxFixedError || !exactPeriodicClosure || !adjacentLoopSeamExact) throw new Error('Fixed-region or loop verification failed');
  const report = { source: `assets/illustrations/${name}-static.png`, output: `assets/illustrations/cel-six/${name}-six-wind.webp`, width, height: h, fps, sourcePoseCount: 6, sourcePoseHashes, preparedPoseHashes, adjacentPoseDifferences, generatedInputFrames: frameCount, registration, fixedPixels, movingPixels, maxFixedRegionChannelErrorBeforeEncoding: maxFixedError, trunkVerification, exactPeriodicClosure, adjacentLoopSeamExact, meanMovingPosePremultipliedRGBDifference: poseDifference / movingPixels / 3 / (poses.length - 1), poseHoldMs: holdFrames / fps * 1000, dissolveMs: dissolveFrames / fps * 1000, sequence: sequence.map(p => String.fromCharCode(65 + p)), closureTransition: 'F -> A uses the same 500ms smooth premultiplied dissolve as every other transition', composition: 'six unique drawn poses, anchor registration, fixed-region source restoration, premultiplied RGBA interpolation; no local displacement; interpolation is not counted as a new source picture', browserAcceptance: 'pending' };
  if (prepareOnly) return { ...report, preparedOnly: true };
  const temporary = path.join(outDir, `${name}-six-${process.pid}.tmp.webp`);
  const child = spawn(ffmpeg, ['-v', 'warning', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${h}`, '-r', String(fps), '-i', 'pipe:0', '-an', '-c:v', 'libwebp_anim', '-q:v', '94', '-lossless', '0', '-compression_level', '5', '-loop', '0', '-pix_fmt', 'bgra', temporary], { windowsHide: true });
  const errors = []; child.stderr.on('data', c => errors.push(c)); const done = once(child, 'close');
  for (let frame = 0; frame < frameCount; frame++) {
    const buffer = render(poses, sequence, frame, mask);
    if (!child.stdin.write(buffer)) await once(child.stdin, 'drain');
    if (frame % fps === 0) console.log(`${name}: ${frame}/${frameCount}`);
  }
  child.stdin.end(); const [code] = await done; if (code) throw new Error(Buffer.concat(errors).toString());
  const bytes = await readFile(temporary), container = inspectWebP(bytes);
  const md5 = await capture(['-v', 'error', '-i', temporary, '-fps_mode', 'passthrough', '-pix_fmt', 'rgba', '-f', 'framemd5', 'pipe:1']);
  const decodedFrames = md5.toString().split(/\r?\n/).filter(line => /^\s*\d+\s*,/.test(line)).length;
  if (decodedFrames !== container.encodedFrames) throw new Error(`Decoded ${decodedFrames}, encoded ${container.encodedFrames}`);
  const first = await capture(['-v', 'error', '-i', temporary, '-frames:v', '1', '-pix_fmt', 'rgba', '-f', 'rawvideo', 'pipe:1']);
  let decodedTransparentPixels = 0, decodedPartialAlphaPixels = 0, alphaChannelMaxError = 0;
  for (let i = 3; i < first.length; i += 4) { if (!first[i]) decodedTransparentPixels++; else if (first[i] < 255) decodedPartialAlphaPixels++; alphaChannelMaxError = Math.max(alphaChannelMaxError, Math.abs(first[i] - raw[i])); }
  if (!decodedTransparentPixels || Math.abs(container.durationMs - 6000) > 70 || container.animation.loopCount !== 0) throw new Error('Alpha, duration or loop count validation failed');
  await rename(temporary, path.join(outDir, `${name}-six-wind.webp`));
  return { ...report, bytes: bytes.length, ...container, decodedFrames, decodedTransparentPixels, decodedPartialAlphaPixels, alphaChannelMaxError, encoding: 'libwebp_anim q:v 94, lossless alpha', verification: 'every encoded frame decoded to RGBA framemd5; transparent and partial alpha inspected; all fixed pixels exact before encoding; adjacent seam and periodic closure exact before encoding' };
}

await mkdir(outDir, { recursive: true });
const reportPath = path.join(outDir, 'six-verification.json');
let report = {}; try { report = JSON.parse(await readFile(reportPath, 'utf8')); } catch {}
for (const name of names) {
  console.log(`Building drawn-pose loop: ${name}`);
  report[name] = await build(name);
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report[name]));
}
