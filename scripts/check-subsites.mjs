import assert from 'node:assert/strict';
import {routeSubsite} from '../lib/subsites/router.mjs';
import {sites,articles,renderSite} from '../lib/subsites/render.mjs';
const get=(url,method='GET')=>routeSubsite({request:new Request(url,{method})});
let checks=0;
for(const url of ['https://aubcompany.com/','https://aubcompany.com/column/','https://aubcompany.com/api/scan','https://gift.aubcompany.com/','https://law.aubcompany.com/','https://life.aubcompany.com/','https://www.aubcompany.com/']){assert.equal(await get(url),null);checks++;}
for(const k of Object.keys(sites)){
 const host='https://'+k+'.aubcompany.com';
 for(const path of ['/','/column/',...articles[k].map(a=>'/column/'+a.slug+'/')]){
  const r=await get(host+path);assert.equal(r.status,200);const html=await r.text();assert.match(html,/카카오톡 상담/);assert.match(html,/627호/);assert.match(html,/20230508@aubcompany.com/);assert.ok(html.includes('href="'+host+path+'"'));assert.equal((html.match(/<h1/g)||[]).length,1);for(const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs))JSON.parse(m[1]);checks++;
 }
 assert.equal((await get(host+'/missing/')).status,404);checks++;
 assert.equal((await get(host+'/column')).status,301);checks++;
 assert.equal((await get(host+'/','HEAD')).body,null);checks++;
 assert.equal(await get(host+'/assets/subsites/studio.css'),null);checks++;
 assert.match(await (await get(host+'/sitemap.xml')).text(),new RegExp(articles[k][0].slug));checks++;
 assert.match(await (await get(host+'/rss.xml')).text(),/<rss/);checks++;
 const preview=await get('https://aubcompany.com/__preview/subsites/'+k+'/');assert.equal(preview.headers.get('x-robots-tag'),'noindex, follow');checks++;
 for(const a of articles[k]){const count=a.sections.flatMap(s=>s.paragraphs).join('').length;assert.ok(count>=2400,k+': '+count);}
}
for(const k of Object.keys(sites)){
 const html=renderSite(k);
 for(const marker of ['class="contact-dock"','tel:01055010152','https://pf.kakao.com/_wxjxiSX/chat','agency.css?v=20261010b','data-demo-view="mobile"','실제 고객사 작업물이나 성과 자료가 아닙니다.'])assert.ok(html.includes(marker),k+': '+marker);
 checks++;
}
console.log('PASS: '+checks+' routing/content checks; main, gift, law, life and www untouched.');
