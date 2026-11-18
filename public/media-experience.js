import {bilibiliVideoSource} from './video-source.js';
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const make = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const timeLabel = value => {
  if (!Number.isFinite(value)) return '0:00';
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
};
const addCorners = target => {
  target.append(make('span', 'screen-corner screen-corner-start'), make('span', 'screen-corner screen-corner-end'));
};

/** Mount public media displays. Sources are validated by the caller. */
export function mountMediaExperience({ videoRoot, audioRoot, videos = [], audio = [] }) {
  videoRoot.replaceChildren();
  audioRoot.replaceChildren();
  const cleanups = [];
  const players = [];
  let activeDialog = null;

  // Capture also covers players opened in the gallery or another media section.
  const onlyOnePlaying = event => {
    if (!(event.target instanceof HTMLMediaElement)) return;
    document.querySelectorAll('audio, video').forEach(player => {
      if (player !== event.target) player.pause();
    });
  };
  document.addEventListener('play', onlyOnePlaying, true);
  cleanups.push(() => document.removeEventListener('play', onlyOnePlaying, true));

  function createVideoTile(item) {
    const tile = make('button', 'screen-tile');
    tile.type = 'button';
    tile.setAttribute('aria-label', item ? `观看视频：${item.title}` : '展开视频展示空间');
    tile.setAttribute('aria-haspopup', 'dialog');
    if (item) tile.classList.add('is-work');
    if (item?.poster) {
      const poster = make('img', 'screen-poster');
      poster.src = item.poster;
      poster.alt = '';
      poster.loading = 'lazy';
      poster.width = 1200;
      poster.height = 825;
      poster.addEventListener('error', () => poster.remove(), { once: true });
      tile.append(poster);
    }
    if (item) {
      const play = make('span', 'screen-play', '▶');
      play.setAttribute('aria-hidden', 'true');
      tile.append(play);
    } else {
      const word = make('span', 'screen-word');
      word.append(make('span', '', 'Motion'), make('span', '', 'studies.'));
      tile.append(word);
    }
    const caption = make('span', 'screen-tile-caption');
    caption.append(make('span', 'screen-tile-title', item?.title || '影像作品正在整理'));
    const icon = make('span', 'screen-expand', '↗');
    icon.setAttribute('aria-hidden', 'true');
    caption.append(icon);
    tile.append(caption);
    addCorners(tile);
    tile.addEventListener('click', () => openScreen(tile, item));
    return tile;
  }

  function openScreen(trigger, item) {
    if (activeDialog) return;
    const startRect = trigger.getBoundingClientRect();
    const dialog = make('dialog', 'screen-dialog');
    const shell = make('div', 'screen-dialog-shell');
    const surface = make('div', 'screen-surface');
    const top = make('div', 'screen-dialog-top');
    const title = make('h2', 'screen-dialog-title', item?.title || '影像展示');
    title.id = 'screen-dialog-title';
    dialog.setAttribute('aria-labelledby', title.id);
    const close = make('button', 'screen-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', '关闭视频展示');
    top.append(title, close);
    addCorners(surface);
    let player, frame;
    const external = bilibiliVideoSource(item);
    document.querySelectorAll('audio, video').forEach(media => media.pause());
    if (external) {
      surface.classList.add('has-embed');
      frame = make('iframe', 'screen-player screen-embed');
      frame.title = `${item.title} — 哔哩哔哩播放器`;
      frame.src = external.embed;
      frame.allow = 'fullscreen; picture-in-picture; encrypted-media';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox');
      surface.append(frame);
    } else if (item?.src) {
      player = make('video', 'screen-player');
      player.src = item.src;
      player.controls = true;
      player.playsInline = true;
      player.preload = 'metadata';
      player.setAttribute('aria-label', item.title);
      if (item.poster) player.poster = item.poster;
      players.push(player);
      player.addEventListener('error', () => {
        if (surface.querySelector('.media-load-error')) return;
        surface.append(make('p', 'media-load-error', '视频暂时无法播放，请稍后重试。'));
      });
      surface.append(player);
    } else {
      const placeholder = make('div', 'screen-placeholder');
      const word = make('p', 'screen-word');
      word.append(make('span', '', 'Motion'), make('span', '', 'studies.'));
      placeholder.append(word, make('p', 'screen-pending', '视频作品待加入'));
      surface.append(placeholder);
    }
    shell.append(top, surface);
    if (external) {
      const footer = make('div', 'screen-source');
      const original = make('a', '', '在哔哩哔哩打开 ↗');
      original.href = external.original;
      original.target = '_blank';
      original.rel = 'noopener noreferrer';
      const retry = make('button', '', '重新加载播放器');
      retry.type = 'button';
      retry.addEventListener('click', () => { frame.src = external.embed; });
      footer.append(original, retry);
      shell.append(footer);
    }
    if (item?.description) shell.append(make('p', 'screen-description', item.description));
    dialog.append(shell);
    document.body.append(dialog);
    activeDialog = dialog;
    dialog.showModal();
    document.body.classList.add('modal-open');
    let closing = false;
    let openingAnimation;
    const destination = surface.getBoundingClientRect();
    const transformFrom = rect => `translate(${rect.left - destination.left}px, ${rect.top - destination.top}px) scale(${rect.width / destination.width}, ${rect.height / destination.height})`;
    if (!reducedMotion() && startRect.width && destination.width) {
      openingAnimation = surface.animate(
        [{ transform: transformFrom(startRect) }, { transform: 'none' }],
        { duration: 580, easing: 'cubic-bezier(.22,1,.36,1)' }
      );
      top.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 180, fill: 'backwards' });
    }
    close.focus({ preventScroll: true });

    async function closeScreen() {
      if (closing) return;
      closing = true;
      player?.pause();
      // Removing the browsing context immediately stops embedded playback too.
      frame?.remove();
      // Preserve the in-flight pose when Escape is pressed during expansion.
      const currentTransform = getComputedStyle(surface).transform;
      openingAnimation?.cancel();
      const endRect = trigger.getBoundingClientRect();
      if (!reducedMotion() && trigger.isConnected && endRect.bottom > 0 && endRect.top < innerHeight) {
        const currentRect = surface.getBoundingClientRect();
        const transform = `translate(${endRect.left - currentRect.left}px, ${endRect.top - currentRect.top}px) scale(${endRect.width / currentRect.width}, ${endRect.height / currentRect.height})`;
        dialog.classList.add('is-closing');
        await surface.animate([{ transform: currentTransform, opacity: 1 }, { transform, opacity: .7 }], {
          duration: 340, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards'
        }).finished.catch(() => {});
      }
      dialog.close();
      dialog.remove();
      if (player) {
        player.removeAttribute('src');
        player.load();
        const index = players.indexOf(player);
        if (index !== -1) players.splice(index, 1);
      }
      activeDialog = null;
      if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
      if (trigger.isConnected) trigger.focus({ preventScroll: true });
    }
    close.addEventListener('click', closeScreen);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeScreen(); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeScreen();
    });
  }

  if (!videos.length) {
    videoRoot.append(createVideoTile(null));
  } else {
    const pageSize = 2;
    const pageCount = Math.ceil(videos.length / pageSize);
    let page = 0, pageAnimation;
    const collection = make('div', 'screen-collection');
    if (pageCount > 1) collection.classList.add('has-pages');
    const list = make('ol', 'screen-list');
    list.id = 'screen-work-list';
    list.setAttribute('aria-label', '视频作品列表');
    const footer = make('div', 'screen-list-footer');
    const status = make('p', 'screen-list-status');
    status.setAttribute('role', 'status');
    const navigation = make('div', 'screen-list-nav');
    navigation.setAttribute('role', 'navigation');
    navigation.setAttribute('aria-label', '视频作品翻页');
    const previous = make('button', 'screen-list-arrow', '←');
    const next = make('button', 'screen-list-arrow', '→');
    const position = make('span', 'screen-list-position');
    for (const [button, label] of [[previous, '上一页视频'], [next, '下一页视频']]) {
      button.type = 'button';
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-controls', list.id);
    }
    navigation.append(previous, position, next);
    footer.append(status, navigation);
    collection.append(list, footer);
    videoRoot.append(collection);
    function renderVideoPage(delta = 0) {
      pageAnimation?.cancel();
      const start = page * pageSize;
      const shown = videos.slice(start, start + pageSize);
      list.replaceChildren(...shown.map(item => {
        const row = make('li', 'screen-list-item');
        row.append(createVideoTile(item));
        return row;
      }));
      list.start = start + 1;
      previous.disabled = page === 0;
      next.disabled = page === pageCount - 1;
      status.textContent = `${start + 1}–${start + shown.length} / ${videos.length} 部作品`;
      position.textContent = `${String(page + 1).padStart(2, '0')} / ${String(pageCount).padStart(2, '0')}`;
      position.setAttribute('aria-label', `第 ${page + 1} 页，共 ${pageCount} 页`);
      if (delta) {
        list.querySelector('button')?.focus({ preventScroll: true });
        list.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'instant' : 'smooth' });
        if (!reducedMotion()) pageAnimation = list.animate([
          { opacity: .3, transform: `translateY(${delta > 0 ? 14 : -14}px)` },
          { opacity: 1, transform: 'none' }
        ], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
      }
    }
    function turnVideoPage(delta) {
      const target = page + delta;
      if (activeDialog || target < 0 || target >= pageCount) return;
      page = target;
      renderVideoPage(delta);
    }
    previous.addEventListener('click', () => turnVideoPage(-1));
    next.addEventListener('click', () => turnVideoPage(1));
    cleanups.push(() => pageAnimation?.cancel());
    renderVideoPage();
  }

  function createAudioTrack(item) {
    const track = make('article', 'voice-track');
    const play = make('button', 'voice-wave-button');
    play.type = 'button';
    play.disabled = !item?.src;
    play.setAttribute('aria-label', item ? `播放声音：${item.title}` : '声音样本待加入');
    play.setAttribute('aria-pressed', 'false');
    const wave = make('span', 'voice-wave');
    wave.setAttribute('aria-hidden', 'true');
    const bars = [];
    for (let i = 0; i < 56; i++) {
      const bar = make('i');
      const height = .12 + .78 * Math.abs(Math.sin(i * .68) * Math.cos(i * .13));
      bar.style.height = `${height * 100}%`;
      bar.style.opacity = String(.3 + .65 * Math.abs(Math.cos(i * .11)));
      bars.push(bar);
      wave.append(bar);
    }
    const action = make('span', 'voice-action');
    const icon = make('span', 'voice-action-icon', '▶');
    icon.setAttribute('aria-hidden', 'true');
    const actionText = make('span', '', item ? '播放声音' : '声音样本待加入');
    action.append(icon, actionText);
    play.append(wave, action);
    track.append(play, make('h4', 'voice-title', item?.title || '声音展示'));
    if (item?.description) track.append(make('p', 'voice-description', item.description));
    if (!item?.src) return track;

    const player = make('audio');
    player.src = item.src;
    player.preload = 'metadata';
    player.setAttribute('aria-label', item.title);
    player.hidden = true;
    players.push(player);
    const controls = make('div', 'voice-controls');
    const time = make('span', 'voice-time', '0:00 / 0:00');
    const seek = make('input', 'voice-seek');
    seek.type = 'range';
    seek.min = 0;
    seek.max = 100;
    seek.step = .1;
    seek.value = 0;
    seek.disabled = true;
    seek.setAttribute('aria-label', `${item.title}：播放进度`);
    seek.setAttribute('aria-valuetext', '0:00');
    const mute = make('button', 'voice-mute', '静音');
    mute.type = 'button';
    mute.setAttribute('aria-pressed', 'false');
    mute.setAttribute('aria-label', `${item.title}：静音`);
    controls.append(time, mute, seek);
    track.append(controls, player);
    let context, analyser, frequency, frame = 0, inView = true, connecting = false;
    let errorMessage;

    function reportError(message) {
      if (!errorMessage) {
        errorMessage = make('p', 'media-load-error');
        errorMessage.setAttribute('role', 'status');
        track.append(errorMessage);
      }
      errorMessage.textContent = message;
    }
    function updateTime() {
      time.textContent = `${timeLabel(player.currentTime)} / ${timeLabel(player.duration)}`;
      const available = Number.isFinite(player.duration) && player.duration > 0;
      seek.disabled = !available;
      seek.value = available ? String(player.currentTime / player.duration * 100) : '0';
      seek.setAttribute('aria-valuetext', `${timeLabel(player.currentTime)}，共 ${timeLabel(player.duration)}`);
    }
    function restoreBars() { bars.forEach(bar => { bar.style.transform = 'scaleY(1)'; }); }
    function stopWave() { cancelAnimationFrame(frame); frame = 0; restoreBars(); }
    function drawWave(timestamp) {
      frame = 0;
      if (player.paused || player.ended || document.hidden || !inView || reducedMotion()) return;
      if (analyser && frequency) analyser.getByteFrequencyData(frequency);
      bars.forEach((bar, i) => {
        const scale = analyser && frequency
          ? .35 + frequency[Math.min(frequency.length - 1, Math.floor(i / bars.length * frequency.length))] / 255 * 1.4
          : .35 + .75 * Math.abs(Math.sin(timestamp * .0036 + i * .39));
        bar.style.transform = `scaleY(${scale})`;
      });
      frame = requestAnimationFrame(drawWave);
    }
    function scheduleWave() { if (!frame && !reducedMotion()) frame = requestAnimationFrame(drawWave); }
    async function connectAnalyzer() {
      // Cross-origin media can play normally; connecting it without CORS would silence it.
      const source = new URL(item.src, location.href);
      if (source.protocol !== 'blob:' && source.origin !== location.origin) return;
      if (context) { if (context.state === 'suspended') await context.resume().catch(() => {}); return; }
      if (connecting) return;
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      connecting = true;
      let sourceNode;
      try {
        context = new Context();
        // Keep native playback untouched if the audio context cannot start.
        await context.resume();
        if (context.state !== 'running') throw new Error('Audio analysis unavailable');
        sourceNode = context.createMediaElementSource(player);
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = .8;
        sourceNode.connect(analyser);
        analyser.connect(context.destination);
        frequency = new Uint8Array(analyser.frequencyBinCount);
      } catch {
        // Playback controls remain useful if the browser cannot provide analysis.
        analyser = null;
        if (sourceNode && context) {
          sourceNode.disconnect();
          sourceNode.connect(context.destination);
        } else {
          context?.close().catch(() => {});
          context = null;
        }
      } finally { connecting = false; }
    }
    play.addEventListener('click', async () => {
      if (!player.paused) { player.pause(); return; }
      if (errorMessage) errorMessage.textContent = '';
      connectAnalyzer();
      try { await player.play(); }
      catch { reportError('声音暂时无法播放，请重试或检查媒体文件。'); }
    });
    player.addEventListener('play', () => {
      play.setAttribute('aria-pressed', 'true');
      play.setAttribute('aria-label', `暂停声音：${item.title}`);
      icon.textContent = 'Ⅱ';
      actionText.textContent = '暂停';
      track.classList.add('is-playing');
      scheduleWave();
    });
    function paused() {
      play.setAttribute('aria-pressed', 'false');
      play.setAttribute('aria-label', `播放声音：${item.title}`);
      icon.textContent = '▶';
      actionText.textContent = player.ended ? '重新播放' : '播放声音';
      track.classList.remove('is-playing');
      stopWave();
    }
    player.addEventListener('pause', paused);
    player.addEventListener('ended', paused);
    player.addEventListener('error', () => { paused(); reportError('声音文件未能载入，请稍后重试。'); });
    player.addEventListener('loadedmetadata', updateTime);
    player.addEventListener('durationchange', updateTime);
    player.addEventListener('timeupdate', updateTime);
    seek.addEventListener('input', () => { if (Number.isFinite(player.duration)) player.currentTime = Number(seek.value) / 100 * player.duration; updateTime(); });
    mute.addEventListener('click', () => {
      player.muted = !player.muted;
      mute.textContent = player.muted ? '取消静音' : '静音';
      mute.setAttribute('aria-pressed', String(player.muted));
      mute.setAttribute('aria-label', `${item.title}：${mute.textContent}`);
    });
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView && !player.paused) scheduleWave(); else stopWave();
    });
    observer.observe(track);
    const visibility = () => { if (document.hidden) stopWave(); else if (!player.paused && inView) scheduleWave(); };
    document.addEventListener('visibilitychange', visibility);
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const motionChange = () => { if (motion.matches) stopWave(); else if (!player.paused && inView) scheduleWave(); };
    motion.addEventListener('change', motionChange);
    cleanups.push(() => {
      stopWave(); observer.disconnect(); document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', motionChange); context?.close().catch(() => {});
    });
    return track;
  }
  for (const item of audio.length ? audio : [null]) audioRoot.append(createAudioTrack(item));
  return () => {
    players.forEach(player => { player.pause(); player.removeAttribute('src'); player.load(); });
    cleanups.forEach(cleanup => cleanup());
    activeDialog?.remove();
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
  };
}
