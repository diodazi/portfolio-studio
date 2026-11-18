/** Subtle ambient light, with pointer input layered over a slow idle movement. */
export function mountLightField(canvas, button) {
  const ctx = canvas?.getContext('2d');
  if (!ctx) return { destroy() {} };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');
  const abort = new AbortController();
  const listen = (target, name, handler, options = {}) =>
    target?.addEventListener(name, handler, { ...options, signal: abort.signal });
  const rings = 42;
  const segments = 96;
  const rows = [];
  let width = 0, height = 0, dpr = 1;
  let frame = 0, previousPaint = 0, elapsed = 0;
  let inView = false, destroyed = false;
  let enabled = document.documentElement.dataset.motion !== 'paused';
  let baseX = -.36, baseY = .2, angleX = baseX, angleY = baseY;
  let pointerX = 0, pointerY = 0, variant = 0;
  let shadow;

  // Geometry and projected buffers are reused; the loop does not allocate point arrays.
  for (let v = 0; v < rings; v++) {
    const source = new Float32Array((segments + 1) * 3);
    const points = new Float32Array((segments + 1) * 2);
    const b = v / rings * Math.PI * 2;
    const cosB = Math.cos(b), sinB = Math.sin(b);
    for (let u = 0; u <= segments; u++) {
      const a = u / segments * Math.PI * 2;
      const radius = 1 + .12 * Math.cos(a * 2) + .32 * cosB;
      source[u * 3] = radius * Math.cos(a);
      source[u * 3 + 1] = radius * Math.sin(a);
      source[u * 3 + 2] = .36 * sinB + .16 * Math.sin(a * 2);
    }
    rows.push({ source, points, depth: 0, index: v, fill: null, stroke: null });
  }
  const ordered = [...rows];

  function makePaints() {
    if (!width || !height) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    shadow = ctx.createRadialGradient(width * .53, height * .84, 0, width * .53, height * .84, width * .28);
    shadow.addColorStop(0, 'rgba(73,82,93,.14)');
    shadow.addColorStop(1, 'rgba(73,82,93,0)');
    for (const row of rows) {
      const phase = row.index / rings;
      const fill = ctx.createLinearGradient(width * .16, height * .18, width * .82, height * .72);
      fill.addColorStop(0, `rgba(255,255,255,${.018 + phase * .016})`);
      fill.addColorStop(.43, `rgba(150,164,192,${.012 + phase * .009})`);
      fill.addColorStop(.62, `rgba(58,81,208,${.008 + phase * .008})`);
      fill.addColorStop(1, 'rgba(255,255,255,.018)');
      const stroke = ctx.createLinearGradient(width * .2, height * .1, width * .8, height * .8);
      stroke.addColorStop(0, `rgba(255,255,255,${.68 - phase * .2})`);
      stroke.addColorStop(.32, `rgba(85,96,114,${.25 + phase * .3})`);
      stroke.addColorStop(.5, 'rgba(232,241,255,.9)');
      stroke.addColorStop(.68, `rgba(45,74,240,${.3 + phase * .28})`);
      stroke.addColorStop(1, 'rgba(164,176,194,.28)');
      row.fill = fill;
      row.stroke = stroke;
    }
  }

  function paint() {
    if (!width || !height || destroyed) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const breathing = 1 + .018 * Math.sin(elapsed * .34);
    const roll = -.66 + .045 * Math.sin(elapsed * .16);
    const ca = Math.cos(angleX), sa = Math.sin(angleX);
    const cb = Math.cos(angleY), sb = Math.sin(angleY);
    const cs = Math.cos(roll), sn = Math.sin(roll);
    const scale = Math.min(width * .31, height * .39) * breathing;
    const centerX = width * .53;
    const centerY = height * .47 + Math.sin(elapsed * .27) * Math.min(5, height * .008);

    ctx.save();
    ctx.translate(0, height * .58);
    ctx.scale(1, .31);
    ctx.fillStyle = shadow;
    ctx.fillRect(0, 0, width, height * 2);
    ctx.restore();

    let minX = centerX, maxX = centerX, minY = centerY, maxY = centerY;
    for (const row of rows) {
      const source = row.source, points = row.points;
      let depth = 0;
      for (let u = 0; u <= segments; u++) {
        const x = source[u * 3], y = source[u * 3 + 1], z = source[u * 3 + 2];
        const yy = y * ca - z * sa;
        const zz = y * sa + z * ca;
        const xx = x * cb + zz * sb;
        const rotatedZ = -x * sb + zz * cb;
        const perspective = 1 / (1 + rotatedZ * .11);
        points[u * 2] = centerX + (xx * cs - yy * sn) * scale * perspective;
        points[u * 2 + 1] = centerY + (xx * sn + yy * cs) * scale * perspective;
        minX = Math.min(minX, points[u * 2]);
        maxX = Math.max(maxX, points[u * 2]);
        minY = Math.min(minY, points[u * 2 + 1]);
        maxY = Math.max(maxY, points[u * 2 + 1]);
        depth += rotatedZ;
      }
      row.depth = depth;
    }
    // Leave a small optical margin even when rotation projects outside the canvas.
    const margin = Math.min(24, width * .04, height * .04);
    const fit = Math.max(0, Math.min(1,
      (centerX - margin) / Math.max(1, centerX - minX),
      (width - centerX - margin) / Math.max(1, maxX - centerX),
      (centerY - margin) / Math.max(1, centerY - minY),
      (height - centerY - margin) / Math.max(1, maxY - centerY)
    ));
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(fit, fit);
    ctx.translate(-centerX, -centerY);
    ordered.sort((a, b) => a.depth - b.depth);
    for (const row of ordered) {
      ctx.beginPath();
      ctx.moveTo(row.points[0], row.points[1]);
      for (let u = 1; u <= segments; u++) ctx.lineTo(row.points[u * 2], row.points[u * 2 + 1]);
      ctx.closePath();
      ctx.fillStyle = row.fill;
      ctx.fill();
      ctx.strokeStyle = row.stroke;
      ctx.lineWidth = .8 + (row.index / rings > .8 ? .45 : 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  const canRun = () => enabled && !reduced.matches && inView && !document.hidden && !destroyed;
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousPaint = 0;
  }
  function tick(timestamp) {
    frame = 0;
    if (!canRun()) return;
    const interval = 1000 / (coarse.matches ? 24 : 30);
    if (!previousPaint || timestamp - previousPaint >= interval - .5) {
      const delta = previousPaint ? Math.min((timestamp - previousPaint) / 1000, .1) : interval / 1000;
      previousPaint = timestamp;
      elapsed += delta;
      const targetX = baseX + Math.sin(elapsed * .19) * .12 + pointerY;
      const targetY = baseY + Math.sin(elapsed * .13) * .27 + pointerX;
      const follow = 1 - Math.exp(-delta * 4.8);
      angleX += (targetX - angleX) * follow;
      angleY += (targetY - angleY) * follow;
      paint();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    if (!canRun()) { stop(); return; }
    if (!frame) frame = requestAnimationFrame(tick);
  }

  const resize = new ResizeObserver(([entry]) => {
    width = entry.contentRect.width;
    height = entry.contentRect.height;
    dpr = Math.min(devicePixelRatio || 1, coarse.matches ? 1.5 : 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    makePaints();
    paint();
    sync();
  });
  resize.observe(canvas);
  const visibility = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    sync();
  });
  visibility.observe(canvas);

  // Only input events measure the pointer rectangle, never the animation loop.
  listen(canvas, 'pointermove', event => {
    if (!canRun() || (event.pointerType === 'touch' && !event.buttons)) return;
    const rect = canvas.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / Math.max(rect.width, 1) - .5) * .7;
    pointerY = ((event.clientY - rect.top) / Math.max(rect.height, 1) - .5) * .45;
  }, { passive: true });
  listen(canvas, 'pointerleave', () => { pointerX = pointerY = 0; });
  listen(canvas, 'pointercancel', () => { pointerX = pointerY = 0; });
  listen(button, 'click', () => {
    variant++;
    baseX = -.36 + Math.sin(variant * 1.4) * .36;
    baseY = .2 + Math.cos(variant * 1.7) * .64;
    pointerX = pointerY = 0;
    if (!canRun()) { angleX = baseX; angleY = baseY; paint(); }
    else sync();
  });
  listen(document, 'visibilitychange', sync);
  listen(reduced, 'change', sync);
  listen(coarse, 'change', sync);
  listen(window, 'portfolio-motion-change', event => {
    enabled = event.detail?.enabled ?? document.documentElement.dataset.motion !== 'paused';
    sync();
  });

  return {
    destroy() {
      destroyed = true;
      stop();
      resize.disconnect();
      visibility.disconnect();
      abort.abort();
    }
  };
}
