import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {articles} from '../lib/subsites/articles.mjs';
const cli='C:/Users/c/AppData/Local/Microsoft/WinGet/Packages/Anthropic.ClaudeCode_Microsoft.Winget.Source_8wekyb3d8bbwe/claude.exe';
if(!fs.existsSync(cli))throw Error('Existing Claude CLI unavailable');
const dir='content/industry-queue';fs.mkdirSync(dir,{recursive:true});
const day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});
const all=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(`${dir}/${f}`,'utf8')));
for(const site of Object.keys(articles)){
 const queued=all.filter(x=>x.site===site&&!articles[site].some(a=>a.slug===x.article?.slug));
 if(queued.length>=4)continue;
 const prompt=`Write ${4-queued.length} distinct Korean marketing articles for ${site}. Audience: business owners buying website production and marketing, not consumers buying their services. Read lib/subsites/articles.mjs for exact article schema and avoid all existing topics. Write ONLY JSON files to content/industry-queue/${site}-<unique-slug>.json. Wrapper: {site:'${site}',approved:false,publishAt:'${day}',article:{slug,title,description,category,summary,sections:[{heading,paragraphs}],checklist}}. Valid JSON double quotes. At least 2400 Korean characters of useful body per article, short paragraphs, concrete operational examples clearly labeled hypothetical, no invented clients/results, no ranking guarantees. Do not invent sources. Avoid medical/legal/insurance advice. Existing pending titles: ${queued.map(x=>x.article.title).join('; ')}. No git or shell actions. Return file names.`;
 const result=spawnSync(cli,['-p',prompt,'--permission-mode','acceptEdits','--allowedTools','Read,Write,Glob,Grep'],{encoding:'utf8',timeout:900000,windowsHide:true,maxBuffer:1024*1024*8});
 if(result.status!==0)throw Error(`Draft generation failed: ${site}; review CLI login or subscription`);
 console.log(`Drafts prepared for ${site}; editorial review required`);
}
