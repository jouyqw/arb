import fs from 'node:fs';
import {articles} from '../lib/subsites/articles.mjs';
const day = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const queue = 'content/industry-queue';
fs.mkdirSync(queue,{recursive:true});
const pending=fs.readdirSync(queue).filter(f=>f.endsWith('.json')).sort().map(file=>({file,...JSON.parse(fs.readFileSync(`${queue}/${file}`,'utf8'))}));
let count=0;const missing=[];
for(const site of Object.keys(articles)){
 const today=articles[site].filter(a=>a.datePublished===day).length;
 const selected=pending.filter(x=>x.site===site&&x.approved===true&&x.publishAt<=day&&!articles[site].some(a=>a.slug===x.article?.slug)).slice(0,Math.max(0,2-today));
 for(const item of selected){
  const a=item.article;
  if(!/^[a-z0-9-]+$/.test(a.slug)||!a.title||!a.description||!a.category||!Array.isArray(a.summary)||!Array.isArray(a.checklist)||!Array.isArray(a.sections)||a.sections.some(s=>!s.heading||!Array.isArray(s.paragraphs))||a.sections.flatMap(s=>s.paragraphs).join('').length<2400)throw Error(`Invalid article: ${item.file}`);
 }
 if(today+selected.length<2)missing.push(site);
 for(const item of selected){articles[site].unshift({...item.article,datePublished:day,dateModified:day});count++;}
}
if(count)fs.writeFileSync('lib/subsites/articles.mjs',`// Reviewed industry articles.\nexport const articles = ${JSON.stringify(articles,null,2)};\n`);
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`published=${count}\n`);
console.log(JSON.stringify({day,published:count,underTarget:missing}));
if(missing.length)console.log(`::warning::Approved queue needs replenishment: ${missing.join(', ')}`);
