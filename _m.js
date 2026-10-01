const fs = require('fs');
function walk(b) {
  if (typeof b === 'string') return b;
  let s = '';
  for (const p of ['title', 'text', 'label', 'caption', 'q', 'a']) if (b[p]) s += b[p];
  if (b.items) for (const i of b.items) s += walk(i);
  if (b.headers) s += b.headers.join('');
  if (b.rows) for (const r of b.rows) s += r.join('');
  return s;
}
for (const f of process.argv.slice(2)) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  let tot = 0, prose = 0, headings = 0;
  for (const b of j.body) {
    tot += walk(b).length;
    if (typeof b === 'string') prose += b.length;
    if (b && b.type === 'heading') headings++;
  }
  console.log(f.split(/[\\/]/).pop(), 'all=' + tot, 'prose=' + prose, 'headings=' + headings);
}
