(() => {
  'use strict';
  const hero = document.querySelector('.hero-city');
  if (!hero) return;
  const video = hero.querySelector('video');
  const toggle = hero.querySelector('.hero-motion-toggle');
  const label = toggle.querySelector('span');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  let userPaused = false;
  let userStarted = false;
  let visible = true;
  let failed = false;
  let loaded = false;
  let playRequest = 0;

  // No video request is made until motion is permitted or explicitly requested.
  const automaticMotionAllowed = () => !reduced.matches && !connection?.saveData;
  const shouldPlay = () => !failed && visible && !document.hidden && !userPaused && (userStarted || automaticMotionAllowed());
  function updateButton(playing) {
    toggle.setAttribute('aria-pressed', String(playing));
    toggle.setAttribute('aria-label', playing ? '배경 영상 일시정지' : '배경 영상 재생');
    label.textContent = playing ? '배경 일시정지' : '배경 재생';
  }
  function setSource() {
    if (loaded) return;
    loaded = true;
    video.muted = true;
    video.defaultMuted = true;
    video.src = matchMedia('(max-width:680px)').matches
      ? '/assets/hero/city-flight-mobile.mp4'
      : '/assets/hero/city-flight.mp4';
  }
  async function syncPlayback() {
    const request = ++playRequest;
    if (!shouldPlay()) { video.pause(); updateButton(false); return; }
    setSource();
    try {
      await video.play();
      if (request !== playRequest) return;
      if (!shouldPlay()) { video.pause(); updateButton(false); }
    } catch {
      // Autoplay can be denied on low-power devices; keep the poster and play control.
      if (request === playRequest) updateButton(false);
    }
  }
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    if (!video.paused) { userPaused = true; userStarted = false; }
    else { userPaused = false; userStarted = true; }
    syncPlayback();
  });
  video.addEventListener('playing', () => {
    if (!shouldPlay()) { video.pause(); return; }
    hero.classList.add('has-city-video');
    updateButton(true);
  });
  video.addEventListener('pause', () => updateButton(false));
  video.addEventListener('error', () => {
    failed = true;
    video.pause();
    hero.classList.remove('has-city-video');
    toggle.hidden = true;
  });
  document.addEventListener('visibilitychange', syncPlayback);
  function preferenceChanged() {
    userStarted = false;
    if (!automaticMotionAllowed()) hero.classList.remove('has-city-video');
    syncPlayback();
  }
  reduced.addEventListener('change', preferenceChanged);
  connection?.addEventListener('change', preferenceChanged);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      syncPlayback();
    }, { threshold: 0 }).observe(hero);
  }
  syncPlayback();
})();
