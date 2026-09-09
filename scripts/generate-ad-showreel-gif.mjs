import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const gifencPath = process.env.GIFENC_ESM || 'node_modules/gifenc/dist/gifenc.esm.js';
const { GIFEncoder, quantize, applyPalette } = await import(pathToFileURL(resolve(gifencPath)).href);

const out = resolve(process.argv[2] || 'assets/hero/ad-showreel.gif');
const width = 620;
const height = 620;
const frames = 72;
const delay = 42;

function clamp(v) {
  return Math.max(0, Math.min(255, v));
}

function blend(px, i, r, g, b, a) {
  const inv = 1 - a;
  px[i] = clamp(px[i] * inv + r * a);
  px[i + 1] = clamp(px[i + 1] * inv + g * a);
  px[i + 2] = clamp(px[i + 2] * inv + b * a);
  px[i + 3] = 255;
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

function frame(t) {
  const data = new Uint8Array(width * height * 4);
  const sweep = (Math.sin(t * Math.PI * 2) + 1) / 2;
  const pulse = (Math.sin(t * Math.PI * 4) + 1) / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gx = x / width;
      const gy = y / height;
      const vignette = Math.hypot(gx - .52, gy - .45);
      data[i] = clamp(6 + 22 * gx + 12 * (1 - vignette));
      data[i + 1] = clamp(13 + 38 * gy + 18 * pulse);
      data[i + 2] = clamp(28 + 78 * gx + 92 * (1 - vignette));
      data[i + 3] = 255;
    }
  }

  circle(data, 455 - sweep * 120, 98 + pulse * 22, 210, [78, 191, 255, .72]);
  circle(data, 132 + sweep * 84, 448, 230, [40, 109, 255, .5]);
  circle(data, 450, 468 - sweep * 54, 170, [255, 65, 105, .26]);

  const phx = 214 + Math.sin(t * Math.PI * 2) * 8;
  const phy = 62 + Math.cos(t * Math.PI * 2) * 5;
  rect(data, phx - 12, phy + 18, 228, 410, [0, 0, 0, .3], 38);
  rect(data, phx, phy, 232, 418, [11, 20, 36, 1], 38);
  rect(data, phx + 9, phy + 9, 214, 400, [34, 48, 72, 1], 31);
  rect(data, phx + 21, phy + 26, 190, 366, [8, 15, 29, 1], 22);
  circle(data, phx + 143 + sweep * 14, phy + 92, 130, [65, 198, 255, .75]);
  rect(data, phx + 62, phy + 102 + pulse * 10, 118, 154, [201, 225, 255, .78], 22);
  rect(data, phx + 30, phy + 180 - pulse * 8, 148, 138, [78, 139, 238, .54], 24);
  circle(data, phx + 72, phy + 284, 72, [255, 202, 160, .62]);
  rect(data, phx + 72, phy + 22, 88, 6, [126, 213, 245, .45], 3);

  const bars = [
    [70, 72, 132, 118, 0],
    [388, 204, 148, 122, .21],
    [86, 432, 178, 102, .42],
    [340, 444, 196, 102, .63],
  ];
  for (const [x, y, w, h, off] of bars) {
    const local = (t + off) % 1;
    const yy = y + Math.sin(local * Math.PI * 2) * 11;
    rect(data, x + 5, yy + 9, w, h, [0, 0, 0, .18], 16);
    rect(data, x, yy, w, h, [19, 35, 61, .78], 16);
    rect(data, x + 16, yy + 22, w * (.42 + .38 * local), 10, [87, 198, 255, .92], 5);
    rect(data, x + 16, yy + 44, w * (.32 + .52 * (1 - local)), 10, [255, 58, 98, .92], 5);
    rect(data, x + 16, yy + 68, w * (.28 + .46 * pulse), 10, [74, 218, 144, .9], 5);
  }

  for (let i = 0; i < 5; i++) {
    const x = 22 + ((t * 760 + i * 142) % 680);
    rect(data, x - 150, 578, 110, 7, [73, 163, 255, .72], 4);
    rect(data, x - 26, 578, 70, 7, [255, 51, 95, .88], 4);
  }

  for (let n = 0; n < 1500; n++) {
    const x = (n * 47 + Math.floor(t * 1000)) % width;
    const y = (n * 83 + Math.floor(t * 700)) % height;
    const i = (y * width + x) * 4;
    const v = (n * 13) % 18;
    data[i] = clamp(data[i] + v);
    data[i + 1] = clamp(data[i + 1] + v);
    data[i + 2] = clamp(data[i + 2] + v);
  }

  return data;
}

await mkdir(dirname(out), { recursive: true });
const gif = GIFEncoder();
for (let f = 0; f < frames; f++) {
  const data = frame(f / frames);
  const palette = quantize(data, 192, { format: 'rgb565' });
  const index = applyPalette(data, palette);
  gif.writeFrame(index, width, height, { palette, delay });
}
gif.finish();
await writeFile(out, gif.bytes());
console.log(out);
