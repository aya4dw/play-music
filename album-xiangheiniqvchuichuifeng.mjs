import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);
const CLI = new URL('./dist/index.js', import.meta.url).pathname;

const album = {
  artist: '张学友',
  artistEn: 'Jacky Cheung',
  name: '想和你去吹吹风',
  nameEn: 'Want to Feel the Breeze With You',
  tracks: [
    { cn: '想和你去吹吹风', en: 'Want to Feel the Breeze With You' },
    { cn: '三天两夜', en: 'Three Days and Two Nights' },
    { cn: '自由', en: 'Freedom' },
    { cn: '台北不是伤心地', en: 'Taipei Is Not a Sad Place' },
    { cn: '火花', en: 'Spark' },
    { cn: '隐形眼镜', en: 'Contact Lenses' },
    { cn: '纽约的司机驾着北京的梦', en: 'New York Driver Driving Beijing Dream' },
    { cn: '演', en: 'Acting' },
    { cn: '毛衣', en: 'Sweater' },
    { cn: '什么世界', en: 'What World' },
  ]
};

const outDir = path.join(process.env.HOME || process.env.USERPROFILE, 'Music', `${album.artist} - ${album.name}`);

async function downloadAlbum() {
  fs.mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < album.tracks.length; i++) {
    const track = album.tracks[i];
    const num = String(i + 1).padStart(2, '0');
    const query = `${track.cn} ${album.artist}`;
    console.log(`\n[${num}/10] ${track.cn}`);

    let savedPath = null;
    try {
      const { stdout } = await execFileAsync('node', [CLI, 'download', query, '-b', 'flac', '-o', outDir], { timeout: 300000 });
      const match = stdout.match(/Saved to:\s*(.+)/);
      if (match) {
        savedPath = match[1].trim();
        console.log(`  ✓ ${path.basename(savedPath)}`);
      } else {
        console.log(`  ✗ Trying cross-source...`);
        const { stdout: stdout2 } = await execFileAsync('node', [CLI, 'download', query, '-o', outDir], { timeout: 300000 });
        const match2 = stdout2.match(/Saved to:\s*(.+)/);
        if (match2) {
          savedPath = match2[1].trim();
          console.log(`  ✓ ${path.basename(savedPath)}`);
        } else {
          console.log(`  ✗ Failed`);
        }
      }
    } catch (e) {
      console.log(`  ✗ Error: ${e.message}`);
    }
  }

  console.log('\n--- Matching files to tracks ---');
  const allFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.flac'));
  console.log(`Found ${allFiles.length} files:`);
  allFiles.forEach(f => console.log(`  ${f}`));

  console.log('\n--- Renaming with track numbers ---');
  for (let i = 0; i < album.tracks.length; i++) {
    const track = album.tracks[i];
    const num = String(i + 1).padStart(2, '0');
    const newName = `${num} ${track.cn}.flac`;

    const matchedFile = allFiles.find(f => {
      const nameWithoutExt = f.replace('.flac', '');
      return nameWithoutExt.includes(track.cn);
    });

    if (matchedFile) {
      const oldPath = path.join(outDir, matchedFile);
      const newPath = path.join(outDir, newName);
      if (matchedFile !== newName) {
        fs.renameSync(oldPath, newPath);
        console.log(`  ${matchedFile} → ${newName}`);
      } else {
        console.log(`  (already correct) ${newName}`);
      }
    } else {
      console.log(`  ✗ No match for: ${track.cn}`);
    }
  }

  console.log('\n--- Writing FLAC tags ---');
  const taggedFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.flac')).sort();

  for (let i = 0; i < taggedFiles.length; i++) {
    const file = taggedFiles[i];
    const filePath = path.join(outDir, file);

    const buf = fs.readFileSync(filePath);
    const header = buf.toString('ascii', 0, 4);
    if (header !== 'fLaC') {
      console.log(`  SKIP ${file} - not FLAC`);
      continue;
    }

    const trackNum = String(i + 1).padStart(2, '0');
    const trackInfo = album.tracks[i] || { cn: file.replace(/^\d+\s*/, '').replace('.flac', ''), en: '' };

    const vorbisCommentType = 4;
    let pos = 4;
    let found = false;

    while (pos < buf.length - 4) {
      const byte0 = buf[pos];
      const isLast = (byte0 & 0x80) !== 0;
      const type = byte0 & 0x7F;
      const length = (buf[pos+1] << 16) | (buf[pos+2] << 8) | buf[pos+3];
      const headerSize = 4;
      const blockStart = pos + headerSize;

      if (type === vorbisCommentType) {
        const blockData = buf.slice(blockStart, blockStart + length);

        const vendorLen = blockData.readUInt32LE(0);
        let cpos = 4 + vendorLen;

        const userCommentListLen = blockData.readUInt32LE(cpos);
        cpos += 4;

        const existingComments = [];
        for (let j = 0; j < userCommentListLen; j++) {
          if (cpos >= blockData.length) break;
          const commentLen = blockData.readUInt32LE(cpos);
          cpos += 4;
          if (cpos + commentLen > blockData.length) break;
          const comment = blockData.slice(cpos, cpos + commentLen).toString('utf8');
          cpos += commentLen;
          const key = comment.split('=')[0].toUpperCase();
          if (key !== 'TITLE' && key !== 'ARTIST' && key !== 'ALBUM' && key !== 'TRACKNUMBER') {
            existingComments.push(comment);
          }
        }

        const newTags = [
          `TITLE=${trackInfo.cn}`,
          `ARTIST=${album.artist}`,
          `ALBUM=${album.name}`,
          `TRACKNUMBER=${trackNum}`
        ];

        const allComments = [...existingComments, ...newTags, 'ENCODER=play-music'];

        let wpos = 0;
        const vendorBuf = blockData.slice(4, 4 + vendorLen);
        const totalCommentLen = allComments.reduce((acc, c) => acc + 4 + Buffer.byteLength(c, 'utf8'), 0);
        const newBlockDataLen = 4 + 4 + vendorBuf.length + totalCommentLen;
        const newBlockData = Buffer.alloc(newBlockDataLen);

        newBlockData.writeUInt32LE(vendorLen, wpos); wpos += 4;
        vendorBuf.copy(newBlockData, wpos); wpos += vendorLen;
        newBlockData.writeUInt32LE(allComments.length, wpos); wpos += 4;

        for (const c of allComments) {
          const cBuf = Buffer.from(c, 'utf8');
          newBlockData.writeUInt32LE(cBuf.length, wpos); wpos += 4;
          cBuf.copy(newBlockData, wpos); wpos += cBuf.length;
        }

        const newBlock = Buffer.alloc(headerSize + newBlockDataLen);
        newBlock[0] = vorbisCommentType | (isLast ? 0x80 : 0);
        newBlock[1] = (newBlockDataLen >> 16) & 0xFF;
        newBlock[2] = (newBlockDataLen >> 8) & 0xFF;
        newBlock[3] = newBlockDataLen & 0xFF;
        newBlockData.copy(newBlock, headerSize);

        const before = buf.slice(0, pos);
        const after = buf.slice(blockStart + length);
        const newFlac = Buffer.concat([before, newBlock, after]);
        fs.writeFileSync(filePath, newFlac);

        console.log(`  ✓ ${file} → TITLE="${trackInfo.cn}" TRACKNUMBER=${trackNum}`);
        found = true;
        break;
      }

      pos += headerSize + length;
      if (isLast) break;
    }

    if (!found) {
      console.log(`  ✗ ${file} - Vorbis Comment not found`);
    }
  }

  console.log(`\nDone! ${outDir}`);
}

downloadAlbum().catch(console.error);
