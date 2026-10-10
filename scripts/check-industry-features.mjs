import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {renderSite,sites,articles} from '../lib/subsites/render.mjs';
import {industryServices,industryContent} from '../lib/subsites/industry-content.mjs';
import {inline,paragraphs} from '../lib/subsites/editorial.mjs';
const source=readFileSync('assets/subsites/industry-diagnostics.js','utf8');
for(const key of Object.keys(sites)){
 const ctx={window:{},location:{search:'?industry='+key},URLSearchParams};vm.runInNewContext(source,ctx);
 const profile=ctx.window.ARB_INDUSTRY;assert.equal(profile.name,industryContent[key].name);assert.equal(profile.types.length,3);assert.equal(profile.questions.length,6);
 for(const q of profile.questions){assert.equal(q[1].length,3);assert.ok(q[0].length>10&&q[2].length>20);}
 assert.equal(industryServices(key).length,13);const home=renderSite(key);assert.match(home,/id="marketing"/);assert.ok(home.includes(profile.name+' 홈페이지·마케팅 진단'));
 const board=renderSite(key,{path:'/column/'});for(const id of ['column-search','column-category','column-prev','column-next'])assert.ok(board.includes('id="'+id+'"'));assert.ok(board.includes(articles[key][0].slug));
 const article=renderSite(key,{path:'/column/'+articles[key][0].slug+'/'});assert.match(article,/class="key-sentence"/);assert.ok(!article.includes('undefined'));
 console.log('PASS',key,'7-question profile, 13 services, column board and article emphasis');
}
assert.equal(inline('<script>bad</script>'),'&lt;script&gt;bad&lt;/script&gt;');assert.match(inline('::강조:: __밑줄__ ;;색상;;'),/<mark>강조<\/mark>/);assert.match(paragraphs(['첫 문장입니다. 다음 문장입니다. 세 번째입니다.']),/key-sentence/);
console.log('PASS safe inline formatting');
