/**
 * fix-encoding.js — Converte caracteres Latin-1 (Windows-1252) para UTF-8 correto
 * Uso: node fix-encoding.js
 */
const fs   = require('fs');
const path = require('path');

function fixEncoding(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length) {
    const b = buf[i];
    if (b < 0x80) { out.push(b); i++; continue; }

    // 4-byte sequence F0-F7
    if (b >= 0xF0 && b <= 0xF7 && i + 3 < buf.length) {
      const [b2,b3,b4] = [buf[i+1],buf[i+2],buf[i+3]];
      if ((b2&0xC0)===0x80 && (b3&0xC0)===0x80 && (b4&0xC0)===0x80) {
        out.push(b,b2,b3,b4); i+=4; continue;
      }
    }
    // 3-byte sequence E0-EF
    if (b >= 0xE0 && b <= 0xEF && i + 2 < buf.length) {
      const [b2,b3] = [buf[i+1],buf[i+2]];
      if ((b2&0xC0)===0x80 && (b3&0xC0)===0x80) {
        out.push(b,b2,b3); i+=3; continue;
      }
    }
    // 2-byte sequence C2-DF
    if (b >= 0xC2 && b <= 0xDF && i + 1 < buf.length) {
      const b2 = buf[i+1];
      if ((b2&0xC0)===0x80) { out.push(b,b2); i+=2; continue; }
    }
    // Byte isolado Latin-1 (0x80-0xFF) — re-codifica como UTF-8
    out.push(0xC0 | (b >> 6), 0x80 | (b & 0x3F));
    i++;
  }
  return Buffer.from(out);
}

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
let fixed = 0;

files.forEach(f => {
  const fp = path.join(dir, f);
  const orig = fs.readFileSync(fp);
  const result = fixEncoding(orig);
  if (!orig.equals(result)) {
    fs.writeFileSync(fp, result);
    console.log('  Corrigido:', f);
    fixed++;
  } else {
    console.log('  OK (sem alteração):', f);
  }
});

console.log(`\nFeito! ${fixed} arquivo(s) corrigido(s).`);
