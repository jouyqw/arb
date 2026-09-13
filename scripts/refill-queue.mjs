/**
 * 아비컴퍼니 칼럼 큐 자동 보충
 *
 *   node scripts/refill-queue.mjs --check      큐 잔량만 본다
 *   node scripts/refill-queue.mjs              부족하면 채운다(로컬만)
 *   node scripts/refill-queue.mjs --git        채운 뒤 커밋·푸시까지
 *   node scripts/refill-queue.mjs --force 3    잔량과 무관하게 3편
 *
 * 구조
 *   content/queue/<slug>.json 이 "초안 + publishAt" 이다.
 *   .github/workflows/publish-queue.yml 이 매일 00:10 KST 에 발행일이 된 것 한 편을
 *   data/columns.json 으로 옮기고 generate-columns.mjs 로 페이지·사이트맵을 다시 만든다.
 *
 *   발행 경로에는 LLM 이 끼지 않는다. 여기서 채우는 건 큐뿐이다.
 *   2026-09-06 이후 발행이 멈춘 원인도 워크플로 고장이 아니라 큐가 비어 있어서였다.
 *
 * 안전장치
 *   - 규격검사를 통과한 초안만 큐에 남긴다.
 *   - 큐에 넣기 전에 generate-columns.mjs 로 실제 렌더까지 해 보고 산출물은 되돌린다.
 *   - 실패는 바탕화면 파일로 알린다.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const QUEUE = path.join(ROOT, 'content', 'queue');
const BANK = path.join(ROOT, 'content', 'topic-bank.json');
const COLUMNS = path.join(ROOT, 'data', 'columns.json');
const LOG = path.join(ROOT, 'refill.log');
const LOCK = path.join(ROOT, '.refill.lock');
const DESK = path.join(process.env.USERPROFILE || '', 'Desktop', '아비컴퍼니_칼럼보충_실패.txt');

const THRESHOLD = 6;
const TARGET = 14;
const MAX_ADD = 6;
const RETRY = 2;
const BATCH_TIMEOUT = 30 * 60 * 1000;

// 이 사이트는 마케팅 대행사다. 성과를 약속하는 표현은 표시광고법 문제로 직결된다.
const BANNED = ['100%', '무조건', '보장합니다', '수익 보장', '1위 보장', '최저가', '국내 최고',
  '업계 1위', '반드시 상위노출', '상위노출 보장', '무조건 1페이지'];

const CLAUDE = [
  'C:\\Users\\c\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Anthropic.ClaudeCode_Microsoft.Winget.Source_8wekyb3d8bbwe\\claude.exe',
  'claude',
].find((p) => p === 'claude' || fs.existsSync(p));

const stamp = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
const TODAY = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function log(msg) {
  const line = `[${stamp()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG, line + '\n'); } catch { }
}
const unlock = () => { try { fs.rmSync(LOCK); } catch { } };
function fail(msg, detail = '') {
  log('!! ' + msg);
  if (detail) log(String(detail).slice(0, 600));
  try {
    fs.writeFileSync(DESK, `${stamp()}\n아비컴퍼니 칼럼 보충에 실패했습니다.\n\n${msg}\n\n${String(detail).slice(0, 1200)}\n`);
  } catch { }
  unlock();
  process.exit(1);
}
const sleep = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { } };
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const git = (a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const published = () => JSON.parse(fs.readFileSync(COLUMNS, 'utf8'));
const queueFiles = () => (fs.existsSync(QUEUE) ? fs.readdirSync(QUEUE).filter((f) => f.endsWith('.json')) : []);
const queueItems = () => queueFiles().map((f) => JSON.parse(fs.readFileSync(path.join(QUEUE, f), 'utf8')));

const plainText = (body) => (body || []).map((b) => {
  if (typeof b === 'string') return b;
  if (!b || typeof b !== 'object') return '';
  if (b.type === 'heading') return b.text || '';
  if (b.type === 'summary' || b.type === 'list') return (b.items || []).join(' ');
  if (b.type === 'table') return [...(b.headers || []), ...(b.rows || []).flat()].join(' ');
  if (b.type === 'callout' || b.type === 'warning') return `${b.label || ''} ${b.text || ''}`;
  if (b.type === 'infographic') return (b.items || []).map((i) => `${i.title} ${i.text}`).join(' ');
  return '';
}).join('\n');

/* ---------- 규격 검사 ---------- */
const VALID_TYPES = ['heading', 'summary', 'table', 'list', 'callout', 'warning', 'infographic'];

function validate(topic, date, seenTitles, seenSlugs) {
  const file = path.join(QUEUE, `${topic.slug}.json`);
  if (!fs.existsSync(file)) return [`${topic.slug}.json 이 없습니다`];
  let d;
  try { d = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return [`${topic.slug}.json JSON 오류: ${e.message}`]; }

  const e = [];
  for (const k of ['slug', 'title', 'description', 'category', 'author', 'keywords', 'body', 'publishAt']) {
    if (d[k] === undefined || d[k] === '' || d[k] === null) e.push(`${k} 없음`);
  }
  if (e.length) return e.map((x) => `${topic.slug}: ${x}`);

  if (d.slug !== topic.slug) e.push(`slug 이 "${d.slug}" (배정 ${topic.slug})`);
  if (d.category !== topic.category) e.push(`category 가 "${d.category}" (배정 ${topic.category})`);
  if (String(d.publishAt).slice(0, 10) !== date) e.push(`publishAt 이 "${d.publishAt}" (배정 ${date})`);
  if (seenSlugs.has(d.slug)) e.push(`slug 중복: ${d.slug}`);
  if (seenTitles.has(d.title)) e.push(`제목 중복: ${d.title}`);

  const n = (s) => [...String(s || '')].length;
  if (n(d.title) < 18 || n(d.title) > 48) e.push(`title 길이 ${n(d.title)}자 (18~48)`);
  if (n(d.description) < 80 || n(d.description) > 160) e.push(`description 길이 ${n(d.description)}자 (80~160)`);
  if (!Array.isArray(d.keywords) || d.keywords.length < 3) e.push('keywords 3개 미만');
  if (!Array.isArray(d.body)) return [...e, `${topic.slug}: body 가 배열이 아닙니다`].map((x) => x);

  // 블록 모양 검사 — 여기서 안 걸러내면 generate-columns 가 빈 문자열을 뱉어 문단이 통째로 사라진다.
  let headings = 0;
  let hasSummary = false;
  let hasTable = false;
  d.body.forEach((b, i) => {
    if (typeof b === 'string') { if (!b.trim()) e.push(`body[${i}] 빈 문단`); return; }
    if (!b || typeof b !== 'object' || !b.type) { e.push(`body[${i}] 형식을 알 수 없습니다`); return; }
    if (!VALID_TYPES.includes(b.type)) { e.push(`body[${i}] 지원하지 않는 type: ${b.type}`); return; }
    if (b.type === 'heading') { headings += 1; if (!b.text) e.push(`body[${i}] heading 에 text 없음`); }
    if (b.type === 'summary') { hasSummary = true; if (!Array.isArray(b.items) || !b.items.length) e.push(`body[${i}] summary 에 items 없음`); }
    if (b.type === 'list' && (!Array.isArray(b.items) || !b.items.length)) e.push(`body[${i}] list 에 items 없음`);
    if (b.type === 'table') {
      hasTable = true;
      if (!Array.isArray(b.headers) || !b.headers.length) e.push(`body[${i}] table 에 headers 없음`);
      if (!Array.isArray(b.rows) || !b.rows.length) e.push(`body[${i}] table 에 rows 없음`);
      else if (b.rows.some((r) => !Array.isArray(r) || r.length !== (b.headers || []).length)) e.push(`body[${i}] table 의 행 길이가 헤더와 다릅니다`);
    }
    if ((b.type === 'callout' || b.type === 'warning') && !b.text) e.push(`body[${i}] ${b.type} 에 text 없음`);
    if (b.type === 'infographic' && (!Array.isArray(b.items) || !b.items.length)) e.push(`body[${i}] infographic 에 items 없음`);
  });

  if (!hasSummary) e.push('summary 블록이 없습니다');
  if (!hasTable) e.push('table 블록이 없습니다');
  if (headings < 5) e.push(`heading 블록이 ${headings}개 (최소 5개)`);
  if (d.body[0]?.type !== 'summary') e.push('첫 블록이 summary 가 아닙니다');

  const text = plainText(d.body);
  if (n(text) < 2500) e.push(`본문이 짧습니다 (${n(text)}자, 최소 2500)`);
  if (n(text) > 8000) e.push(`본문이 너무 깁니다 (${n(text)}자)`);
  for (const w of BANNED) if (text.includes(w) || String(d.title).includes(w) || String(d.description).includes(w)) e.push(`금지 표현: ${w}`);

  return e.map((x) => `${topic.slug}: ${x}`);
}

/* ---------- 프롬프트 ---------- */
function buildPrompt(topic, date, samples, titles, note) {
  return `너는 "아비컴퍼니"(aubcompany.com)의 마케팅 칼럼을 쓴다. 이번에 쓸 글은 1편이다.
아비컴퍼니는 전문직·지역 사업자의 홈페이지 제작과 검색 마케팅을 대행하는 회사다.

## 먼저 읽을 것 (문체·구성·분량의 기준이다)
${samples.map((s) => `- data/columns.json 안의 slug "${s}" 항목`).join('\n')}
AUTHORING.md 가 있으면 그것도 읽는다. 기존 글과 같은 톤으로 쓴다 —
상담에서 실제로 들은 질문에 답하듯, 과장 없이 구체적으로.

## 이번 글
- 파일: content/queue/${topic.slug}.json (JSON 객체 하나)
- slug: "${topic.slug}"
- category: "${topic.category}"
- publishAt: "${date}"
- 주요 키워드: ${topic.keyword}
- 다룰 내용: ${topic.angle}

## JSON 형식
{
  "slug": "${topic.slug}",
  "title": "...",                     // 18~48자. 질문형도 좋다. 기존 제목과 겹치지 않게
  "description": "...",               // 80~160자. 이 글에서 실제로 다루는 것. 제목 반복 금지
  "category": "${topic.category}",
  "author": "아비컴퍼니",
  "keywords": ["...", "...", "..."],  // 3~6개
  "publishAt": "${date}",
  "body": [ ... ]
}

## body 배열에 쓸 수 있는 것 (이 외의 type 을 쓰면 렌더링에서 통째로 사라진다)
- 평범한 문단: 그냥 문자열 "..."
- { "type": "summary", "title": "핵심 요약", "items": ["...", "...", "..."] }
- { "type": "heading", "text": "소제목" }
- { "type": "table", "headers": ["...", "..."], "rows": [["...", "..."]] }   // 모든 행의 칸 수가 headers 와 같아야 한다
- { "type": "list", "items": ["...", "..."] }
- { "type": "callout", "label": "짧은 라벨", "text": "..." }
- { "type": "warning", "label": "주의", "text": "..." }
- { "type": "infographic", "title": "...", "items": [{ "icon": "1", "title": "...", "text": "..." }], "caption": "..." }

## 본문 규칙
- **첫 블록은 반드시 summary** 이고, heading 을 5~8개 쓴다.
- 표(table)를 최소 1개 넣는다. 비교표·체크리스트처럼 실제로 쓸 수 있는 형태로.
- 순수 텍스트 기준 **2,800~4,000자**. 기존 글(약 1,600자)보다 깊게 쓴다.
  같은 말을 늘리지 말고, 실제 판단 기준·순서·숫자를 넣어 늘린다.
- 결론부터 말하고, 그다음 이유와 방법으로 간다.
- 문단은 2~4문장으로 짧게 끊는다. 긴 문단을 만들지 않는다.

## 절대 하지 말 것
- 성과를 약속하는 표현. "1위 보장", "무조건", "100%", "최저가", "반드시 상위노출" 금지.
  → "이런 경우에 효과가 나타납니다", "보통 3개월 정도 걸립니다" 처럼 조건과 함께 쓴다.
- 경쟁사를 깎아내리지 않는다.
- 없는 사례·수치를 지어내지 않는다. 확실하지 않으면 범위로 말한다.
- 특정 고객사의 비공개 정보를 쓰지 않는다.

## 기존 칼럼 제목 (주제가 겹치면 안 된다)
${titles.map((t) => `- ${t}`).join('\n')}
${note ? `\n## 직전 시도에서 걸린 문제 — 반드시 고쳐라\n${note}\n` : ''}
content/queue/${topic.slug}.json 하나만 쓰고, 파일명만 출력하고 끝내라. git 등 다른 명령은 실행하지 마라.`;
}

function runClaude(text) {
  for (let t = 1; t <= 3; t += 1) {
    const res = spawnSync(CLAUDE, [
      '-p', text, '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Write,Glob,Grep',
    ], { cwd: ROOT, encoding: 'utf8', timeout: BATCH_TIMEOUT, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    if (!res.error && res.status === 0) return res;
    const why = String(res.stderr || res.stdout || res.error?.message || '').trim().slice(-400);
    log(`  !! claude 호출 실패 (${res.status ?? 'error'}) ${t}/3 — ${why || '출력 없음'}`);
    if (t < 3) { log('  60초 쉬었다가 다시 부릅니다'); sleep(60000); }
  }
  return null;
}

/* ---------- 렌더 검증 ---------- */
// 큐에 남기기 전에 실제로 페이지가 만들어지는지 본다.
// 초안 하나가 generate-columns 를 깨뜨리면 그날 발행 전체가 실패한다.
function renderVerify(items) {
  const backup = fs.readFileSync(COLUMNS, 'utf8');
  const arr = JSON.parse(backup);
  const merged = arr.concat(items.map(({ publishAt, ...rest }) => ({
    ...rest,
    datePublished: rest.datePublished || String(publishAt).slice(0, 10),
    dateModified: rest.dateModified || String(publishAt).slice(0, 10),
  })));
  fs.writeFileSync(COLUMNS, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

  let err = '';
  try {
    execFileSync(process.execPath, [path.join(HERE, 'generate-columns.mjs')], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    for (const it of items) {
      const page = path.join(ROOT, 'column', it.slug, 'index.html');
      if (!fs.existsSync(page)) { err += `\n${it.slug}: 페이지가 생성되지 않았습니다`; continue; }
      const html = fs.readFileSync(page, 'utf8');
      if (!/<h1[\s>]/i.test(html)) err += `\n${it.slug}: H1 없음`;
      if (html.includes('undefined')) err += `\n${it.slug}: 렌더 결과에 undefined 가 있습니다`;
      const bodyText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      if ([...bodyText].length < 2000) err += `\n${it.slug}: 렌더된 본문이 너무 짧습니다 (${[...bodyText].length}자)`;
    }
  } catch (e) {
    err += String(e.stdout || '') + String(e.stderr || e.message || '');
  }

  // 되돌리기 — 실제 반영은 발행일에 워크플로가 한다.
  //
  // 되돌릴 범위를 반드시 산출물로 좁힌다. `git checkout -- .` 나 범위 없는 `git clean` 은
  // "빌드가 만든 것" 과 "사람이 아직 커밋하지 않은 것" 을 구분하지 못해서,
  // 작성 중이던 스크립트·배정표를 통째로 날려 버린다(울산 저장소에서 실제로 겪음).
  const OUTPUTS = ['column', 'service', 'sitemap.xml'];
  fs.writeFileSync(COLUMNS, backup, 'utf8');
  try { git(['checkout', '--', ...OUTPUTS]); } catch { }
  try { git(['clean', '-fdq', '--', 'column', 'service']); } catch { }

  return err.trim().slice(-1200);
}

/* ---------- 본체 ---------- */
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const GIT = argv.includes('--git');
const fi = argv.indexOf('--force');
const FORCE = fi >= 0 ? Math.max(1, Math.min(MAX_ADD, Number(argv[fi + 1]) || 1)) : 0;

fs.mkdirSync(QUEUE, { recursive: true });

// 개수를 세기 전에 원격을 먼저 반영한다.
// 발행 워크플로가 원격에서 큐 파일을 지우므로, 당겨오지 않으면 잔량을 실제보다 많게 본다.
if (GIT) {
  try { git(['fetch', 'origin', 'main']); git(['merge', '--ff-only', 'origin/main']); log('원격 반영'); }
  catch (e) { fail('원격과 갈라짐 — 로컬 변경을 정리해야 합니다', String(e.stdout || e.message)); }
}

const live = published();
const q = queueItems().sort((a, b) => String(a.publishAt).localeCompare(String(b.publishAt)));
const lastAt = [...live.map((c) => c.datePublished), ...q.map((c) => String(c.publishAt).slice(0, 10))]
  .filter(Boolean).sort().at(-1) || TODAY;

log(`─── 큐 점검 (KST ${TODAY}) ─── 발행 ${live.length}편 · 큐 ${q.length}편 · 마지막 예약일 ${lastAt}`);
if (CHECK) {
  q.forEach((c) => console.log(`  ${String(c.publishAt).slice(0, 10)}  ${c.slug}  ${c.title}`));
  process.exit(0);
}

const bank = JSON.parse(fs.readFileSync(BANK, 'utf8')).topics;
const usedSlugs = new Set([...live.map((c) => c.slug), ...q.map((c) => c.slug)]);
const free = bank.filter((t) => !usedSlugs.has(t.slug));

const need = FORCE || (q.length < THRESHOLD ? Math.min(MAX_ADD, TARGET - q.length) : 0);
if (need <= 0) { log(`큐 ${q.length}편 — 보충 불필요(기준 ${THRESHOLD})`); process.exit(0); }

if (!free.length) fail('주제 배정표가 비었습니다', `content/topic-bank.json 에 새 주제를 추가해야 ${lastAt} 이후로 발행이 이어집니다.`);
if (free.length < need) log(`!! 배정표에 남은 주제가 ${free.length}개뿐입니다 — 곧 채워 넣어야 합니다`);

if (fs.existsSync(LOCK)) {
  if (Date.now() - fs.statSync(LOCK).mtimeMs < BATCH_TIMEOUT * 2) { log('이미 실행 중 — 종료'); process.exit(0); }
  unlock();
}
fs.writeFileSync(LOCK, stamp());

const targets = free.slice(0, Math.min(need, free.length));
const base = lastAt > TODAY ? lastAt : TODAY;
const plan = targets.map((t, i) => ({ topic: t, date: addDays(base, i + 1) }));
log(`${plan.length}건 보충 시작 → ${plan[0].date} ~ ${plan[plan.length - 1].date}`);

const seenTitles = new Set([...live.map((c) => c.title), ...q.map((c) => c.title)]);
const seenSlugs = new Set(usedSlugs);
const written = [];

for (const { topic, date } of plan) {
  const samples = live.filter((c) => c.category === topic.category).slice(-2).map((c) => c.slug);
  if (!samples.length) samples.push(live.at(-1).slug);

  let note = '';
  let ok = false;
  for (let attempt = 0; attempt <= RETRY; attempt += 1) {
    if (attempt) log(`  재작성 ${attempt}회차 — ${topic.slug}`);
    try { fs.rmSync(path.join(QUEUE, `${topic.slug}.json`)); } catch { }

    if (!runClaude(buildPrompt(topic, date, samples, [...seenTitles], note))) {
      fail('claude 를 세 번 불렀지만 모두 실패했습니다 (사용량 한도로 보입니다)',
        `여기까지 ${written.length}건은 남아 있습니다. 다시 실행하면 이어서 씁니다.`);
    }
    const errs = validate(topic, date, seenTitles, seenSlugs);
    if (!errs.length) { ok = true; break; }
    note = errs.map((x) => `- ${x}`).join('\n');
    log(`  !! 규격 불통과 ${topic.slug}: ${errs.slice(0, 3).join(' / ')}`);
  }
  if (!ok) {
    try { fs.rmSync(path.join(QUEUE, `${topic.slug}.json`)); } catch { }
    log(`  건너뜀 — ${topic.slug} 가 ${RETRY + 1}회 모두 규격 미달`);
    continue;
  }

  const d = JSON.parse(fs.readFileSync(path.join(QUEUE, `${topic.slug}.json`), 'utf8'));
  seenTitles.add(d.title);
  seenSlugs.add(d.slug);
  written.push(d);
  try { fs.writeFileSync(LOCK, stamp()); } catch { }
  log(`  통과 ${date}  ${topic.slug} — ${d.title}`);
}

if (!written.length) fail('한 편도 규격을 통과하지 못했습니다');

log('렌더 검증 중…');
const renderErr = renderVerify(written);
if (renderErr) {
  written.forEach((d) => { try { fs.rmSync(path.join(QUEUE, `${d.slug}.json`)); } catch { } });
  fail('새 초안이 렌더를 깨뜨려 전부 되돌렸습니다', renderErr);
}
log('렌더 검증 통과');

if (GIT) {
  try {
    git(['add', '--', 'content/queue', 'content/topic-bank.json']);
    git(['-c', 'core.autocrlf=false', 'commit', '-q', '-m', `칼럼 큐 보충: ${written.length}편 (${plan[0].date} ~)`]);
    git(['push', '-q', 'origin', 'main']);
    log('GitHub 푸시 완료 — publish-queue 가 매일 00:10 KST 에 한 편씩 발행');
  } catch (e) {
    fail('커밋·푸시 실패', String(e.stdout || e.stderr || e.message));
  }
}

log(`─── 보충 완료 · ${written.length}편 (배정표 잔여 ${free.length - written.length}개) ───`);
try { if (fs.existsSync(DESK)) fs.rmSync(DESK); } catch { }
unlock();
