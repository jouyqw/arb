import fs from 'fs';

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
const [file, slug] = process.argv.slice(2);
let d = JSON.parse(fs.readFileSync(file, 'utf8'));
if (slug) {
  const arr = Array.isArray(d) ? d : (d.columns || d.items || []);
  d = arr.find((x) => x.slug === slug);
}
const t = plainText(d.body);
const headings = d.body.filter((b) => b && b.type === 'heading').length;
const faq = d.body.find((b) => b && b.type === 'faq');
console.log('chars', n(t));
console.log('firstPerson', (t.match(/저는|제가|저희는|저희가|저희|제 경험|상담에서/g) || []).length);
console.log('title', n(d.title), 'desc', n(d.description));
console.log('headings', headings, 'faq', faq ? faq.items.length : 0,
  'faqMinA', faq ? Math.min(...faq.items.map((x) => n(x.a))) : 0);
console.log('first block', d.body[0] && d.body[0].type);
const BANNED = ['100%', '무조건', '보장합니다', '수익 보장', '1위 보장', '최저가', '국내 최고',
  '업계 1위', '반드시 상위노출', '상위노출 보장', '무조건 1페이지'];
console.log('banned', BANNED.filter((w) => t.includes(w) || String(d.title).includes(w)));
