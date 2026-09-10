import { createSign } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

// 새 사이트는 siteUrl/sitemapUrl을 추가합니다. IndexNow 키는 도메인 루트에
// 같은 이름의 txt 파일이 실제 공개된 경우에만 적습니다.
const sites = [
  ['AUB컴퍼니', 'https://aubcompany.com/', 'https://aubcompany.com/sitemap.xml', '91a7460f8c9b4e8db4f2a13d67a0c5e2'],
  ['AUB 법률', 'https://law.aubcompany.com/', 'https://law.aubcompany.com/sitemap.xml'],
  ['AUB 생활', 'https://life.aubcompany.com/', 'https://life.aubcompany.com/sitemap.xml'],
  ['새로고침 인테리어', 'https://interior-f5.com/', 'https://interior-f5.com/sitemap.xml', '91a7460f8c9b4e8db4f2a13d67a0c5e2'],
  ['키자드 칼럼', 'https://jung30h.keyzard.org/', 'https://jung30h.keyzard.org/sitemap.xml', undefined, undefined, true],
  ['예율 칼럼', 'https://column.lawfirmyeyul.com/', 'https://column.lawfirmyeyul.com/sitemap.xml', 'd5534fd395b25c998ea43d165535551a'],
  ['태앤규 칼럼', 'https://column.taeandkyu.com/', 'https://column.taeandkyu.com/sitemap.xml', '91a7460f8c9b4e8db4f2a13d67a0c5e2'],
  ['태앤규', 'https://taeandkyu.com/', 'https://taeandkyu.com/sitemap.xml', '1c271ef7c79c4a3abc5b43a40dc1e3b8', undefined, true],
  ['태앤규 전주', 'https://taeandkyujeonju.com/', 'https://taeandkyujeonju.com/sitemap.xml', '91a7460f8c9b4e8db4f2a13d67a0c5e2'],
  ['울산 변호사', 'https://ulsanlawyer.kr/', 'https://ulsanlawyer.kr/sitemap.xml', '91a7460f8c9b4e8db4f2a13d67a0c5e2'],
  ['위드윤', 'https://with-yoon-law.com/', 'https://with-yoon-law.com/sitemap.xml', 'eee764b31941bb288655b49d490b1005'],
  ['우리인법무사', 'https://woorinlaw.com/', 'https://woorinlaw.com/sitemap.xml'],
  ['바나나퀵', 'https://xn--910ba239f8iu.com/', 'https://xn--910ba239f8iu.com/sitemap.xml'],
  ['새출발양형자료분석센터', 'https://xn--9r2bp4d54aq9fim5fl21a29d8xr6viw3n.com/', 'https://xn--9r2bp4d54aq9fim5fl21a29d8xr6viw3n.com/sitemap.php'],
  ['대필마스터', 'https://xn--vk1bq2ko7hvupcze.com/', 'https://xn--vk1bq2ko7hvupcze.com/sitemap.xml', undefined, 'https://www.xn--vk1bq2ko7hvupcze.com/'],
  ['예율 법률칼럼', 'https://columns.yeyul-law.com/', 'https://columns.yeyul-law.com/sitemap.xml', '628977ad229e859371ca6577bf876d14'],
  ['법무법인 예율', 'https://yeyul-law.com/', 'https://yeyul-law.com/sitemap.xml'],
].map(([name, siteUrl, sitemapUrl, indexNowKey, googleProperty, skipScan]) => ({ name, siteUrl, sitemapUrl, indexNowKey, googleProperty, skipScan }));

const recentDays = Number(process.env.RECENT_DAYS || 7);
const forceAll = process.env.FORCE_ALL === '1';
const dryRun = process.env.DRY_RUN === '1';
const report = { runAt: new Date().toISOString(), dryRun, googleAccount: null, sites: [] };

const base64url = (value) => Buffer.from(value).toString('base64')
  .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

function xmlText(value = '') {
  return value.replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
}

async function getText(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'cache-control': 'no-cache', 'user-agent': 'Mozilla/5.0 (compatible; AUBSearchMonitor/2.0; +https://aubcompany.com/)' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  return response.text();
}

const blocks = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))].map((m) => m[1]);
function value(block, tag) {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? xmlText(match[1]) : '';
}

async function readSitemap(sitemapUrl, seen = new Set()) {
  if (seen.has(sitemapUrl)) return [];
  if (seen.size > 100) throw new Error('하위 사이트맵이 100개를 넘었습니다.');
  seen.add(sitemapUrl);
  // 일부 CDN은 GitHub Actions 요청에 오래된 응답을 주므로 점검용 쿼리로 우회합니다.
  const fetchUrl = new URL(sitemapUrl);
  fetchUrl.searchParams.set('_index_check', Date.now().toString());
  const xml = await getText(fetchUrl.href);
  const children = blocks(xml, 'sitemap').map((block) => value(block, 'loc')).filter(Boolean);
  if (children.length) return (await Promise.all(children.map((url) => readSitemap(url, seen)))).flat();
  const entries = blocks(xml, 'url').map((block) => ({ loc: value(block, 'loc'), lastmod: value(block, 'lastmod') }))
    .filter((entry) => /^https?:\/\//.test(entry.loc));
  if (!entries.length) throw new Error('사이트맵에서 페이지 주소를 찾지 못했습니다.');
  return entries;
}

function selectRecent(entries) {
  if (forceAll) return entries;
  const cutoff = Date.now() - recentDays * 86400000;
  return entries.filter(({ lastmod }) => {
    const time = Date.parse(lastmod);
    return lastmod && Number.isFinite(time) && time >= cutoff && time <= Date.now() + 86400000;
  });
}

async function keyIsLive(site) {
  if (!site.indexNowKey) return false;
  try {
    return (await getText(new URL(`${site.indexNowKey}.txt`, site.siteUrl).href)).trim() === site.indexNowKey;
  } catch { return false; }
}

async function submitIndexNow(site, urls) {
  if (!urls.length) return [{ name: 'IndexNow', status: 'no-recent-url', ok: true }];
  if (dryRun) return [{ name: '네이버', status: 'dry-run', ok: true }, { name: 'IndexNow', status: 'dry-run', ok: true }];
  const payload = JSON.stringify({
    host: new URL(site.siteUrl).host,
    key: site.indexNowKey,
    keyLocation: new URL(`${site.indexNowKey}.txt`, site.siteUrl).href,
    urlList: urls.slice(0, 10000),
  });
  return Promise.all([
    ['네이버', 'https://searchadvisor.naver.com/indexnow'],
    ['IndexNow', 'https://api.indexnow.org/indexnow'],
  ].map(async ([name, endpoint]) => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: payload,
        signal: AbortSignal.timeout(30000),
      });
      return { name, status: response.status, ok: response.ok || response.status === 202 };
    } catch (error) { return { name, status: 'error', ok: false, error: error.message }; }
  }));
}

async function googleContext() {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const credentials = JSON.parse(raw);
  report.googleAccount = credentials.client_email;
  const now = Math.floor(Date.now() / 1000);
  const tokenUrl = credentials.token_uri || 'https://oauth2.googleapis.com/token';
  const claim = { iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/webmasters', aud: tokenUrl, iat: now, exp: now + 3600 };
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify(claim))}`;
  const jwt = `${unsigned}.${base64url(createSign('RSA-SHA256').update(unsigned).sign(credentials.private_key))}`;
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) throw new Error(`Google 인증 실패: ${JSON.stringify(tokenData)}`);
  const listResponse = await fetch('https://www.googleapis.com/webmasters/v3/sites', { headers: { authorization: `Bearer ${tokenData.access_token}` } });
  const listData = await listResponse.json();
  if (!listResponse.ok) throw new Error(`Google 속성 목록 실패: ${JSON.stringify(listData)}`);
  return { token: tokenData.access_token, properties: (listData.siteEntry || []).map((item) => item.siteUrl) };
}

function propertyFor(site, properties) {
  if (site.googleProperty && properties.includes(site.googleProperty)) return site.googleProperty;
  if (properties.includes(site.siteUrl)) return site.siteUrl;
  const host = new URL(site.siteUrl).hostname.replace(/^www\./, '');
  return properties.find((property) => property === `sc-domain:${host}`) || null;
}

async function submitGoogle(site, google) {
  if (!google) return { status: 'secret-missing', ok: false };
  const property = propertyFor(site, google.properties);
  if (!property) return { status: 'permission-missing', ok: false };
  if (dryRun) return { status: 'dry-run', ok: true, property };
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(site.sitemapUrl)}`;
  const response = await fetch(endpoint, { method: 'PUT', headers: { authorization: `Bearer ${google.token}` } });
  return { status: response.status, ok: response.ok || response.status === 204, property };
}

let google = null;
try { google = await googleContext(); } catch (error) { console.error(error.message); }

for (const site of sites) {
  const item = { name: site.name, siteUrl: site.siteUrl, sitemapUrl: site.sitemapUrl };
  if (site.skipScan) {
    item.sitemapStatus = 'external-scan-skipped';
    item.recentCount = 0;
    item.indexNow = [{ name: 'IndexNow', status: 'site-specific-automation', ok: true }];
    item.google = await submitGoogle(site, google).catch((error) => ({ status: 'error', ok: false, error: error.message }));
    console.log(`${site.name}: 외부 차단으로 사이트맵 점검 생략 / Google ${item.google.status}`);
    report.sites.push(item);
    continue;
  }
  try {
    const entries = [...new Map((await readSitemap(site.sitemapUrl)).map((entry) => [entry.loc, entry])).values()];
    const recent = selectRecent(entries).filter((entry) => new URL(entry.loc).hostname === new URL(site.siteUrl).hostname);
    item.urlCount = entries.length;
    item.recentCount = recent.length;
    item.sitemapStatus = 'ok';
    item.indexNowKeyVerified = await keyIsLive(site);
    item.indexNow = item.indexNowKeyVerified
      ? await submitIndexNow(site, recent.map((entry) => entry.loc))
      : [{ name: 'IndexNow', status: site.indexNowKey ? 'key-not-live' : 'key-not-configured', ok: false }];
    item.google = await submitGoogle(site, google);
    console.log(`${site.name}: URL ${entries.length} / 최근 ${recent.length} / Google ${item.google.status} / IndexNow ${item.indexNow.map((r) => r.status).join(',')}`);
  } catch (error) {
    item.sitemapStatus = 'error';
    item.error = error.message;
    item.google = await submitGoogle(site, google).catch((googleError) => ({ status: 'error', ok: false, error: googleError.message }));
    console.error(`${site.name}: ${error.message}`);
  }
  report.sites.push(item);
}

await mkdir('reports', { recursive: true });
await writeFile('reports/search-index-latest.json', JSON.stringify(report, null, 2) + '\n');
const summary = [
  '# 검색 색인 자동화 결과', '', `- 실행: ${report.runAt}`,
  `- Google 자동화 계정: ${report.googleAccount || '설정 안 됨'}`,
  `- 전체 사이트: ${report.sites.length}개`, '',
  '| 사이트 | 사이트맵 URL | 최근 제출 | Google | 네이버·IndexNow |',
  '|---|---:|---:|---|---|',
  ...report.sites.map((item) => `| ${item.name} | ${item.urlCount ?? '-'} | ${item.recentCount ?? '-'} | ${item.google?.status ?? '-'} | ${item.indexNow?.map((r) => r.status).join('/') ?? '-'} |`),
  '', '> 제출은 검색로봇에게 알리는 절차이며 색인이나 검색 순위를 보장하지 않습니다.',
].join('\n');
await writeFile('reports/search-index-latest.md', summary + '\n');
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary + '\n', { flag: 'a' });
