import fs from 'node:fs';

const plainText = (body) => (body || []).map((b) => {
  if (typeof b === 'string') return b;
  if (!b || typeof b !== 'object') return '';
  if (b.type === 'heading') return b.text || '';
  if (b.type === 'summary' || b.type === 'list') return (b.items || []).join(' ');
  if (b.type === 'table') return [...(b.headers || []), ...(b.rows || []).flat()].join(' ');
  if (b.type === 'callout' || b.type === 'warning') return `${b.label || ''} ${b.text || ''}`;
  if (b.type === 'infographic') return (b.items || []).map((i) => `${i.title} ${i.text}`).join(' ');
  if (b.type === 'faq') return (b.items || []).map((i) => `${i.q} ${i.a}`).join(' ');
  return '';
}).join('\n');

const n = (s) => [...String(s || '')].length;
const fp = (t) => (t.match(/저는|제가|저희는|저희가|저희|제 경험|상담에서/g) || []).length;

const slug = process.argv[2];
const all = JSON.parse(fs.readFileSync('data/columns.json', 'utf8'));
const arr = Array.isArray(all) ? all : (all.columns || all.items || []);
const c = arr.find((x) => x.slug === slug);
if (c) {
  const len = n(plainText(c.body));
  console.log('ORIGINAL', len, '| min85 =', Math.ceil(len * 0.85), '| max 9500');
}
for (const f of fs.readdirSync('content/voice')) {
  const d = JSON.parse(fs.readFileSync('content/voice/' + f, 'utf8'));
  const t = plainText(d.body);
  console.log(f.padEnd(46), n(t), 'fp=' + fp(t), 'title=' + n(d.title), 'desc=' + n(d.description));
}
