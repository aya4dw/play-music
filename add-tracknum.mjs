import fs from 'fs';
import path from 'path';

const dir = 'C:\\Users\\weidi\\Music\\陶喆 - 黑色柳丁';

const trackMap = {
  '陶喆 - 黑色柳丁.flac': 1,
  '陶喆 - Melody.flac': 2,
  '陶喆 - 蝴蝶.flac': 3,
  '陶喆 - 讨厌红楼梦.flac': 4,
  '陶喆 - 二十二.flac': 5,
  '陶喆 - 月亮代表谁的心.flac': 6,
  '陶喆 - Dear God.flac': 7,
  '陶喆 - 宫保鸡丁.flac': 8,
  '陶喆 - My Anata.flac': 9,
  '陶喆 - Angel.flac': 10,
  '陶喆 - Katrina (Demo).flac': 11,
  '陶喆 - 摇篮曲.flac': 12
};

function addTrackNumber(filePath, trackNum) {
  const buf = fs.readFileSync(filePath);

  // Parse metadata blocks
  let pos = 4; // skip "fLaC"
  let vorbisStart = -1;
  let vorbisLen = 0;
  let blocks = [];

  while (pos < buf.length - 4) {
    const isLast = (buf[pos] >> 7) & 1;
    const type = buf[pos] & 0x7F;
    const len = (buf[pos+1] << 16) | (buf[pos+2] << 8) | buf[pos+3];

    if (type === 4) { // VORBIS_COMMENT
      vorbisStart = pos;
      vorbisLen = len;

      // Parse existing comments
      const data = buf.slice(pos + 4, pos + 4 + len);
      let p = 0;
      const vendorLen = data.readUInt32LE(p);
      p += 4;
      const vendor = data.slice(p, p + vendorLen);
      p += vendorLen;
      const count = data.readUInt32LE(p);
      p += 4;

      const comments = [];
      for (let i = 0; i < count; i++) {
        const l = data.readUInt32LE(p);
        p += 4;
        comments.push(data.slice(p, p + l).toString('utf8'));
        p += l;
      }

      // Add TRACKNUMBER if not present
      const hasTrack = comments.some(c => c.startsWith('TRACKNUMBER='));
      if (!hasTrack) {
        comments.push(`TRACKNUMBER=${trackNum}`);
        console.log(`  Added TRACKNUMBER=${trackNum}`);
      }

      // Rebuild Vorbis comment block
      const newComments = comments.map(c => Buffer.from(c, 'utf8'));
      const commentListLen = newComments.reduce((sum, b) => sum + 4 + b.length, 0);
      const newBlockLen = 4 + vendorLen + 4 + commentListLen;
      const newBlock = Buffer.alloc(4 + newBlockLen);

      // Header
      newBlock[0] = isLast ? 0x84 : 0x04; // type 4 = VORBIS_COMMENT
      newBlock[1] = (newBlockLen >> 16) & 0xFF;
      newBlock[2] = (newBlockLen >> 8) & 0xFF;
      newBlock[3] = newBlockLen & 0xFF;

      // Vendor
      let wp = 4;
      newBlock.writeUInt32LE(vendorLen, wp); wp += 4;
      vendor.copy(newBlock, wp); wp += vendorLen;

      // Comment count
      newBlock.writeUInt32LE(comments.length, wp); wp += 4;

      // Comments
      for (const c of newComments) {
        newBlock.writeUInt32LE(c.length, wp); wp += 4;
        c.copy(newBlock, wp); wp += c.length;
      }

      // Rebuild file: before vorbis + newBlock + after vorbis
      const before = buf.slice(0, vorbisStart);
      const after = buf.slice(vorbisStart + 4 + vorbisLen);
      const newFile = Buffer.concat([before, newBlock, after]);
      fs.writeFileSync(filePath, newFile);
      return;
    }

    pos += 4 + len;
  }
}

// Rename and add track numbers
for (const [filename, trackNum] of Object.entries(trackMap)) {
  const filePath = path.join(dir, filename);
  if (fs.existsSync(filePath)) {
    console.log(`${filename}:`);
    addTrackNumber(filePath, trackNum);
  } else {
    console.log(`${filename}: NOT FOUND`);
  }
}

console.log('\nDone!');
