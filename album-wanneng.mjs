import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);
const CLI = 'C:\\Users\\weidi\\play-music\\dist\\index.js';

const albums = [
  {
    artist: '万能青年旅店',
    artistEn: 'Wan Neng Qing Nian Lv Dian',
    name: '万能青年旅店',
    nameEn: 'Wan Neng Youth Hostel',
    tracks: [
      { cn: '狗尿馆', en: 'Dog Pee Hall' },
      { cn: '不万能的喜剧', en: 'Not Omni-Comedy' },
      { cn: '揪心的玩笑与漫长的白日梦', en: 'Heartfelt Joke and Long Daydream' },
      { cn: '大石碎胸口', en: 'Big Stone Crushes Chest' },
      { cn: '洋鸟消夏录', en: 'Ocean Birds Summer Record' },
      { cn: '秦皇岛', en: 'Qinhuangdao' },
      { cn: '十万嬉皮', en: 'Ten Thousand Hippies' },
      { cn: '杀死那个石家庄人', en: 'Kill That Person from Shijiazhuang' },
    ]
  },
  {
    artist: '万能青年旅店',
    artistEn: 'Wan Neng Qing Nian Lv Dian',
    name: '冀西南林路行',
    nameEn: 'Journey Through the Forests of Southwest Hebei',
    tracks: [
      { cn: '早', en: 'Early' },
      { cn: '泥河', en: 'Mud River' },
      { cn: '平等云雾', en: 'Equal Clouds and Fog' },
      { cn: '采石', en: 'Stone Quarrying' },
      { cn: '山雀', en: 'Mountain Tit' },
      { cn: '绕越', en: 'Detour' },
      { cn: '河北墨麒麟', en: 'Hebei Black Unicorn' },
      { cn: '郊眠寺', en: 'Jiaomian Temple' },
    ]
  }
];

async function downloadTrack(query, outDir) {
  try {
    const { stdout } = await execFileAsync('node', [CLI, 'download', query, '-b', 'flac', '-o', outDir], { timeout: 300000 });
    const match = stdout.match(/Saved to:\s*(.+)/);
    if (match) return { ok: true, file: path.basename(match[1].trim()) };
  } catch (e) {}
  try {
    const { stdout } = await execFileAsync('node', [CLI, 'download', query, '-o', outDir], { timeout: 300000 });
    const match = stdout.match(/Saved to:\s*(.+)/);
    if (match) return { ok: true, file: path.basename(match[1].trim()), cross: true };
  } catch (e) {}
  return { ok: false };
}

async function downloadAlbum(album) {
  const outDir = path.join(process.env.HOME || process.env.USERPROFILE, 'Music', `${album.artist} - ${album.name}`);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\n=== ${album.name} (${album.tracks.length} tracks) ===`);

  for (let i = 0; i < album.tracks.length; i++) {
    const track = album.tracks[i];
    const num = String(i + 1).padStart(2, '0');
    const query = `${track.cn} ${album.artist}`;
    process.stdout.write(`[${num}/${String(album.tracks.length).padStart(2, '0')}] ${track.cn}... `);

    const result = await downloadTrack(query, outDir);
    if (result.ok) {
      console.log(`✓ ${result.file}${result.cross ? ' (cross)' : ''}`);
    } else {
      console.log(`✗ FAILED`);
    }
  }

  // Rename files by matching Chinese title
  const allFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.flac'));
  for (let i = 0; i < album.tracks.length; i++) {
    const track = album.tracks[i];
    const num = String(i + 1).padStart(2, '0');
    const newName = `${num} ${track.cn}.flac`;
    const matched = allFiles.find(f => f.includes(track.cn) && f !== newName);
    if (matched) {
      const oldPath = path.join(outDir, matched);
      const newPath = path.join(outDir, newName);
      if (matched !== newName) {
        fs.renameSync(oldPath, newPath);
        console.log(`  Renamed: ${matched} → ${newName}`);
      }
    }
  }

  // Write FLAC tags
  const taggedFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.flac')).sort();
  for (let i = 0; i < taggedFiles.length; i++) {
    const file = taggedFiles[i];
    const filePath = path.join(outDir, file);
    const trackInfo = album.tracks[i];
    if (!trackInfo) continue;

    const buf = fs.readFileSync(filePath);
    if (buf.toString('ascii', 0, 4) !== 'fLaC') continue;

    let pos = 4;
    let found = false;
    while (pos < buf.length - 4) {
      const byte0 = buf[pos];
      const isLast = (byte0 & 0x80) !== 0;
      const type = byte0 & 0x7F;
      const len = (buf[pos+1] << 16) | (buf[pos+2] << 8) | buf[pos+3];
      const blockStart = pos + 4;

      if (type === 4) {
        const blockData = buf.slice(blockStart, blockStart + len);
        const vendorLen = blockData.readUInt32LE(0);
        let cpos = 4 + vendorLen;
        const count = blockData.readUInt32LE(cpos);
        cpos += 4;
        const existing = [];
        for (let j = 0; j < count; j++) {
          if (cpos >= blockData.length) break;
          const l = blockData.readUInt32LE(cpos); cpos += 4;
          if (cpos + l > blockData.length) break;
          const comment = blockData.slice(cpos, cpos + l).toString('utf8');
          cpos += l;
          const key = comment.split('=')[0].toUpperCase();
          if (!['TITLE','ARTIST','ALBUM','TRACKNUMBER'].includes(key)) existing.push(comment);
        }

        const newTags = [
          `TITLE=${trackInfo.cn}`,
          `ARTIST=${album.artist}`,
          `ALBUM=${album.name}`,
          `TRACKNUMBER=${String(i+1).padStart(2,'0')}`
        ];
        const allComments = [...existing, ...newTags, 'ENCODER=play-music'];

        const vendorBuf = blockData.slice(4, 4 + vendorLen);
        let wpos = 0;
        const totalLen = allComments.reduce((a, c) => a + 4 + Buffer.byteLength(c, 'utf8'), 0);
        const newBlockDataLen = 4 + 4 + vendorBuf.length + totalLen;
        const newBlockData = Buffer.alloc(newBlockDataLen);
        newBlockData.writeUInt32LE(vendorLen, wpos); wpos += 4;
        vendorBuf.copy(newBlockData, wpos); wpos += vendorLen;
        newBlockData.writeUInt32LE(allComments.length, wpos); wpos += 4;
        for (const c of allComments) {
          const cBuf = Buffer.from(c, 'utf8');
          newBlockData.writeUInt32LE(cBuf.length, wpos); wpos += 4;
          cBuf.copy(newBlockData, wpos); wpos += cBuf.length;
        }

        const newBlock = Buffer.alloc(4 + newBlockDataLen);
        newBlock[0] = 4 | (isLast ? 0x80 : 0);
        newBlock[1] = (newBlockDataLen >> 16) & 0xFF;
        newBlock[2] = (newBlockDataLen >> 8) & 0xFF;
        newBlock[3] = newBlockDataLen & 0xFF;
        newBlockData.copy(newBlock, 4);

        const newFlac = Buffer.concat([buf.slice(0, pos), newBlock, buf.slice(blockStart + len)]);
        fs.writeFileSync(filePath, newFlac);
        found = true;
        break;
      }
      pos += 4 + len;
      if (isLast) break;
    }
    if (found) {
      console.log(`  Tagged: ${file}`);
    }
  }

  // Generate M3U8 playlist
  const playlistFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.flac')).sort();
  const m3u8Lines = ['#EXTM3U', ''];
  for (const f of playlistFiles) {
    m3u8Lines.push('#EXTINF:-1,' + f.replace('.flac', ''));
    m3u8Lines.push(f);
  }
  const m3u8Path = path.join(outDir, `${album.name}.m3u8`);
  fs.writeFileSync(m3u8Path, '\ufeff' + m3u8Lines.join('\r\n'), 'utf8');
  console.log(`  Playlist: ${album.name}.m3u8`);

  return outDir;
}

(async () => {
  const dirs = [];
  for (const album of albums) {
    const dir = await downloadAlbum(album);
    dirs.push(dir);
  }

  console.log('\n=== Summary ===');
  dirs.forEach(d => console.log(d));

  // Combined playlist for CD burning (both albums on one disc)
  const combinedDir = path.join(process.env.HOME || process.env.USERPROFILE, 'Music', '万能青年旅店 - 双专辑合集');
  fs.mkdirSync(combinedDir, { recursive: true });

  const allFlac = [];
  for (const album of albums) {
    const albumDir = path.join(process.env.HOME || process.env.USERPROFILE, 'Music', `${album.artist} - ${album.name}`);
    const files = fs.readdirSync(albumDir).filter(f => f.endsWith('.flac')).sort();
    for (const f of files) {
      const src = path.join(albumDir, f);
      const dest = path.join(combinedDir, f);
      if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
      allFlac.push({ file: f, album: album.name });
    }
  }

  const m3u8Lines = ['#EXTM3U', ''];
  for (const item of allFlac) {
    const title = item.file.replace('.flac', '');
    const extInf = item.file.includes(' ') ? title : `${item.album} - ${title}`;
    m3u8Lines.push('#EXTINF:-1,' + extInf);
    m3u8Lines.push(item.file);
  }
  const combinedM3u8 = path.join(combinedDir, '万能青年旅店合集.m3u8');
  fs.writeFileSync(combinedM3u8, '\ufeff' + m3u8Lines.join('\r\n'), 'utf8');
  console.log(`\nCombined playlist: ${combinedM3u8}`);
  console.log(`Combined album dir: ${combinedDir}`);
  console.log(`Total tracks: ${allFlac.length}`);
})().catch(console.error);
