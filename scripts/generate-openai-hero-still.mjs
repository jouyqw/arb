import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const keyFile = process.argv[2] || 'C:/Users/c/Desktop/클로드코드/이커머스/open api.txt';
const out = resolve(process.argv[3] || 'assets/hero/ad-showreel-source.png');
const apiKey = (process.env.OPENAI_API_KEY || await readFile(keyFile, 'utf8')).trim();

const prompt = [
  'Premium 3D motion graphics still for a Korean digital advertising agency homepage.',
  'A sleek cinematic vertical short-form video production scene inside a glossy dark studio:',
  'floating smartphone with abstract ad creative layers, timeline strips, luminous editing panels,',
  'subtle analytics waveforms, glassmorphism surfaces, refined depth, no people.',
  'The style must feel like a high-end YouTube Shorts campaign reel that could reach millions of views,',
  'clean, expensive, modern, polished, professional, not cartoonish.',
  'Use deep navy, electric blue, cyan, small magenta accents, realistic glass, metal, and soft volumetric light.',
  'No logos, no brand names, no readable text, no watermark, no UI words, no numbers.',
  'Composition: centered hero asset with safe crop for square and mobile vertical framing.'
].join(' ');

const res = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-image-1',
    prompt,
    size: '1536x1024',
    quality: 'high',
  }),
});

if (!res.ok) {
  const text = await res.text();
  throw new Error(`OpenAI image generation failed: HTTP ${res.status} ${text.slice(0, 500)}`);
}

const json = await res.json();
const b64 = json.data?.[0]?.b64_json;
if (!b64) throw new Error('OpenAI image generation did not return b64_json.');

await mkdir(dirname(out), { recursive: true });
await writeFile(out, Buffer.from(b64, 'base64'));
console.log(out);
