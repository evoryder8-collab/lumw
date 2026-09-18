import sharp from 'sharp';
import fs from 'node:fs/promises';

await sharp('src/assets/luma-social-cover-master.png').resize(1200, 630, { fit: 'cover' }).flatten({ background: '#14372c' }).jpeg({ quality: 90, mozjpeg: true }).toFile('public/social/luma-wellness-cover.jpg');
// Reuse the exact original brand artwork. Crop only its transparent padding.
const mark = await sharp('src/assets/logo-luma-symbol-display.webp').trim().png().toBuffer();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="15" fill="#faf7ee"/><image x="12" y="5" width="40" height="54" href="data:image/png;base64,${mark.toString('base64')}"/></svg>`;
await fs.writeFile('public/favicon.svg', svg);
for (const size of [32, 48, 180, 192, 512]) {
  const name = size === 180 ? 'apple-touch-icon.png' : size === 32 ? 'favicon-32.png' : `icon-${size}.png`;
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/${name}`);
}
// A PNG-compressed ICO fallback for browsers that request /favicon.ico directly.
const png = await sharp(Buffer.from(svg)).resize(48, 48).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header[6] = header[7] = 48;
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
await fs.writeFile('public/favicon.ico', Buffer.concat([header, png]));
console.log('Created 1200x630 sharing cover, original-symbol favicon and touch icons.');
