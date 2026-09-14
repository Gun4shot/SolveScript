// One scheduler per scene: no scroll work or GPU activity outside the viewport.
export function observeScrollScene(root, { onProgress, onActiveChange = () => {} }) {
  const win = root.ownerDocument.defaultView;
  const doc = root.ownerDocument;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let intersecting = false;
  let active = false;
  let disposed = false;
  let frame = 0;
  let measure = true;
  let top = 0;
  let distance = 1;
  let width = 0;
  let previous = -1;

  const update = () => {
    frame = 0;
    if (!active || disposed) return;
    if (measure) {
      top = root.getBoundingClientRect().top + win.scrollY;
      distance = Math.max(1, root.offsetHeight - win.innerHeight);
      width = win.innerWidth;
      measure = false;
      previous = -1;
    }
    const progress = Math.round(Math.max(0, Math.min(1, (win.scrollY - top) / distance)) * 100000) / 100000;
    if (progress === previous) return;
    previous = progress;
    onProgress(progress, width);
  };
  const schedule = () => {
    if (active && !disposed && !frame) frame = win.requestAnimationFrame(update);
  };
  const refresh = () => {
    if (disposed) return;
    measure = true;
    schedule();
  };
  const syncActivity = () => {
    if (disposed) return;
    const next = intersecting && !doc.hidden && !motion.matches;
    if (next === active) return;
    active = next;
    root.dataset.sceneActive = String(active);
    onActiveChange(active);
    if (active) refresh();
    else if (frame) { win.cancelAnimationFrame(frame); frame = 0; }
  };
  root.dataset.sceneActive = 'false';
  const visibility = new win.IntersectionObserver(([entry]) => {
    // An edge touching the viewport counts as intersecting even with zero pixels visible.
    intersecting = entry.isIntersecting && entry.intersectionRatio > 0;
    syncActivity();
  }, { threshold: 0.00001 });
  visibility.observe(root);
  const resize = new win.ResizeObserver(refresh);
  resize.observe(root);
  // A preceding section or a late font can shift this scene without resizing it.
  resize.observe(doc.body);
  doc.fonts?.ready.then(refresh);
  win.addEventListener('scroll', schedule, { passive: true });
  win.addEventListener('resize', refresh);
  doc.addEventListener('visibilitychange', syncActivity);
  motion.addEventListener('change', syncActivity);
  return () => {
    disposed = true;
    if (frame) win.cancelAnimationFrame(frame);
    visibility.disconnect();
    resize.disconnect();
    win.removeEventListener('scroll', schedule);
    win.removeEventListener('resize', refresh);
    doc.removeEventListener('visibilitychange', syncActivity);
    motion.removeEventListener('change', syncActivity);
    delete root.dataset.sceneActive;
  };
}

// Skip unchanged values and keep animation variables off the text/layout tree.
export function sceneStyleWriter(element) {
  const previous = new Map();
  return (name, value) => {
    const formatted = typeof value === 'number' ? String(Math.round(value * 10000) / 10000) : value;
    if (previous.get(name) === formatted) return;
    previous.set(name, formatted);
    element.style.setProperty(name, formatted);
  };
}
