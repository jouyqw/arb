/**
 * 칼럼을 "대표가 직접 쓴 글"로 바꾼다 — node scripts/rewrite-voice.mjs [--only slug] [--limit 5] [--apply]
 *
 * 왜
 *   지금 글은 정보는 맞는데 누가 썼는지가 없다. 자료실 문서처럼 읽힌다.
 *   검색과 AI 양쪽 모두 "이 분야를 실제로 해 본 사람이 쓴 글"을 위에 올린다(E-E-A-T).
 *   그리고 읽는 사람이 맡길 곳을 고르는 중이라면, 글쓴이가 누구인지가 판단 재료가 된다.
 *
 * 무엇을
 *   - 1인칭(저/저희)으로 바꾼다. 아비컴퍼니 대표 오경록이 상담에서 겪은 이야기로.
 *   - 상담에서 실제로 듣는 질문, 현장에서 본 실패 지점을 넣는다.
 *   - 읽고 나서 "물어볼 곳이 있구나"로 이어지게 한다. 다만 영업 문구를 늘어놓지 않는다.
 *   - 사실·숫자·구조(표·FAQ)는 그대로 살린다. 톤을 바꾸는 작업이지 다시 쓰는 게 아니다.
 *
 * 안전장치
 *   upgrade-columns.mjs 와 같은 규격검사를 쓴다. 분량이 줄거나 FAQ·표가 빠지면 반려된다.
 *   없는 사례를 지어내지 못하게 프롬프트에서 막고, 검사에서 금지 표현도 함께 본다.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const COLUMNS = path.join(ROOT, 'data', 'columns.json');
const STAGE = path.join(ROOT, 'content', 'voice');
const LOG = path.join(ROOT, 'voice.log');

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

/** 1인칭이 실제로 쓰였는지. 톤을 바꾸라고 했는데 안 바꾸고 오는 경우를 잡는다. */
function firstPersonCount(text) {
  return (text.match(/저는|제가|저희는|저희가|저희|제 경험|상담에서/g) || []).length;
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
  if (d.slug !== slug) e.push(`slug 이 "${d.slug}"`);
  if (d.category !== original.category) e.push('category 가 바뀌었습니다');
  if (n(d.title) < 18 || n(d.title) > 48) e.push(`title ${n(d.title)}자 (18~48)`);
  if (n(d.description) < 80 || n(d.description) > 160) e.push(`description ${n(d.description)}자 (80~160)`);
  if (!Array.isArray(d.body)) return [...e, 'body 가 배열이 아닙니다'];

  let headings = 0, hasSummary = false, hasTable = false, faqCount = 0;
  d.body.forEach((b, i) => {
    if (typeof b === 'string') { if (!b.trim()) e.push(`body[${i}] 빈 문단`); return; }
    if (!b || !b.type || !VALID_TYPES.includes(b.type)) { e.push(`body[${i}] 알 수 없는 블록`); return; }
    if (b.type === 'heading') { headings += 1; if (!b.text) e.push(`body[${i}] heading text 없음`); }
    if (b.type === 'summary') { hasSummary = true; if (!Array.isArray(b.items) || !b.items.length) e.push(`body[${i}] summary 비었음`); }
    if (b.type === 'list' && (!Array.isArray(b.items) || !b.items.length)) e.push(`body[${i}] list 비었음`);
    if (b.type === 'table') {
      hasTable = true;
      if (!Array.isArray(b.headers) || !b.headers.length) e.push(`body[${i}] table headers 없음`);
      if (!Array.isArray(b.rows) || !b.rows.length) e.push(`body[${i}] table rows 없음`);
      else if (b.rows.some((r) => !Array.isArray(r) || r.length !== b.headers.length)) e.push(`body[${i}] table 행 길이 불일치`);
    }
    if ((b.type === 'callout' || b.type === 'warning') && !b.text) e.push(`body[${i}] ${b.type} text 없음`);
    if (b.type === 'infographic' && (!Array.isArray(b.items) || !b.items.length)) e.push(`body[${i}] infographic 비었음`);
    if (b.type === 'faq') {
      faqCount = (b.items || []).length;
      if (faqCount < 4) e.push(`faq ${faqCount}개 (최소 4개)`);
      else if (b.items.some((x) => !x || !x.q || !x.a)) e.push('faq q/a 누락');
      else if (b.items.some((x) => n(x.a) < 60)) e.push('faq 답변 60자 미만');
    }
  });

  if (!hasSummary) e.push('summary 없음');
  if (!hasTable) e.push('table 없음');
  if (!faqCount) e.push('faq 없음');
  if (headings < 6) e.push(`heading ${headings}개 (최소 6개)`);
  if (d.body[0]?.type !== 'summary') e.push('첫 블록이 summary 가 아닙니다');

  const text = plainText(d.body);
  const before = n(plainText(original.body));
  if (n(text) < MIN_CHARS) e.push(`본문 ${n(text)}자 (최소 ${MIN_CHARS})`);
  if (n(text) < before * 0.85) e.push(`분량이 ${Math.round(n(text) / before * 100)}%로 줄었습니다`);
  if (n(text) > 9500) e.push(`본문이 너무 깁니다 (${n(text)}자)`);
  for (const w of BANNED) if (text.includes(w) || String(d.title).includes(w)) e.push(`금지 표현: ${w}`);

  const fp = firstPersonCount(text);
  if (fp < 6) e.push(`1인칭 서술이 ${fp}곳뿐입니다 (최소 6곳) — 톤이 안 바뀌었습니다`);

  return e;
}

function buildPrompt(c, note) {
  return `아비컴퍼니(aubcompany.com) 마케팅 칼럼 한 편의 **목소리를 바꾼다.**
정보를 다시 조사하는 게 아니라, 같은 내용을 **대표가 직접 쓴 글**로 옮기는 작업이다.

## 글쓴이
아비컴퍼니 대표 **오경록**. 병원·법무법인·세무법인 등 전문직 22곳의 홈페이지 제작과
검색 마케팅을 대행해 왔다. 글은 1인칭("저는", "저희가")으로 쓴다.

## 대상
slug "${c.slug}" — ${c.title}

\`\`\`json
${JSON.stringify({ ...c, datePublished: undefined, dateModified: undefined }, null, 1)}
\`\`\`

## 결과물
content/voice/${c.slug}.json 에 JSON 객체 하나를 쓴다.
slug·category·author 는 그대로. 블록 구조(summary/heading/table/faq 등)도 그대로 유지한다.

## 어떻게 바꾸나

**1. 상담에서 시작한다.**
   각 소제목의 첫 문단은 여전히 답부터 쓰되, 글 전체의 도입과 중간중간에
   "상담에서 이런 질문을 자주 받습니다", "실제로 이런 경우를 봤습니다" 같은
   **현장에서 나온 관찰**을 넣는다. 추상적인 설명만 이어지지 않게 한다.

**2. 실패 지점을 구체적으로 짚는다.**
   잘하는 법만 적지 말고, **안 하면 무엇을 잃는지**를 숫자와 함께 말한다.
   예: "이 순서를 바꾸면 원고를 두 번 쓰게 됩니다", "3개월을 버리는 셈입니다"
   겁을 주는 게 아니라, 판단이 늦어질 때 생기는 실제 비용을 알려 주는 것이다.

**3. 읽는 사람이 다음에 뭘 해야 할지 알게 한다.**
   글 끝이 아니라 중간에도 "여기까지 정리되면 다음은 ○○입니다" 처럼
   행동 순서를 준다. 읽고 나서 막막하지 않아야 한다.

**4. 맡길지 직접 할지 판단할 재료를 준다.**
   "이 정도는 직접 하셔도 됩니다 / 이 부분은 맡기시는 편이 낫습니다"를
   **조건과 함께** 구분해 준다. 무조건 맡기라고 하지 않는다. 그게 더 믿을 만하게 읽힌다.

**5. 마지막 블록 앞에 callout 하나를 둔다.**
   label 은 "상담 전에 준비하시면 좋은 것" 같은 실용적인 제목으로,
   text 는 상담 오기 전에 정리해 오면 좋은 자료 2~3가지를 적는다.
   "연락 주세요" 같은 문구는 쓰지 않는다. 페이지 하단에 이미 연락처가 있다.

## 반드시 지킬 것
- **사실·숫자·표·FAQ 를 지운다면 실패다.** 지금 글의 정보는 전부 남긴다.
  분량이 85% 아래로 줄면 자동 반려된다. 지금보다 길어지는 게 정상이다.
- **1인칭 서술이 본문 전체에 최소 6곳** 이상 나와야 한다.
- 첫 블록은 summary, 표 최소 1개, faq 4~6문항, heading 6개 이상 — 구조는 그대로.
- faq 답변은 그 자체로 완결된 3~5문장(60자 이상).

## 절대 하지 말 것
- **없는 사례를 지어내지 마라.** "○○병원 사례에서" 처럼 특정할 수 있는 고객 이야기 금지.
  일반화해서 쓴다: "병원 쪽 상담에서 자주 보는 경우는", "전문직 사무소에서는 대개".
- 성과 약속: "1위 보장", "무조건", "100%", "최저가", "반드시 상위노출" 금지.
  **금지 표현을 나쁜 예시로 인용하는 것도 안 된다** — 검사기가 인용과 주장을 구분하지 못한다.
  풀어서 서술한다(예: "순위를 약속하는 표현").
- 경쟁사 비방. 고객사 비공개 정보. 자화자찬("저희가 최고입니다") 금지 —
  실력은 주장이 아니라 글의 구체성으로 보여 준다.
${note ? `\n## 직전 시도에서 걸린 문제 — 반드시 고쳐라\n${note}\n` : ''}
content/voice/${c.slug}.json 하나만 쓰고, 파일명만 출력하고 끝내라. git 명령은 실행하지 마라.`;
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
const LIMIT = li >= 0 ? Number(argv[li + 1]) || 5 : 5;
const oi = argv.indexOf('--only');
const ONLY = oi >= 0 ? argv[oi + 1] : '';

fs.mkdirSync(STAGE, { recursive: true });
const all = JSON.parse(fs.readFileSync(COLUMNS, 'utf8'));

// 아직 1인칭으로 안 바뀐 글부터
const needsWork = (c) => firstPersonCount(plainText(c.body)) < 6;
let targets = ONLY ? all.filter((c) => c.slug === ONLY) : all.filter(needsWork);
log(`─── 목소리 전환 대상 ${all.filter(needsWork).length}편 중 ${Math.min(LIMIT, targets.length)}편 ───`);

const done = [];
for (const c of targets.slice(0, LIMIT)) {
  const before = n(plainText(c.body));

  if (fs.existsSync(path.join(STAGE, `${c.slug}.json`)) && !validate(c.slug, c).length) {
    const d = JSON.parse(fs.readFileSync(path.join(STAGE, `${c.slug}.json`), 'utf8'));
    log(`  재사용 ${c.slug}`);
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
  log(`  통과 ${c.slug} — ${before}자 → ${n(plainText(d.body))}자 · 1인칭 ${firstPersonCount(plainText(d.body))}곳`);
  done.push(d);
}

if (!done.length) { log('반영할 글이 없습니다.'); process.exit(0); }
if (!APPLY) { log(`\n${done.length}편 통과. --apply 를 붙이면 반영합니다.`); process.exit(0); }

const backupPath = path.join(ROOT, 'data', `columns.voice-backup-${new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)}.json`);
const backup = fs.readFileSync(COLUMNS, 'utf8');
if (!fs.existsSync(backupPath)) fs.writeFileSync(backupPath, backup);

const merged = all.map((c) => {
  const u = done.find((d) => d.slug === c.slug);
  if (!u) return c;
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
    if (!html.includes('"FAQPage"')) err += `\n${d.slug}: FAQ 스키마 없음`;
    if (html.includes('undefined')) err += `\n${d.slug}: 렌더에 undefined`;
  }
} catch (e) {
  err += String(e.stdout || '') + String(e.stderr || e.message || '');
}
if (err) {
  fs.writeFileSync(COLUMNS, backup, 'utf8');
  try { execFileSync('git', ['checkout', '--', 'column', 'service', 'sitemap.xml'], { cwd: ROOT }); } catch { }
  log(`!! 렌더 검증 실패 — 되돌렸습니다${err.slice(-500)}`);
  process.exit(1);
}

done.forEach((d) => { try { fs.rmSync(path.join(STAGE, `${d.slug}.json`)); } catch { } });
log(`─── 반영 완료 · ${done.length}편 ───`);
