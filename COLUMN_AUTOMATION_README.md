# 칼럼 자동화 사용 방법

## 1. 새 칼럼 추가

`data/columns.json` 파일에 아래 항목을 하나 더 추가합니다.

- `slug`: URL 주소에 들어갈 영문 글 주소
- `title`: 칼럼 제목
- `description`: 검색 결과에 보일 설명문
- `category`: 칼럼 분류
- `author`: 작성자
- `datePublished`: 발행일
- `dateModified`: 수정일
- `keywords`: 검색 키워드
- `body`: 본문 문단 배열

## 2. 페이지 자동 생성

서버나 로컬 PC에서 아래 명령을 실행하면 됩니다.

```bash
node scripts/generate-columns.mjs
```

자동으로 생성되는 파일:

- `column/index.html`
- `column/각-칼럼-slug/index.html`
- `sitemap.xml`

## 3. API 자동화 연결 위치

OpenAI API, 사내 관리자 페이지, 또는 별도 자동화 서버에서 칼럼 초안을 만든 뒤 `data/columns.json`에 같은 형식으로 저장하면 됩니다.

추천 발행 흐름:

1. 키워드 입력
2. OpenAI API로 초안 생성
3. 담당자 검수
4. `data/columns.json` 업데이트
5. `scripts/generate-columns.mjs` 실행
6. 서버 업로드
7. 네이버 서치어드바이저 수집 요청 API 호출
8. 구글 Search Console에서 sitemap.xml 확인

## 4. 배포 전 확인

현재 도메인이 `https://aubcompany.com`이 아니면 아래 파일의 도메인을 실제 도메인으로 변경해야 합니다.

- `robots.txt`
- `sitemap.xml`
- `scripts/generate-columns.mjs`의 `siteUrl`
