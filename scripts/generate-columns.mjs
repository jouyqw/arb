import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const siteUrl = 'https://aubcompany.com';
const columns = JSON.parse(await readFile(path.join(root, 'data', 'columns.json'), 'utf8'));

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const articleTemplate = (post) => {
  const url = `${siteUrl}/column/${post.slug}/`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    author: { '@type': 'Organization', name: post.author },
    publisher: { '@type': 'Organization', name: '아비컴퍼니', url: siteUrl },
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    keywords: post.keywords.join(', ')
  };

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(post.title)} | 아비컴퍼니 칼럼</title>
  <meta name="description" content="${esc(post.description)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${esc(post.title)}" />
  <meta property="og:description" content="${esc(post.description)}" />
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  <style>
    body{margin:0;font-family:Arial,'Noto Sans KR',sans-serif;color:#0D1117;line-height:1.85;background:#fff}
    .wrap{max-width:820px;margin:0 auto;padding:48px 22px 80px}
    a{color:#0047CC;text-decoration:none;font-weight:700}
    .brand{display:inline-flex;margin-bottom:34px;color:#0047CC}
    .tag{display:inline-block;margin-bottom:18px;padding:6px 12px;border-radius:999px;background:#E8F0FE;color:#0047CC;font-size:12px;font-weight:800}
    h1{font-size:clamp(28px,5vw,44px);line-height:1.3;letter-spacing:-.8px;margin:0 0 16px}
    .desc{font-size:17px;color:#5A6577;margin:0 0 24px}
    .meta{display:flex;gap:12px;flex-wrap:wrap;padding:18px 0 30px;border-top:1px solid #e8ecf2;border-bottom:1px solid #e8ecf2;color:#7a8594;font-size:13px}
    article{padding-top:32px}
    p{font-size:17px;margin:0 0 22px}
    .cta{margin-top:44px;padding:28px;border-radius:18px;background:#050E20;color:#fff}
    .cta p{font-size:15px;color:rgba(255,255,255,.78)}
    .cta a{display:inline-flex;margin-top:4px;padding:12px 18px;border-radius:10px;background:#FEE500;color:#191919}
  </style>
</head>
<body>
  <main class="wrap">
    <a class="brand" href="../../">← 아비컴퍼니 홈</a>
    <span class="tag">${esc(post.category)}</span>
    <h1>${esc(post.title)}</h1>
    <p class="desc">${esc(post.description)}</p>
    <div class="meta">
      <span>작성자 ${esc(post.author)}</span>
      <span>발행일 ${esc(post.datePublished)}</span>
      <span>수정일 ${esc(post.dateModified)}</span>
    </div>
    <article>
      ${post.body.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('\n      ')}
    </article>
    <section class="cta">
      <h2>우리 업종에도 검색 노출형 칼럼이 필요하다면</h2>
      <p>아비컴퍼니가 홈페이지, 칼럼 구조, 사이트맵, 광고 운영까지 함께 진단해드립니다.</p>
      <a href="https://open.kakao.com/o/s96tWi4f" target="_blank" rel="noopener">무료 상담 신청</a>
    </section>
  </main>
</body>
</html>`;
};

const listingTemplate = () => `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>마케팅 칼럼 | 아비컴퍼니</title>
  <meta name="description" content="병원, 법률사무소, 세무사 등 전문직 마케팅과 검색 노출 전략을 다루는 아비컴퍼니 칼럼입니다." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${siteUrl}/column/" />
  <style>
    body{margin:0;font-family:Arial,'Noto Sans KR',sans-serif;color:#0D1117;background:#F7F9FC;line-height:1.75}
    .wrap{max-width:1080px;margin:0 auto;padding:48px 22px 80px}
    a{text-decoration:none;color:inherit}
    .home{display:inline-flex;margin-bottom:34px;color:#0047CC;font-weight:800}
    h1{font-size:clamp(30px,5vw,46px);letter-spacing:-.8px;margin:0 0 12px}
    .lead{max-width:640px;color:#5A6577;font-size:16px;margin:0 0 32px}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
    .card{display:flex;flex-direction:column;min-height:260px;padding:24px;border-radius:18px;background:#fff;border:1px solid rgba(0,0,0,.08)}
    .tag{width:fit-content;margin-bottom:16px;padding:5px 10px;border-radius:999px;background:#E8F0FE;color:#0047CC;font-size:11px;font-weight:800}
    h2{font-size:20px;line-height:1.45;margin:0 0 12px}
    p{color:#5A6577;font-size:14px;margin:0}
    .meta{margin-top:auto;padding-top:18px;color:#8A95A3;font-size:12px}
    @media(max-width:800px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:560px){.grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main class="wrap">
    <a class="home" href="../">← 아비컴퍼니 홈</a>
    <h1>마케팅 칼럼</h1>
    <p class="lead">검색 노출과 상담 전환을 함께 만드는 전문직 마케팅 인사이트를 정리합니다.</p>
    <div class="grid">
      ${columns.map((post) => `<a class="card" href="${post.slug}/">
        <span class="tag">${esc(post.category)}</span>
        <h2>${esc(post.title)}</h2>
        <p>${esc(post.description)}</p>
        <span class="meta">${esc(post.author)} · ${esc(post.datePublished)}</span>
      </a>`).join('\n      ')}
    </div>
  </main>
</body>
</html>`;

await mkdir(path.join(root, 'column'), { recursive: true });
await writeFile(path.join(root, 'column', 'index.html'), listingTemplate(), 'utf8');

for (const post of columns) {
  const dir = path.join(root, 'column', post.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), articleTemplate(post), 'utf8');
}

const urls = [
  { loc: `${siteUrl}/`, lastmod: '2026-06-01' },
  { loc: `${siteUrl}/column/`, lastmod: '2026-06-01' },
  ...columns.map((post) => ({ loc: `${siteUrl}/column/${post.slug}/`, lastmod: post.dateModified }))
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((item) => `  <url>
    <loc>${item.loc}</loc>
    <lastmod>${item.lastmod}</lastmod>
  </url>`).join('\n')}
</urlset>
`;

await writeFile(path.join(root, 'sitemap.xml'), sitemap, 'utf8');
console.log(`Generated ${columns.length} column pages and sitemap.xml`);
