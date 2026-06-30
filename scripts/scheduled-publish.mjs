import { readFileSync, writeFileSync } from 'node:fs';

const startDate = '2026-07-01';
const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
const publishDate = process.env.PUBLISH_DATE || kstNow.toISOString().slice(0, 10);
const dayIndex = Math.floor((new Date(`${publishDate}T00:00:00+09:00`) - new Date(`${startDate}T00:00:00+09:00`)) / 86400000);

if (dayIndex < 0 || dayIndex >= 30) {
  console.log(`No scheduled posts for ${publishDate}`);
  process.exit(0);
}

const columnsPath = 'data/columns.json';
const columns = JSON.parse(readFileSync(columnsPath, 'utf8'));

const topics = [
  ['전문직 홈페이지 신뢰 구조', '전문직 홈페이지는 경력 나열보다 고객이 불안을 줄일 수 있는 정보 구조가 중요합니다.', '전문직 마케팅'],
  ['병원 지역검색 콘텐츠 설계', '병원 홈페이지는 진료과목, 지역명, 증상별 설명, 예약 동선이 함께 정리되어야 합니다.', '병원 마케팅'],
  ['소상공인 블로그 자동화 운영', '소상공인 홈페이지는 반복되는 글 작성과 검색엔진 제출을 자동화하면 운영 부담을 줄일 수 있습니다.', '콘텐츠 자동화'],
  ['법무법인 칼럼 마케팅', '법률 서비스는 검색자가 실제로 묻는 질문을 칼럼으로 정리할 때 상담 전환이 좋아집니다.', '법률 마케팅'],
  ['인테리어 포트폴리오 SEO', '인테리어 업체는 시공 사진만 올리기보다 공간별 고민과 해결 과정을 함께 설명해야 합니다.', '인테리어 마케팅'],
  ['분양 홈페이지 전환 동선', '분양 홈페이지는 방문자가 가격, 위치, 일정, 문의 버튼을 빠르게 확인할 수 있어야 합니다.', '분양 마케팅'],
  ['장례식장 홈페이지 신뢰 요소', '장례식장 홈페이지는 시설 안내보다 비용, 절차, 위치, 상담 동선이 먼저 보여야 합니다.', '장례식장 마케팅'],
  ['AI 검색 대응 콘텐츠 구조', 'AI 검색 시대에는 짧은 홍보문보다 질문과 답변이 분명한 구조가 더 유리합니다.', 'AI 검색 최적화'],
  ['광고 후 홈페이지 점검', '광고비를 쓰기 전 홈페이지의 문의 버튼, 모바일 속도, 신뢰 문구를 먼저 점검해야 합니다.', '광고 전환'],
  ['지역 서비스업 문의 전환', '지역 서비스업은 가까운 위치와 실제 해결 사례를 함께 보여줄 때 문의 가능성이 높아집니다.', '지역 마케팅']
];

const slugify = (text, slot) => `scheduled-${slot + 1}-${publishDate}-${text.toLowerCase().replaceAll(' ', '-').replace(/[^a-z0-9가-힣-]/g, '')}`;

const buildPost = ([topic, description, category], slot) => {
  const title = `${topic}, 홈페이지에서 어떻게 보여줘야 할까요?`;
  const slug = slugify(topic, slot);
  return {
    slug,
    title,
    description,
    category,
    author: '아비컴퍼니',
    datePublished: publishDate,
    dateModified: publishDate,
    keywords: [topic, category, '홈페이지 마케팅'],
    body: [
      {
        type: 'summary',
        title: '핵심 요약',
        items: [
          `${topic}은 예쁜 디자인보다 고객이 바로 이해할 수 있는 정보 구조가 먼저입니다.`,
          '모바일에서 제목, 신뢰 근거, 문의 버튼이 자연스럽게 보여야 전환이 올라갑니다.'
        ]
      },
      `${topic}을 준비할 때 가장 많이 놓치는 부분은 방문자의 상황입니다. 업체 입장에서는 장점이 많아 보여도 고객은 가격, 일정, 신뢰, 진행 방식처럼 당장 확인하고 싶은 정보부터 찾습니다.`,
      `그래서 홈페이지는 회사 소개를 길게 보여주기보다 **고객 질문에 먼저 답하는 구조**가 필요합니다. 첫 화면에서 누구를 위한 서비스인지, 어떤 문제를 해결하는지, 문의는 어떻게 하는지가 보여야 합니다.`,
      {
        type: 'table',
        headers: ['구분', '홈페이지에서 보여줄 내용', '확인 포인트'],
        rows: [
          ['첫 화면', '서비스 대상과 핵심 장점', '모바일에서도 한눈에 보여야 합니다'],
          ['신뢰 근거', '사례, 경력, 절차, 후기', '과장보다 구체성이 중요합니다'],
          ['콘텐츠', '고객이 검색하는 질문형 칼럼', '지역명과 업종 키워드를 자연스럽게 포함합니다'],
          ['문의 동선', '전화, 카카오톡, 상담 폼', '버튼 위치가 반복적으로 보여야 합니다']
        ]
      },
      '검색 노출을 생각한다면 칼럼도 함께 운영하는 것이 좋습니다. 단순 홍보 글보다 실제 고객이 검색하는 질문을 제목으로 잡고, 본문에서는 표와 단계별 설명을 넣는 방식이 효과적입니다.',
      {
        type: 'heading',
        text: '운영할 때 주의할 점'
      },
      '한 번 만든 홈페이지를 그대로 두면 검색엔진이 새 정보를 발견하기 어렵습니다. 정기적으로 칼럼을 추가하고 사이트맵을 제출하면 노출 기회를 꾸준히 만들 수 있습니다.',
      '**중요한 것은 자동화만이 아닙니다.** 업종에 맞는 주제, 고객이 이해하기 쉬운 문장, 모바일에서 읽기 편한 구조가 함께 맞아야 실제 문의로 이어집니다.'
    ]
  };
};

let created = 0;
for (let slot = 0; slot < 3; slot += 1) {
  const topic = topics[(dayIndex * 3 + slot) % topics.length];
  const post = buildPost(topic, slot);
  if (columns.some((item) => item.slug === post.slug)) continue;
  columns.unshift(post);
  console.log(`Added ${post.slug}`);
  created += 1;
}

writeFileSync(columnsPath, `${JSON.stringify(columns, null, 2)}\n`, 'utf8');
console.log(`Scheduled publish completed for ${publishDate}: ${created} new posts`);
