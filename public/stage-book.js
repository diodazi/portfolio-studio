// A small, dependency-free project folio. Detail views remain owned by the host page.
const mountedBooks = new WeakMap();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountStageBook(root, projects = [], onOpen = () => {}) {
  mountedBooks.get(root)?.destroy();
  root.replaceChildren();
  const records = projects.filter(project => project && project.id && project.title);
  if (!records.length) {
    root.append(element('p', 'stage-book-empty', '项目资料正在整理。'));
    return { destroy() {}, setIndex() {}, getIndex: () => 0 };
  }

  let index = 0;
  let ghost = null;
  let animations = [];
  let pointer = null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  const listen = (target, event, handler, options = {}) =>
    target.addEventListener(event, handler, { ...options, signal: abort.signal });

  const book = element('div', 'stage-book');
  book.setAttribute('role', 'region');
  book.setAttribute('aria-label', '现场项目档案');
  const viewport = element('div', 'stage-book-viewport');
  const stack = element('div', 'stage-book-stack');
  stack.setAttribute('aria-hidden', 'true');
  const page = element('article', 'stage-book-page');
  const pageTop = element('div', 'stage-book-top');
  const subtitle = element('p', 'stage-book-subtitle');
  const folio = element('span', 'stage-book-folio');
  pageTop.append(subtitle, folio);

  const title = element('h3', 'stage-book-title');
  const role = element('p', 'stage-book-role');
  const body = element('div', 'stage-book-body');
  const highlight = element('p', 'stage-book-highlight');
  const summary = element('p', 'stage-book-summary');
  body.append(highlight, summary);
  const footer = element('div', 'stage-book-footer');
  const period = element('span', 'stage-book-period');
  const open = element('button', 'stage-book-open');
  open.type = 'button';
  open.append(element('span', '', '展开档案'));
  const arrow = element('span', 'stage-book-open-arrow', '↗');
  arrow.setAttribute('aria-hidden', 'true');
  open.append(arrow);
  footer.append(period, open);
  page.append(pageTop, title, role, body, footer);
  viewport.append(stack, page);

  const controls = element('div', 'stage-book-controls');
  const previous = element('button', 'stage-book-turn', '←');
  const next = element('button', 'stage-book-turn', '→');
  previous.type = next.type = 'button';
  previous.setAttribute('aria-label', '上一页项目');
  next.setAttribute('aria-label', '下一页项目');
  const count = element('span', 'stage-book-count');
  count.setAttribute('aria-live', 'polite');
  count.setAttribute('aria-atomic', 'true');
  controls.append(previous, count, next);
  book.append(viewport, controls);
  root.append(book);

  function update() {
    const project = records[index];
    subtitle.textContent = project.subtitle || '现场项目';
    folio.textContent = String(index + 1).padStart(2, '0');
    title.textContent = project.title;
    role.textContent = project.role || '';
    highlight.textContent = project.highlight || '';
    summary.textContent = Array.isArray(project.description) ? project.description[0] || '' : '';
    period.textContent = project.period || '';
    open.setAttribute('aria-label', `查看《${project.title}》项目详情`);
    page.setAttribute('aria-label', `《${project.title}》`);
    count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(records.length).padStart(2, '0')}`;
    count.setAttribute('aria-label', `第 ${index + 1} 页，共 ${records.length} 页`);
    previous.disabled = index === 0;
    next.disabled = index === records.length - 1;
    root.dataset.projectIndex = String(index);
  }

  function settle() {
    for (const animation of animations) animation.cancel();
    animations = [];
    ghost?.remove();
    ghost = null;
  }

  function setIndex(target, { animate = true } = {}) {
    const nextIndex = Math.max(0, Math.min(records.length - 1, Number(target) || 0));
    if (nextIndex === index) return;
    settle();
    const direction = nextIndex > index ? 1 : -1;
    const canAnimate = animate && !reducedMotion.matches && typeof page.animate === 'function';
    if (canAnimate) {
      ghost = page.cloneNode(true);
      ghost.classList.add('stage-book-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.inert = true;
      ghost.querySelectorAll('button, a').forEach(node => node.tabIndex = -1);
      viewport.append(ghost);
    }
    index = nextIndex;
    update();
    // Reaching an edge must not leave keyboard focus on a disabled control.
    if (document.activeElement === previous && previous.disabled) next.focus({ preventScroll: true });
    else if (document.activeElement === next && next.disabled) previous.focus({ preventScroll: true });
    if (!canAnimate) return;

    const outgoing = ghost;
    outgoing.style.transformOrigin = direction > 0 ? '0% 50%' : '100% 50%';
    const exit = outgoing.animate([
      { transform: 'perspective(1500px) rotateY(0deg) translateX(0)', opacity: 1 },
      { transform: `perspective(1500px) rotateY(${-direction * 64}deg) translateX(${-direction * 13}%)`, opacity: 0 }
    ], { duration: 420, easing: 'cubic-bezier(.22,.75,.2,1)', fill: 'forwards' });
    const enter = page.animate([
      { transform: `translateX(${direction * 16}px) scale(.985)`, opacity: .45 },
      { transform: 'translateX(0) scale(1)', opacity: 1 }
    ], { duration: 420, easing: 'cubic-bezier(.23,1,.32,1)' });
    animations = [exit, enter];
    exit.finished.then(() => {
      outgoing.remove();
      if (ghost === outgoing) { ghost = null; animations = []; }
    }).catch(() => {});
  }

  listen(previous, 'click', event => setIndex(index - 1, { animate: event.detail !== 0 }));
  listen(next, 'click', event => setIndex(index + 1, { animate: event.detail !== 0 }));
  listen(open, 'click', () => onOpen(records[index], open));
  listen(book, 'keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      setIndex(index + (event.key === 'ArrowRight' ? 1 : -1), { animate: false });
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setIndex(event.key === 'Home' ? 0 : records.length - 1, { animate: false });
    }
  });
  listen(viewport, 'pointerdown', event => {
    if (event.pointerType !== 'touch' || event.target.closest('button, a')) return;
    pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }, { passive: true });
  listen(viewport, 'pointerup', event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer = null;
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.4) setIndex(index + (dx < 0 ? 1 : -1));
  }, { passive: true });
  listen(viewport, 'pointercancel', () => { pointer = null; });
  listen(reducedMotion, 'change', () => { if (reducedMotion.matches) settle(); });
  update();

  const controller = {
    setIndex,
    getIndex: () => index,
    destroy() { settle(); abort.abort(); mountedBooks.delete(root); }
  };
  mountedBooks.set(root, controller);
  return controller;
}
