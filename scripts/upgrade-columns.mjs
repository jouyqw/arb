/**
 * 이미 발행된 칼럼을 보강한다 — node scripts/upgrade-columns.mjs [--limit 10] [--apply]
 *
 * 왜
 *   발행 99편의 본문 중앙값이 1,849자다. 얇은 글이 많으면 개별 글이 안 뜨는 건 물론이고
 *   사이트 전체 평가가 내려간다. FAQ 가 있는 글은 3편뿐이라 AI 검색에 인용될 거리도 없다.
 *
 * 무엇을
 *   - 본문을 3,200자 이상으로 늘린다. 같은 말을 늘리지 말고 판단 기준·순서·숫자를 넣는다.
 *   - 표를 최소 1개 넣는다(없으면 새로, 있으면 그대로 둔다).
 *   - FAQ 4~6문항을 넣는다. 화면과 구조화 데이터 양쪽에 쓰인다.
 *   - **기존 문장을 지우지 않는다.** 보강 후 원문 문장이 사라지면 실패로 본다.
 *
 * 안전장치
 *   - 규격검사 통과분만 반영한다(refill-queue 와 같은 기준).
 *   - 반영 전에 generate-columns 로 렌더까지 해 보고 산출물은 되돌린다.
 *   - 원본은 data/columns.backup-<날짜>.json 으로 남긴다.
 *   - --apply 없이 돌리면 아무것도 바꾸지 않는다.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const COLUMNS = path.join(ROOT, 'data', 'columns.json');
const STAGE = path.join(ROOT, 'content', 'upgrade');
const LOG = path.join(ROOT, 'upgrade.log');

const MIN_CHARS = 3200;
const RETRY = 2;
const TIMEOUT = 25 * 60 * 1000;

const BANNED = ['100%', '무조건', '보장합니다', '수익 보장', '1위 보장', '최저가', '국내 최고',
  '업계 1위', '반드시 상위노출', '상위노출 보장', '무조건 1페이지'];

const CLAUDE = [
  'C:\\Users\\c\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Anthropic.ClaudeCode_Microsoft.Winget.Source_8wekyb3d8bbwe\\claude.exe',
  'claude',
].find((p) => p === 'claude' || fs.existsSync(p));

const stamp = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
function log(m) {
  const line = `[${stamp()}] ${m}`;
  console.log(line);
  try { fs.appendFileSync(LOG, line + '\n'); } catch { }
}

const plainText = (body) => (body || []).map((b) => {
  if (typeof b === 'string') return b;
  if (!b || typeof b !== 'object') return '';
  if (b.type === 'heading') return b.text || '';
  if (b.type === 'summary' || b.type === 'list') return (b.items || []).join(' ');
  if (b.type === 'table') return [...(b.headers || []), ...(b.rows || []).flat()].join(' ');
  if (b.type === 'callout' || b.type === 'warning') return `${b.label || ''} ${b.text || ''}`;
  if (b.type === 'infographic') return (b.items || []).map((i) => `${i.title} ${i.text}`).join(' ');
  if (b.type === 'faq') return (b.items || []).map((i) => `${i.q} ${i.a}`).join(' ');
  return '';
}).join('\n');

const VALID_TYPES = ['heading', 'summary', 'table', 'list', 'callout', 'warning', 'infographic', 'faq'];
const n = (s) => [...String(s || '')].length;

/** 원문의 문장들이 그대로 남아 있는지 본다. 보강은 더하는 일이지 갈아엎는 일이 아니다. */
function keptOriginal(oldBody, newBody) {
  const norm = (s) => s.replace(/\s+/g, '').replace(/[·.,"'“”‘’()]/g, '');
  const after = norm(plainText(newBody));
  const sentences = plainText(oldBody).split(/(?<=[.?!])\s+/).map(norm).filter((s) => s.length >= 18);
  if (!sentences.length) return true;
  const kept = sentences.filter((s) => after.includes(s)).length;
  return kept / sentences.length >= 0.7;
}

function validate(slug, original) {
  const file = path.join(STAGE, `${slug}.json`);
  if (!fs.existsSync(file)) return ['파일이 없습니다'];
  let d;
  try { d = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return [`JSON 오류: ${e.message}`]; }

  const e = [];
  for (const k of ['slug', 'title', 'description', 'category', 'author', 'keywords', 'body']) {
    if (d[k] === undefined || d[k] === '' || d[k] === null) e.push(`${k} 없음`);
  }
  if (e.length) return e;

  if (d.slug !== slug) e.push(`slug 이 "${d.slug}" (원래 ${slug})`);
  if (d.category !== original.category) e.push(`category 가 바뀌었습니다 ("${d.category}")`);
  if (n(d.title) < 18 || n(d.title) > 48) e.push(`title 길이 ${n(d.title)}자 (18~48)`);
  if (n(d.description) < 80 || n(d.description) > 160) e.push(`description 길이 ${n(d.description)}자 (80~160)`);
  if (!Array.isArray(d.body)) return [...e, 'body 가 배열이 아닙니다'];

  let headings = 0, hasSummary = false, hasTable = false, faqCount = 0;
  d.body.forEach((b, i) => {
    if (typeof b === 'string') { if (!b.trim()) e.push(`body[${i}] 빈 문단`); return; }
    if (!b || !b.type || !VALID_TYPES.includes(b.type)) { e.push(`body[${i}] 알 수 없는 블록`); return; }
    if (b.type === 'heading') { headings += 1; if (!b.text) e.push(`body[${i}] heading 에 text 없음`); }
    if (b.type === 'summary') { hasSummary = true; if (!Array.isArray(b.items) || !b.items.length) e.push(`body[${i}] summary 비었음`); }
    if (b.type === 'list' && (!Array.isArray(b.items) || !b.items.length)) e.push(`body[${i}] list 비었음`);
    if (b.type === 'table') {
      hasTable = true;
      if (!Array.isArray(b.headers) || !b.headers.length) e.push(`body[${i}] table headers 없음`);
      if (!Array.isArray(b.rows) || !b.rows.length) e.push(`body[${i}] table rows 없음`);
      else if (b.rows.some((r) => !Array.isArray(r) || r.length !== (b.headers || []).length)) e.push(`body[${i}] table 행 길이 불일치`);
    }
    if ((b.type === 'callout' || b.type === 'warning') && !b.text) e.push(`body[${i}] ${b.type} text 없음`);
    if (b.type === 'infographic' && (!Array.isArray(b.items) || !b.items.length)) e.push(`body[${i}] infographic 비었음`);
    if (b.type === 'faq') {
      faqCount = (b.items || []).length;
      if (faqCount < 4) e.push(`faq 질문이 ${faqCount}개 (최소 4개)`);
      else if (b.items.some((x) => !x || !x.q || !x.a)) e.push('faq 항목에 q 또는 a 없음');
      else if (b.items.some((x) => n(x.a) < 60)) e.push('faq 답변이 60자 미만인 항목이 있습니다');
    }
  });

  if (!hasSummary) e.push('summary 블록이 없습니다');
  if (!hasTable) e.push('table 블록이 없습니다');
  if (!faqCount) e.push('faq 블록이 없습니다');
  if (headings < 6) e.push(`heading 이 ${headings}개 (최소 6개)`);
  if (d.body[0]?.type !== 'summary') e.push('첫 블록이 summary 가 아닙니다');

  const text = plainText(d.body);
  if (n(text) < MIN_CHARS) e.push(`본문 ${n(text)}자 (최소 ${MIN_CHARS})`);
  if (n(text) > 9000) e.push(`본문이 너무 깁니다 (${n(text)}자)`);
  for (const w of BANNED) if (text.includes(w) || String(d.title).includes(w)) e.push(`금지 표현: ${w}`);
  if (!keptOriginal(original.body, d.body)) e.push('원문 내용이 상당 부분 사라졌습니다 (보강이 아니라 재작성됨)');

  return e;
}

function buildPrompt(c, note) {
  const before = n(plainText(c.body));
  return `아비컴퍼니(aubcompany.com)의 이미 발행된 마케팅 칼럼 한 편을 **보강**한다.
새로 쓰는 게 아니라, 지금 글을 그대로 두고 살을 붙이는 작업이다.

## 대상
slug "${c.slug}" — 제목: ${c.title}
현재 본문 ${before}자. 아래 JSON 이 지금 내용이다.

\`\`\`json
${JSON.stringify({ ...c, datePublished: undefined, dateModified: undefined }, null, 1)}
\`\`\`

## 결과물
content/upgrade/${c.slug}.json 에 보강한 JSON 객체 하나를 쓴다.
slug·category·author 는 그대로 둔다. title 은 그대로 두되 18~48자 범위를 벗어나면 다듬어도 된다.

## 반드시 지킬 것
- **지금 있는 문장을 지우지 마라.** 순서를 바꾸거나 표현을 다듬는 건 괜찮지만,
  담고 있던 정보가 사라지면 실패로 처리된다. 이건 "더하는" 작업이다.
- 순수 텍스트 기준 **${MIN_CHARS}자 이상**으로 늘린다. 같은 말을 풀어 쓰지 말고
  **실제 판단 기준·확인 순서·기간·금액 범위·체크리스트**를 더해서 늘린다.
- **표(table)를 최소 1개** 둔다. 이미 있으면 살리고, 필요하면 하나 더 넣는다.
  비교 축이 분명해야 한다 — "A 와 B 중 무엇을 고를지"를 표 하나로 끝낼 수 있게.
- **마지막에서 두 번째 블록은 faq** 로 하고 질문을 4~6개 넣는다.
- heading 을 6개 이상 쓴다. 첫 블록은 summary 다.

## body 에 쓸 수 있는 블록 (이 외의 type 은 렌더링에서 사라진다)
- 평범한 문단: 그냥 문자열 "..."
- { "type": "summary", "title": "핵심 요약", "items": ["...", "..."] }
- { "type": "heading", "text": "소제목" }
- { "type": "table", "headers": ["...", "..."], "rows": [["...", "..."]] }   // 모든 행의 칸 수가 headers 와 같아야 한다
- { "type": "list", "items": ["...", "..."] }
- { "type": "callout", "label": "짧은 라벨", "text": "..." }
- { "type": "warning", "label": "주의", "text": "..." }
- { "type": "infographic", "title": "...", "items": [{ "icon": "1", "title": "...", "text": "..." }], "caption": "..." }
- { "type": "faq", "title": "자주 묻는 질문", "items": [{ "q": "질문", "a": "답변" }] }

## 검색·AI 노출을 위해 (이 글의 목적이다)
- **각 heading 바로 다음 문단은 그 소제목의 질문에 대한 답부터 쓴다.**
  AI 가 답변에 인용할 때 그 한 문단만 떼어 가기 때문이다. 배경 설명으로 시작하지 마라.
- faq 답변은 **그 자체로 완결된 3~5문장**으로 쓴다. "위에서 설명한 대로" 같은 참조를 쓰지 마라.
  60자 미만이면 반려된다.
- 숫자로 말할 수 있는 건 숫자로 쓴다(기간·항목 수·금액 범위). 지어내지 말고 범위로.
- 문단은 2~4문장으로 짧게 끊는다.

## 절대 하지 말 것
- 성과를 약속하는 표현: "1위 보장", "무조건", "100%", "최저가", "반드시 상위노출" 금지.
  → "이런 경우에 효과가 나타납니다", "보통 3개월 정도 걸립니다" 처럼 조건과 함께 쓴다.
- 경쟁사 비방. 없는 사례·수치 지어내기. 고객사 비공개 정보.
- 다른 파일 수정. git 명령 실행.
${note ? `\n## 직전 시도에서 걸린 문제 — 반드시 고쳐라\n${note}\n` : ''}
content/upgrade/${c.slug}.json 하나만 쓰고, 파일명만 출력하고 끝내라.`;
}

function runClaude(text) {
  const res = spawnSync(CLAUDE, ['-p', text, '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Write,Glob,Grep'],
    { cwd: ROOT, encoding: 'utf8', timeout: TIMEOUT, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  if (!res.error && res.status === 0) return true;
  log(`  !! claude 실패 (${res.status ?? 'error'}) — ${String(res.stderr || res.stdout || '').trim().slice(-300)}`);
  return false;
}

/* ---------- 본체 ---------- */
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const li = argv.indexOf('--limit');
const LIMIT = li >= 0 ? Number(argv[li + 1]) || 10 : 10;
const oi = argv.indexOf('--only');
const ONLY = oi >= 0 ? argv[oi + 1] : '';

fs.mkdirSync(STAGE, { recursive: true });
const all = JSON.parse(fs.readFileSync(COLUMNS, 'utf8'));

const needsWork = (c) => {
  const hasFaq = (c.body || []).some((b) => b && b.type === 'faq');
  return !hasFaq || n(plainText(c.body)) < MIN_CHARS;
};

// 짧은 글부터 고친다. 얻는 게 가장 크다.
let targets = all.filter(needsWork).sort((a, b) => n(plainText(a.body)) - n(plainText(b.body)));
if (ONLY) targets = all.filter((c) => c.slug === ONLY);
log(`─── 보강 대상 ${all.filter(needsWork).length}편 중 ${Math.min(LIMIT, targets.length)}편 처리 ───`);

const done = [];
for (const c of targets.slice(0, LIMIT)) {
  const before = n(plainText(c.body));

  // 이미 만들어 둔 초안이 검사를 통과하면 다시 부르지 않는다.
  // 96편이면 여섯 시간짜리 작업이다. 중간에 끊겨도 이어서 돌 수 있어야 한다.
  if (fs.existsSync(path.join(STAGE, `${c.slug}.json`)) && !validate(c.slug, c).length) {
    const d = JSON.parse(fs.readFileSync(path.join(STAGE, `${c.slug}.json`), 'utf8'));
    log(`  재사용 ${c.slug} — ${before}자 → ${n(plainText(d.body))}자`);
    done.push(d);
    continue;
  }

  let note = '';
  let ok = false;
  for (let attempt = 0; attempt <= RETRY; attempt += 1) {
    if (attempt) log(`  재시도 ${attempt} — ${c.slug}`);
    try { fs.rmSync(path.join(STAGE, `${c.slug}.json`)); } catch { }
    if (!runClaude(buildPrompt(c, note))) break;
    const errs = validate(c.slug, c);
    if (!errs.length) { ok = true; break; }
    note = errs.map((x) => `- ${x}`).join('\n');
    log(`  !! 검사 불통과 ${c.slug}: ${errs.slice(0, 3).join(' / ')}`);
  }
  if (!ok) { log(`  건너뜀 — ${c.slug}`); continue; }
  const d = JSON.parse(fs.readFileSync(path.join(STAGE, `${c.slug}.json`), 'utf8'));
  const after = n(plainText(d.body));
  const faq = (d.body.find((b) => b && b.type === 'faq')?.items || []).length;
  log(`  통과 ${c.slug} — ${before}자 → ${after}자 · FAQ ${faq}문항`);
  done.push(d);
}

if (!done.length) { log('반영할 글이 없습니다.'); process.exit(0); }

if (!APPLY) {
  log(`\n${done.length}편이 검사를 통과했습니다. --apply 를 붙이면 반영합니다.`);
  process.exit(0);
}

/* 반영 — 렌더까지 해 보고 문제가 없을 때만 남긴다 */
const backupPath = path.join(ROOT, 'data', `columns.backup-${new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)}.json`);
const backup = fs.readFileSync(COLUMNS, 'utf8');
if (!fs.existsSync(backupPath)) fs.writeFileSync(backupPath, backup);

const merged = all.map((c) => {
  const u = done.find((d) => d.slug === c.slug);
  if (!u) return c;
  // 발행일은 건드리지 않는다. 수정일만 올린다.
  return { ...c, ...u, datePublished: c.datePublished, dateModified: new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10) };
});
fs.writeFileSync(COLUMNS, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

let err = '';
try {
  execFileSync(process.execPath, [path.join(HERE, 'generate-columns.mjs')], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  for (const d of done) {
    const page = path.join(ROOT, 'column', d.slug, 'index.html');
    if (!fs.existsSync(page)) { err += `\n${d.slug}: 페이지 미생성`; continue; }
    const html = fs.readFileSync(page, 'utf8');
    if (!html.includes('"FAQPage"')) err += `\n${d.slug}: FAQ 스키마가 안 나옵니다`;
    if (html.includes('undefined')) err += `\n${d.slug}: 렌더 결과에 undefined`;
  }
} catch (e) {
  err += String(e.stdout || '') + String(e.stderr || e.message || '');
}

if (err) {
  fs.writeFileSync(COLUMNS, backup, 'utf8');
  try { execFileSync('git', ['checkout', '--', 'column', 'service', 'sitemap.xml'], { cwd: ROOT }); } catch { }
  log(`!! 렌더 검증 실패 — 전부 되돌렸습니다${err.slice(-600)}`);
  process.exit(1);
}

done.forEach((d) => { try { fs.rmSync(path.join(STAGE, `${d.slug}.json`)); } catch { } });
log(`─── 반영 완료 · ${done.length}편 (원본 ${path.basename(backupPath)}) ───`);
