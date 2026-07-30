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

async function searchSong(query) {
  try {
    const { stdout } = await execFileAsync('node', [CLI, 'search', query, '--json'], { timeout: 30000 });
    const json = JSON.parse(stdout);
    return json.data?.songs || [];
  } catch {
    return [];
  }
}

function isFlacFile(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return buf.toString('ascii', 0, 4) === 'fLaC';
  } catch {
    return false;
  }
}

async function downloadSong(query, outDir, bitrate = 'flac') {
  try {
    const { stdout } = await execFileAsync('node', [CLI, 'download', query, '-b', bitrate, '-o', outDir], { timeout: 300000 });
    const match = stdout.match(/Saved to:\s*(.+)/);
    if (match) {
      const savedPath = match[1].trim();
      const isFlac = isFlacFile(savedPath);
      return { ok: true, file: path.basename(savedPath), path: savedPath, isFlac };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
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

    // Step 1: Try Kuwo FLAC
    const result = await downloadSong(query, outDir, 'flac');
    if (result.ok && result.isFlac) {
      console.log(`✓ FLAC (Kuwo): ${result.file}`);
      continue;
    }

    // Step 2: Try Kuwo without bitrate (cross-source)
    console.log(`\n  ^ FLAC failed, trying cross-source...`);
    const result2 = await downloadSong(query, outDir);
    if (result2.ok) {
      if (result2.isFlac) {
        console.log(`  ✓ FLAC (cross): ${result2.file}`);
      } else {
        console.log(`  ✗ Not FLAC (${result2.file}), will retry other platforms`);
      }
    } else {
      console.log(`  ✗ Failed: ${result2.error || 'unknown'}`);
    }
  }

  // List what we got
  const files = fs.readdirSync(outDir).filter(f => f.endsWith('.flac') || f.endsWith('.mp3'));
  console.log(`\n  Downloaded (${files.length}):`);
  for (const f of files) {
    const fp = path.join(outDir, f);
    const flac = isFlacFile(fp);
    console.log(`  ${flac ? 'FLAC' : 'MP3 '} ${f}`);
  }

  return outDir;
}

(async () => {
  for (const album of albums) {
    await downloadAlbum(album);
  }
})().catch(console.error);
