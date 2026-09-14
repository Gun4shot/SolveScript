import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observeScrollScene, sceneStyleWriter } from './scrollScene.js';

function fixture({ reduced = false } = {}) {
  const win = new EventTarget();
  const doc = new EventTarget();
  const motion = new EventTarget();
  motion.matches = reduced;
  const frames = new Map();
  let sequence = 0;
  let reads = 0;
  let enter;
  let resized;
  Object.assign(win, {
    scrollY: 1000, innerHeight: 800, innerWidth: 1200,
    matchMedia: () => motion,
    requestAnimationFrame: fn => { const id = ++sequence; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    IntersectionObserver: class { constructor(fn) { enter = fn; } observe() {} disconnect() {} },
    ResizeObserver: class { constructor(fn) { resized = fn; } observe() {} disconnect() {} },
  });
  Object.assign(doc, { defaultView: win, hidden: false, body: {} });
  const root = { ownerDocument: doc, dataset: {}, offsetHeight: 3200, documentTop: 1000,
    getBoundingClientRect() { reads++; return { top: this.documentTop - win.scrollY }; },
  };
  const progress = [];
  const activity = [];
  const stop = observeScrollScene(root, { onProgress: p => progress.push(p), onActiveChange: a => activity.push(a) });
  return {
    win, doc, motion, root, progress, activity, stop, frames,
    enter: (value, ratio = value ? 0.25 : 0) => enter([{ isIntersecting: value, intersectionRatio: ratio }]),
    resize: () => resized(),
    reads: () => reads,
    scroll: y => { win.scrollY = y; win.dispatchEvent(new Event('scroll')); },
    flush: () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); },
  };
}

test('offscreen scenes do no work; re-entry catches up and cleanup cancels queued work', () => {
  const f = fixture();
  f.scroll(1500);
  assert.equal(f.frames.size, 0);
  f.enter(true); f.flush();
  assert.equal(f.progress.at(-1), 0.20833);
  f.scroll(1600); f.enter(false); f.flush();
  assert.equal(f.progress.length, 1);
  f.scroll(2200); f.enter(true); f.flush();
  assert.equal(f.progress.at(-1), 0.5);
  assert.deepEqual(f.activity, [true, false, true]);
  f.scroll(2300); f.stop(); f.flush(); f.scroll(2400);
  assert.equal(f.frames.size, 0);
  assert.equal(f.progress.length, 2);
});

test('a scene touching the viewport boundary stays paused until pixels are visible', () => {
  const f = fixture();
  f.enter(true, 0); f.flush();
  assert.equal(f.root.dataset.sceneActive, 'false');
  assert.equal(f.progress.length, 0);
  f.enter(true, 0.01); f.flush();
  assert.equal(f.root.dataset.sceneActive, 'true');
  f.enter(true, 0); f.flush();
  assert.equal(f.root.dataset.sceneActive, 'false');
  f.stop();
});

test('scroll events coalesce and reuse geometry until a resize or layout shift', () => {
  const f = fixture(); f.enter(true); f.flush();
  f.scroll(1100); f.scroll(1200); f.scroll(1300);
  assert.equal(f.frames.size, 1);
  f.flush();
  assert.equal(f.reads(), 1);
  assert.equal(f.progress.at(-1), 0.125);
  f.scroll(1300); f.flush();
  assert.equal(f.progress.length, 2);
  f.root.documentTop = 1100; f.resize(); f.flush();
  assert.equal(f.reads(), 2);
  assert.equal(f.progress.at(-1), 0.08333);
  f.stop();
});

test('hidden tabs stop work and resume at the current position', () => {
  const f = fixture(); f.enter(true); f.flush();
  f.doc.hidden = true; f.doc.dispatchEvent(new Event('visibilitychange'));
  f.scroll(2000); f.flush();
  assert.equal(f.progress.length, 1);
  assert.equal(f.root.dataset.sceneActive, 'false');
  f.doc.hidden = false; f.doc.dispatchEvent(new Event('visibilitychange')); f.flush();
  assert.equal(f.progress.at(-1), 0.41667);
  f.stop();
});

test('reduced motion disables animation, including preference changes during a queued frame', () => {
  const f = fixture({ reduced: true }); f.enter(true); f.scroll(1500); f.flush();
  assert.equal(f.progress.length, 0);
  f.motion.matches = false; f.motion.dispatchEvent(new Event('change')); f.flush();
  assert.equal(f.progress.length, 1);
  f.scroll(1800);
  f.motion.matches = true; f.motion.dispatchEvent(new Event('change')); f.flush();
  assert.equal(f.progress.length, 1);
  assert.equal(f.root.dataset.sceneActive, 'false');
  f.stop();
});

test('style writer skips repeated values and insignificant floating-point noise', () => {
  const writes = [];
  const write = sceneStyleWriter({ style: { setProperty: (...args) => writes.push(args) } });
  write('--progress', 0.5); write('--progress', 0.500000001); write('--progress', 0.75);
  assert.deepEqual(writes, [['--progress', '0.5'], ['--progress', '0.75']]);
});
