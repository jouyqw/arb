(() => {
  const stage = document.getElementById('baStage');
  if (!stage) return;
  const slider = document.getElementById('baRange');
  const before = document.getElementById('baBefore');
  const after = document.getElementById('baAfter');
  const cases = {
    law: {name:'법률사무소',project:'법률사무소 · 신뢰와 상담 동선 중심',points:['방문 인사 중심의 첫 화면을 핵심 메시지와 업무 분야 중심으로 정리했습니다.','차분한 네이비와 공간 이미지로 법률사무소의 신뢰감을 표현했습니다.','업무 분야와 상담 절차를 쉽게 찾도록 PC와 모바일 구성을 조정했습니다.']},
    medical: {name:'의원',project:'의원 · 편안한 첫 방문 경험',points:['긴 소개 대신 방문자가 궁금해하는 진료 과정과 첫 방문 안내를 앞세웠습니다.','밝은 공간 이미지와 부드러운 색조로 편안한 분위기를 만들었습니다.','진료 정보와 방문 안내가 작은 화면에서도 자연스럽게 이어지도록 구성했습니다.']},
    interior: {name:'인테리어 스튜디오',project:'인테리어 · 공간과 프로젝트 중심',points:['추상적인 회사 소개를 줄이고 공간의 성격과 작업 방향을 먼저 보여줍니다.','공간 사진을 넓게 사용해 재료와 빛, 공간의 깊이를 전달합니다.','프로젝트 탐색에서 문의 안내까지 기기별로 간결하게 연결했습니다.']}
  };
  let selected = 'law';
  let device = 'desktop';
  const updateSplit = () => {
    stage.style.setProperty('--split', slider.value + '%');
    slider.setAttribute('aria-valuetext', '변경 전 ' + slider.value + '%, 변경 후 ' + (100 - Number(slider.value)) + '% 표시');
  };
  const updateView = () => {
    const item = cases[selected];
    const mobile = device === 'mobile';
    stage.classList.toggle('is-mobile', mobile);
    before.src = '/assets/renewal/reference-' + selected + '-before-' + device + '.webp';
    after.src = '/assets/renewal/reference-' + selected + '-after-' + device + '.webp';
    before.alt = item.name + ' 리뉴얼 전 디자인 예시';
    after.alt = item.name + ' 리뉴얼 후 디자인 예시';
    before.width = after.width = mobile ? 375 : 1425;
    before.height = after.height = mobile ? 844 : 1000;
    document.getElementById('baProject').textContent = item.project;
    document.querySelectorAll('[data-case]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.case === selected)));
    document.querySelectorAll('.ba-device').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.device === device)));
    item.points.forEach((text,i) => document.getElementById('baPoint'+i).textContent=text);
    slider.value = '50';
    updateSplit();
  };
  slider.addEventListener('input', updateSplit);
  document.querySelectorAll('[data-case]').forEach(button => button.addEventListener('click', () => { selected=button.dataset.case; updateView(); }));
  document.querySelectorAll('.ba-device').forEach(button => button.addEventListener('click', () => { device=button.dataset.device; updateView(); }));
  updateSplit();
})();
