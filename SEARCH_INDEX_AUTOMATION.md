# 전체 사이트 검색 색인 자동화

`전체 사이트 검색 색인 자동화` GitHub Actions가 2시간마다 등록된 사이트의
사이트맵을 읽고 아래 작업을 합니다.

1. 최근 7일 안에 새로 발행되거나 수정된 주소를 찾습니다.
2. 공개 키가 설치된 사이트는 네이버와 IndexNow에 실제 페이지 주소를 알립니다.
3. Google Search Console API로 각 사이트의 사이트맵을 다시 제출합니다.
4. 사이트별 URL 수와 제출 결과를 30일간 실행 보고서로 보관합니다.

새 사이트는 `scripts/submit-search-engines.mjs`의 `sites` 목록에 추가합니다.
Google 제출이 `permission-missing`이면 보고서에 표시된 자동화 계정을 해당
Search Console 속성의 사용자로 한 번만 등록해야 합니다.

일반 법률칼럼에는 Google Indexing API를 사용하지 않습니다. 이 API는 채용공고와
실시간 방송 페이지에만 허용되므로, 일반 페이지는 사이트맵 제출 방식이 맞습니다.

