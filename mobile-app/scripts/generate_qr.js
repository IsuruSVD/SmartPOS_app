const { toQR } = require('toqr');
const fs = require('fs');

const url = process.argv[2] || 'exps://c-isurusvd-cawxof-mwlxhaq6rpkurtoi.on.expo.app';
const qr = toQR(url);
const side = Math.round(Math.sqrt(qr.length));
const scale = 12;
const margin = 4;
const totalSide = (side + margin * 2) * scale;

// Create SVG or write array to stdout
const rects = [];
for (let r = 0; r < side; r++) {
  for (let c = 0; c < side; c++) {
    if (qr[r * side + c] !== 0) {
      rects.push(`<rect x="${(c + margin) * scale}" y="${(r + margin) * scale}" width="${scale}" height="${scale}" fill="black"/>`);
    }
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalSide}" height="${totalSide}" viewBox="0 0 ${totalSide} ${totalSide}">
  <rect width="100%" height="100%" fill="white"/>
  ${rects.join('\n  ')}
</svg>`;

fs.writeFileSync('C:/Users/isuru/OpenBot/Shared/smartpos-sdk58-tunnel-qr.svg', svg);
console.log('Saved SVG QR code to C:/Users/isuru/OpenBot/Shared/smartpos-sdk58-tunnel-qr.svg');
