import { createSign } from 'node:crypto';

const siteUrl = 'https://aubcompany.com/';
const sitemapUrl = 'https://aubcompany.com/sitemap.xml';
const indexNowKey = '91a7460f8c9b4e8db4f2a13d67a0c5e2';

function base64url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// IndexNow 는 사이트맵 주소가 아니라 개별 페이지 주소를 받아야 그 페이지를 가지러 온다.
// 사이트맵 URL 하나만 던지던 동안은 사실상 아무 것도 알리지 않은 것과 같았다.
async function readSitemapUrls() {
  const response = await fetch(sitemapUrl, { headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) {
    throw new Error(`사이트맵을 읽지 못했습니다: ${response.status} ${response.statusText}`);
  }
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  if (!urls.length) {
    throw new Error('사이트맵에 <loc> 가 하나도 없습니다.');
  }
  return urls;
}

async function submitIndexNow(urls) {
  const host = new URL(siteUrl).host;
  // IndexNow 는 한 번에 1만 건까지 받지만, 여유를 두고 나눠 보낸다.
  const chunks = [];
  for (let i = 0; i < urls.length; i += 1000) chunks.push(urls.slice(i, i + 1000));

  for (const [index, chunk] of chunks.entries()) {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        host,
        key: indexNowKey,
        keyLocation: `${siteUrl}${indexNowKey}.txt`,
        urlList: chunk,
      }),
    });

    console.log(`IndexNow ${host} (${index + 1}/${chunks.length}, ${chunk.length}건): ${response.status} ${response.statusText}`);
    if (!response.ok && response.status !== 202) {
      throw new Error(await response.text());
    }
  }
}

async function createGoogleAccessToken() {
  const rawJson = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!rawJson) {
    console.log('Google Search Console: GSC_SERVICE_ACCOUNT_JSON secret is missing, skipped.');
    return null;
  }

  const credentials = JSON.parse(rawJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters',
    aud: credentials.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(credentials.private_key);
  const jwt = `${unsigned}.${base64url(signature)}`;

  const response = await fetch(claim.aud, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Google token error: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function submitGoogleSitemap() {
  const token = await createGoogleAccessToken();
  if (!token) return;

  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}` },
  });

  console.log(`Google sitemap ${sitemapUrl}: ${response.status} ${response.statusText}`);
  if (!response.ok && response.status !== 204) {
    throw new Error(await response.text());
  }
}

const urls = await readSitemapUrls();
console.log(`사이트맵 URL ${urls.length}건`);
await submitIndexNow(urls);
await submitGoogleSitemap();
