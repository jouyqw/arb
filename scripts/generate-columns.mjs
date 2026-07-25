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

const renderInline = (value = '') => esc(value)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/__(.+?)__/g, '<u>$1</u>');

const renderBlock = (block) => {
  if (typeof block === 'string') return `<p>${renderInline(block)}</p>`;

  if (block?.type === 'heading') {
    return `<h2>${renderInline(block.text)}</h2>`;
  }

  if (block?.type === 'summary') {
    return `<section class="summary-box">
        <strong>${esc(block.title || '핵심 요약')}</strong>
        <ul>${block.items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>
      </section>`;
  }

  if (block?.type === 'image') {
    return `<figure class="hero-figure">
        <img src="${esc(block.src)}" alt="${esc(block.alt || '')}" loading="lazy" />
        ${block.caption ? `<figcaption>${renderInline(block.caption)}</figcaption>` : ''}
      </figure>`;
  }

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
    return `<ul>${block.items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`;
  }

  // 인포그래픽·콜아웃 등 직접 작성한 HTML 블록 (Claude 일일 발행에서 사용)
  if (block?.type === 'html') {
    return block.html || '';
  }

  if (block?.type === 'callout' || block?.type === 'warning') {
    const cls = block.type === 'warning' ? 'warning-box' : 'callout-box';
    return `<div class="${cls}">${block.label ? `<span class="label">${esc(block.label)}</span>` : ''}<p>${renderInline(block.text || '')}</p></div>`;
  }

  if (block?.type === 'infographic') {
    const items = (block.items || []).map((item) => `<div class="ig-item"><span class="ig-ic">${item.icon || ''}</span><div><b>${esc(item.title)}</b><span class="t">${esc(item.text)}</span></div></div>`).join('');
    return `<div class="infographic"><div class="infographic-h">${esc(block.title || '')}</div><div class="ig-grid">${items}</div></div>${block.caption ? `<p class="figure-note">▲ ${esc(block.caption)}</p>` : ''}`;
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
  if (post.image) schema.image = `${siteUrl}${post.image}`;

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
  ${post.image ? `<meta property="og:image" content="${siteUrl}${esc(post.image)}" />` : ''}
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
    strong{font-weight:900;color:#0B55D9}
    u{text-decoration-thickness:8px;text-underline-offset:-3px;text-decoration-color:#D8E5FF;text-decoration-skip-ink:none}
    ul{margin:0 0 24px;padding-left:20px}
    li{font-size:17px;margin:0 0 9px}
    .hero-figure{margin:30px 0 34px;border-radius:18px;overflow:hidden;border:1px solid #EAECF0;box-shadow:0 16px 38px rgba(16,24,40,.1);background:#F7F9FC}
    .hero-figure img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover}
    .hero-figure figcaption{padding:12px 16px;color:#667085;font-size:13px;background:#fff}
    .summary-box{margin:28px 0 34px;padding:22px 24px;border:1px solid #D8E5FF;border-radius:16px;background:#F3F7FF}
    .summary-box strong{display:block;margin-bottom:10px;color:#0B55D9;font-size:16px}
    .summary-box ul{margin:0;padding-left:20px}
    .summary-box li{font-size:15px;margin-bottom:6px;color:#344054}
    .table-wrap{overflow-x:auto;margin:30px 0;border:1px solid #EAECF0;border-radius:14px;box-shadow:0 12px 30px rgba(16,24,40,.06)}
    table{width:100%;border-collapse:collapse;background:#fff;min-width:560px}
    th{background:#F3F7FF;color:#0B55D9;text-align:left;font-size:14px;font-weight:900;padding:15px 16px;border-bottom:1px solid #D8E5FF}
    td{padding:16px;border-bottom:1px solid #EAECF0;color:#344054;font-size:15px;vertical-align:top}
    tr:last-child td{border-bottom:0}
    .infographic{margin:30px 0;border:1px solid #EAECF0;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 12px 30px rgba(16,24,40,.06)}
    .infographic-h{background:#08111F;color:#fff;padding:15px 22px;font-weight:900;font-size:15px}
    .ig-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#EAECF0}
    .ig-item{background:#fff;padding:20px;display:flex;gap:13px;align-items:flex-start}
    .ig-ic{flex-shrink:0;width:42px;height:42px;border-radius:50%;background:#EEF4FF;border:1px solid #D8E5FF;display:flex;align-items:center;justify-content:center;color:#0B55D9}
    .ig-item b{display:block;color:#101828;font-size:15px;margin-bottom:4px}
    .ig-item .t{font-size:13.5px;color:#4b5563;line-height:1.6;display:block}
    .figure-note{color:#8A95A3;font-size:12.5px;margin:-18px 0 26px;text-align:center}
    .callout-box,.warning-box{border-radius:14px;padding:20px 22px;margin:26px 0}
    .callout-box{background:#F3F7FF;border:1px solid #D8E5FF}
    .warning-box{background:#FFF4F1;border:1px solid #F6CFC5}
    .callout-box .label,.warning-box .label{display:inline-block;font-size:12px;font-weight:900;color:#0B55D9;margin-bottom:7px}
    .warning-box .label{color:#B42318}
    .callout-box p,.warning-box p{margin:0;font-size:15.5px}
    .cta{margin-top:46px;padding:30px;border-radius:16px;background:#08111F;color:#fff}
    .cta h2{color:#fff}
    .cta p{font-size:15px;color:rgba(255,255,255,.78)}
    .cta-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
    .cta a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:12px 18px;border-radius:10px;background:#FEE500;color:#191919}
    .cta .phone{background:#fff;color:#08111F}
    @media(max-width:560px){.wrap{padding-top:34px}.cta{padding:24px}p,li{font-size:16px}.ig-grid{grid-template-columns:1fr}table{min-width:0}th,td{padding:12px 13px;font-size:14px}}
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

const listingTemplate = () => {
  const sorted = [...columns].sort((a, b) => b.datePublished.localeCompare(a.datePublished) || a.slug.localeCompare(b.slug));
  const cats = [...new Set(sorted.map((p) => p.category))];
  const counts = {};
  sorted.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
  const chips = [`<button class="chip active" type="button" data-cat="all">전체</button>`]
    .concat(cats.map((c) => `<button class="chip" type="button" data-cat="${esc(c)}">${esc(c)} <b>${counts[c]}</b></button>`))
    .join('');
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '아비컴퍼니 마케팅 칼럼',
    url: `${siteUrl}/column/`,
    inLanguage: 'ko-KR',
    publisher: { '@type': 'Organization', name: '아비컴퍼니', url: siteUrl },
    mainEntity: { '@type': 'ItemList', itemListElement: sorted.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${siteUrl}/column/${p.slug}/`, name: p.title })) }
  };

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>마케팅 칼럼 | 아비컴퍼니</title>
  <meta name="description" content="전문직 마케팅, 홈페이지 제작, 병원·법무법인·인테리어·분양 등 업종별 검색 노출 전략을 다루는 아비컴퍼니 칼럼입니다." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${siteUrl}/column/" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="마케팅 칼럼 | 아비컴퍼니" />
  <meta property="og:description" content="전문직 마케팅과 홈페이지 제작, 업종별 검색 노출 전략 칼럼." />
  <meta property="og:url" content="${siteUrl}/column/" />
  <script type="application/ld+json">${JSON.stringify(itemListLd)}</script>
  <style>
    *{box-sizing:border-box}
    body{margin:0;font-family:Arial,'Noto Sans KR',sans-serif;color:#101828;background:#F7F9FC;line-height:1.75}
    .wrap{max-width:1120px;margin:0 auto;padding:50px 22px 84px}
    a{text-decoration:none;color:inherit}
    .home{display:inline-flex;margin-bottom:34px;color:#0B55D9;font-weight:900}
    h1{font-size:clamp(31px,5vw,48px);letter-spacing:-.4px;margin:0 0 12px}
    .lead{max-width:720px;color:#667085;font-size:16px;margin:0 0 28px}
    .finder{margin:0 0 26px}
    .search-box{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #D9DFE7;border-radius:12px;padding:13px 16px;box-shadow:0 8px 22px rgba(16,24,40,.05)}
    .search-box:focus-within{border-color:#0B55D9;box-shadow:0 8px 26px rgba(11,85,217,.14)}
    .search-box svg{color:#8A95A3;flex-shrink:0}
    .search-box input{flex:1;border:0;outline:0;font-size:15px;font-family:inherit;background:transparent;color:#101828;min-width:0}
    .search-box #colClear{display:none;border:0;background:#EEF1F5;color:#4b5563;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:17px;line-height:1;flex-shrink:0}
    .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
    .chip{border:1px solid #D9DFE7;background:#fff;color:#344054;border-radius:999px;padding:8px 15px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;transition:all .18s}
    .chip b{color:#0B55D9;margin-left:3px}
    .chip:hover{border-color:#0B55D9}
    .chip.active{background:#0B55D9;border-color:#0B55D9;color:#fff}
    .chip.active b{color:#CFE0FF}
    .finder-meta{margin-top:13px;color:#8A95A3;font-size:13px}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
    .card{display:flex;flex-direction:column;min-height:286px;padding:25px;border-radius:14px;background:#fff;border:1px solid #EAECF0;box-shadow:0 10px 26px rgba(16,24,40,.05);transition:transform .2s ease,box-shadow .2s ease}
    .card:hover{transform:translateY(-3px);box-shadow:0 16px 34px rgba(16,24,40,.09)}
    .tag{width:fit-content;margin-bottom:16px;padding:6px 11px;border-radius:999px;background:#EEF4FF;color:#0B55D9;font-size:11px;font-weight:900}
    h2{font-size:20px;line-height:1.45;margin:0 0 12px}
    p{color:#667085;font-size:14px;margin:0}
    .meta{margin-top:auto;padding-top:18px;color:#8A95A3;font-size:12px}
    .empty{display:none;text-align:center;color:#8A95A3;padding:44px 0;font-size:15px}
    @media(max-width:860px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:580px){.grid{grid-template-columns:1fr}.card{min-height:auto}.wrap{padding-top:36px}}
  </style>
</head>
<body>
  <main class="wrap">
    <a class="home" href="../">← 아비컴퍼니 홈</a>
    <h1>마케팅 칼럼</h1>
    <p class="lead">전문직 마케팅, 홈페이지 제작, 업종별 검색 노출과 상담 전환을 함께 만드는 실전 인사이트를 정리합니다.</p>
    <div class="finder">
      <div class="search-box"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M21 21l-4.3-4.3M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg><input id="colSearch" type="search" placeholder="궁금한 키워드로 칼럼 검색 (예: 병원, 홈페이지 제작, 네이버)" autocomplete="off"><button id="colClear" type="button" aria-label="검색어 지우기">×</button></div>
      <div class="chips" id="colCats">${chips}</div>
      <div class="finder-meta" id="colCount">총 ${sorted.length}개 칼럼</div>
    </div>
    <div class="grid" id="colGrid">
      ${sorted.map((post) => `<a class="card" data-cat="${esc(post.category)}" data-text="${esc(`${post.title} ${post.description} ${(post.keywords || []).join(' ')}`.toLowerCase())}" href="${post.slug}/">
        <span class="tag">${esc(post.category)}</span>
        <h2>${esc(post.title)}</h2>
        <p>${esc(post.description)}</p>
        <span class="meta">${esc(post.author)} · ${esc(post.datePublished)}</span>
      </a>`).join('\n      ')}
    </div>
    <div class="empty" id="colEmpty">검색 결과가 없습니다. 다른 키워드나 분야를 선택해 보세요.</div>
  </main>
  <script>
  (function(){
    var cards=[].slice.call(document.querySelectorAll('#colGrid .card'));
    var search=document.getElementById('colSearch');
    var clearBtn=document.getElementById('colClear');
    var chips=[].slice.call(document.querySelectorAll('#colCats .chip'));
    var countEl=document.getElementById('colCount');
    var emptyEl=document.getElementById('colEmpty');
    var activeCat='all';
    function apply(){
      var q=(search?search.value:'').trim().toLowerCase().replace(/\\s+/g,'');
      var shown=0;
      cards.forEach(function(card){
        var cat=card.getAttribute('data-cat')||'';
        var text=(card.getAttribute('data-text')||'').replace(/\\s+/g,'');
        var show=(activeCat==='all'||cat===activeCat)&&(!q||text.indexOf(q)!==-1);
        card.style.display=show?'':'none';
        if(show)shown++;
      });
      if(countEl)countEl.textContent='총 '+shown+'개 칼럼';
      if(emptyEl)emptyEl.style.display=shown?'none':'block';
      if(clearBtn)clearBtn.style.display=(search&&search.value)?'inline-flex':'none';
    }
    if(search)search.addEventListener('input',apply);
    if(clearBtn)clearBtn.addEventListener('click',function(){search.value='';search.focus();apply();});
    chips.forEach(function(chip){chip.addEventListener('click',function(){
      chips.forEach(function(o){o.classList.remove('active');});
      chip.classList.add('active');
      activeCat=chip.getAttribute('data-cat')||'all';
      apply();
    });});
    apply();
  })();
  </script>
</body>
</html>`;
};

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
