import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);
const CLI = 'C:\\Users\\weidi\\play-music\\dist\\index.js';

const albums = [
  {
    artist: '万能青年旅店',
    name: '万能青年旅店',
    tracks: ['狗尿馆','不万能的喜剧','揪心的玩笑与漫长的白日梦','大石碎胸口','洋鸟消夏录','秦皇岛','十万嬉皮','杀死那个石家庄人']
  },
  {
    artist: '万能青年旅店',
    name: '冀西南林路行',
    tracks: ['早','泥河','平等云雾','采石','山雀','绕越','河北墨麒麟','郊眠寺']
  }
];

function isFlac(filePath) {
  try { return fs.readFileSync(filePath).toString('ascii', 0, 4) === 'fLaC'; } catch { return false; }
}

async function download(query, outDir, quality) {
  try {
    const { stdout } = await execFileAsync('node', [CLI, 'download', query, '-b', quality, '-o', outDir], { timeout: 300000 });
    const m = stdout.match(/Saved to:\s*(.+)/);
    if (m) return { ok: true, path: m[1].trim() };
  } catch {}
  return { ok: false };
}

function findFile(dir, title) {
  const files = fs.readdirSync(dir);
  return files.find(f => {
    const name = f.replace(/\.(flac|mp3)$/i, '');
    return name.includes(title) || title.includes(name.replace(/^.+?\s-\s/, ''));
  });
}

(async () => {
  for (const album of albums) {
    const dir = path.join(process.env.HOME || process.env.USERPROFILE, 'Music', `${album.artist} - ${album.name}`);
    fs.mkdirSync(dir, { recursive: true });
    console.log(`\n=== ${album.name} ===`);

    for (let i = 0; i < album.tracks.length; i++) {
      const track = album.tracks[i];
      const num = String(i + 1).padStart(2, '0');
      const query = `${track} ${album.artist}`;
      process.stdout.write(`[${num}] ${track}... `);

      let result = await download(query, dir, 'flac');
      if (!result.ok) result = await download(query, dir, '320k');
      if (!result.ok) result = await download(query, dir, '128k');
      if (!result.ok) result = await download(query, dir, '');

      if (result.ok) {
        const base = path.basename(result.path);
        const ext = path.extname(base);
        const newName = `${num} ${track}${ext}`;
        const oldPath = path.join(dir, base);
        const newPath = path.join(dir, newName);
        if (base !== newName) {
          try { fs.renameSync(oldPath, newPath); } catch {}
        }
        const flac = isFlac(newPath);
        console.log(`${flac ? 'FLAC' : 'MP3 '} ${path.basename(newPath)}`);
      } else {
        console.log('✗');
      }
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.flac') || f.endsWith('.mp3'));
    console.log(`  Got ${files.length}/${album.tracks.length}`);
  }
})().catch(console.error);
