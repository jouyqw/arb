/**
 * 홈페이지 주소를 받아 실제로 내려받아 검사하는 Cloudflare Pages Function.
 *
 * 브라우저에서는 다른 도메인의 HTML을 읽을 수 없어(CORS) 서버 쪽에서 처리한다.
 * 결과는 전부 실제 응답에서 뽑은 값이고, 추정하거나 만들어내는 항목은 없다.
 *
 * POST /api/scan  { "input": "example.com" }
 * GET  /api/scan?input=example.com   (확인용)
 */

const UA = 'Mozilla/5.0 (compatible; ArbCompanyScan/1.0; +https://aubcompany.com/)';
const FETCH_TIMEOUT = 9000;
const MAX_BYTES = 1500000;

/* ─── 입력 정리 ─── */

function normalize(raw) {
  const v = String(raw || '').trim();
  if (!v) return { kind: 'empty' };
  if (v.length > 200) return { kind: 'invalid', reason: '입력이 너무 깁니다.' };

  // 주소로 볼 수 있는가: 공백이 없어야 하고, 점 뒤에 영문 최상위 도메인이 와야 한다
  // (공백이 있으면 무조건 상호명으로 본다 — "주식회사 A.B" 같은 이름을 주소로 오해하지 않도록)
  const looksUrl = !/\s/.test(v) &&
    /^(https?:\/\/)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/|$|\?|#|:)/i.test(v);
  if (!looksUrl) return { kind: 'name', name: v };

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v);
  } catch (e) {
    return { kind: 'invalid', reason: '주소 형식을 읽을 수 없습니다.' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { kind: 'invalid', reason: 'http 또는 https 주소만 검사할 수 있습니다.' };
  }
  if (url.port && !['80', '443', ''].includes(url.port)) {
    return { kind: 'invalid', reason: '표준 포트가 아닌 주소는 검사하지 않습니다.' };
  }
  if (isBlockedHost(url.hostname)) {
    return { kind: 'invalid', reason: '검사할 수 없는 주소입니다.' };
  }
  return { kind: 'url', url };
}

// 내부망·루프백으로 요청이 새어 나가지 않도록 막는다
function isBlockedHost(h) {
  const host = String(h).toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '[::1]' || host === '::1') return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const p = host.split('.').map(Number);
    if (p[0] === 127 || p[0] === 10 || p[0] === 0) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] >= 224) return true;
  }
  return false;
}

/* ─── 가져오기 ─── */

async function grab(url, { text = true } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9' },
      redirect: 'follow',
      signal: ctl.signal,
      cf: { cacheTtl: 300, cacheEverything: false }
    });
    const ms = Date.now() - started;
    let body = '';
    if (text && res.ok) {
      const reader = res.body && res.body.getReader ? res.body.getReader() : null;
      if (reader) {
        const dec = new TextDecoder('utf-8', { fatal: false });
        let size = 0;
        while (size < MAX_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          body += dec.decode(value, { stream: true });
        }
        try { await reader.cancel(); } catch (e) {}
      } else {
        body = await res.text();
      }
    }
    return { ok: res.ok, status: res.status, finalUrl: res.url || url, ms, body };
  } catch (e) {
    return { ok: false, status: 0, finalUrl: url, ms: Date.now() - started, body: '', error: String(e && e.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

/* ─── HTML에서 신호 뽑기 ─── */

const CATS = [
  { key: 'basic',   name: '기본 정보',   why: '검색 결과에 어떻게 표시될지를 결정하는 항목입니다.' },
  { key: 'index',   name: '수집 · 색인', why: '검색엔진이 페이지를 찾아 저장할 수 있어야 노출이 시작됩니다.' },
  { key: 'geo',     name: 'AI 검색 대응', why: 'AI가 인용할 수 있는 형태로 정리되어 있는지 봅니다.' },
  { key: 'mobile',  name: '모바일 · 속도', why: '문의 대부분이 휴대폰에서 발생합니다.' },
  { key: 'convert', name: '전환 동선',   why: '들어온 사람이 문의까지 닿을 수 있는지 봅니다.' }
];

function attr(tag, name) {
  const m = tag.match(new RegExp(name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
  return m ? (m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] || '') : '';
}

function metaContent(html, keyName, keyValue) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const t of tags) {
    if (attr(t, keyName).toLowerCase() === keyValue.toLowerCase()) return attr(t, 'content').trim();
  }
  return '';
}

function stripToText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function analyze(page, extra) {
  const html = page.body || '';
  const head = (html.match(/<head\b[\s\S]*?<\/head>/i) || [html])[0];
  const checks = [];
  const add = (cat, weight, ok, label, detail) => checks.push({ cat, weight, ok, label, detail });

  /* 기본 정보 */
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleM ? stripToText(titleM[1]) : '';
  add('basic', 3, title ? (title.length >= 10 && title.length <= 60 ? true : 'warn') : false,
    '페이지 제목',
    title ? `${title.length}자 · "${title.slice(0, 40)}${title.length > 40 ? '…' : ''}"`
          : '제목 태그가 없습니다. 검색 결과에 주소가 그대로 나옵니다.');

  const desc = metaContent(html, 'name', 'description');
  add('basic', 3, desc ? (desc.length >= 50 && desc.length <= 160 ? true : 'warn') : false,
    '검색 결과 설명문',
    desc ? `${desc.length}자 · 권장 50~160자`
         : 'meta description이 없어 검색엔진이 본문에서 임의로 잘라 보여줍니다.');

  const h1s = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || [];
  add('basic', 2, h1s.length === 1 ? true : (h1s.length === 0 ? false : 'warn'),
    '대표 제목(H1)',
    h1s.length === 1 ? `1개 · "${stripToText(h1s[0]).slice(0, 30)}"`
      : h1s.length === 0 ? 'H1이 없어 이 페이지의 주제가 무엇인지 신호가 약합니다.'
      : `${h1s.length}개 · 페이지당 1개가 원칙입니다.`);

  const canonical = (head.match(/<link\b[^>]*rel\s*=\s*["']?canonical["']?[^>]*>/i) || [''])[0];
  add('basic', 1, !!canonical, '대표 주소(canonical)',
    canonical ? attr(canonical, 'href').slice(0, 60) : '중복 주소가 생기면 평가가 나뉩니다.');

  const lang = attr((html.match(/<html\b[^>]*>/i) || [''])[0], 'lang');
  add('basic', 1, !!lang, '언어 설정', lang ? `lang="${lang}"` : 'html lang 속성이 없습니다.');

  const ogT = metaContent(html, 'property', 'og:title');
  const ogD = metaContent(html, 'property', 'og:description');
  const ogI = metaContent(html, 'property', 'og:image');
  const ogCount = [ogT, ogD, ogI].filter(Boolean).length;
  add('basic', 2, ogCount === 3 ? true : (ogCount ? 'warn' : false),
    '카톡·SNS 공유 미리보기',
    ogCount === 3 ? 'og 제목·설명·이미지 모두 있습니다.'
      : ogCount ? `og 태그 ${ogCount}/3 · 이미지가 빠지면 링크가 밋밋하게 공유됩니다.`
      : 'og 태그가 없어 카톡으로 링크를 보내면 미리보기가 나오지 않습니다.');

  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const withAlt = imgs.filter(t => attr(t, 'alt').trim()).length;
  const altRate = imgs.length ? Math.round(withAlt / imgs.length * 100) : null;
  add('basic', 2, imgs.length === 0 ? 'warn' : (altRate >= 70 ? true : (altRate >= 40 ? 'warn' : false)),
    '이미지 설명(alt)',
    imgs.length === 0 ? '이미지가 없습니다.' : `${imgs.length}개 중 ${withAlt}개 작성 · ${altRate}%`);

  /* 수집 · 색인 */
  const robotsMeta = (metaContent(html, 'name', 'robots') || '').toLowerCase();
  const noindex = robotsMeta.includes('noindex');
  add('index', 3, !noindex, '색인 허용 여부',
    noindex ? 'noindex가 걸려 있어 검색에서 아예 빠집니다. 가장 먼저 확인해야 합니다.'
            : (robotsMeta ? `robots: ${robotsMeta}` : '색인을 막는 설정이 없습니다.'));

  add('index', 2, extra.robots.ok, 'robots.txt',
    extra.robots.ok ? '있습니다.' : '없습니다. 수집 규칙과 사이트맵 위치를 알릴 수 없습니다.');

  add('index', 2, extra.robots.hasSitemap, 'robots.txt의 사이트맵 안내',
    extra.robots.hasSitemap ? 'Sitemap 항목이 적혀 있습니다.' : 'robots.txt에 Sitemap 줄이 없습니다.');

  add('index', 3, extra.sitemap.ok, '사이트맵',
    extra.sitemap.ok ? `sitemap.xml 확인 · 주소 ${extra.sitemap.count}개`
                     : 'sitemap.xml을 찾지 못했습니다. 새 글이 늦게 수집됩니다.');

  const naverV = metaContent(html, 'name', 'naver-site-verification');
  const googleV = metaContent(html, 'name', 'google-site-verification');
  add('index', 2, (naverV || googleV) ? (naverV && googleV ? true : 'warn') : false,
    '검색엔진 등록 확인',
    naverV && googleV ? '네이버·구글 인증 메타가 모두 있습니다.'
      : naverV ? '네이버만 확인됩니다. 구글 서치콘솔도 연결하는 편이 좋습니다.'
      : googleV ? '구글만 확인됩니다. 네이버 서치어드바이저도 연결하세요.'
      : '인증 메타가 없습니다. 파일 방식으로 등록했다면 통과로 보셔도 됩니다.');

  /* AI 검색 대응 */
  const ldBlocks = html.match(/<script\b[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || [];
  const ldTypes = [];
  ldBlocks.forEach(b => {
    const body = b.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/i, '');
    (body.match(/"@type"\s*:\s*"([^"]+)"/g) || []).forEach(m => {
      const t = m.split('"')[3];
      if (t && !ldTypes.includes(t)) ldTypes.push(t);
    });
  });
  add('geo', 3, ldBlocks.length > 0, '구조화 데이터',
    ldBlocks.length ? `${ldBlocks.length}개 · ${ldTypes.slice(0, 5).join(', ') || '형식 확인 필요'}`
                    : 'JSON-LD가 없습니다. AI와 검색엔진이 업종·주소·연락처를 구조로 읽지 못합니다.');

  const bizType = ldTypes.some(t => /LocalBusiness|Organization|LegalService|MedicalBusiness|Dentist|Attorney|AccountingService/i.test(t));
  add('geo', 2, bizType, '사업체 정보 스키마',
    bizType ? '업체 정보가 구조화되어 있습니다.'
            : 'LocalBusiness 또는 Organization 스키마가 없어 지역·업종 인식이 약합니다.');

  const heads = (html.match(/<h[23]\b[^>]*>[\s\S]*?<\/h[23]>/gi) || []).map(stripToText);
  const qHeads = heads.filter(t => /[?？]|무엇|어떻게|왜|얼마|가능한가|하나요|되나요/.test(t)).length;
  const hasFaq = ldTypes.some(t => /FAQPage|QAPage/i.test(t));
  add('geo', 2, hasFaq || qHeads >= 3 ? true : (qHeads >= 1 ? 'warn' : false),
    '질문형 콘텐츠',
    hasFaq ? 'FAQ 스키마가 있습니다.'
      : qHeads ? `질문형 제목 ${qHeads}개 · FAQ 스키마까지 붙이면 인용 확률이 올라갑니다.`
      : 'AI 검색은 질문에 답하는 문장을 인용합니다. 질문형 소제목이 없습니다.');

  const text = stripToText(html);
  const chars = text.length;
  add('geo', 3, chars >= 1500 ? true : (chars >= 600 ? 'warn' : false),
    '본문 분량',
    `${chars.toLocaleString()}자 · 인용될 만한 설명이 있으려면 1,500자 이상을 권합니다.`);

  add('geo', 1, extra.llms.ok, 'llms.txt',
    extra.llms.ok ? '있습니다.' : 'AI 크롤러에게 사이트를 안내하는 llms.txt가 없습니다. 아직 선택 항목입니다.');

  /* 모바일 · 속도 */
  const viewport = metaContent(html, 'name', 'viewport');
  add('mobile', 3, !!viewport && /width\s*=\s*device-width/i.test(viewport), '모바일 대응 설정',
    viewport ? `viewport: ${viewport.slice(0, 50)}` : 'viewport 메타가 없어 휴대폰에서 PC 화면이 축소되어 보입니다.');

  const https = page.finalUrl.startsWith('https://');
  add('mobile', 2, https, '보안 접속(HTTPS)',
    https ? '적용되어 있습니다.' : 'https가 아니어서 브라우저가 주의 표시를 띄웁니다.');

  add('mobile', 2, page.ms < 1500 ? true : (page.ms < 3000 ? 'warn' : false),
    '첫 응답 속도', `${page.ms}ms · 1.5초 안쪽을 권합니다.`);

  const kb = Math.round(html.length / 1024);
  add('mobile', 1, kb < 700 ? true : (kb < 1500 ? 'warn' : false),
    'HTML 용량', `${kb.toLocaleString()}KB`);

  /* 전환 동선 */
  const tel = (html.match(/href\s*=\s*["']tel:/gi) || []).length;
  add('convert', 3, tel > 0, '전화 연결 버튼',
    tel ? `tel: 링크 ${tel}개` : '휴대폰에서 눌러 바로 걸 수 있는 링크가 없습니다.');

  const kakao = /open\.kakao\.com|pf\.kakao\.com|talk\.kakao|channel\.kakao/i.test(html);
  add('convert', 2, kakao, '채팅 상담 연결',
    kakao ? '카카오톡 연결이 있습니다.' : '전화가 부담스러운 방문자가 남길 창구가 없습니다.');

  const form = /<form\b/i.test(html) || /<input\b[^>]*type\s*=\s*["']?(tel|text|email)/i.test(html);
  add('convert', 2, form, '문의 폼',
    form ? '입력 폼이 있습니다.' : '영업시간 외에 남겨둘 수 있는 폼이 없습니다.');

  const biz = /사업자\s*등록\s*번호|사업자번호|\d{3}-\d{2}-\d{5}/.test(text);
  const addr = /(시|도)\s?\S*(구|군|시)\s?\S*(로|길|동)/.test(text);
  add('convert', 2, biz && addr ? true : (biz || addr ? 'warn' : false),
    '사업자 정보 · 주소 표기',
    biz && addr ? '사업자등록번호와 주소가 모두 있습니다.'
      : biz ? '주소 표기가 확인되지 않습니다. 지역 검색에 불리합니다.'
      : addr ? '사업자등록번호가 확인되지 않습니다.'
      : '사업자 정보와 주소가 없어 신뢰 신호와 지역 신호가 모두 약합니다.');

  /* 점수 */
  const cats = CATS.map(c => {
    const list = checks.filter(k => k.cat === c.key);
    const max = list.reduce((a, k) => a + k.weight, 0);
    const got = list.reduce((a, k) => a + (k.ok === true ? k.weight : k.ok === 'warn' ? k.weight * 0.5 : 0), 0);
    return { key: c.key, name: c.name, why: c.why, score: max ? Math.round(got / max * 100) : 0, checks: list };
  });
  const maxAll = checks.reduce((a, k) => a + k.weight, 0);
  const gotAll = checks.reduce((a, k) => a + (k.ok === true ? k.weight : k.ok === 'warn' ? k.weight * 0.5 : 0), 0);

  const fixes = checks
    .filter(k => k.ok !== true)
    .sort((a, b) => (a.ok === false ? 0 : 1) - (b.ok === false ? 0 : 1) || b.weight - a.weight)
    .slice(0, 4)
    .map(k => ({ cat: CATS.find(c => c.key === k.cat).name, label: k.label, detail: k.detail }));

  return {
    total: Math.round(gotAll / maxAll * 100),
    cats,
    fixes,
    title,
    description: desc
  };
}

/* ─── 상호명으로 들어온 경우 ─── */

/**
 * 검색 API는 2026년에 NAVER API HUB(네이버 클라우드)로 이관됐다.
 * 신규 발급은 HUB 키만 가능하고, 기존 Developers Center 키는 2027년 6월까지만 쓸 수 있다.
 * 둘 중 있는 쪽으로 호출한다.
 */
function naverAuth(env) {
  if (!env) return null;
  if (env.NCP_API_KEY_ID && env.NCP_API_KEY) {
    return {
      base: 'https://naverapihub.apigw.ntruss.com/search/v1/',
      suffix: '',
      headers: { 'X-NCP-APIGW-API-KEY-ID': env.NCP_API_KEY_ID, 'X-NCP-APIGW-API-KEY': env.NCP_API_KEY }
    };
  }
  if (env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET) {
    return {
      base: 'https://openapi.naver.com/v1/search/',
      suffix: '.json',
      headers: { 'X-Naver-Client-Id': env.NAVER_CLIENT_ID, 'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET }
    };
  }
  return null;
}

async function byName(name, env) {
  const auth = naverAuth(env);
  // 키가 없으면 자동 조회를 시도하지 않고 사람이 확인하는 쪽으로 보낸다
  if (!auth) return { kind: 'name', name, supported: false };

  const q = encodeURIComponent(name);

  async function ask(path, display) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    try {
      const res = await fetch(`${auth.base}${path}${auth.suffix}?query=${q}&display=${display}`,
        { headers: auth.headers, signal: ctl.signal });
      if (!res.ok) return null;                    // 키 오류·한도 초과 등
      const data = await res.json();
      return data && data.errorCode ? null : data; // 오류를 본문으로 주는 경우
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  const [local, blog, web] = await Promise.all([ask('local', 5), ask('blog', 1), ask('webkr', 5)]);

  // 세 곳 모두 실패했다면 키가 잘못됐거나 한도를 넘긴 것이다.
  // 반쯤 빈 결과를 보여주느니 사람이 확인하는 쪽으로 넘긴다.
  if (!local && !blog && !web) return { kind: 'name', name, supported: false };

  const place = local && local.items && local.items[0];
  return {
    kind: 'name',
    name,
    supported: true,
    place: place ? { title: stripToText(place.title), category: place.category, address: place.roadAddress || place.address, link: place.link } : null,
    blogCount: blog && typeof blog.total === 'number' ? blog.total : null,
    webCount: web && typeof web.total === 'number' ? web.total : null,
    site: place && place.link ? place.link : (web && web.items && web.items[0] ? web.items[0].link : null)
  };
}

/* ─── 핸들러 ─── */

async function handle(input, env) {
  const n = normalize(input);
  if (n.kind === 'empty') return { ok: false, message: '홈페이지 주소나 상호명을 입력해 주세요.' };
  if (n.kind === 'invalid') return { ok: false, message: n.reason };
  if (n.kind === 'name') return { ok: true, ...(await byName(n.name, env)) };

  const base = n.url.origin;
  const [page, robots, sitemap, llms] = await Promise.all([
    grab(n.url.toString()),
    grab(base + '/robots.txt'),
    grab(base + '/sitemap.xml'),
    grab(base + '/llms.txt')
  ]);

  if (!page.ok) {
    return {
      ok: false,
      message: page.status
        ? `페이지를 여는 데 실패했습니다. (응답 코드 ${page.status})`
        : '주소에 접속하지 못했습니다. 오타가 없는지, 사이트가 열려 있는지 확인해 주세요.'
    };
  }
  if (isBlockedHost(new URL(page.finalUrl).hostname)) {
    return { ok: false, message: '검사할 수 없는 주소로 연결됩니다.' };
  }

  const sitemapCount = sitemap.ok ? (sitemap.body.match(/<loc>/gi) || []).length : 0;
  const result = analyze(page, {
    robots: { ok: robots.ok, hasSitemap: robots.ok && /sitemap\s*:/i.test(robots.body) },
    sitemap: { ok: sitemap.ok && sitemapCount > 0, count: sitemapCount },
    llms: { ok: llms.ok }
  });

  return {
    ok: true,
    kind: 'url',
    target: n.url.toString(),
    finalUrl: page.finalUrl,
    ms: page.ms,
    ...result
  };
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export async function onRequestPost(context) {
  let body = {};
  try { body = await context.request.json(); } catch (e) {}
  const out = await handle(body && body.input, context.env);
  return new Response(JSON.stringify(out), { status: out.ok ? 200 : 400, headers: JSON_HEADERS });
}

/**
 * 설정 점검용. 키 값은 절대 내보내지 않고, 들어 있는지 여부와
 * 네이버가 돌려준 응답 코드만 알려준다. (401 = 키 오류, 403/429 = 권한·한도)
 */
async function diagnose(env) {
  const auth = naverAuth(env);
  // Client ID 는 요청 헤더로 나가는 값이라 비밀이 아니다. 어느 값이 실렸는지 확인용으로만 앞 4자리를 보여준다.
  // Secret 은 길이만 본다 — 공백이 섞였거나 잘린 경우를 잡기 위해서다.
  const peek = v => v ? `${String(v).slice(0, 4)}…(${String(v).length}자)` : null;
  const id = env && env.NAVER_CLIENT_ID, sec = env && env.NAVER_CLIENT_SECRET;
  const out = {
    NAVER_CLIENT_ID: id ? peek(id) : false,
    NAVER_CLIENT_SECRET: sec ? `${String(sec).length}자` : false,
    공백섞임: {
      id: id ? id !== String(id).trim() : null,
      secret: sec ? sec !== String(sec).trim() : null
    },
    NCP_API_KEY_ID: !!(env && env.NCP_API_KEY_ID),
    NCP_API_KEY: !!(env && env.NCP_API_KEY),
    mode: auth ? (auth.base.includes('ntruss') ? 'apihub' : 'developers') : null,
    calls: {}
  };
  if (!auth) { out.hint = '키가 하나라도 비어 있으면 호출하지 않습니다. 두 개 다 필요합니다.'; return out; }
  for (const path of ['local', 'blog', 'webkr']) {
    try {
      const res = await fetch(`${auth.base}${path}${auth.suffix}?query=%ED%85%8C%EC%8A%A4%ED%8A%B8&display=1`,
        { headers: auth.headers });
      let note = '';
      if (!res.ok) {
        const body = await res.text();
        note = body.slice(0, 160);
      }
      out.calls[path] = { status: res.status, note };
    } catch (e) {
      out.calls[path] = { status: 0, note: String(e && e.message || e).slice(0, 120) };
    }
  }
  return out;
}

export async function onRequestGet(context) {
  const params = new URL(context.request.url).searchParams;
  if (params.get('diag') === '1') {
    return new Response(JSON.stringify(await diagnose(context.env), null, 2), { status: 200, headers: JSON_HEADERS });
  }
  const out = await handle(params.get('input'), context.env);
  return new Response(JSON.stringify(out), { status: out.ok ? 200 : 400, headers: JSON_HEADERS });
}

export { normalize, analyze, stripToText };
