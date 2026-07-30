import fs from 'fs';
import path from 'path';

function readFlacTags(filePath) {
  const buf = fs.readFileSync(filePath);
  let pos = 4;
  for (let i = 0; i < 10; i++) {
    const type = buf[pos] & 0x7F;
    const len = (buf[pos+1] << 16) | (buf[pos+2] << 8) | buf[pos+3];
    if (type === 4) {
      const data = buf.slice(pos + 4, pos + 4 + len);
      let p = 0;
      const vendorLen = data.readUInt32LE(p); p += 4 + vendorLen;
      const count = data.readUInt32LE(p); p += 4;
      const tags = {};
      for (let j = 0; j < count; j++) {
        const l = data.readUInt32LE(p); p += 4;
        const s = data.slice(p, p + l).toString('utf8');
        const eq = s.indexOf('=');
        if (eq > 0) { const k = s.substring(0, eq).toUpperCase(); if (!tags[k]) tags[k] = s.substring(eq + 1); }
        p += l;
      }
      return tags;
    }
    pos += 4 + len;
  }
  return {};
}

function esc(s) { return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }

// 中文歌名 → 英文映射（Wikipedia 官方英文名）
const enMap = {
  '黑色柳丁': 'Black Tangerine',
  'Melody': 'Melody',
  '蝴蝶': 'Butterfly',
  '讨厌红楼梦': "Let's Fall in Love",
  '二十二': '22',
  '月亮代表谁的心': 'Moon Over My Heart',
  'Dear God': 'Dear God',
  '宫保鸡丁': 'Kung Pao Chicken',
  'My Anata': 'My Anata',
  'Angel': 'Angel',
  'Katrina': 'Katrina',
  '摇篮曲': 'Lullaby',
  'Katrina (Demo)': 'Katrina (Demo)'
};

function generateToc(albumDir) {
  const files = fs.readdirSync(albumDir).filter(f => f.endsWith('.flac')).sort();
  if (!files.length) { console.log('No FLAC files'); return; }

  const firstTags = readFlacTags(path.join(albumDir, files[0]));
  const albumTitle = enMap[firstTags.ALBUM] || 'Unknown Album';
  const performer = firstTags.ARTIST === '陶喆' ? 'David Tao' : (firstTags.ARTIST || 'Unknown');

  let toc = `CD_DA\n\nCD_TEXT {\n  LANGUAGE_MAP {\n    0 : EN\n  }\n\n  LANGUAGE 0 {\n    TITLE "${esc(albumTitle)}"\n    PERFORMER "${esc(performer)}"\n  }\n}\n`;

  for (const file of files) {
    const tags = readFlacTags(path.join(albumDir, file));
    const cnTitle = tags.TITLE || path.basename(file, '.flac');
    const enTitle = enMap[cnTitle] || cnTitle;
    const artist = tags.ARTIST === '陶喆' ? 'David Tao' : (tags.ARTIST || performer);

    toc += `\nTRACK AUDIO\nCD_TEXT {\n  LANGUAGE 0 {\n    TITLE "${esc(enTitle)}"\n    PERFORMER "${esc(artist)}"\n  }\n}\nFILE "${file}" 0\n`;
  }

  const tocPath = path.join(albumDir, 'album.toc');
  fs.writeFileSync(tocPath, toc, 'utf8');
  console.log(`Generated: ${tocPath}`);
  console.log(`Album: ${albumTitle}`);
  console.log(`Performer: ${performer}`);
  console.log(`Tracks: ${files.length}`);
  console.log('\nTOC content:\n');
  console.log(toc);
}

const albumDir = process.argv[2] || '.';
generateToc(albumDir);
