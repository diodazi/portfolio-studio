const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Motion is a progressive enhancement: content is never hidden waiting for JavaScript.
export function mountPageMotion() {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const toggle = document.querySelector('#motion-toggle');
  const reveals = new WeakSet();
  const pendingReveals = new Set();
  const observedSections = new WeakSet();
  const tiltTargets = new WeakSet();
  const imageTargets = new Set();
  const visibleImages = new Set();
  const animations = new Set();
  let userPaused = false;
  try { userPaused = localStorage.getItem('portfolio-motion-paused') === 'true'; } catch {}
  let enabled = false;
  let scrollFrame = 0;

  const progress = document.createElement('span');
  progress.className = 'page-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);

  function animate(node, frames, options) {
    if (!enabled || typeof node.animate !== 'function') return;
    const animation = node.animate(frames, options);
    animations.add(animation);
    animation.finished.catch(() => {}).finally(() => animations.delete(animation));
  }

  const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!pendingReveals.has(entry.target)) continue;
      if (!entry.target.isConnected) {
        revealObserver.unobserve(entry.target);
        pendingReveals.delete(entry.target);
        reveals.delete(entry.target);
        continue;
      }
      if (!entry.isIntersecting) continue;
      revealObserver.unobserve(entry.target);
      pendingReveals.delete(entry.target);
      animate(entry.target, [
        { opacity: .16, transform: 'translate3d(0, 18px, 0)' },
        { opacity: 1, transform: 'translate3d(0, 0, 0)' }
      ], { duration: 640, delay: Number(entry.target.dataset.revealDelay || 0), easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    }
  }, { threshold: .08, rootMargin: '0px 0px -28px 0px' });

  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target.classList.toggle('is-inview', entry.isIntersecting));
  }, { threshold: 0 });

  const imageObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.target.isConnected && imageTargets.has(entry.target)) visibleImages.add(entry.target);
      else visibleImages.delete(entry.target);
    });
    scheduleScroll();
  }, { rootMargin: '80px 0px' });

  function updateScroll() {
    scrollFrame = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? clamp(scrollY / max, 0, 1) : 0})`;
    if (!enabled) return;
    const measured = [...visibleImages].filter(image => image.isConnected).map(image => ({
      image, rect: image.parentElement.getBoundingClientRect()
    }));
    for (const { image, rect } of measured) {
      const amount = clamp((innerHeight / 2 - rect.top - rect.height / 2) / innerHeight, -.65, .65);
      // Keep displacement inside the extra image area, including short viewports.
      const travel = Math.min(finePointer.matches ? 42 : 20, rect.height * .045);
      image.style.transform = `translate3d(0, ${amount * travel}px, 0) scale(1.065)`;
    }
  }
  function scheduleScroll() {
    if (!scrollFrame && !document.hidden) scrollFrame = requestAnimationFrame(updateScroll);
  }

  function sync() {
    enabled = !userPaused && !reduced.matches && !document.hidden && !document.body.classList.contains('modal-open');
    root.dataset.motion = enabled ? 'running' : 'paused';
    if (toggle) {
      const paused = userPaused || reduced.matches;
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.setAttribute('aria-label', paused ? '开启背景动效' : '暂停背景动效');
      toggle.title = reduced.matches ? '已跟随系统减少动态效果设置' : paused ? '开启背景动效' : '暂停背景动效';
      toggle.disabled = reduced.matches;
    }
    window.dispatchEvent(new CustomEvent('portfolio-motion-change', { detail: { enabled } }));
    if (!enabled) {
      animations.forEach(animation => animation.cancel());
      animations.clear();
      document.querySelectorAll('.photo-button:not([data-fixed-frame]) img,.writing-tile,.stage-book-viewport').forEach(node => {
        node.style.transform = '';
      });
    }
    scheduleScroll();
  }
  toggle?.addEventListener('click', () => {
    userPaused = !userPaused;
    try { localStorage.setItem('portfolio-motion-paused', String(userPaused)); } catch {}
    sync();
  });
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', scheduleScroll, { passive: true });
  document.addEventListener('focusin', () => {
    animations.forEach(animation => {
      if (animation.effect?.target?.contains(document.activeElement)) animation.finish();
    });
  });

  function bindTilt(node) {
    if (tiltTargets.has(node)) return;
    tiltTargets.add(node);
    let rect, frame = 0, px = 0, py = 0;
    const reset = () => {
      cancelAnimationFrame(frame); frame = 0; rect = null;
      node.style.transform = '';
    };
    node.addEventListener('pointerenter', event => {
      if (enabled && finePointer.matches && event.pointerType !== 'touch') rect = node.getBoundingClientRect();
    });
    node.addEventListener('pointermove', event => {
      if (!enabled || !finePointer.matches || event.pointerType === 'touch') return;
      rect ||= node.getBoundingClientRect();
      px = clamp((event.clientX - rect.left) / rect.width - .5, -.5, .5);
      py = clamp((event.clientY - rect.top) / rect.height - .5, -.5, .5);
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        if (enabled) node.style.transform = `perspective(1100px) rotateX(${-py * 5}deg) rotateY(${px * 7}deg) translateY(-3px)`;
      });
    }, { passive: true });
    node.addEventListener('pointerleave', reset);
    node.addEventListener('pointercancel', reset);
    window.addEventListener('scroll', reset, { passive: true });
  }

  function refresh() {
    for (const node of pendingReveals) {
      if (node.isConnected) continue;
      revealObserver.unobserve(node);
      pendingReveals.delete(node);
      reveals.delete(node);
    }
    for (const image of imageTargets) {
      if (image.isConnected) continue;
      imageObserver.unobserve(image);
      imageTargets.delete(image);
      visibleImages.delete(image);
    }
    document.querySelectorAll('main > section').forEach(section => {
      if (!observedSections.has(section)) { observedSections.add(section); sectionObserver.observe(section); }
    });
    const selectors = '.hero-copy > *, .section-heading > *, .stage-intro > *, .project-list, .film-column, .audio-column, .about-section > *, .contact-section > *, .photo-card:not([data-exhibit])';
    document.querySelectorAll(selectors).forEach((node, index) => {
      if (reveals.has(node)) return;
      reveals.add(node);
      pendingReveals.add(node);
      node.dataset.revealDelay = String((index % 3) * 65);
      revealObserver.observe(node);
    });
    document.querySelectorAll('.writing-tile,.stage-book-viewport').forEach(bindTilt);
    document.querySelectorAll('.photo-button:not([data-fixed-frame]) img').forEach(image => {
      if (!imageTargets.has(image)) { imageTargets.add(image); imageObserver.observe(image); }
    });
    scheduleScroll();
  }
  sync();
  refresh();
  return { refresh };
}
