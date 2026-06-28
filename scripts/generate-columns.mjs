import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const siteUrl = 'https://aubcompany.com';
const contactPhone = '010-5501-0152';
const columns = JSON.parse(await readFile(path.join(root, 'data', 'columns.json'), 'utf8'));

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const renderBlock = (block) => {
  if (typeof block === 'string') return `<p>${esc(block)}</p>`;

  if (block?.type === 'table') {
    return `<div class="table-wrap">
        <table>
          <thead>
            <tr>${block.headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('\n            ')}
          </tbody>
        </table>
      </div>`;
  }

  if (block?.type === 'list') {
    return `<ul>${block.items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
  }

  return '';
};

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
    *{box-sizing:border-box}
    body{margin:0;font-family:Arial,'Noto Sans KR',sans-serif;color:#101828;line-height:1.85;background:#fff}
    .wrap{max-width:860px;margin:0 auto;padding:52px 22px 86px}
    a{color:#0B55D9;text-decoration:none;font-weight:800}
    .brand{display:inline-flex;margin-bottom:34px;color:#0B55D9}
    .tag{display:inline-block;margin-bottom:18px;padding:7px 13px;border-radius:999px;background:#EEF4FF;color:#0B55D9;font-size:12px;font-weight:900}
    h1{font-size:clamp(29px,5vw,46px);line-height:1.28;letter-spacing:-.4px;margin:0 0 16px}
    h2{font-size:24px;line-height:1.35;margin:0 0 12px}
    .desc{font-size:17px;color:#667085;margin:0 0 24px}
    .meta{display:flex;gap:12px;flex-wrap:wrap;padding:18px 0 30px;border-top:1px solid #EAECF0;border-bottom:1px solid #EAECF0;color:#7A8594;font-size:13px}
    article{padding-top:34px}
    p{font-size:17px;margin:0 0 22px}
    ul{margin:0 0 24px;padding-left:20px}
    li{font-size:17px;margin:0 0 9px}
    .table-wrap{overflow-x:auto;margin:30px 0;border:1px solid #EAECF0;border-radius:14px;box-shadow:0 12px 30px rgba(16,24,40,.06)}
    table{width:100%;border-collapse:collapse;background:#fff;min-width:560px}
    th{background:#F3F7FF;color:#0B55D9;text-align:left;font-size:14px;font-weight:900;padding:15px 16px;border-bottom:1px solid #D8E5FF}
    td{padding:16px;border-bottom:1px solid #EAECF0;color:#344054;font-size:15px;vertical-align:top}
    tr:last-child td{border-bottom:0}
    .cta{margin-top:46px;padding:30px;border-radius:16px;background:#08111F;color:#fff}
    .cta h2{color:#fff}
    .cta p{font-size:15px;color:rgba(255,255,255,.78)}
    .cta-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
    .cta a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:12px 18px;border-radius:10px;background:#FEE500;color:#191919}
    .cta .phone{background:#fff;color:#08111F}
    @media(max-width:560px){.wrap{padding-top:34px}.cta{padding:24px}p,li{font-size:16px}}
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
      ${post.body.map(renderBlock).join('\n      ')}
    </article>
    <section class="cta">
      <h2>우리 업종에도 검색 노출형 홈페이지가 필요하다면</h2>
      <p>아비컴퍼니가 홈페이지 제작, 업종별 칼럼, 검색 노출 구조, 광고 운영까지 함께 진단해드립니다.</p>
      <div class="cta-actions">
        <a href="tel:${contactPhone.replaceAll('-', '')}" class="phone">전화 상담 ${contactPhone}</a>
        <a href="https://open.kakao.com/o/s96tWi4f" target="_blank" rel="noopener">카카오톡 상담</a>
      </div>
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
  <meta name="description" content="인테리어, 분양, 장례식장, 병원, 법률사무소 등 업종별 홈페이지 제작과 검색 노출 전략을 다루는 아비컴퍼니 칼럼입니다." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${siteUrl}/column/" />
  <style>
    *{box-sizing:border-box}
    body{margin:0;font-family:Arial,'Noto Sans KR',sans-serif;color:#101828;background:#F7F9FC;line-height:1.75}
    .wrap{max-width:1120px;margin:0 auto;padding:50px 22px 84px}
    a{text-decoration:none;color:inherit}
    .home{display:inline-flex;margin-bottom:34px;color:#0B55D9;font-weight:900}
    h1{font-size:clamp(31px,5vw,48px);letter-spacing:-.4px;margin:0 0 12px}
    .lead{max-width:720px;color:#667085;font-size:16px;margin:0 0 34px}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
    .card{display:flex;flex-direction:column;min-height:286px;padding:25px;border-radius:14px;background:#fff;border:1px solid #EAECF0;box-shadow:0 10px 26px rgba(16,24,40,.05);transition:transform .2s ease,box-shadow .2s ease}
    .card:hover{transform:translateY(-3px);box-shadow:0 16px 34px rgba(16,24,40,.09)}
    .tag{width:fit-content;margin-bottom:16px;padding:6px 11px;border-radius:999px;background:#EEF4FF;color:#0B55D9;font-size:11px;font-weight:900}
    h2{font-size:20px;line-height:1.45;margin:0 0 12px}
    p{color:#667085;font-size:14px;margin:0}
    .meta{margin-top:auto;padding-top:18px;color:#8A95A3;font-size:12px}
    @media(max-width:860px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:580px){.grid{grid-template-columns:1fr}.card{min-height:auto}}
  </style>
</head>
<body>
  <main class="wrap">
    <a class="home" href="../">← 아비컴퍼니 홈</a>
    <h1>마케팅 칼럼</h1>
    <p class="lead">업종별 홈페이지 제작, 검색 노출, 상담 전환을 함께 만드는 실전 마케팅 인사이트를 정리합니다.</p>
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

const latestColumnDate = columns.reduce((latest, post) => (
  post.dateModified > latest ? post.dateModified : latest
), '2026-06-01');

const urls = [
  { loc: `${siteUrl}/`, lastmod: latestColumnDate },
  { loc: `${siteUrl}/column/`, lastmod: latestColumnDate },
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
