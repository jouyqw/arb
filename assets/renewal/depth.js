(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ribbon = document.querySelector('.ticker');
  if (ribbon) {
    const track = ribbon.querySelector('.ticker-track');
    const group = ribbon.querySelector('.ticker-group');
    const toggle = ribbon.querySelector('.ticker-toggle');
    const duplicate = group.cloneNode(true);
    duplicate.setAttribute('aria-hidden', 'true');
    track.append(duplicate);
    ribbon.classList.add('is-ready');
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const paused = ribbon.classList.toggle('is-paused');
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.setAttribute('aria-label', paused ? '서비스 띠 재생' : '서비스 띠 일시정지');
      toggle.querySelector('span').textContent = paused ? '▷' : 'Ⅱ';
    });
    let inView = true;
    const sync = () => ribbon.classList.toggle('is-outside', !inView || document.hidden);
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }).observe(ribbon);
    }
  }

  const scene = document.querySelector('.device-scene');
  if (!scene) return;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let frame = 0;
  const reset = () => {
    cancelAnimationFrame(frame);
    scene.style.removeProperty('--scene-x');
    scene.style.removeProperty('--scene-y');
  };
  scene.addEventListener('pointermove', event => {
    if (reduced.matches || !finePointer.matches) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const box = scene.getBoundingClientRect();
      const x = Math.max(-.5, Math.min(.5, (event.clientX - box.left) / box.width - .5));
      const y = Math.max(-.5, Math.min(.5, (event.clientY - box.top) / box.height - .5));
      scene.style.setProperty('--scene-x', `${-y * 3}deg`);
      scene.style.setProperty('--scene-y', `${x * 5}deg`);
    });
  }, { passive: true });
  scene.addEventListener('pointerleave', reset);
  reduced.addEventListener('change', reset);
  finePointer.addEventListener('change', reset);
})();
