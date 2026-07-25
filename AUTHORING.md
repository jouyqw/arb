# 일일 칼럼 발행 플레이북 — aubcompany.com (아비컴퍼니)

이 문서는 매일 자동 세션(클라우드)이 그대로 따라 실행하는 지침입니다.
목표: **마케팅 실무자가 직접 쓴 것 같은 고품질 칼럼 3개**를 매일 발행.
타깃 키워드: 전문직마케팅, 홈페이지제작, 병원마케팅, 법무법인마케팅, GEO(AI 검색).
자동화 티가 나는 문구는 넣지 않습니다.

## 매일 실행 순서

1. 저장소 루트에서 시작. 오늘 날짜(KST) 확인.
2. `data/columns.json`의 기존 slug를 확인해 이미 다룬 주제 파악.
3. `content/topic-bank.json`에서 **아직 없는** 주제 3개를 서로 다른 카테고리로 선택.
   - 소진되면 실무에서 자주 받는 질문으로 새 주제 생성(slug 중복 금지, `scheduled-` 접두사 절대 금지).
4. 각 글을 `data/columns.json` 배열 끝에 추가(아래 형식).
5. 생성: `node scripts/generate-columns.mjs`
6. 확인: 생성된 `column/<slug>/index.html`이 정상 렌더링됐는지, 문단·인포그래픽이 보이는지 확인.
7. 커밋 & 푸시:
   ```
   git add data/columns.json column sitemap.xml
   git -c commit.gpgsign=false commit -m "칼럼 발행: <오늘 날짜>"
   git push origin main
   ```
   push 후 Cloudflare 자동 배포 + GitHub Actions가 검색엔진 제출 처리.

## columns.json 항목 형식

```json
{
  "slug": "english-lowercase-hyphen",
  "title": "타깃 키워드가 자연스럽게 들어간 제목",
  "description": "45~160자 요약. 키워드 포함.",
  "category": "전문직 마케팅 | 홈페이지 제작·전환 | SEO·상위노출 | AI 검색(GEO) | 업종별 마케팅",
  "author": "아비컴퍼니",
  "datePublished": "YYYY-MM-DD",
  "dateModified": "YYYY-MM-DD",
  "keywords": ["키워드1", "키워드2", "키워드3"],
  "image": "/assets/columns/<이미지>.webp",      // 있으면. 없으면 생략
  "body": [ ...블록 배열... ]
}
```

## body 블록 종류

- `"문자열"` → 문단(`<p>`). **강조**는 `**텍스트**`.
- `{"type":"heading","text":"소제목"}` → `<h2>`
- `{"type":"summary","title":"핵심 요약","items":["...","..."]}` → 상단 요약 박스
- `{"type":"table","headers":[...],"rows":[[...],[...]]}` → 표
- `{"type":"list","items":[...]}` → 목록
- `{"type":"image","src":"/assets/columns/x.webp","alt":"...","caption":"..."}` → 이미지
- `{"type":"callout","label":"팁","text":"..."}` / `{"type":"warning","label":"주의","text":"..."}` → 강조 박스
- `{"type":"infographic","title":"제목","caption":"캡션","items":[{"icon":"<svg ...>...</svg>","title":"항목","text":"설명"}]}` → 아이콘 인포그래픽 (아이콘은 `viewBox='0 0 24 24' width='21' height='21' fill='none' stroke='currentColor' stroke-width='1.8'` 인라인 SVG, 속성 홑따옴표)

## 품질 기준

- **문체**: 마케팅 실무자가 실제 프로젝트 경험으로 쓰는 톤. "실제 운영해 보면", "상담하다 보면" 같은 자연스러운 표현. 템플릿 반복 금지.
- **가독성(모바일 우선)**: 한 문단 1~2문장.
- **분량**: 본문 텍스트 2,000자 이상.
- **구조**: heading(h2) 4~6개, summary 1개, 인포그래픽·표·콜아웃 중 1개 이상.
- **키워드**: 타깃 키워드 자연스럽게 4~8회(스터핑 금지).
- **중복 금지**: 기존 글과 다른 각도·사례. 같은 본문 재사용 절대 금지.
- **GEO**: 질문형 소제목 + 첫 문단에 요지 답변(AI 인용에 유리).
- 과장·확정적 성과 보장 표현 금지("무조건 1위" 등).
