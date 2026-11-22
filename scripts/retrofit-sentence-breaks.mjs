/**
 * 이미 발행된 칼럼의 문단을 문장 단위로 끊어 준다.
 *
 * 2026-11-19 에 렌더러가 문단 안의 \n 을 <br> 로 바꾸게 고쳤다. 그런데 그 전에
 * 쓰인 글 170편은 문단이 통째로 한 덩어리다. 모바일에서 그게 가장 크게 갈린다.
 * 새로 쓰는 글만 고쳐 두면 170편은 영원히 옛 모양으로 남는다.
 *
 * 글을 다시 쓰지 않는다. ;;보이는 줄만 나눈다;; — 글자는 하나도 건드리지 않고
 * 문장 사이의 공백 하나를 줄바꿈으로 바꾼다. 그래서 LLM 을 부르지 않는다.
 *
 * 끊는 자리를 고르는 기준:
 *  - 마침표·물음표·느낌표 앞 글자가 ;;한글일 때만;; 끊는다.
 *    "3.5" "No.1" "1.2억" 같은 자리에서 끊기면 글이 깨진다. 한글 조건이 그걸 막는다.
 *  - 강조 표기(**, ::, ;;) 는 짝으로 움직인다. 끊는 자리 앞쪽에 짝이 안 맞는
 *    표기가 있으면 그 자리는 건너뛴다. 표기 한가운데를 끊으면 렌더가 깨진다.
 *  - 문단이 90자 미만이면 그냥 둔다. 한 줄짜리를 더 쪼개면 읽기 더 나쁘다.
 *
 * 사용법:
 *   node scripts/retrofit-sentence-breaks.mjs --dry      무엇이 바뀌는지만 본다
 *   node scripts/retrofit-sentence-breaks.mjs            data/columns.json 을 고친다
 *   node scripts/retrofit-sentence-breaks.mjs --git      고치고 커밋까지
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'data', 'columns.json');
const MIN_LEN = 90;

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const GIT = argv.includes('--git');
const LIMIT = (() => {
  const i = argv.indexOf('--limit');
  return i >= 0 ? Number(argv[i + 1]) || 0 : 0;
})();

const log = (msg) => console.log(msg);

/* 끊는 자리 앞에서 강조 표기가 짝이 맞는지 본다.
 * ** 는 두 글자라 개수가 아니라 쌍의 수로 센다. */
const markersBalanced = (text) => ['\\*\\*', '::', ';;']
  .every((m) => ((text.match(new RegExp(m, 'g')) || []).length % 2 === 0));

const breakSentences = (para) => {
  if (para.includes('\n')) return para;            // 이미 끊어 둔 문단은 손대지 않는다
  if ([...para].length < MIN_LEN) return para;

  const out = [];
  let last = 0;
  // 한글 + 종결부호 + 공백. 종결부호 뒤에 닫는 괄호·인용부호가 붙는 경우까지 받는다.
  const re = /([가-힣])([.?!]+)(["'”’)\]]*)\s+/g;
  let m;
  while ((m = re.exec(para)) !== null) {
    const cut = m.index + m[0].length;
    const head = para.slice(last, cut);
    if (!markersBalanced(para.slice(0, cut))) continue;   // 표기 한가운데면 건너뛴다
    out.push(head.trimEnd());
    last = cut;
  }
  if (!out.length) return para;
  const tail = para.slice(last).trim();
  if (tail) out.push(tail);
  return out.length >= 2 ? out.join('\n') : para;
};

const raw = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const columns = Array.isArray(raw) ? raw : raw.columns;
if (!Array.isArray(columns)) {
  console.error('data/columns.json 모양이 예상과 다릅니다');
  process.exit(1);
}

let touchedCols = 0;
let touchedParas = 0;
const samples = [];

for (const col of columns) {
  if (!Array.isArray(col.body)) continue;
  if (LIMIT && touchedCols >= LIMIT) break;
  let changed = false;

  col.body = col.body.map((block) => {
    if (typeof block !== 'string') return block;
    const next = breakSentences(block);
    if (next === block) return block;
    changed = true;
    touchedParas += 1;
    if (samples.length < 3) samples.push({ slug: col.slug, before: block, after: next });
    return next;
  });

  if (changed) touchedCols += 1;
}

log(`문단 ${touchedParas}개 · 칼럼 ${touchedCols}편이 문장 단위로 끊깁니다`);
for (const s of samples) {
  log(`\n── ${s.slug}\n[전]\n${s.before}\n[후]\n${s.after}`);
}

if (DRY) {
  log('\n--dry 였으므로 파일은 그대로입니다');
  process.exit(0);
}
if (!touchedParas) {
  log('바꿀 것이 없습니다');
  process.exit(0);
}

// 글자가 사라지지 않았는지 마지막으로 확인한다. 줄바꿈과 공백만 달라야 한다.
const flatten = (cols) => cols.flatMap((c) => (Array.isArray(c.body) ? c.body : []))
  .filter((b) => typeof b === 'string').join('').replace(/\s+/g, '');
const beforeAll = flatten(JSON.parse(fs.readFileSync(DATA, 'utf8')).columns
  ?? JSON.parse(fs.readFileSync(DATA, 'utf8')));
const afterAll = flatten(columns);
if (beforeAll !== afterAll) {
  console.error('글자가 달라졌습니다 — 저장하지 않고 멈춥니다');
  process.exit(1);
}
log('글자 대조 통과 (공백·줄바꿈만 달라졌습니다)');

fs.writeFileSync(DATA, `${JSON.stringify(raw, null, 2)}\n`);
log('data/columns.json 저장');

execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'generate-columns.mjs')], { stdio: 'inherit' });

if (GIT) {
  const git = (args) => execFileSync('git', args, { cwd: ROOT, stdio: 'inherit' });
  git(['add', '--', 'data/columns.json', 'column', 'service', 'sitemap.xml']);
  git(['-c', 'core.autocrlf=false', 'commit', '-q', '-m',
    `발행된 칼럼 ${touchedCols}편을 문장 단위로 끊었다 (문단 ${touchedParas}개)\n\n글자는 그대로다. 문장 사이 공백 하나를 줄바꿈으로 바꿨다.`]);
  git(['push', '-q', 'origin', 'main']);
  log('푸시 완료');
}
