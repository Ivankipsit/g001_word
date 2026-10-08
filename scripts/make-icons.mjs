import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

function svgFor(size) {
  const r = Math.round(size * 0.22);
  const font = Math.round(size * 0.42);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3D8F8F"/>
      <stop offset="100%" stop-color="#1E5252"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="${font}" fill="#F7F4EF">W</text>
</svg>`;
}

for (const size of [192, 512]) {
  const svg = Buffer.from(svgFor(size));
  await sharp(svg).png().toFile(path.join(outDir, `icon-${size}.png`));
  console.log(`Wrote icon-${size}.png`);
}
