import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);
const CLI = 'C:\\Users\\weidi\\play-music\\dist\\index.js';

const album = {
  artist: '陶喆',
  name: '黑色柳丁',
  tracks: [
    '黑色柳丁',
    'Melody',
    '蝴蝶',
    '讨厌红楼梦',
    '二十二',
    '月亮代表谁的心',
    'Dear God',
    '宫保鸡丁',
    'My Anata',
    'Angel',
    'Katrina',
    '摇篮曲'
  ]
};

const outDir = path.join(process.env.HOME || process.env.USERPROFILE, 'Music', `${album.artist} - ${album.name}`);

async function downloadAlbum() {
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Album: ${album.artist} - ${album.name}`);
  console.log(`Tracks: ${album.tracks.length}`);
  console.log(`Output: ${outDir}\n`);

  for (let i = 0; i < album.tracks.length; i++) {
    const track = album.tracks[i];
    const num = String(i + 1).padStart(2, '0');
    const query = `${track} ${album.artist}`;
    console.log(`[${num}/${String(album.tracks.length).padStart(2, '0')}] ${track}`);

    try {
      const { stdout } = await execFileAsync('node', [CLI, 'download', query, '-b', 'flac', '-o', outDir], { timeout: 300000 });
      if (stdout.includes('Saved to:')) {
        // Find the downloaded file and rename it
        const files = fs.readdirSync(outDir);
        const downloadedFile = files.find(f => f.endsWith('.flac') && !f.match(/^\d{2} /));
        if (downloadedFile) {
          const newName = `${num} ${track}.flac`;
          fs.renameSync(path.join(outDir, downloadedFile), path.join(outDir, newName));
          console.log(`  ✓ ${newName}`);
        } else {
          console.log(`  ✓ Downloaded`);
        }
      } else {
        console.log(`  ✗ Failed`);
      }
    } catch (e) {
      console.log(`  ✗ Error: ${e.message}`);
    }
  }

  console.log('\nDone!');
}

downloadAlbum();
