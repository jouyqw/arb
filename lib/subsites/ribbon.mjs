const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function serviceRibbon(site,design){
 const items=[...design.chips,'홈페이지 제작','검색·칼럼 콘텐츠','상담 동선 설계'];
 const group=hidden=>`<ul class="ribbon-group"${hidden?' aria-hidden="true"':''}>${items.map(item=>`<li><span aria-hidden="true">✳</span>${escape(item)}</li>`).join('')}</ul>`;
 return `<section class="service-ribbon" aria-label="${escape(site.n)} 제공 서비스"><div class="ribbon-controls"><span>OUR EXPERTISE <span class="ribbon-subtitle">/ ${escape(site.n)}</span></span><button type="button" class="ribbon-toggle" aria-pressed="false" aria-label="서비스 띠 움직임 정지">일시정지 Ⅱ</button></div><div class="ribbon-window"><div class="ribbon-track">${group(false)}${group(true)}</div></div></section>`;
}
