import sharp from 'sharp';

const chips = [
  ['Roblox', 64, 158],
  ['Minecraft', 238, 206],
  ['Unity', 460, 140],
  ['สตรีมเมอร์มือใหม่', 616, 300],
];
const artwork = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
<defs>
  <linearGradient id="bg" x2="1" y2="1"><stop stop-color="#090710"/><stop offset=".55" stop-color="#20102f"/><stop offset="1" stop-color="#510d4c"/></linearGradient>
  <linearGradient id="accent"><stop stop-color="#d798ff"/><stop offset=".5" stop-color="#e879f9"/><stop offset="1" stop-color="#ff49cf"/></linearGradient>
  <radialGradient id="glow"><stop stop-color="#c026d3" stop-opacity=".2"/><stop offset="1" stop-color="#c026d3" stop-opacity="0"/></radialGradient>
  <pattern id="dots" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#e879f9" opacity=".16"/></pattern>
</defs>
<rect width="1200" height="630" fill="url(#bg)"/>
<rect width="1200" height="630" fill="url(#dots)"/>
<path d="M900 0H1200V630H1090L750 0" fill="#d946ef" opacity=".045"/>
<ellipse cx="958" cy="258" rx="270" ry="230" fill="url(#glow)"/>
<path d="M64 112H164" stroke="#e879f9" stroke-width="3" stroke-linecap="round"/>
<g font-family="Thonburi, sans-serif">
  <text x="64" y="84" font-family="Arial,sans-serif" font-style="italic" font-size="28" font-weight="bold" letter-spacing="1" fill="#f0abfc">JUDY ENTERTAINMENT</text>
  <text x="64" y="182" font-size="52" font-weight="bold" fill="#fff">สังกัด</text>
  <text x="64" y="290" font-family="Arial,sans-serif" font-size="96" font-weight="bold" fill="url(#accent)">TikTok Live</text>
  <text x="64" y="390" font-size="84" font-weight="bold" fill="#fff">สายเกม</text>
  <text x="64" y="454" font-size="29" fill="#e4d5ec">เกมที่เชื่อมต่อของขวัญได้ พร้อมทีมซัพพอร์ต</text>
  <text x="64" y="498" font-size="29" fill="#e4d5ec">ดูแลตั้งแต่เริ่มไลฟ์ เติบโตไปด้วยกัน</text>
  ${chips.map(([text,x,width]) => `<rect x="${x}" y="540" width="${width}" height="48" rx="13" fill="#fff" fill-opacity=".07" stroke="#e879f9" stroke-opacity=".3"/><text x="${x + width/2}" y="572" text-anchor="middle" font-size="23" font-weight="bold" fill="#f5e5fc">${text}</text>`).join('')}
</g>
</svg>`;
// Screen removes the artwork's black background while preserving its original neon glow.
const logo = await sharp('public/brand/judy-entertainment.png')
  .trim({ background: '#000000', threshold: 20 })
  .resize({ width: 400 })
  .png().toBuffer();
await sharp(Buffer.from(artwork))
  .composite([{ input: logo, left: 752, top: 138, blend: 'screen' }])
  .jpeg({ quality: 93 }).toFile('public/og-judy-v4.jpg');
const {width,height} = await sharp('public/og-judy-v4.jpg').metadata();
if(width !== 1200 || height !== 630) throw new Error('Invalid share card dimensions');
console.log('Created JUDY share card (1200 × 630).');
