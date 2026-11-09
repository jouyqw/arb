/**
 * 발행된 칼럼에 전환 요소를 보완한다.
 *
 *   node scripts/retrofit-closing.mjs --check        대상만 센다
 *   node scripts/retrofit-closing.mjs --limit 12     12편 손본다
 *   node scripts/retrofit-closing.mjs --limit 12 --git  커밋·푸시까지
 *
 * 무엇이 빠져 있나 (2026-11-09 실측, 발행 152편 기준)
 *   · faq 로 끝남 74편 — 마지막에 제안 문단이 없다
 *   · "직접 하셔도 되는 선" 없음 50편
 *   겹쳐서 95편이 새 기준에 못 미친다. 57편만 통과한다.
 *
 * 왜 마지막 문단이 전환을 가르나
 *   faq 로 끝나면 읽는 사람이 "그래서 뭘 하면 되나" 를 들고 그냥 닫는다.
 *   마지막 한 문단에서 (1) 직접 해 보셔도 된다 (2) 사람들이 막히는 지점
 *   (3) 그 상태로 물어보셔도 된다 를 말해 주면 그때 연락이 온다.
 *   "지금 바로 문의하세요" 는 반대로 닫게 만든다.
 *
 * 왜 통째로 다시 쓰지 않나
 *   본문은 이미 쓸 만하다. 빠진 건 끝맺음이다. 통째로 다시 쓰면 색인된 글
 *   106장의 내용이 바뀌어 순위가 흔들린다. 끝에 한 문단을 더하는 쪽이 안전하다.
 *
 * 왜 같은 문단을 돌려 쓰지 않나
 *   74장이 같은 문장을 들고 있으면 구글이 중복으로 본다.
 *   글마다 그 글의 내용을 읽고 쓰게 한다 — 그래서 LLM 을 한 편씩 부른다.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const COLUMNS = path.join(ROOT, 'data', 'columns.json');
const LOG = path.join(ROOT, 'retrofit.log');
const WORK = path.join(ROOT, 'content', 'retrofit');

const CLAUDE = [
  'C:\\Users\\c\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Anthropic.ClaudeCode_Microsoft.Winget.Source_8wekyb3d8bbwe\\claude.exe',
  'claude',
].find((p) => p === 'claude' || fs.existsSync(p));

const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const GIT = argv.includes('--git');
const li = argv.indexOf('--limit');
const LIMIT = li >= 0 ? Math.max(1, Number(argv[li + 1]) || 1) : 1;

const stamp = () => new Date(Date.now() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 19);
function log(m) {
  const line = `[${stamp()}] ${m}`;
  console.log(line);
  try { fs.appendFileSync(LOG, `${line}\n`); } catch { }
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

// '직접 하셔도 됩니다' 는 표현이 여러 가지다. 좁게 잡으면 멀쩡한 문단이 반려된다
// (medical-law-firm-content-marketing 이 '직접 하실 수 있습니다' 로 쓰고 걸렸다).
const HAS_DIRECT = /(직접|혼자)\s*[가-힣]{0,6}(하|해|챙기|쓰|올리|바꾸|손보)(도|셔도|시면|실|시는|시면서)/;
const BANNED = ['100%', '무조건', '보장합니다', '수익 보장', '1위 보장', '최저가', '국내 최고',
  '업계 1위', '반드시 상위노출', '상위노출 보장', '무조건 1페이지'];
const SALESY = ['지금 바로 문의', '무료 상담 신청', '지금 신청', '서둘러', '놓치지 마', '한정'];

/** 이 글에 무엇이 빠졌나 */
function missing(c) {
  const body = c.body || [];
  const text = plainText(body);
  const last = body[body.length - 1];
  const out = [];
  if (typeof last !== 'string' || [...last].length < 80) out.push('closing');
  if (!HAS_DIRECT.test(text)) out.push('direct');
  return out;
}

const all = JSON.parse(fs.readFileSync(COLUMNS, 'utf8'));
const targets = all.map((c, i) => ({ i, c, need: missing(c) })).filter((x) => x.need.length);

log(`발행 ${all.length}편 · 보완 대상 ${targets.length}편`);
if (CHECK) {
  const a = targets.filter((t) => t.need.includes('closing')).length;
  const b = targets.filter((t) => t.need.includes('direct')).length;
  log(`  마지막 제안 문단 없음 ${a}편 · "직접 하셔도 되는 선" 없음 ${b}편`);
  targets.slice(0, 15).forEach((t) => log(`  [${t.need.join('+')}] ${t.c.slug}`));
  process.exit(0);
}

fs.mkdirSync(WORK, { recursive: true });

function buildPrompt(c, need) {
  const body = c.body || [];
  const heads = body.filter((b) => b?.type === 'heading').map((b) => b.text);
  const faq = body.find((b) => b?.type === 'faq');
  const text = plainText(body);
  return `너는 **아비컴퍼니 대표 오경록**이다. aubcompany.com 에 이미 올라가 있는 칼럼 한 편의
**끝맺음만** 보완한다. 본문은 건드리지 않는다.

## 이 글
- 제목: ${c.title}
- 분류: ${c.category}
- 소제목: ${heads.join(' / ')}
${faq ? `- faq 질문: ${(faq.items || []).map((i) => i.q).join(' / ')}` : ''}

## 글 내용 (읽고 쓴다 — 이 글에만 맞는 끝맺음이어야 한다)
${text.slice(0, 5000)}

## 쓸 것
${need.includes('closing') ? `**closing** — 글 맨 끝에 붙일 문단 하나. 180~340자.
  · 이 글만 보고 직접 해 보셔도 된다고 한 번 말한다(이 글 주제에 맞게 구체적으로).
  · 사람들이 **실제로 막히는 지점**을 한두 개 짚는다. 이 글 내용에서 나온 것으로.
  · 그 상태 그대로 물어보셔도 된다고 한다. 무엇을 들고 오면 되는지도 한 줄.
  · "지금 바로 문의하세요", "무료 상담" 같은 말과 전화번호·링크는 쓰지 않는다.
` : ''}${need.includes('direct') ? `**direct** — 본문 중간에 넣을 문단 하나. 110~260자.
  "이건 사장님이 직접 하셔도 됩니다" 를 **조건과 함께** 말하는 문단이다.
  어디까지는 직접 해도 되고 어디서부터 사람을 부르는 편이 나은지 선을 긋는다.
  읽는 사람은 이 한 줄에서 믿을지 말지를 정한다. 다 맡기라고 하면 광고로 읽힌다.
` : ''}
## 말투
- 1인칭("저는", "저희가"). 읽는 사람은 치과 원장님·세무사·인테리어 사장님이다.
- "사장님", "원장님" 으로 부른다. 느낌표는 쓰지 않는다.
- 문장을 짧게 끊는다. "~해야 합니다" 대신 "~하시는 편이 낫습니다".
- 없는 사례·수치를 지어내지 않는다. 성과를 약속하는 표현 금지.

## 출력
${path.join('content', 'retrofit', `${c.slug}.json`).replace(/\\/g, '/')} 파일 하나에 아래 형태로만 쓴다.
{${need.includes('closing') ? '\n  "closing": "..."' : ''}${need.includes('closing') && need.includes('direct') ? ',' : ''}${need.includes('direct') ? '\n  "direct": "..."' : ''}
}
다른 파일은 만들지 말고, 파일명만 출력하고 끝내라. git 등 다른 명령은 실행하지 마라.`;
}

function runClaude(text) {
  for (let t = 1; t <= 2; t += 1) {
    const res = spawnSync(CLAUDE, ['-p', text, '--permission-mode', 'acceptEdits',
      '--allowedTools', 'Read,Write'], {
      cwd: ROOT, encoding: 'utf8', timeout: 12 * 60 * 1000, maxBuffer: 32 * 1024 * 1024, windowsHide: true,
    });
    if (!res.error && res.status === 0) return true;
    log(`  !! claude 실패 ${t}/2`);
  }
  return false;
}

/** 받은 문단이 쓸 만한지 */
function gradePart(s, min, max) {
  const n = [...String(s || '')].length;
  if (n < min || n > max) return `길이 ${n}자 (${min}~${max})`;
  const bad = [...BANNED, ...SALESY].filter((w) => s.includes(w));
  if (bad.length) return `금지·영업 표현: ${bad.join(',')}`;
  if (s.includes('!')) return '느낌표';
  if (/010-|02-|\bhttps?:/.test(s)) return '전화번호·링크';
  return '';
}

let done = 0;
const changed = [];
for (const t of targets) {
  if (done >= LIMIT) break;
  const { c, need, i } = t;
  const out = path.join(WORK, `${c.slug}.json`);
  try { fs.rmSync(out); } catch { }

  // 한 번은 다시 쓰게 한다. 그냥 건너뛰면 길이 몇 자 때문에 글이 영영 안 고쳐진다.
  let got = null;
  let errs = [];
  for (let attempt = 0; attempt <= 1; attempt += 1) {
    const note = errs.length
      ? `\n## 직전 시도에서 걸린 것 — 반드시 고쳐라\n${errs.map((x) => `- ${x}`).join('\n')}\n`
      : '';
    if (!runClaude(buildPrompt(c, need) + note)) { errs = ['호출 실패']; break; }
    if (!fs.existsSync(out)) { errs = ['출력 파일이 없습니다']; continue; }
    try { got = JSON.parse(fs.readFileSync(out, 'utf8')); }
    catch { errs = ['JSON 형식 오류']; got = null; continue; }

    errs = [];
    if (need.includes('closing')) {
      const bad = gradePart(got.closing, 180, 340);
      if (bad) errs.push(`closing ${bad}`);
    }
    if (need.includes('direct')) {
      const bad = gradePart(got.direct, 90, 280);
      if (bad) errs.push(`direct ${bad}`);
      else if (!HAS_DIRECT.test(got.direct)) {
        errs.push('direct 문단에 "직접 하셔도 됩니다" 류의 표현이 없습니다 — 그 한 줄이 핵심입니다');
      }
    }
    if (!errs.length) break;
    log(`  재작성 — ${c.slug}: ${errs.join(' / ')}`);
    try { fs.rmSync(out); } catch { }
  }
  if (!got || errs.length) { log(`  !! 건너뜀 ${c.slug}: ${errs.join(' / ') || '결과 없음'}`); continue; }

  // 본문에 끼운다. direct 는 faq 바로 앞에, closing 은 맨 끝에.
  const body = [...(c.body || [])];
  if (need.includes('direct')) {
    const fi = body.findIndex((b) => b?.type === 'faq');
    body.splice(fi >= 0 ? fi : body.length, 0, got.direct);
  }
  if (need.includes('closing')) body.push(got.closing);

  all[i] = { ...c, body };
  changed.push(c.slug);
  done += 1;
  log(`  보완 ${c.slug} (${need.join('+')})`);
}

if (!changed.length) { log('보완한 글이 없습니다'); process.exit(1); }

const backup = fs.readFileSync(COLUMNS, 'utf8');
fs.writeFileSync(COLUMNS, `${JSON.stringify(all, null, 2)}\n`);

// 렌더까지 확인한다. 하나가 깨지면 그날 발행 전체가 멈춘다.
let err = '';
try {
  execFileSync(process.execPath, [path.join(HERE, 'generate-columns.mjs')],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  for (const slug of changed) {
    const page = path.join(ROOT, 'column', slug, 'index.html');
    if (!fs.existsSync(page)) { err += `\n${slug}: 페이지 없음`; continue; }
    const h = fs.readFileSync(page, 'utf8');
    if (h.includes('undefined')) err += `\n${slug}: undefined 포함`;
    if (!/<h1[\s>]/i.test(h)) err += `\n${slug}: H1 없음`;
  }
} catch (e) { err += String(e.stdout || '') + String(e.stderr || e.message || ''); }

if (err) {
  fs.writeFileSync(COLUMNS, backup);
  try { execFileSync('git', ['checkout', '--', 'column', 'sitemap.xml'], { cwd: ROOT }); } catch { }
  log(`!! 렌더가 깨져 전부 되돌렸습니다${err.slice(0, 600)}`);
  process.exit(1);
}
log(`렌더 검증 통과 · ${changed.length}편 반영`);

if (GIT) {
  try {
    execFileSync('git', ['add', '--', 'data/columns.json', 'column', 'sitemap.xml', 'retrofit.log'], { cwd: ROOT });
    execFileSync('git', ['-c', 'core.autocrlf=false', 'commit', '-q', '-m',
      `칼럼 끝맺음 보완 ${changed.length}편 — 전환 요소 추가`], { cwd: ROOT });
    execFileSync('git', ['push', '-q', 'origin', 'main'], { cwd: ROOT });
    log('커밋·푸시 완료');
  } catch (e) { log(`!! 커밋 실패: ${String(e.stdout || e.message).slice(0, 300)}`); }
}

log(`─── 보완 완료 · ${changed.length}편 (남은 대상 ${targets.length - changed.length}편) ───`);
