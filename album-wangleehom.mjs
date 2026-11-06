import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);
const CLI = new URL('./dist/index.js', import.meta.url).pathname;

const album = {
  artist: '王力宏',
  artistEn: 'Wang Leehom',
  name: '盖世英雄',
  nameEn: 'Heroes Of The World',
  tracks: [
    { cn: '在梅边', en: 'In The Plum' },
    { cn: '花田错', en: 'Flower Field Mistake' },
    { cn: '盖世英雄', en: 'Heroes Of The World' },
    { cn: 'Kiss Goodbye', en: 'Kiss Goodbye' },
    { cn: '嘿吼', en: 'Hei Hou' },
    { cn: '大城小爱', en: 'Big City Small Love' },
    { cn: '第一个清晨', en: 'First Morning' },
    { cn: '哥儿们', en: 'Brothers' },
    { cn: '让开', en: 'Move Aside' },
    { cn: '爱因为在心中', en: 'Love Because In Heart' },
  ]
};

const outDir = path.join(process.env.HOME || process.env.USERPROFILE, 'Music', `${album.artist} - ${album.name}`);
const tempDir = path.join(outDir, '_wav_temp');

async function downloadAlbum() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  for (let i = 0; i < album.tracks.length; i++) {
    const track = album.tracks[i];
    const num = String(i + 1).padStart(2, '0');
    const query = `${track.cn} ${album.artist}`;
    console.log(`\n[${num}/${album.tracks.length}] ${track.cn}`);

    let savedPath = null;
    try {
      const { stdout } = await execFileAsync('node', [CLI, 'download', query, '-b', 'flac', '-o', outDir], { timeout: 300000 });
      const match = stdout.match(/Saved to:\s*(.+)/);
      if (match) {
        savedPath = match[1].trim();
        console.log(`  ✓ ${path.basename(savedPath)}`);
      } else {
        console.log(`  ✗ FLAC not found, trying cross-source...`);
        const { stdout: stdout2 } = await execFileAsync('node', [CLI, 'download', query, '-o', outDir], { timeout: 300000 });
        const match2 = stdout2.match(/Saved to:\s*(.+)/);
        if (match2) {
          savedPath = match2[1].trim();
          console.log(`  ✓ (cross-source) ${path.basename(savedPath)}`);
        } else {
          console.log(`  ✗ Failed`);
        }
      }
    } catch (e) {
      console.log(`  ✗ Error: ${e.message}`);
    }
  }

  console.log('\n--- Matching files to tracks ---');
  const allFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.flac') || f.endsWith('.mp3') || f.endsWith('.m4a'));
  console.log(`Found ${allFiles.length} files:`);
  allFiles.forEach(f => console.log(`  ${f}`));

  console.log('\n--- Renaming with track numbers ---');
  for (let i = 0; i < album.tracks.length; i++) {
    const track = album.tracks[i];
    const num = String(i + 1).padStart(2, '0');
    const ext = allFiles.find(f => f.includes(track.cn))?.split('.').pop() || 'flac';
    const newName = `${num} ${track.cn}.${ext}`;

    const matchedFile = allFiles.find(f => {
      const nameWithoutExt = f.replace(/\.(flac|mp3|m4a)$/, '');
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
  const finalFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.flac') || f.endsWith('.mp3') || f.endsWith('.m4a'));
  for (let i = 0; i < album.tracks.length; i++) {
    const track = album.tracks[i];
    const num = String(i + 1).padStart(2, '0');
    const ext = finalFiles.find(f => f.includes(track.cn))?.split('.').pop() || 'flac';
    const filePath = path.join(outDir, `${num} ${track.cn}.${ext}`);
    if (fs.existsSync(filePath)) {
      const trackNum = i + 1;
      const total = album.tracks.length;
      const title = track.cn;
      const artist = album.artist;
      const albumName = album.name;
      try {
        const { execSync } = await import('child_process');
        const ffmpeg = 'ffmpeg';
        execSync(`"${ffmpeg}" -i "${filePath}" -c copy -metadata title="${title}" -metadata artist="${artist}" -metadata album="${albumName}" -metadata track=${trackNum} -metadata total=${total} -y "${filePath}_tagged.${ext}"`, { stdio: 'ignore' });
        const taggedPath = `${filePath}_tagged.${ext}`;
        if (fs.existsSync(taggedPath)) {
          fs.renameSync(taggedPath, filePath);
          console.log(`  ✓ ${title}`);
        }
      } catch (e) { }
    }
  }

  console.log('\n--- Generating M3U8 playlist ---');
  const m3u8Path = path.join(outDir, 'playlist.m3u8');
  const m3u8Lines = ['#EXTM3U', '#EXTENC:UTF-8'];
  for (let i = 0; i < album.tracks.length; i++) {
    const track = album.tracks[i];
    const num = String(i + 1).padStart(2, '0');
    const ext = finalFiles.find(f => f.includes(track.cn))?.split('.').pop() || 'flac';
    const filename = `${num} ${track.cn}.${ext}`;
    m3u8Lines.push(`#EXTINF:${track.cn.includes('Kiss') ? 261 : 0},${album.artist} - ${track.cn}`);
    m3u8Lines.push(filename);
  }
  const BOM = '\uFEFF';
  fs.writeFileSync(m3u8Path, BOM + m3u8Lines.join('\r\n'), 'utf8');
  console.log(`  ✓ playlist.m3u8`);

  console.log('\n=== Done! ===');
  console.log(`Output: ${outDir}`);
}

downloadAlbum().catch(console.error);
