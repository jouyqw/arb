import { assertServiceCopy } from './check-service-copy.mjs';
/**
 * 예약 칼럼 발행기 — node scripts/publish-queue.mjs [--dry]
 *
 * content/queue/*.json 중 publishAt 이 오늘(KST) 이하인 글 한 편을
 * data/columns.json 배열 끝에 붙인다. 이후 generate-columns.mjs 는 워크플로가 실행한다.
 *
 * 왜 이렇게 하나: 매일 칼럼을 쓰던 클라우드 예약 세션이 조용히 실패하는 날이 많았다.
 * 세션은 매일 실행됐는데 커밋이 들어오지 않아 8/15 이후 발행이 끊겼다. 그래서
 * "글 쓰기"와 "글 내보내기"를 분리한다. 내보내기에는 LLM 이 끼지 않는다.
 */

import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const QUEUE = path.join('content', 'queue');
const COLUMNS = path.join('data', 'columns.json');

const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
console.log(`KST 오늘 = ${today}`);

const out = process.env.GITHUB_OUTPUT;
const emit = (line) => {
  if (out) fs.appendFileSync(out, `${line}\n`);
};

if (!fs.existsSync(QUEUE)) {
  console.log('큐 폴더가 없습니다. 발행할 것이 없습니다.');
  emit('published=0');
  process.exit(0);
}

const columns = JSON.parse(fs.readFileSync(COLUMNS, 'utf8'));
const known = new Set(columns.map((c) => c.slug));

const files = fs.readdirSync(QUEUE).filter((f) => f.endsWith('.json')).sort();
const due = [];
for (const f of files) {
  const item = JSON.parse(fs.readFileSync(path.join(QUEUE, f), 'utf8'));
  const at = String(item.publishAt || item.datePublished || '').slice(0, 10);
  if (at && at <= today) due.push({ f, item, at });
}

if (!due.length) {
  console.log(`발행일이 된 글이 없습니다. 큐에 ${files.length}편 남아 있습니다.`);
  emit('published=0');
  process.exit(0);
}

// 같은 날짜로 예약된 글은 함께 낸다(2026-10-15 부터 평일 2편).
// 다만 밀린 날짜까지 한꺼번에 쏟지는 않는다 — 대량생성 신호가 된다.
// 그래서 한 번에 최대 "이틀치" 까지만 낸다.
//
// 하루치만 내면 밀린 날을 영영 못 따라잡는다. 예약은 평일마다 2편씩 쌓이는데
// 소화는 하루치씩이라, 주말이나 실행이 걸러진 날 생긴 공백이 그대로 남는다.
// 2026-10-25 에 세 사이트가 똑같이 10/23 자 2편씩 밀려 있었다.
// 이틀치까지 허용하면 밀린 분이 한 번에 한 칸씩 당겨지고, 한꺼번에 쏟지도 않는다.
due.sort((a, b) => a.at.localeCompare(b.at) || a.f.localeCompare(b.f));
const dueDays = [...new Set(due.map((x) => x.at))];
const takeDays = dueDays.slice(0, 2);
const batch = due.filter((x) => takeDays.includes(x.at));
if (due.length > batch.length) {
  console.log(`발행일이 지난 글이 ${due.length}편입니다. 오늘은 ${takeDays.join(', ')} 자 ${batch.length}편만 냅니다.`);
} else if (takeDays.length > 1) {
  console.log(`밀린 분을 따라잡습니다 — ${takeDays.join(', ')} 자 ${batch.length}편.`);
}

// Validate the entire batch before writing or removing any queued files.
for (const { item } of batch) assertServiceCopy(item);

const titles = [];
for (const { f, item, at } of batch) {
  if (known.has(item.slug)) {
    console.warn(`건너뜀 ${item.slug} — 이미 발행된 글입니다. 큐에서만 제거합니다.`);
    if (!DRY) fs.rmSync(path.join(QUEUE, f));
    continue;
  }

  const { publishAt, ...rest } = item;
  // 날짜는 예약일(at)을 따른다. rest 쪽을 우선하면 예약일을 옮겼을 때
  // 새 글이 초안 쓴 날짜로 올라가, 검색엔진이 새 글로 보지 않는다
  // (2026-10-13 전주개인회생에서 실제로 그렇게 됐다).
  const entry = { ...rest, datePublished: at || rest.datePublished, dateModified: at || rest.dateModified };

  if (DRY) {
    console.log(`[dry] ${entry.slug} (${at}) — ${entry.title}`);
    titles.push(entry.title);
    continue;
  }

  columns.push(entry);
  fs.rmSync(path.join(QUEUE, f));
  titles.push(entry.title);
  console.log(`발행 ${entry.slug} (${at})`);
}

if (!DRY && titles.length) {
  fs.writeFileSync(COLUMNS, `${JSON.stringify(columns, null, 2)}
`, 'utf8');
}

emit(`published=${titles.length}`);
if (titles.length) emit(`summary=${titles.join(' / ').slice(0, 180)}`);
console.log(`
발행 ${titles.length}편, 큐 잔량 ${files.length - titles.length}편`);
