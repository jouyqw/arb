    /* ─── 스크롤 해결사례 토스트 ─── */
    (function () {
      const box = document.getElementById('csToast');
      if (!box) return;
      const KEY = 'aubCaseToastOff';
      try { if (sessionStorage.getItem(KEY)) { box.remove(); return; } } catch (e) {}

      // 실제로 받아본 고민과, 그 고민을 어떻게 풀었는지 — 아래 사례·후기 섹션과 같은 내용
      const CASES = [
        { biz: '법무법인 · 민사',
          pain: '홈페이지는 잘 만들었는데 문의가 오지 않습니다',
          fix: '첫 화면 문구와 상담 버튼 위치를 다시 잡고 칼럼을 연결',
          out: '방문 → 상담으로 이어지는 동선 확보' },
        { biz: '한의원 · 전주',
          pain: '블로그를 올려도 문의로 이어지지 않아요',
          fix: '지역명 + 증상 키워드로 다시 설계하고 상담 버튼 정리',
          out: '신규 예약이 꾸준히 들어오는 구조로' },
        { biz: '세무법인',
          pain: '광고비에서 수수료를 얼마나 떼는지 알 수가 없어요',
          fix: '집행 내역 전액 공개 · 대행 수수료 0원',
          out: '광고비 100%를 매체 집행에만 투입' },
        { biz: '피부과 의원',
          pain: '메타 광고 하나에만 의존하고 있습니다',
          fix: '당근 · 구글 · 네이버 스마트플레이스까지 동시 운영',
          out: '채널별 유입을 매달 리포트로 확인' },
        { biz: '법무법인 · 이혼',
          pain: '광고를 멈추면 문의도 같이 끊깁니다',
          fix: '검색자가 실제로 묻는 질문을 칼럼으로 쌓아 자산화',
          out: '광고를 줄인 달에도 상담이 남았습니다' },
        { biz: '전문직 공통',
          pain: 'AI 검색에는 우리 회사가 나오지 않아요',
          fix: '질문-답변 구조 칼럼과 구조화 데이터로 GEO 설계',
          out: 'AI 답변의 인용 출처로 노출되도록' },
        { biz: '치과의원',
          pain: '임플란트와 교정 문의가 섞여 관리가 어렵습니다',
          fix: '키워드와 페이지를 분야별로 분리',
          out: '상담 분류가 쉬워지고 지역 검색 노출도 증가' },
        { biz: '성형외과',
          pain: '클릭은 많은데 예약으로 이어지지 않습니다',
          fix: '시술별 랜딩페이지와 모바일 상담 동선 정비',
          out: '광고비 대비 예약 효율 개선' }
      ];

      const elBiz = document.getElementById('csBiz');
      const elPain = document.getElementById('csPain');
      const elFix = document.getElementById('csFix');
      const elOut = document.getElementById('csOut');
      const reducedM = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const modal = document.getElementById('popOverlay');

      const STAY = 7000;            // 한 장이 머무는 시간
      const GAP = 2400;             // 다음 장까지 최소 간격
      const START = () => Math.max(320, innerHeight * 0.7);          // 히어로를 지난 뒤부터
      const STEP = () => Math.max(520, innerHeight * 0.8);           // 한 화면쯤 스크롤할 때마다 다음 장

      let idx = 0, visible = false, done = false, hideTimer = null;
      let lastY = pageYOffset, travel = 0, lastHide = 0;

      box.style.setProperty('--dur', STAY + 'ms');

      function stop(remember) {
        done = true;
        clearTimeout(hideTimer);
        hide();
        if (remember) { try { sessionStorage.setItem(KEY, '1'); } catch (e) {} }
      }
      function hide() {
        if (!visible) return;
        visible = false;
        lastHide = Date.now();
        box.classList.remove('on');
      }
      function show() {
        const c = CASES[idx];
        elBiz.textContent = c.biz;
        elPain.textContent = c.pain;
        elFix.textContent = c.fix;
        elOut.textContent = c.out;
        idx += 1;
        visible = true;
        travel = 0;
        void box.offsetWidth;               // 진행바 애니메이션 재시작
        box.classList.add('on');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(function () {
          hide();
          if (idx >= CASES.length) done = true;   // 한 바퀴 돌면 더 띄우지 않는다
        }, STAY);
      }

      function onScroll() {
        const y = pageYOffset;
        travel += Math.abs(y - lastY);
        lastY = y;
        if (done) return;
        if (visible) {
          if (y < START() * 0.6) hide();          // 맨 위로 돌아가면 접는다
          return;
        }
        if (y < START()) return;
        if (travel < STEP()) return;
        if (Date.now() - lastHide < GAP) return;
        if (document.hidden) return;
        if (modal && modal.classList.contains('on')) return;   // 진단 팝업과 겹치지 않게
        show();
      }

      addEventListener('scroll', onScroll, { passive: true });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { clearTimeout(hideTimer); hide(); }
      });
      if (modal && window.MutationObserver) {          // 진단 팝업이 열리면 즉시 접는다
        new MutationObserver(function () {
          if (modal.classList.contains('on') && visible) { clearTimeout(hideTimer); hide(); }
        }).observe(modal, { attributes: true, attributeFilter: ['class'] });
      }

      document.getElementById('csClose').addEventListener('click', function () { stop(true); });
      document.getElementById('csCta').addEventListener('click', function () {
        stop(false);
        const sec = document.getElementById('scan');
        if (sec) sec.scrollIntoView({ behavior: reducedM ? 'auto' : 'smooth', block: 'start' });
        const input = document.getElementById('scanInput');
        if (input) setTimeout(function () { input.focus({ preventScroll: true }); }, 700);
      });
    })();
