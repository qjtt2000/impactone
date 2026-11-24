/* Impact One daily audio: supported system controls and per-edition resume. */
(() => {
  'use strict';
  const audio = document.getElementById('daily-audio-track');
  const button = document.getElementById('daily-audio-toggle');
  const status = document.getElementById('daily-audio-status');
  if (!audio || !button || audio.dataset.ioPlayer) return;
  audio.dataset.ioPlayer = '20261124';
  const edition = location.pathname.split('/').pop().replace(/\.html$/, '');
  const storageKey = 'impactone_audio_position_' + edition;
  const session = navigator.mediaSession;
  let savedPosition = 0, lastSaved = -1, controlsReady = false;
  try { savedPosition = Number(localStorage.getItem(storageKey)) || 0; } catch {}
  if (!Number.isFinite(savedPosition) || savedPosition < 0) savedPosition = 0;

  function message(text) {
    if (status) { status.textContent = text; status.hidden = !text; }
  }
  function persist() {
    const time = audio.ended ? 0 : audio.currentTime;
    if (!Number.isFinite(time) || time < 0) return;
    try {
      if (time < 1 || audio.ended) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, String(time));
    } catch {}
    lastSaved = Math.floor(time);
  }
  function position() {
    if (!session?.setPositionState || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    try {
      session.setPositionState({
        duration: audio.duration,
        position: Math.min(audio.duration, Math.max(0, audio.currentTime)),
        playbackRate: audio.playbackRate || 1
      });
    } catch {}
  }
  function update() {
    const playing = !audio.paused && !audio.ended;
    button.setAttribute('aria-pressed', String(playing));
    button.textContent = playing ? '暂停收听' : audio.currentTime > 1 && !audio.ended ? '继续收听' : '听新闻';
    if (controlsReady && session) {
      try { session.playbackState = audio.ended ? 'none' : playing ? 'playing' : 'paused'; } catch {}
      position();
    }
  }
  function restore() {
    if (!savedPosition || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    if (savedPosition < audio.duration - 2) {
      try { audio.currentTime = savedPosition; message('已记住上次收听位置，点“继续收听”接着听。'); } catch {}
    } else { try { localStorage.removeItem(storageKey); } catch {} }
    savedPosition = 0;
    update();
  }
  function configureSystemControls() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    if (!session || controlsReady) return;
    controlsReady = true;
    try {
      if (typeof MediaMetadata === 'function') {
        const image = document.querySelector('meta[property="og:image"]')?.content;
        session.metadata = new MediaMetadata({
          title: '影响力·' + (edition.endsWith('-ny') ? '纽约' : '全球') + '·每日必读｜' + edition.replace(/-ny$/, ''),
          artist: 'Impact One',
          album: '每日必读',
          ...(image ? { artwork: [{ src: image, sizes: '600x600', type: 'image/jpeg' }] } : {})
        });
      }
    } catch {}
    function seek(time) {
      if (!Number.isFinite(time) || !Number.isFinite(audio.duration)) return;
      audio.currentTime = Math.min(audio.duration, Math.max(0, time));
      persist(); position();
    }
    for (const [action, handler] of [
      ['play', play],
      ['pause', () => { audio.pause(); persist(); }],
      ['stop', () => { audio.pause(); audio.currentTime = 0; persist(); update(); }],
      ['seekto', event => seek(event.seekTime)],
      ['seekbackward', event => seek(audio.currentTime - (event.seekOffset || 15))],
      ['seekforward', event => seek(audio.currentTime + (event.seekOffset || 15))]
    ]) { try { session.setActionHandler(action, handler); } catch {} }
  }
  async function play() {
    message('');
    configureSystemControls();
    if (audio.error) audio.load();
    restore();
    try { await audio.play(); }
    catch (error) { if (error.name !== 'AbortError') message('暂时无法播放，请再点一次重试。'); }
    update();
  }
  button.addEventListener('click', () => {
    if (!audio.paused && !audio.ended) { audio.pause(); persist(); }
    else play();
  });
  audio.addEventListener('loadedmetadata', restore);
  audio.addEventListener('timeupdate', () => {
    if (Math.abs(Math.floor(audio.currentTime) - lastSaved) >= 5) persist();
    position();
  });
  audio.addEventListener('seeked', () => { persist(); position(); });
  audio.addEventListener('ratechange', position);
  audio.addEventListener('playing', () => { message(''); update(); });
  audio.addEventListener('play', update);
  audio.addEventListener('pause', () => { persist(); update(); });
  audio.addEventListener('ended', () => { persist(); update(); });
  audio.addEventListener('error', () => message('暂时无法播放，请再点一次重试。'));
  // Preserve position on navigation; do not pause or force background autoplay.
  document.addEventListener('visibilitychange', persist);
  window.addEventListener('pagehide', persist);
  window.addEventListener('pageshow', update);
  restore(); update();
})();
