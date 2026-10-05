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

const file = process.argv[2];
const slug = process.argv[3];
let d = JSON.parse(fs.readFileSync(file, 'utf8'));
if (slug) {
  const arr = Array.isArray(d) ? d : (d.columns || d.items || d.posts);
  d = arr.find((x) => x.slug === slug);
}
const t = plainText(d.body);
let headings = 0, faq = 0, tables = 0, summary = false;
for (const b of d.body) {
  if (typeof b !== 'string' && b) {
    if (b.type === 'heading') headings++;
    if (b.type === 'faq') { faq = b.items.length; b.items.forEach((x, i) => { if (n(x.a) < 60) console.log('  !! faq', i, 'a', n(x.a), '자'); }); }
    if (b.type === 'table') tables++;
    if (b.type === 'summary') summary = true;
  }
}
console.log(file);
console.log('title', n(d.title), '(18~48)');
console.log('desc', n(d.description), '(80~160)');
console.log('body', n(t), '(<=9500)');
console.log('firstPerson', fp(t), '(>=6)');
console.log('headings', headings, 'faq', faq, 'tables', tables, 'summary', summary, 'first=summary', d.body[0]?.type === 'summary');
const BANNED = ['100%', '무조건', '보장합니다', '수익 보장', '1위 보장', '최저가', '국내 최고', '업계 1위', '반드시 상위노출', '상위노출 보장', '무조건 1페이지'];
for (const w of BANNED) if (t.includes(w) || String(d.title).includes(w)) console.log('  !! banned:', w);
