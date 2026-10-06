const fs = require('fs');
function texts(b, out) {
  if (typeof b === 'string') { out.push(b); return out; }
  if (Array.isArray(b)) { for (const x of b) texts(x, out); return out; }
  if (b && typeof b === 'object') {
    for (const k of Object.keys(b)) { if (k === 'type') continue; texts(b[k], out); }
    return out;
  }
  return out;
}
for (const f of process.argv.slice(2)) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const t = texts(j.body, []);
  console.log(f, 'chars=' + t.join('').length, 'blocks=' + j.body.length);
}
