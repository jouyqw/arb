const services=[
['반응형 홈페이지 · 광고 랜딩','시공 사례와 공사 범위, 상담 절차를 PC·모바일에 맞게 제작합니다. 광고의 지역·공정과 도착 페이지의 내용을 맞춥니다.'],
['네이버 검색 광고','지역명·리모델링·공정별 검색어를 분류하고 광고 문구, 연결 페이지와 예산을 함께 설계합니다.'],
['구글 검색 · 디스플레이 광고','검색 의도에 맞는 문구와 이미지 소재를 구성하고 유입 이후 견적 상담까지 확인합니다.'],
['메타 광고 · 인스타그램','공간 사진과 전후 변화, 시공 과정을 소재로 기획합니다. 관심 지역과 고객층에 맞춰 광고를 운영합니다.'],
['당근 지역 광고','실제 시공 가능한 생활권에 맞춰 지역 광고와 비즈프로필을 구성하고 상담 연결을 점검합니다.'],
['네이버 블로그 · 홈페이지 칼럼','지역·평형·공정별 사례와 비용·기간·자재 선택에 관한 질문을 콘텐츠로 정리합니다. 검색 유입을 목표로 지속 개선합니다.'],
['카페 · 지역 커뮤니티','커뮤니티 규칙에 맞는 정보와 공개 가능한 시공 사례를 기획합니다. 홍보성 게시물은 광고 관계를 밝히며 허위 후기를 만들지 않습니다.'],
['네이버 지식인','공정·일정·견적 준비에 관한 질문에 사실 중심의 답변 콘텐츠를 구성합니다. 계정·광고 표시 등 플랫폼 규칙을 따릅니다.'],
['스마트플레이스 · 지역 검색','업체 정보, 시공 가능 지역, 사진과 상담 링크를 정리합니다. 실제 고객 후기의 응대와 정보 최신화를 돕습니다.'],
['유튜브 쇼츠 · 릴스 · 틱톡','시공 과정, 자재 설명, 공간 변화와 대표 인터뷰를 짧은 영상으로 기획합니다. 프로필에서 홈페이지 상담까지 연결합니다.'],
['SEO · GEO · AI 검색 대응','사이트맵·수집 설정·내부 링크와 질문형 콘텐츠, 구조화 데이터를 점검합니다. 검색 순위나 AI 답변 인용을 보장하지 않습니다.'],
['언론 홍보 · 보도자료','확인 가능한 프로젝트와 브랜드 소식을 보도자료로 정리하고 게재를 지원합니다. 유료 홍보는 광고임을 구분합니다.'],
['데이터 분석 · 유지관리','유입 경로와 상담 클릭을 기준으로 콘텐츠와 광고를 개선합니다. 업데이트·성능 관리와 반복 광고 클릭의 점검 범위는 계약 시 정합니다.']
];
export function marketingServices(){return `<section class="section marketing-catalog" id="marketing"><div class="wrap"><span class="overline">WEBSITE & MARKETING</span><h2>어떤 마케팅을<br>해드리나요?</h2><p class="marketing-lead">홈페이지 제작부터 검색·광고·콘텐츠 운영까지.<br>시공 지역과 주력 공정, 보유 자료와 예산에 맞춰 필요한 서비스를 조합합니다.</p><div class="marketing-grid">${services.map(([title,text],i)=>`<article><span>${String(i+1).padStart(2,'0')}</span><h3>${title}</h3><p>${text}</p></article>`).join('')}</div><p class="marketing-note">모든 매체를 무조건 집행하지 않습니다. 제작·운영 범위, 광고비와 비용 조건은 상담 후 별도로 합의합니다. 검색 상위 노출·문의 수·매출을 보장하지 않습니다.</p></div></section>`;}
export function toolEntry(){return `<section class="section tool-entry" id="marketing-diagnosis"><div class="wrap"><span class="overline">CHECK YOUR BUSINESS</span><h2>지금 마케팅,<br>어디부터 바꿀까요?</h2><div class="tool-entry-grid"><article><h3>AI 1분 마케팅 진단</h3><p>발견·유입·도착·신뢰·전환·측정. 7개 질문에 답하고 단계별 점수와 개선 순서를 확인하세요.</p><button type="button" data-tool="diagnosis">현재 마케팅 상황 진단 ↗</button><small>답변 기반 자체 점검 · 생성형 AI 분석 아님</small></article><article><h3>내 홈페이지 점수 검사</h3><p>주소를 입력하면 제목, 수집 설정, 구조화 데이터와 상담 링크 등 실제 HTML 응답을 검사합니다.</p><button type="button" data-tool="scan">홈페이지 주소로 검사 ↗</button><small>자체 기준 점수 · 실제 검색 순위나 매출 예측 아님</small></article></div></div></section>`;}
export function toolDialog(){return `<dialog class="tools-dialog" aria-labelledby="tools-title"><header><h2 id="tools-title">홈페이지·마케팅 진단</h2><button type="button" class="tools-close" aria-label="진단 팝업 닫기">닫기 ×</button></header><iframe allow="clipboard-write" title="홈페이지·마케팅 무료 진단" referrerpolicy="strict-origin-when-cross-origin"></iframe><p class="tools-fallback">화면이 열리지 않나요? <a href="https://aubcompany.com/#scan" target="_blank" rel="noopener">메인 사이트에서 검사하기 ↗</a></p></dialog><button type="button" class="tools-launcher" data-tool="diagnosis">무료 마케팅 진단 ↗</button>`;}
