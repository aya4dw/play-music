import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { homedir } from 'os';

const execFileAsync = promisify(execFile);
const CLI = new URL('./dist/index.js', import.meta.url).pathname;

const album = {
  artist: 'Queen',
  name: 'A Night at the Opera',
  coverQuery: 'Queen A Night at the Opera',
  date: '1975',
  tracks: [
    { cn: 'Death On Two Legs (Dedicated To...)' },
    { cn: 'Lazing On A Sunday Afternoon' },
    { cn: 'I\'m In Love With My Car' },
    { cn: 'You\'re My Best Friend' },
    { cn: '\'39' },
    { cn: 'Sweet Lady' },
    { cn: 'Seaside Rendezvous' },
    { cn: 'The Prophet\'s Song' },
    { cn: 'Love Of My Life' },
    { cn: 'Good Company' },
    { cn: 'Bohemian Rhapsody' },
    { cn: 'God Save The Queen' },
  ]
};

const outDir = path.join(homedir(), 'Music', `${album.artist} - ${album.name}`);
const coverPath = path.join(outDir, 'cover.jpg');
const singleFile = path.join(homedir(), 'Music', 'Queen - Bohemian Rhapsody.flac');

async function sh(cmd, args, opts = {}) {
  const { stdout } = await execFileAsync(cmd, args, opts);
  return stdout;
}

async function downloadCover() {
  if (fs.existsSync(coverPath)) return coverPath;
  try {
    const q = encodeURIComponent(album.coverQuery);
    const out = await sh('curl', ['-s', `https://itunes.apple.com/search?term=${q}&media=music&entity=album&limit=1`]);
    const url = JSON.parse(out).results?.[0]?.artworkUrl100;
    if (!url) return null;
    await sh('curl', ['-sL', '-o', coverPath, url.replace(/100x100bb/, '1000x1000bb')]);
    return coverPath;
  } catch {
    return null;
  }
}

async function download(query, dir) {
  for (const args of [['download', query, '-b', 'flac', '-o', dir], ['download', query, '-o', dir]]) {
    try {
      const { stdout } = await execFileAsync('node', [CLI, ...args], { timeout: 300000 });
      const m = stdout.match(/Saved to:\s*(.+)/);
      if (m) return m[1].trim();
    } catch {}
  }
  return null;
}

async function validateAndRepair(fp) {
  try {
    await sh('flac', ['-t', '-s', fp]);
    return;
  } catch {
    console.log('\n  损坏，重编码修复');
    const tmp = path.join(path.dirname(fp), '.repair-' + path.basename(fp));
    await sh('ffmpeg', ['-y', '-v', 'error', '-i', fp, '-acodec', 'flac', '-compression_level', '8', tmp]);
    fs.renameSync(tmp, fp);
  }
}

async function tagAndCover(fp, title, trackNum) {
  const cover = await downloadCover();
  const tmp = path.join(path.dirname(fp), '.tag-' + path.basename(fp));
  const args = ['-y', '-v', 'error', '-i', fp];
  if (cover) args.push('-i', cover);
  args.push('-map', '0:a');
  if (cover) args.push('-map', '1:v', '-c:v', 'copy', '-disposition:v', 'attached_pic');
  args.push('-c:a', 'copy',
    '-metadata', `title=${title}`,
    '-metadata', `artist=${album.artist}`,
    '-metadata', `album=${album.name}`,
    '-metadata', `album_artist=${album.artist}`,
    '-metadata', `track=${String(trackNum).padStart(2, '0')}`,
    '-metadata', `date=${album.date}`);
  if (cover) args.push('-metadata:s:v', 'comment=Cover (front)', '-metadata:s:v', 'title=Album cover');
  args.push(tmp);
  await sh('ffmpeg', args);
  fs.renameSync(tmp, fp);
}

function genPlaylist(files) {
  const lines = ['#EXTM3U'];
  for (const f of files) {
    lines.push(`#EXTINF:-1,${f.replace(/\.(flac|mp3)$/i, '')}`);
    lines.push(f);
  }
  const p = path.join(outDir, `${album.name}.m3u8`);
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8');
  console.log(`Playlist: ${p}`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`=== ${album.artist} - ${album.name} (${album.tracks.length} tracks) ===\n`);

  if (fs.existsSync(singleFile)) {
    const dest = path.join(outDir, '11 Bohemian Rhapsody.flac');
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(singleFile, dest);
      console.log('[11] Bohemian Rhapsody ... 复用已下载单曲');
    }
  }

  for (let i = 0; i < album.tracks.length; i++) {
    const t = album.tracks[i];
    const num = String(i + 1).padStart(2, '0');
    const target = path.join(outDir, `${num} ${t.cn}.flac`);
    if (fs.existsSync(target)) { console.log(`[${num}] ${t.cn} ... 已存在`); continue; }
    const q = `${t.cn} ${album.artist}`;
    process.stdout.write(`[${num}] ${t.cn}... `);
    const saved = await download(q, outDir);
    if (!saved) { console.log('✗'); continue; }
    const base = path.basename(saved);
    const ext = path.extname(base).toLowerCase();
    const newName = `${num} ${t.cn}${ext}`;
    if (base !== newName) { try { fs.renameSync(path.join(outDir, base), path.join(outDir, newName)); } catch {} }
    console.log(ext.slice(1).toUpperCase());
  }

  const files = fs.readdirSync(outDir).filter(f => /\.(flac|mp3)$/i.test(f)).sort();
  for (const f of files) {
    if (!/\.flac$/i.test(f)) continue;
    const fp = path.join(outDir, f);
    process.stdout.write(`处理 ${f}... `);
    await validateAndRepair(fp);
    const title = f.replace(/^\d+\s+/, '').replace(/\.flac$/i, '');
    await tagAndCover(fp, title, parseInt(f, 10));
    console.log('✓');
  }

  genPlaylist(files);
  console.log(`${files.length} tracks -> ${album.name}.m3u8`);
  console.log(`Done: ${outDir}`);
}

main().catch(console.error);
