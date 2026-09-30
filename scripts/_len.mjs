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
const slug = process.argv[2];
const cols = JSON.parse(fs.readFileSync('data/columns.json', 'utf8'));
const arr = Array.isArray(cols) ? cols : (cols.columns || cols.items);
const orig = arr.find((x) => x.slug === slug);
const before = n(plainText(orig.body));
console.log('before', before, 'floor85', Math.ceil(before * 0.85), 'ceil', 9500);
const f = `content/voice/${slug}.json`;
if (fs.existsSync(f)) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const t = plainText(d.body);
  const fp = (t.match(/저는|제가|저희는|저희가|저희|제 경험|상담에서/g) || []).length;
  let headings = 0, faq = 0, tables = 0;
  d.body.forEach((b) => {
    if (b && b.type === 'heading') headings++;
    if (b && b.type === 'faq') { faq = b.items.length; b.items.forEach((x) => { if (n(x.a) < 60) console.log('SHORT FAQ:', x.q); }); }
    if (b && b.type === 'table') tables++;
  });
  console.log('after', n(t), 'ratio', Math.round(n(t) / before * 100) + '%', '1인칭', fp, 'headings', headings, 'faq', faq, 'tables', tables);
  console.log('title', n(d.title), 'desc', n(d.description), 'first', d.body[0]?.type);
  const BANNED = ['100%', '무조건', '보장합니다', '수익 보장', '1위 보장', '최저가', '국내 최고', '업계 1위', '반드시 상위노출', '상위노출 보장', '무조건 1페이지'];
  for (const w of BANNED) if (t.includes(w) || String(d.title).includes(w)) console.log('BANNED:', w);
}
