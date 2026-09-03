import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const siteUrl = 'https://aubcompany.com';
const contactPhone = '010-5501-0152';
const columns = JSON.parse(await readFile(path.join(root, 'data', 'columns.json'), 'utf8'));
const services = JSON.parse(await readFile(path.join(root, 'data', 'services.json'), 'utf8'));

const columnBySlug = new Map(columns.map((post) => [post.slug, post]));
const serviceBySlug = new Map(services.map((svc) => [svc.slug, svc]));

// 칼럼 하나가 어느 서비스 페이지에 묶여 있는지 역으로 찾는다.
// 서비스(허브) → 칼럼(스포크) 링크만 있으면 한쪽 방향이라 클러스터가 안 닫힌다.
const servicesForColumn = new Map();
for (const svc of services) {
  for (const slug of svc.relatedColumns || []) {
    if (!columnBySlug.has(slug)) {
      throw new Error(`services.json: '${svc.slug}' 가 없는 칼럼 '${slug}' 을 참조합니다.`);
    }
    if (!servicesForColumn.has(slug)) servicesForColumn.set(slug, []);
    servicesForColumn.get(slug).push(svc);
  }
}

for (const svc of services) {
  for (const slug of svc.relatedServices || []) {
    if (!serviceBySlug.has(slug)) {
      throw new Error(`services.json: '${svc.slug}' 가 없는 서비스 '${slug}' 을 참조합니다.`);
    }
  }
}

// services.json 이 직접 지목하지 않은 칼럼도 허브로 이어야 클러스터가 닫힌다.
// 분야별 기본 연결이 없으면 81편 중 절반이 서비스 페이지와 끊긴 채 남는다.
const categoryServices = {
  'SEO·상위노출': ['naver-place-ranking', 'homepage-production'],
  '전문직 마케팅': ['professional-marketing'],
  'AI 검색(GEO)': ['geo-ai-search-optimization', 'homepage-production'],
  '홈페이지 제작·전환': ['homepage-production'],
  '업종별 마케팅': ['professional-marketing', 'interior-marketing']
};

for (const [category, slugs] of Object.entries(categoryServices)) {
  for (const slug of slugs) {
    if (!serviceBySlug.has(slug)) {
      throw new Error(`categoryServices['${category}'] 가 없는 서비스 '${slug}' 을 참조합니다.`);
    }
  }
}

const hubsForColumn = (post) => {
  const direct = servicesForColumn.get(post.slug);
  if (direct?.length) return direct;
  return (categoryServices[post.category] || []).map((slug) => serviceBySlug.get(slug));
};

// 같은 분야 칼럼을 최신순으로 골라 서로 잇는다. 자기 자신은 뺀다.
const relatedColumnsFor = (post, limit = 4) => [...columns]
  .filter((other) => other.slug !== post.slug && other.category === post.category)
  .sort((a, b) => b.datePublished.localeCompare(a.datePublished) || a.slug.localeCompare(b.slug))
  .slice(0, limit);

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

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: '마케팅 칼럼', item: `${siteUrl}/column/` },
      { '@type': 'ListItem', position: 3, name: post.title, item: url }
    ]
  };

  const related = relatedColumnsFor(post);
  const hubs = hubsForColumn(post);

  const relatedSection = related.length ? `<section class="related">
      <h2>같은 분야의 다른 칼럼</h2>
      <ul class="related-list">
        ${related.map((item) => `<li><a href="../${item.slug}/">${esc(item.title)}</a><span>${esc(item.description)}</span></li>`).join('\n        ')}
      </ul>
      <a class="more" href="../">${esc(post.category)} 칼럼 더 보기 →</a>
    </section>` : '';

  const hubSection = hubs.length ? `<section class="hub">
      <span class="hub-label">이 주제와 연결된 서비스</span>
      <div class="hub-links">
        ${hubs.map((svc) => `<a href="../../service/${svc.slug}/">${esc(svc.title)}</a>`).join('\n        ')}
      </div>
    </section>` : '';

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
  <script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
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
    .crumb{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-bottom:26px;font-size:13px;color:#8A95A3}
    .crumb a{font-weight:700;color:#0B55D9}
    .crumb span{color:#C3CAD4}
    .hub{margin:44px 0 0;padding:22px 24px;border:1px solid #D8E5FF;border-radius:16px;background:#F3F7FF}
    .hub-label{display:block;font-size:12.5px;font-weight:900;color:#0B55D9;margin-bottom:12px}
    .hub-links{display:flex;flex-wrap:wrap;gap:9px}
    .hub-links a{display:inline-flex;align-items:center;padding:9px 15px;border-radius:999px;background:#fff;border:1px solid #D8E5FF;font-size:14px}
    .hub-links a:hover{border-color:#0B55D9}
    .related{margin:40px 0 0;padding-top:32px;border-top:1px solid #EAECF0}
    .related h2{font-size:19px;margin:0 0 18px}
    .related-list{list-style:none;margin:0 0 18px;padding:0}
    .related-list li{margin:0 0 14px;padding-bottom:14px;border-bottom:1px solid #F2F4F7}
    .related-list li:last-child{border-bottom:0}
    .related-list a{display:block;font-size:16px;line-height:1.5;margin-bottom:4px}
    .related-list span{display:block;color:#8A95A3;font-size:13.5px;font-weight:400;line-height:1.6}
    .more{display:inline-block;font-size:14px}
    @media(max-width:560px){.wrap{padding-top:34px}.cta{padding:24px}p,li{font-size:16px}.ig-grid{grid-template-columns:1fr}table{min-width:0}th,td{padding:12px 13px;font-size:14px}.hub{padding:18px}}
  </style>
</head>
<body>
  <main class="wrap">
    <nav class="crumb" aria-label="현재 위치">
      <a href="../../">아비컴퍼니</a><span>›</span><a href="../">마케팅 칼럼</a><span>›</span>${esc(post.category)}
    </nav>
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
    ${hubSection}
    ${relatedSection}
    <section class="cta">
      <h2>우리 업종에도 검색 노출형 홈페이지가 필요하다면</h2>
      <p>아비컴퍼니가 홈페이지 제작, 업종별 칼럼, 검색 노출 구조, 광고 운영까지 함께 진단해드립니다.</p>
      <div class="cta-actions">
        <a href="tel:${contactPhone.replaceAll('-', '')}" class="phone">전화 상담 ${contactPhone}</a>
        <a href="https://pf.kakao.com/_wxjxiSX/chat" target="_blank" rel="noopener">카카오톡 상담</a>
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

// 서비스 페이지 공통 스타일. 칼럼과 톤을 맞추되 상담 유도 요소를 더 크게 둔다.
const serviceStyle = `
    *{box-sizing:border-box}
    body{margin:0;font-family:Arial,'Noto Sans KR',sans-serif;color:#101828;line-height:1.85;background:#fff}
    .wrap{max-width:880px;margin:0 auto;padding:0 22px 88px}
    a{color:#0B55D9;text-decoration:none;font-weight:800}
    .top{background:radial-gradient(900px 460px at 78% -20%,rgba(43,106,255,.34),transparent 62%),linear-gradient(168deg,#0A1120 0%,#0C1730 60%,#0E1F42 100%);color:#fff;padding:34px 0 54px;margin-bottom:44px}
    .top .wrap{padding-bottom:0}
    .crumb{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-bottom:30px;font-size:13px;color:#8FA0BC}
    .crumb a{font-weight:700;color:#9FC2FF}
    .crumb span{color:#4C5E7C}
    .eyebrow{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(122,168,255,.4);background:rgba(43,106,255,.16);border-radius:999px;padding:7px 15px;font-size:12.5px;font-weight:800;color:#A8C6F8;margin-bottom:20px}
    h1{font-size:clamp(28px,4.8vw,44px);line-height:1.26;letter-spacing:-.035em;font-weight:900;color:#fff;margin:0 0 18px}
    .lead{font-size:clamp(15.5px,2vw,18px);color:#A9B7CF;margin:0 0 26px;max-width:640px}
    .top-actions{display:flex;flex-wrap:wrap;gap:11px}
    .top-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:13px 22px;border-radius:11px;font-size:15px}
    .top-actions .primary{background:linear-gradient(100deg,#3D8BFF 0%,#66D0FF 100%);color:#fff;box-shadow:0 8px 22px rgba(61,139,255,.34)}
    .top-actions .ghost{border:1px solid rgba(255,255,255,.24);color:#DCE4F0}
    h2{font-size:25px;line-height:1.34;margin:44px 0 14px;letter-spacing:-.02em}
    p{font-size:17px;margin:0 0 22px}
    strong{font-weight:900;color:#0B55D9}
    u{text-decoration-thickness:8px;text-underline-offset:-3px;text-decoration-color:#D8E5FF;text-decoration-skip-ink:none}
    ul{margin:0 0 24px;padding-left:20px}
    li{font-size:17px;margin:0 0 11px}
    .summary-box{margin:0 0 34px;padding:24px 26px;border:1px solid #D8E5FF;border-radius:16px;background:#F3F7FF}
    .summary-box strong{display:block;margin-bottom:10px;color:#0B55D9;font-size:16px}
    .summary-box ul{margin:0;padding-left:20px}
    .summary-box li{font-size:15px;margin-bottom:7px;color:#344054}
    .table-wrap{overflow-x:auto;margin:30px 0;border:1px solid #EAECF0;border-radius:14px;box-shadow:0 12px 30px rgba(16,24,40,.06)}
    table{width:100%;border-collapse:collapse;background:#fff;min-width:580px}
    th{background:#F3F7FF;color:#0B55D9;text-align:left;font-size:14px;font-weight:900;padding:15px 16px;border-bottom:1px solid #D8E5FF}
    td{padding:16px;border-bottom:1px solid #EAECF0;color:#344054;font-size:15px;vertical-align:top}
    tr:last-child td{border-bottom:0}
    .infographic{margin:30px 0;border:1px solid #EAECF0;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 12px 30px rgba(16,24,40,.06)}
    .infographic-h{background:#08111F;color:#fff;padding:15px 22px;font-weight:900;font-size:15px}
    .ig-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#EAECF0}
    .ig-item{background:#fff;padding:20px;display:flex;gap:13px;align-items:flex-start}
    .ig-ic{flex-shrink:0;width:38px;height:38px;border-radius:50%;background:#EEF4FF;border:1px solid #D8E5FF;display:flex;align-items:center;justify-content:center;color:#0B55D9;font-weight:900;font-size:14px}
    .ig-item b{display:block;color:#101828;font-size:15px;margin-bottom:4px}
    .ig-item .t{font-size:13.5px;color:#4b5563;line-height:1.6;display:block}
    .figure-note{color:#8A95A3;font-size:12.5px;margin:-18px 0 26px;text-align:center}
    .callout-box,.warning-box{border-radius:14px;padding:21px 23px;margin:28px 0}
    .callout-box{background:#F3F7FF;border:1px solid #D8E5FF}
    .warning-box{background:#FFF4F1;border:1px solid #F6CFC5}
    .callout-box .label,.warning-box .label{display:inline-block;font-size:12px;font-weight:900;color:#0B55D9;margin-bottom:7px}
    .warning-box .label{color:#B42318}
    .callout-box p,.warning-box p{margin:0;font-size:15.5px}
    .faq{margin-top:52px;padding-top:38px;border-top:1px solid #EAECF0}
    .faq details{border:1px solid #EAECF0;border-radius:13px;margin-bottom:11px;background:#FCFDFF}
    .faq summary{cursor:pointer;padding:18px 21px;font-size:16.5px;font-weight:800;color:#101828;list-style:none;display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
    .faq summary::-webkit-details-marker{display:none}
    .faq summary::after{content:"+";color:#0B55D9;font-size:21px;line-height:1;flex-shrink:0}
    .faq details[open] summary::after{content:"−"}
    .faq .a{padding:0 21px 20px;margin:0;font-size:15.5px;color:#4b5563}
    .related{margin-top:52px;padding-top:38px;border-top:1px solid #EAECF0}
    .related h2{margin-top:0}
    .related-list{list-style:none;margin:0 0 20px;padding:0}
    .related-list li{margin:0 0 14px;padding-bottom:14px;border-bottom:1px solid #F2F4F7}
    .related-list li:last-child{border-bottom:0}
    .related-list a{display:block;font-size:16px;line-height:1.5;margin-bottom:4px}
    .related-list span{display:block;color:#8A95A3;font-size:13.5px;font-weight:400;line-height:1.6}
    .sib{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}
    .sib a{display:inline-flex;align-items:center;padding:10px 16px;border-radius:999px;background:#F3F7FF;border:1px solid #D8E5FF;font-size:14px}
    .sib a:hover{border-color:#0B55D9}
    .cta{margin-top:52px;padding:32px;border-radius:18px;background:#08111F;color:#fff}
    .cta h2{color:#fff;margin:0 0 10px}
    .cta p{font-size:15px;color:rgba(255,255,255,.78);margin:0}
    .cta-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
    .cta a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:13px 19px;border-radius:10px;background:#FEE500;color:#191919}
    .cta .phone{background:#fff;color:#08111F}
    @media(max-width:560px){.top{padding:26px 0 42px;margin-bottom:34px}p,li{font-size:16px}h2{font-size:22px}.ig-grid{grid-template-columns:1fr}table{min-width:0}th,td{padding:12px 13px;font-size:14px}.cta{padding:24px}}
`;

const serviceTemplate = (svc) => {
  const url = `${siteUrl}/service/${svc.slug}/`;
  const related = (svc.relatedColumns || []).map((slug) => columnBySlug.get(slug));
  const siblings = (svc.relatedServices || []).map((slug) => serviceBySlug.get(slug));

  const serviceLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: svc.title,
    serviceType: svc.title,
    description: svc.description,
    url,
    provider: { '@type': 'Organization', name: '아비컴퍼니', url: `${siteUrl}/`, telephone: '+82-10-5501-0152' },
    areaServed: { '@type': 'AdministrativeArea', name: svc.region },
    inLanguage: 'ko-KR'
  };
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (svc.faq || []).map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a }
    }))
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: '서비스', item: `${siteUrl}/service/` },
      { '@type': 'ListItem', position: 3, name: svc.title, item: url }
    ]
  };

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(svc.metaTitle)}</title>
  <meta name="description" content="${esc(svc.description)}" />
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="ko_KR" />
  <meta property="og:site_name" content="아비컴퍼니" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${esc(svc.metaTitle)}" />
  <meta property="og:description" content="${esc(svc.description)}" />
  <meta property="og:image" content="${siteUrl}/assets/brand/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(serviceLd)}</script>
  ${(svc.faq || []).length ? `<script type="application/ld+json">${JSON.stringify(faqLd)}</script>` : ''}
  <script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
  <style>${serviceStyle}</style>
</head>
<body>
  <header class="top">
    <div class="wrap">
      <nav class="crumb" aria-label="현재 위치">
        <a href="../../">아비컴퍼니</a><span>›</span><a href="../">서비스</a><span>›</span>${esc(svc.title)}
      </nav>
      <span class="eyebrow">${esc(svc.category)}${svc.region && svc.region !== '전국' ? ` · ${esc(svc.region)}` : ''}</span>
      <h1>${esc(svc.h1)}</h1>
      <p class="lead">${esc(svc.lead)}</p>
      <div class="top-actions">
        <a class="primary" href="tel:${contactPhone.replaceAll('-', '')}">전화 상담 ${contactPhone}</a>
        <a class="ghost" href="https://pf.kakao.com/_wxjxiSX/chat" target="_blank" rel="noopener">카카오톡으로 문의</a>
      </div>
    </div>
  </header>
  <main class="wrap">
    <article>
      ${svc.body.map(renderBlock).join('\n      ')}
    </article>
    ${(svc.faq || []).length ? `<section class="faq">
      <h2>자주 묻는 질문</h2>
      ${svc.faq.map((item) => `<details>
        <summary>${esc(item.q)}</summary>
        <p class="a">${esc(item.a)}</p>
      </details>`).join('\n      ')}
    </section>` : ''}
    ${related.length ? `<section class="related">
      <h2>더 자세히 다룬 칼럼</h2>
      <ul class="related-list">
        ${related.map((item) => `<li><a href="../../column/${item.slug}/">${esc(item.title)}</a><span>${esc(item.description)}</span></li>`).join('\n        ')}
      </ul>
      <a href="../../column/">마케팅 칼럼 전체 보기 →</a>
      ${siblings.length ? `<div class="sib">${siblings.map((item) => `<a href="../${item.slug}/">${esc(item.title)}</a>`).join('')}</div>` : ''}
    </section>` : ''}
    <section class="cta">
      <h2>지금 상태부터 확인해보세요</h2>
      <p>현재 홈페이지가 어떤 검색어로 노출되고 있는지, 무엇이 막혀 있는지 먼저 진단해드립니다. 진단 결과만 받아보셔도 됩니다.</p>
      <div class="cta-actions">
        <a href="tel:${contactPhone.replaceAll('-', '')}" class="phone">전화 상담 ${contactPhone}</a>
        <a href="https://pf.kakao.com/_wxjxiSX/chat" target="_blank" rel="noopener">카카오톡 상담</a>
      </div>
    </section>
  </main>
</body>
</html>`;
};

const serviceHubTemplate = () => {
  const hubLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '아비컴퍼니 서비스',
    url: `${siteUrl}/service/`,
    inLanguage: 'ko-KR',
    publisher: { '@type': 'Organization', name: '아비컴퍼니', url: `${siteUrl}/` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: services.map((svc, i) => ({ '@type': 'ListItem', position: i + 1, url: `${siteUrl}/service/${svc.slug}/`, name: svc.title }))
    }
  };

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>서비스 안내 | 홈페이지 제작·전문직 마케팅 | 아비컴퍼니</title>
  <meta name="description" content="아비컴퍼니의 홈페이지 제작, 전문직 마케팅, 인테리어 마케팅, 네이버 플레이스 상위노출 등 서비스별 안내입니다." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${siteUrl}/service/" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${siteUrl}/service/" />
  <meta property="og:title" content="서비스 안내 | 아비컴퍼니" />
  <meta property="og:description" content="홈페이지 제작, 전문직 마케팅, 인테리어 마케팅, 플레이스 상위노출 서비스 안내." />
  <script type="application/ld+json">${JSON.stringify(hubLd)}</script>
  <style>
    *{box-sizing:border-box}
    body{margin:0;font-family:Arial,'Noto Sans KR',sans-serif;color:#101828;background:#F7F9FC;line-height:1.75}
    .wrap{max-width:1120px;margin:0 auto;padding:50px 22px 84px}
    a{text-decoration:none;color:inherit}
    .crumb{display:flex;gap:7px;align-items:center;margin-bottom:30px;font-size:13px;color:#8A95A3}
    .crumb a{font-weight:800;color:#0B55D9}
    h1{font-size:clamp(31px,5vw,46px);letter-spacing:-.4px;margin:0 0 12px}
    .lead{max-width:730px;color:#667085;font-size:16px;margin:0 0 34px}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
    .card{display:flex;flex-direction:column;padding:28px;border-radius:16px;background:#fff;border:1px solid #EAECF0;box-shadow:0 10px 26px rgba(16,24,40,.05);transition:transform .2s ease,box-shadow .2s ease}
    .card:hover{transform:translateY(-3px);box-shadow:0 16px 34px rgba(16,24,40,.09)}
    .tag{width:fit-content;margin-bottom:15px;padding:6px 12px;border-radius:999px;background:#EEF4FF;color:#0B55D9;font-size:11.5px;font-weight:900}
    h2{font-size:21px;line-height:1.42;margin:0 0 11px}
    p{color:#667085;font-size:14.5px;margin:0 0 16px}
    .go{margin-top:auto;color:#0B55D9;font-weight:900;font-size:14px}
    .foot{margin-top:40px;color:#8A95A3;font-size:14px}
    .foot a{color:#0B55D9;font-weight:800}
    @media(max-width:760px){.grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main class="wrap">
    <nav class="crumb" aria-label="현재 위치"><a href="../">아비컴퍼니</a><span>›</span>서비스</nav>
    <h1>서비스 안내</h1>
    <p class="lead">업종과 지역에 따라 필요한 작업이 다릅니다. 해당하는 항목을 먼저 보시고, 애매하면 전화로 현재 상태부터 진단해드립니다.</p>
    <div class="grid">
      ${services.map((svc) => `<a class="card" href="${svc.slug}/">
        <span class="tag">${esc(svc.category)}${svc.region && svc.region !== '전국' ? ` · ${esc(svc.region)}` : ''}</span>
        <h2>${esc(svc.h1)}</h2>
        <p>${esc(svc.description)}</p>
        <span class="go">자세히 보기 →</span>
      </a>`).join('\n      ')}
    </div>
    <p class="foot">업종별 실무 내용은 <a href="../column/">마케팅 칼럼</a>에 정리되어 있습니다.</p>
  </main>
</body>
</html>`;
};

await mkdir(path.join(root, 'column'), { recursive: true });
await writeFile(path.join(root, 'column', 'index.html'), listingTemplate(), 'utf8');

await mkdir(path.join(root, 'service'), { recursive: true });
await writeFile(path.join(root, 'service', 'index.html'), serviceHubTemplate(), 'utf8');

for (const svc of services) {
  const dir = path.join(root, 'service', svc.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), serviceTemplate(svc), 'utf8');
}

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
  { loc: `${siteUrl}/service/`, lastmod: latestColumnDate },
  ...services.map((svc) => ({ loc: `${siteUrl}/service/${svc.slug}/`, lastmod: latestColumnDate })),
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
console.log(`Generated ${columns.length} column pages, ${services.length} service pages and sitemap.xml (${urls.length} urls)`);
