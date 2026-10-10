# 업종별 칼럼 발행

6개 사이트의 공개 칼럼 게시판은 `/column/`입니다. 검색·분류·8편 단위 페이지 이동을 지원합니다. 현재 각 사이트에는 기존 칼럼 1편이 있으며 가상의 글을 채워 넣지 않았습니다.

현재 발행 원본은 `lib/subsites/articles.mjs`의 업종별 배열입니다. 로그인 관리자나 공개 글쓰기 API는 없습니다. 메인 사이트의 `content/queue` 예약 발행과는 별개입니다.

## 글 추가

해당 업종 배열에 기존 글과 같은 구조로 추가합니다. 필수 필드는 `slug`, `title`, `description`, `datePublished`, `dateModified`, `category`, `summary`, `sections`, `checklist`입니다. `sections`의 각 항목에는 `heading`과 `paragraphs` 배열을 넣습니다. 날짜는 `YYYY-MM-DD`, slug는 중복되지 않는 영문·숫자·하이픈을 사용하세요.

본문 강조 표기는 `::배경 강조::`, `__밑줄__`, `;;강조색;;`입니다. 각 절의 첫 문장은 자동으로 강조되므로 표기를 과하게 쓰지 않아도 됩니다. HTML은 실행되지 않고 문자로 처리됩니다.

검토 후 `node scripts/check-subsites.mjs`와 `node scripts/check-industry-features.mjs`를 실행합니다. 기존 검사에는 본문 2,400자 기준이 있으므로 짧은 공지 형식을 추가하려면 별도 설계가 필요합니다. 저장소 main 브랜치에 게시하면 Cloudflare가 배포하며 목록·사이트맵·RSS에도 자동 연결됩니다. 예약 일자를 넣는 것만으로 예약 발행되지는 않습니다.

실제 후기·실적·사진은 사용 권한과 근거를 확인하고, 출처·확인 날짜·수정 이력을 관리하세요.
