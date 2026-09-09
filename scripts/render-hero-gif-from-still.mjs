import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const gifencPath = process.env.GIFENC_ESM || 'node_modules/gifenc/dist/gifenc.esm.js';
const pngjsPath = process.env.PNGJS_CJS || 'node_modules/pngjs/lib/png.js';
const { GIFEncoder, quantize, applyPalette } = await import(pathToFileURL(resolve(gifencPath)).href);
const { PNG } = await import(pathToFileURL(resolve(pngjsPath)).href);

const input = resolve(process.argv[2] || 'assets/hero/ad-showreel-source.png');
const out = resolve(process.argv[3] || 'assets/hero/ad-showreel.gif');
const width = 520;
const height = 520;
const frames = 52;
const delay = 46;

const src = PNG.sync.read(await readFile(input));

function clamp(v) {
  return Math.max(0, Math.min(255, v));
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function sample(img, x, y) {
  const xx = Math.max(0, Math.min(img.width - 1, x));
  const yy = Math.max(0, Math.min(img.height - 1, y));
  const x0 = Math.floor(xx), y0 = Math.floor(yy);
  const x1 = Math.min(img.width - 1, x0 + 1), y1 = Math.min(img.height - 1, y0 + 1);
  const tx = xx - x0, ty = yy - y0;
  const i00 = (y0 * img.width + x0) * 4;
  const i10 = (y0 * img.width + x1) * 4;
  const i01 = (y1 * img.width + x0) * 4;
  const i11 = (y1 * img.width + x1) * 4;
  const c = [0, 0, 0, 255];
  for (let k = 0; k < 3; k++) {
    const a = img.data[i00 + k] * (1 - tx) + img.data[i10 + k] * tx;
    const b = img.data[i01 + k] * (1 - tx) + img.data[i11 + k] * tx;
    c[k] = a * (1 - ty) + b * ty;
  }
  return c;
}

function blend(data, i, r, g, b, a) {
  const inv = 1 - a;
  data[i] = clamp(data[i] * inv + r * a);
  data[i + 1] = clamp(data[i + 1] * inv + g * a);
  data[i + 2] = clamp(data[i + 2] * inv + b * a);
  data[i + 3] = 255;
}

function rect(data, x, y, w, h, color, radius = 0) {
  const [r, g, b, a = 1] = color;
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(width, Math.ceil(x + w));
  const y1 = Math.min(height, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      if (radius) {
        const dx = xx < x + radius ? x + radius - xx : xx > x + w - radius ? xx - (x + w - radius) : 0;
        const dy = yy < y + radius ? y + radius - yy : yy > y + h - radius ? yy - (y + h - radius) : 0;
        if (dx * dx + dy * dy > radius * radius) continue;
      }
      blend(data, (yy * width + xx) * 4, r, g, b, a);
    }
  }
}

function circle(data, cx, cy, rad, color) {
  const [r, g, b, a = 1] = color;
  const x0 = Math.max(0, Math.floor(cx - rad));
  const y0 = Math.max(0, Math.floor(cy - rad));
  const x1 = Math.min(width, Math.ceil(cx + rad));
  const y1 = Math.min(height, Math.ceil(cy + rad));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const d = Math.hypot(x - cx, y - cy) / rad;
      if (d > 1) continue;
      blend(data, (y * width + x) * 4, r, g, b, a * (1 - d) * (1 - d));
    }
  }
}

function makeFrame(n) {
  const t = n / frames;
  const phase = Math.sin(t * Math.PI * 2);
  const pulse = (Math.sin(t * Math.PI * 4) + 1) / 2;
  const data = new Uint8Array(width * height * 4);
  const zoom = 1.05 + 0.055 * pulse;
  const srcSize = Math.min(src.width, src.height) / zoom;
  const cx = src.width * (.52 + .018 * phase);
  const cy = src.height * (.5 + .014 * Math.cos(t * Math.PI * 2));
  const sx0 = cx - srcSize / 2;
  const sy0 = cy - srcSize / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = sx0 + (x / width) * srcSize;
      const sy = sy0 + (y / height) * srcSize;
      const c = sample(src, sx, sy);
      const i = (y * width + x) * 4;
      const vignette = smoothstep(.24, .82, Math.hypot(x / width - .5, y / height - .5));
      data[i] = clamp(c[0] * (1 - .34 * vignette) + 5);
      data[i + 1] = clamp(c[1] * (1 - .3 * vignette) + 8);
      data[i + 2] = clamp(c[2] * (1 - .18 * vignette) + 16);
      data[i + 3] = 255;
    }
  }

  const sweep = ((t * 1.15) % 1) * 760 - 90;
  rect(data, sweep, 0, 62, height, [118, 219, 255, .12], 0);
  circle(data, 470 - phase * 48, 150 + pulse * 28, 170, [70, 202, 255, .24]);
  circle(data, 158 + phase * 44, 468 - pulse * 32, 150, [255, 54, 106, .14]);

  const yBase = 512;
  const play = 36 + ((width - 72) * ((t * 1.8) % 1));
  rect(data, 44, yBase, width - 88, 9, [255, 255, 255, .16], 5);
  rect(data, 44, yBase, play - 44, 9, [83, 197, 255, .7], 5);
  rect(data, play - 3, yBase - 6, 6, 21, [255, 255, 255, .86], 3);

  for (let i = 0; i < 4; i++) {
    const x = 70 + i * 122;
    const h = 22 + Math.sin(t * Math.PI * 2 + i) * 10 + i * 3;
    rect(data, x, 548 - h, 66, h, i % 2 ? [255, 65, 103, .46] : [82, 202, 255, .48], 8);
  }

  return data;
}

await mkdir(dirname(out), { recursive: true });
const gif = GIFEncoder();
for (let i = 0; i < frames; i++) {
  const data = makeFrame(i);
  const palette = quantize(data, 128, { format: 'rgb565' });
  const index = applyPalette(data, palette);
  gif.writeFrame(index, width, height, { palette, delay });
}
gif.finish();
await writeFile(out, gif.bytes());
console.log(out);
