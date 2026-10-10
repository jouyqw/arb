    const AubDiag = (function () {
      /* 문의가 만들어지는 순서: 발견 → 유입 → 도착 → 신뢰 → 전환 → 측정
         앞 단계가 막히면 뒤 단계는 손봐야 소용이 없다. 그래서 단계별로 따로 채점한다. */
      const QUESTIONS = [
        {
          stage: null,
          q: '어떤 업종을 운영하고 계신가요?',
          why: '업종마다 고객이 검색하는 경로와 결정을 내리는 기준이 달라서, 같은 점수라도 해석이 달라집니다.',
          opts: [
            { t: '법무 · 법률', name: '법무·법률', focus: '신뢰' },
            { t: '병원 · 의원', name: '병원·의원', focus: '발견' },
            { t: '세무 · 회계', name: '세무·회계', focus: '신뢰' },
            { t: '인테리어 · 시공', name: '인테리어·시공', focus: '신뢰' },
            { t: '분양 · 부동산', name: '분양·부동산', focus: '전환' },
            { t: '그 외 서비스업', name: '서비스업', focus: '발견' }
          ]
        },
        {
          stage: '발견',
          q: '고객이 실제로 검색하는 말로 찾았을 때,<br>첫 페이지에 우리 자리가 몇 개나 보이나요?',
          why: '상호가 아니라 "지역 + 업종"처럼 고객이 실제로 치는 말 기준입니다. 첫 페이지 클릭은 위쪽 몇 자리에 몰리기 때문에, 노출 면이 하나뿐이면 나머지는 전부 경쟁사 몫이 됩니다.',
          opts: [
            { t: '상호를 쳐야만 나옵니다', d: '이미 아는 사람만 찾아오는 상태', s: 0 },
            { t: '한 곳 정도 걸립니다', d: '블로그나 지도 중 하나', s: 35 },
            { t: '두세 곳에 걸쳐 보입니다', d: '지도 + 블로그 정도', s: 70 },
            { t: '네 곳 이상 자리를 잡고 있습니다', d: '광고 · 지도 · 블로그 · 지식인 등', s: 100 }
          ],
          fix: [
            { b: '검색 첫 페이지에 자리부터 만들어야 합니다', p: '상호 검색만 걸린다는 건 신규 고객이 들어올 통로가 없다는 뜻입니다. 지역 키워드와 업종 키워드부터 순서대로 확보해야 나머지 단계가 의미를 갖습니다.' },
            { b: '노출 면을 하나에서 여러 개로 늘려야 합니다', p: '한 자리만 잡고 있으면 첫 페이지의 나머지는 전부 경쟁사가 가져갑니다. 지식인·카페·지도까지 면을 넓히면 같은 검색어에서 우리가 보이는 횟수 자체가 달라집니다.' },
            { b: '이제 경쟁 키워드 상단을 가져올 차례입니다', p: '기본 노출은 확보됐습니다. 광고와 상위노출을 같은 키워드에 겹쳐 얹으면 상단 점유율이 빠르게 올라갑니다.' },
            { b: '다음 자리는 AI 검색 답변 안입니다', p: '검색 첫 페이지는 이미 잡으셨습니다. 챗GPT·퍼플렉시티·네이버 Cue가 추천하는 이름에 들어가도록 GEO를 선점할 시점입니다.' }
          ]
        },
        {
          stage: '유입',
          q: '지금 들어오는 문의는<br>몇 개의 경로에서 나뉘어 오나요?',
          why: '한 채널에 의존하면 단가가 오르거나 로직이 한 번 바뀔 때 문의가 통째로 끊깁니다. 경로가 나뉘어 있을수록 매달 성과가 안정됩니다.',
          opts: [
            { t: '경로랄 게 없습니다', d: '소개와 지인 위주', s: 0 },
            { t: '사실상 한 곳에서만 옵니다', d: '네이버 또는 메타 하나', s: 35 },
            { t: '두 곳 정도에서 옵니다', s: 70 },
            { t: '세 곳 이상에서 고르게 옵니다', s: 100 }
          ],
          fix: [
/* chunk 0 */
            { b: '소개 외에 들어올 길을 만들어야 합니다', p: '소개는 통제할 수 없는 유입입니다. 검색과 지역 광고 중 업종에 맞는 하나를 골라 작게 시작하면, 매달 예측 가능한 문의가 생깁니다.' },
            { b: '한 채널 의존을 먼저 깨야 합니다', p: '지금 구조는 그 채널의 단가가 오르는 순간 그대로 흔들립니다. 당근·구글·메타 중 업종에 맞는 채널을 하나만 더 붙여도 위험이 크게 줄어듭니다.' },
            { b: '채널 사이 예산 배분을 손볼 단계입니다', p: '경로는 확보되어 있으니, 이제 성과가 낮은 쪽 예산을 주 단위로 옮기는 운영이 필요합니다.' },
            { b: '유입 구조는 안정적입니다', p: '경로가 고르게 나뉘어 있어 한 채널이 흔들려도 버팁니다. 이제 각 채널의 단가를 낮추는 쪽으로 넘어가면 됩니다.' }
          ]
        },
        {
          stage: '도착',
          q: '광고나 검색을 눌렀을 때<br>도착하는 화면은 어떤 상태인가요?',
          why: '클릭 비용은 도착지 상태와 상관없이 똑같이 나갑니다. 도착지가 약하면 광고를 잘할수록 손해가 커집니다.',
          opts: [
            { t: '홈페이지가 없습니다', d: '블로그나 SNS로 보냅니다', s: 0 },
            { t: '있지만 오래됐습니다', d: '3년 이상 손대지 못한 상태', s: 35 },
            { t: '쓸 만하지만 모바일이 불편합니다', d: '글씨가 작거나 버튼 찾기 어려움', s: 70 },
            { t: '검색어에 맞는 화면으로 보냅니다', d: '분야별 페이지가 따로 있음', s: 100 }
          ],
          fix: [
            { b: '도착지부터 만들어야 합니다', p: '블로그와 SNS는 검색에서 우리 이름이 아니라 플랫폼 이름으로 소비됩니다. 상담까지 이어질 도착지가 없으면 광고비는 그대로 새어 나갑니다.' },
            { b: '오래된 화면이 광고 효율을 갉아먹고 있습니다', p: '3년 전 구조는 지금의 검색 기준과 모바일 사용 습관을 따라가지 못합니다. 전체를 새로 만들기 전에 전환 동선부터 다시 짜는 편이 빠르고 쌉니다.' },
            { b: '모바일 화면을 기준으로 다시 짜야 합니다', p: '전문직 문의의 대부분은 휴대폰에서 발생합니다. 글자 크기와 버튼 위치를 모바일 기준으로 바꾸는 것만으로 같은 방문자에서 문의 수가 달라집니다.' },
            { b: '도착지는 제 역할을 하고 있습니다', p: '검색어와 화면이 맞물려 있습니다. 이제 방문자 수를 늘리는 쪽에 예산을 쓰면 됩니다.' }
          ]
        },
        {
          stage: '신뢰',
          q: '우리를 처음 본 사람이<br>확인할 수 있는 근거가 화면에 있나요?',
          why: '전문직은 가격이 아니라 믿음으로 고릅니다. 사례, 후기, 자격, 비용 공개처럼 남이 확인할 수 있는 근거의 양이 곧 전환율입니다.',
          opts: [
            { t: '회사 소개 정도만 있습니다', s: 0 },
            { t: '자격이나 경력은 적어 두었습니다', s: 35 },
            { t: '사례나 후기가 몇 건 있습니다', s: 70 },
            { t: '사례 · 후기 · 비용까지 공개합니다', d: '꾸준히 쌓고 있음', s: 100 }
          ],
          fix: [
            { b: '판단 근거가 화면에 없습니다', p: '회사 소개만으로는 처음 온 사람이 우리를 고를 이유를 찾지 못합니다. 실제 사례를 요지 중심으로 정리해 올리는 것이 가장 빠른 개선입니다.' },
            { b: '경력만으로는 부족합니다', p: '자격과 연차는 경쟁사도 똑같이 적어 둡니다. 우리가 어떤 사건과 시공을 어떻게 처리했는지가 있어야 비교에서 이깁니다.' },
            { b: '있는 사례를 쌓아 자산으로 만들 단계입니다', p: '몇 건으로는 검색에도 잡히지 않습니다. 사례를 정기적으로 쌓으면 신뢰 근거이면서 동시에 검색 유입 자산이 됩니다.' },
            { b: '신뢰 근거는 충분합니다', p: '이 자산을 검색과 AI 답변에 연결하면 같은 콘텐츠로 유입까지 가져올 수 있습니다.' }
          ]
        },
        {
          stage: '전환',
          q: '마음이 생긴 방문자가<br>문의하기까지 몇 번을 눌러야 하나요?',
          why: '단계가 하나 늘 때마다 이탈이 생깁니다. 특히 휴대폰에서는 전화나 채팅으로 한 번에 닿지 않으면 그대로 나가버립니다.',
          opts: [
/* chunk 45 */
            { t: '연락처를 찾아 직접 저장해야 합니다', s: 0 },
            { t: '메뉴를 거쳐 문의 페이지로 가야 합니다', s: 35 },
            { t: '화면마다 버튼이 있습니다', d: '전화 또는 카톡', s: 70 },
            { t: '어느 화면에서든 한 번에 닿습니다', d: '고정 버튼 + 간단한 상담 폼', s: 100 }
          ],
          fix: [
            { b: '문의 버튼부터 고정해야 합니다', p: '연락처를 찾게 만드는 순간 대부분 이탈합니다. 화면 하단에 전화와 카톡 버튼을 고정하는 작업만으로 문의 수가 눈에 띄게 올라갑니다.' },
            { b: '문의까지 가는 길이 너무 깁니다', p: '메뉴를 거쳐야 한다면 그 사이에 절반이 빠집니다. 모든 화면에서 바로 누를 수 있는 위치로 옮겨야 합니다.' },
            { b: '입력 부담을 더 줄일 수 있습니다', p: '버튼은 있으니, 이제 남길 항목을 두세 개로 줄이고 첫 화면 안에서 끝나게 만들면 전환이 한 번 더 올라갑니다.' },
            { b: '전환 동선은 잘 잡혀 있습니다', p: '들어온 사람을 놓치지 않는 구조입니다. 남은 과제는 들어오는 사람 수를 늘리는 것입니다.' }
          ]
        },
        {
          stage: '측정',
          q: '들어온 문의가 어디서 왔는지<br>채널별로 알고 계신가요?',
          why: '측정이 없으면 어느 예산을 줄이고 늘릴지 판단할 근거가 없습니다. 개선 자체가 불가능해지는 단계라 마지막에 묻습니다.',
          opts: [
            { t: '전혀 모릅니다', s: 0 },
            { t: '대략 감으로만 압니다', s: 35 },
            { t: '일부 채널만 확인됩니다', s: 70 },
            { t: '채널별 문의 수와 단가를 봅니다', d: '월 단위로 정리해 확인', s: 100 }
          ],
          fix: [
            { b: '측정 세팅이 가장 시급합니다', p: '어디서 왔는지 모르면 예산을 줄일 수도 늘릴 수도 없습니다. 전화·카톡·폼 각각에 유입 경로가 남도록 세팅하는 것부터 시작해야 합니다.' },
            { b: '감과 실제 수치는 자주 어긋납니다', p: '효과가 있다고 느낀 채널이 실제로는 단가가 가장 높은 경우가 많습니다. 한 장짜리 표로만 정리해도 낭비가 바로 드러납니다.' },
            { b: '측정에 뚫린 구멍을 메워야 합니다', p: '일부만 보이면 안 보이는 채널이 과소평가되어 잘못 잘려 나갑니다. 전 채널을 같은 기준으로 묶어야 비교가 됩니다.' },
            { b: '데이터 기반 운영이 자리 잡았습니다', p: '남은 건 반응이 좋은 매체로 예산을 옮기는 속도입니다. 주 단위로 조정하면 같은 예산에서 결과가 더 나옵니다.' }
          ]
        }
      ];

      const GRADES = [
        { min: 80, g: '상위권 · 확장 단계',
          h: '구조는 이미 완성되어 있습니다',
          s: '여섯 단계 중 막힌 곳이 거의 없습니다. 지금은 고칠 때가 아니라, 경쟁사가 아직 들어오지 않은 자리를 먼저 가져올 때입니다.' },
        { min: 60, g: '최적화 단계',
          h: '흐름은 있는데 한 곳에서 새고 있습니다',
          s: '대부분의 단계가 돌아가고 있어, 낮게 나온 한두 단계만 손봐도 예산을 늘리지 않고 문의 수를 올릴 수 있습니다.' },
        { min: 40, g: '성장 준비 단계',
          h: '단계가 중간에 끊겨 있습니다',
          s: '각 단계가 따로 놀고 있어 앞에서 만든 방문자가 뒤에서 빠져나갑니다. 끊긴 곳을 이어 붙이는 것만으로 체감이 크게 달라지는 구간입니다.' },
        { min: 0, g: '기초 단계',
          h: '아직 문의가 들어올 길이 열려 있지 않습니다',
          s: '지금은 광고비를 늘릴 때가 아니라 발견되는 자리와 도착지를 먼저 만들 때입니다. 순서만 지키면 적은 예산으로도 시작할 수 있습니다.' }
      ];
/* chunk 90 */

      const STAGES = ['발견', '유입', '도착', '신뢰', '전환', '측정'];

      const el = id => document.getElementById(id);
      const intro   = el('diagIntro'),  quiz   = el('diagQuiz'),
            loading = el('diagLoading'), result = el('diagResult'),
            optsBox = el('diagOpts'),    stepEl = el('diagStep'),
            barEl   = el('diagProgress'), backBtn = el('diagBackBtn');

      let idx = 0;
      let answers = [];
      let timers = [];
      let summaryText = '';

      function clearTimers() { timers.forEach(clearTimeout); timers = []; }

      function show(which) {
        intro.style.display   = which === 'intro'   ? 'block' : 'none';
        quiz.style.display    = which === 'quiz'    ? 'block' : 'none';
        loading.style.display = which === 'loading' ? 'block' : 'none';
        result.style.display  = which === 'result'  ? 'block' : 'none';
      }

      function render() {
        const item = QUESTIONS[idx];
        el('diagQ').innerHTML = item.q;
        el('diagWhy').innerHTML = '<b>이걸 왜 묻는가</b>' + item.why;
        el('diagStage').textContent = item.stage ? item.stage + ' 단계' : '기준 설정';
        el('diagFlow').innerHTML = STAGES.map(st =>
          '<span class="' + (st === item.stage ? 'on' : (STAGES.indexOf(st) < STAGES.indexOf(item.stage) ? 'done' : '')) + '">' + st + '</span>'
        ).join('');
        stepEl.textContent = '0' + (idx + 1) + ' / 0' + QUESTIONS.length;
        barEl.style.width = (idx / QUESTIONS.length * 100) + '%';
        backBtn.hidden = idx === 0;

        optsBox.innerHTML = '';
        item.opts.forEach((o, i) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'diag-opt';
          b.innerHTML = '<span class="okey">' + String.fromCharCode(65 + i) + '</span>' +
                        '<span class="otxt">' + o.t + (o.d ? '<small>' + o.d + '</small>' : '') + '</span>';
          b.addEventListener('click', () => choose(i));
          optsBox.appendChild(b);
        });
/* chunk 135 */
        el('diagQ').tabIndex = -1;
        el('diagQ').focus({ preventScroll: true });
        quiz.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }

      function choose(i) {
        answers[idx] = i;
        if (idx < QUESTIONS.length - 1) {
          idx++;
          render();
        } else {
          barEl.style.width = '100%';
          stepEl.textContent = '분석 중';
          analyze();
        }
      }

      function back() {
        if (idx > 0) { idx--; render(); }
      }

      function analyze() {
        show('loading');
        clearTimers();
        const steps = el('diagSteps').querySelectorAll('li');
        steps.forEach(s => s.classList.remove('on'));
        steps.forEach((s, i) => timers.push(setTimeout(() => s.classList.add('on'), 260 + i * 340)));
        timers.push(setTimeout(finish, 1750));
      }

      function finish() {
        const industry = QUESTIONS[0].opts[answers[0]] || QUESTIONS[0].opts[0];
        const stages = [];

        QUESTIONS.forEach((q, qi) => {
          if (!q.stage) return;
          const pick = q.opts[answers[qi]];
          stages.push({
            stage: q.stage,
            order: STAGES.indexOf(q.stage),
            score: pick.s,
            answer: pick.t,
            fix: q.fix[answers[qi]]
          });
        });
/* chunk 180 */

        const score = Math.round(stages.reduce((a, s) => a + s.score, 0) / stages.length);
        const grade = GRADES.find(g => score >= g.min);

        el('diagGrade').textContent = grade.g;
        el('diagHeadline').textContent = grade.h;
        el('diagSummary').textContent = industry.name + ' 업종 기준으로 보면, ' + grade.s;

        // 단계별 막대
        el('diagStages').innerHTML = stages.map(s =>
          '<div class="' + (s.score <= 35 ? 'weak' : '') + '">' +
            '<dt>' + s.stage + '</dt>' +
            '<dd><span data-w="' + s.score + '"></span></dd>' +
            '<em>' + s.score + '</em>' +
          '</div>'
        ).join('');
        timers.push(setTimeout(() => {
          el('diagStages').querySelectorAll('span[data-w]').forEach((b, i) => {
            setTimeout(() => { b.style.width = b.dataset.w + '%'; }, i * 90);
          });
        }, 120));

        // 처방 순서: 점수가 낮은 것부터, 같으면 앞 단계 먼저
        // (앞이 막혀 있는데 뒤부터 고치면 돈만 쓰기 때문)
        const ordered = stages.slice().sort((a, b) => a.score - b.score || a.order - b.order);
        const list = ordered.slice(0, 3);

        el('diagFix').innerHTML = list.map((s, i) =>
          '<div><span class="fnum">0' + (i + 1) + '</span><div>' +
          '<span class="fstage">' + s.stage + '</span>' +
          '<b>' + s.fix.b + '</b><p>' + s.fix.p + '</p></div></div>'
        ).join('');

        const weakest = ordered[0];
        el('diagOrderNote').textContent =
          weakest.score >= 70
            ? '여섯 단계 모두 기준을 넘겼습니다. 아래는 더 끌어올릴 수 있는 순서입니다.'
            : '지금 가장 앞에서 막힌 곳은 ' + weakest.stage + ' 단계입니다. ' +
              '앞 단계가 막힌 상태로 뒤를 손보면 비용만 늘기 때문에, 아래 순서대로 진행하는 것을 권합니다.';

        // 상담 시 붙여넣을 결과 요약
        summaryText =
          '[아비컴퍼니 AI 1분 진단 결과]\n' +
          '업종: ' + industry.name + '\n' +
          '종합: ' + score + '점 / 100점 (' + grade.g + ')\n\n' +
/* chunk 225 */
          '단계별 점수\n' +
          stages.map(s => '· ' + s.stage + ' ' + s.score + '점 — ' + s.answer).join('\n') + '\n\n' +
          '권장 순서\n' +
          list.map((s, i) => (i + 1) + '. [' + s.stage + '] ' + s.fix.b).join('\n');

        show('result');
        stepEl.textContent = '진단 완료';
        el('diagCopied').style.display = 'none';

        // 점수 카운트업 + 게이지
        const num = el('diagScore');
        setTimeout(() => { el('diagMeter').style.width = score + '%'; }, 80);
        let c = 0;
        const step = Math.max(1, Math.round(score / 34));
        const ti = setInterval(() => {
          c = Math.min(c + step, score);
          num.textContent = c;
          if (c >= score) clearInterval(ti);
        }, 26);
      }

      function start(scroll) {
        idx = 0;
        answers = [];
        clearTimers();
        show('quiz');
        render();
        if (scroll !== false) {
          quiz.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        }
      }

      function reset() {
        clearTimers();
        idx = 0; answers = [];
        barEl.style.width = '0%';
        stepEl.textContent = '무료 진단';
        el('diagMeter').style.width = '0';
        el('diagScore').textContent = '0';
        show('intro');
      }

      el('diagStartBtn').addEventListener('click', () => start(false));
      el('diagRetryBtn').addEventListener('click', reset);
      backBtn.addEventListener('click', back);
/* chunk 270 */

      // 결과 복사 후 카카오톡 열기
      el('diagCopyKakao').addEventListener('click', () => {
        const done = () => {
          el('diagCopied').style.display = 'block';
          window.open('https://pf.kakao.com/_wxjxiSX/chat', '_blank');
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(summaryText).then(done).catch(()=>alert('자동 복사가 차단되었습니다. 화면의 결과를 직접 복사한 뒤 상담해 주세요.'));
        } else {
          const ta = document.createElement('textarea');
          ta.value = summaryText;
          ta.style.cssText = 'position:fixed;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          try { if(!document.execCommand('copy')){ta.remove();alert('결과를 직접 복사해 주세요.');return;} } catch (e) {ta.remove();alert('결과를 직접 복사해 주세요.');return;}
          document.body.removeChild(ta);
          done();
        }
      });

      document.querySelectorAll('[data-diag-open]').forEach(b => {
        b.addEventListener('click', e => { e.preventDefault(); start(true); });
      });

      return { start: start };
    })();

    (function () {
      const form = document.getElementById('scanForm');
      if (!form) return;

      const inputEl  = document.getElementById('scanInput');
      const btn      = document.getElementById('scanBtn');
      const errBox   = document.getElementById('scanError');
      const loading  = document.getElementById('scanLoading');
      const result   = document.getElementById('scanResult');
      const nameBox  = document.getElementById('scanName');
      let timers = [];
      let summary = '';

      const esc = t => String(t == null ? '' : t)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      function reset() {
/* chunk 315 */
        timers.forEach(clearTimeout); timers = [];
        errBox.style.display = 'none';
        result.style.display = 'none';
        nameBox.style.display = 'none';
      }

      function fail(msg) {
        loading.style.display = 'none';
        errBox.style.display = 'block';
        errBox.textContent = msg;
      }

      form.addEventListener('submit', async e => {
        e.preventDefault();
        const value = inputEl.value.trim();
        if (!value) { inputEl.focus(); return; }

        reset();
        btn.disabled = true;
        btn.textContent = '검사 중';
        loading.style.display = 'block';

        const steps = document.getElementById('scanSteps').querySelectorAll('li');
        steps.forEach(s => s.classList.remove('on'));
        steps.forEach((s, i) => timers.push(setTimeout(() => s.classList.add('on'), 300 + i * 900)));

        try {
          const res = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ input: value })
          });
          const data = await res.json().catch(() => null);

          if (!data) { fail('결과를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.'); return; }
          if (!data.ok) { fail(data.message || '검사에 실패했습니다.'); return; }

          loading.style.display = 'none';
          if (data.kind === 'name') renderName(data);
          else renderSite(data);
        } catch (err) {
          fail('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
          btn.disabled = false;
          btn.textContent = '무료로 검사하기';
/* chunk 360 */
        }
      });

      function renderSite(d) {
        document.getElementById('scanTarget').innerHTML =
          '<b>' + esc(d.finalUrl) + '</b>' +
          (d.title ? esc(d.title) + '<br>' : '') +
          '응답 ' + d.ms + 'ms';

        document.getElementById('scanCats').innerHTML = d.cats.map(c =>
          '<div class="' + (c.score < 50 ? 'weak' : '') + '">' +
            '<dt>' + esc(c.name) + '</dt>' +
            '<dd><span data-w="' + c.score + '"></span></dd>' +
            '<em>' + c.score + '</em>' +
          '</div>'
        ).join('');

        document.getElementById('scanFix').innerHTML = d.fixes.length
          ? d.fixes.map((f, i) =>
              '<div><span class="fnum">0' + (i + 1) + '</span><div>' +
              '<span class="fcat">' + esc(f.cat) + '</span>' +
              '<b>' + esc(f.label) + '</b><p>' + esc(f.detail) + '</p></div></div>'
            ).join('')
          : '<div><span class="fnum">—</span><div><b>지적할 항목이 없습니다</b>' +
            '<p>검사한 범위에서는 모두 통과했습니다. 이제 노출을 늘리는 쪽으로 넘어가면 됩니다.</p></div></div>';

        const mark = { true: '○', warn: '△', false: '×' };
        document.getElementById('scanChecks').innerHTML = d.cats.map(c =>
          '<div class="scan-group"><h4>' + esc(c.name) + '</h4>' +
          c.checks.map(k =>
            '<div class="scan-item ' + (k.ok === true ? 'pass' : k.ok === 'warn' ? 'warn' : 'fail') + '">' +
              '<span class="scan-mark">' + mark[String(k.ok)] + '</span>' +
              '<div><b>' + esc(k.label) + '</b><span>' + esc(k.detail) + '</span></div>' +
            '</div>'
          ).join('') + '</div>'
        ).join('');

        result.style.display = 'block';

        // 점수 카운트업 + 막대
        const num = document.getElementById('scanScore');
        let c = 0;
        const step = Math.max(1, Math.round(d.total / 34));
        const ti = setInterval(() => {
          c = Math.min(c + step, d.total);
/* chunk 405 */
          num.textContent = c;
          if (c >= d.total) clearInterval(ti);
        }, 26);
        timers.push(setTimeout(() => {
          document.querySelectorAll('#scanCats span[data-w]').forEach((b, i) => {
            setTimeout(() => { b.style.width = b.dataset.w + '%'; }, i * 90);
          });
        }, 120));

        summary =
          '[아비컴퍼니 홈페이지 검사 결과]\n' +
          d.finalUrl + '\n' +
          '종합 ' + d.total + '점 / 100점\n\n' +
          '항목별 점수\n' +
          d.cats.map(x => '· ' + x.name + ' ' + x.score + '점').join('\n') + '\n\n' +
          '먼저 고쳐야 할 것\n' +
          d.fixes.map((f, i) => (i + 1) + '. [' + f.cat + '] ' + f.label + ' — ' + f.detail).join('\n');
      }

      function renderName(d) {
        const t = document.getElementById('scanNameTitle');
        const b = document.getElementById('scanNameBody');

        if (!d.supported) {
          t.textContent = '"' + d.name + '" 은(는) 사람이 직접 확인해 드립니다';
          b.innerHTML =
            '<p>홈페이지 주소를 넣으시면 그 자리에서 검사 결과가 나옵니다. 상호명만으로는 검색 노출을 자동으로 확인할 수 없어, 저희가 직접 찾아본 뒤 정리해 보내드립니다.</p>' +
            '<p>네이버·구글 검색 노출, 지도 등록 상태, 경쟁 업체 노출 현황까지 함께 확인해 드립니다. 비용은 없습니다.</p>';
          summary = '[아비컴퍼니 진단 요청]\n상호명: ' + d.name + '\n검색 노출과 지도 등록 상태를 확인해 주세요.';
        } else {
          t.textContent = '"' + d.name + '" 노출 현황입니다';
          const rows = [];
          rows.push(['지도 등록', d.place
            ? (d.place.title + ' · ' + (d.place.category || ''))
            : (d.similar
                ? '이 이름으로는 찾지 못했습니다 (비슷한 상호: ' + d.similar + ')'
                : '네이버 지도에서 찾지 못했습니다')]);
          if (d.place && d.place.address) rows.push(['주소', d.place.address]);
          if (d.place && d.place.phone) rows.push(['등록된 번호', d.place.phone]);
          rows.push(['블로그 문서', d.blogCount != null ? d.blogCount.toLocaleString() + '건' : '확인 실패']);
          rows.push(['웹 문서', d.webCount != null ? d.webCount.toLocaleString() + '건' : '확인 실패']);
          if (d.site) rows.push(['지도에 걸린 주소', d.site]);
          b.innerHTML =
            '<p>상호명으로 확인된 내용입니다. 홈페이지 주소를 넣으시면 페이지 안까지 검사해 드립니다.</p>' +
            '<dl>' + rows.map(r => '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>').join('') + '</dl>';
/* chunk 450 */
          summary = '[아비컴퍼니 노출 확인]\n상호명: ' + d.name + '\n' + rows.map(r => '· ' + r[0] + ': ' + r[1]).join('\n');
        }
        nameBox.style.display = 'block';
      }

      function copyThen(el, done) {
        const text = summary;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(()=>alert('자동 복사가 차단되었습니다. 화면의 결과를 직접 복사한 뒤 상담해 주세요.'));
        } else {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
          document.body.appendChild(ta); ta.select();
          try { if(!document.execCommand('copy')){ta.remove();alert('결과를 직접 복사해 주세요.');return;} } catch (e) {ta.remove();alert('결과를 직접 복사해 주세요.');return;}
          document.body.removeChild(ta);
          done();
        }
      }

      document.getElementById('scanCopyKakao').addEventListener('click', () => {
        copyThen(null, () => {
          document.getElementById('scanCopied').style.display = 'block';
          window.open('https://pf.kakao.com/_wxjxiSX/chat', '_blank');
        });
      });
      document.getElementById('scanNameKakao').addEventListener('click', () => {
        copyThen(null, () => window.open('https://pf.kakao.com/_wxjxiSX/chat', '_blank'));
      });
    })();


/* chunk 495 */
