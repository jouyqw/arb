(() => {
  const stage = document.getElementById('baStage');
  if (!stage) return;
  const slider = document.getElementById('baRange');
  const before = document.getElementById('baBefore');
  const after = document.getElementById('baAfter');
  const update = () => {
    stage.style.setProperty('--split', slider.value + '%');
    slider.setAttribute('aria-valuetext', '변경 전 ' + slider.value + '%, 변경 후 ' + (100 - Number(slider.value)) + '% 표시');
  };
  slider.addEventListener('input', update);
  document.querySelectorAll('.ba-device').forEach(button => {
    button.addEventListener('click', () => {
      const mobile = button.dataset.device === 'mobile';
      document.querySelectorAll('.ba-device').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      stage.classList.toggle('is-mobile', mobile);
      const device = mobile ? 'mobile' : 'desktop';
      before.src = '/assets/renewal/before-' + device + '.webp';
      after.src = '/assets/renewal/after-' + device + '.webp';
      before.width = after.width = mobile ? 375 : 1425;
      before.height = after.height = mobile ? 844 : 1000;
      slider.value = '50';
      update();
    });
  });
  update();
})();
