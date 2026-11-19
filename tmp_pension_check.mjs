import fs from 'fs';
const j = JSON.parse(fs.readFileSync('content/queue/pension-homepage-production.json', 'utf8'));
let t = '';
for (const b of j.body) {
  if (typeof b === 'string') { t += b; continue; }
  if (b.title) t += b.title;
  if (b.text) t += b.text;
  if (b.caption) t += b.caption;
  if (b.headers) t += b.headers.join('');
  if (b.rows) for (const r of b.rows) t += r.join('');
  if (b.items) for (const i of b.items) {
    if (typeof i === 'string') t += i;
    else t += (i.q || '') + (i.a || '') + (i.title || '') + (i.text || '');
  }
}
const pure = t.replace(/\*\*|__|::|;;/g, '').replace(/\s/g, '');
const c = (s) => (t.split(s).length - 1) / 2;
console.log('title', j.title.length, 'desc', j.description.length);
console.log('pure chars', pure.length);
console.log('headings', j.body.filter(b => b.type === 'heading').length);
console.log('types', j.body.map(b => typeof b === 'string' ? 'p' : b.type).join(','));
console.log('highlight', c('::'), 'warn', c(';;'), 'underline', c('__'));
console.log('excl', (t.match(/!/g) || []).length);
console.log('rows ok', j.body.filter(b => b.type === 'table').every(b => b.rows.every(r => r.length === b.headers.length)));
console.log('faq items', j.body.find(b => b.type === 'faq').items.length);
console.log('first/last', j.body[0].type, typeof j.body[j.body.length - 1], j.body[j.body.length - 2].type);
console.log('1인칭', (t.match(/저는|저희|제가|말씀드/g) || []).length);
