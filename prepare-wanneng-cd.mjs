import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);
const FFMPEG = 'C:\\ffmpeg\\ffmpeg-8.1.2-essentials_build\\bin\\ffmpeg.exe';

function esc(s) { return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }

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
  'Katrina (Demo)': 'Katrina (Demo)',
  '摇篮曲': 'Lullaby',
  '想和你去吹吹风': 'Want to Feel the Breeze With You',
  '三天两夜': 'Three Days and Two Nights',
  '自由': 'Freedom',
  '台北不是伤心地': 'Taipei Is Not a Sad Place',
  '火花': 'Spark',
  '隐形眼镜': 'Contact Lenses',
  '纽约的司机驾着北京的梦': 'New York Driver Driving Beijing Dream',
  '演': 'Acting',
  '毛衣': 'Sweater',
  '什么世界': 'What World',
  '狗尿馆': 'Dog Pee Hall',
  '不万能的喜剧': 'Not Omni-Comedy',
  '揪心的玩笑与漫长的白日梦': 'Heartfelt Joke and Long Daydream',
  '大石碎胸口': 'Big Stone Crushes Chest',
  '洋鸟消夏录': 'Ocean Birds Summer Record',
  '秦皇岛': 'Qinhuangdao',
  '十万嬉皮': 'Ten Thousand Hippies',
  '杀死那个石家庄人': 'Kill That Person from Shijiazhuang',
  '早': 'Early',
  '泥河': 'Mud River',
  '平等云雾': 'Equal Clouds and Fog',
  '采石': 'Stone Quarrying',
  '山雀': 'Mountain Tit',
  '绕越': 'Detour',
  '河北墨麒麟': 'Hebei Black Unicorn',
  '郊眠寺': 'Jiaomian Temple',
};

const albums = [
  { dir: 'C:\\Users\\weidi\\Music\\万能青年旅店 - 万能青年旅店', name: '万能青年旅店', artist: '万能青年旅店', nameEn: 'Wan Neng Youth Hostel', artistEn: 'Wan Neng Qing Nian Lv Dian' },
  { dir: 'C:\\Users\\weidi\\Music\\万能青年旅店 - 冀西南林路行', name: '冀西南林路行', artist: '万能青年旅店', nameEn: 'Journey Through the Forests of Southwest Hebei', artistEn: 'Wan Neng Qing Nian Lv Dian' },
];

const outDir = 'C:\\wav_wanneng';
const wavDir = path.join(outDir, 'wav');
fs.mkdirSync(wavDir, { recursive: true });

async function convertToWav(src, dst) {
  if (fs.existsSync(dst)) return true;
  try {
    await execFileAsync(FFMPEG, ['-i', src, '-y', '-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2', dst], { timeout: 120000 });
    return true;
  } catch (e) {
    console.log(`  Error converting ${src}: ${e.message}`);
    return false;
  }
}

(async () => {
  let trackNum = 1;
  const trackList = [];

  for (const album of albums) {
    const files = fs.readdirSync(album.dir).filter(f => f.endsWith('.flac') || f.endsWith('.mp3')).sort();
    console.log(`\n=== ${album.name} ===`);
    for (const f of files) {
      const src = path.join(album.dir, f);
      const wavName = `Track${String(trackNum).padStart(2,'0')}.wav`;
      const dst = path.join(wavDir, wavName);
      const ext = path.extname(f).toLowerCase();
      const title = f.replace(/^\d+\s+/, '').replace(/\.(flac|mp3)$/i, '');
      const enTitle = enMap[title] || title;

      process.stdout.write(`  ${wavName} <- ${f}... `);
      const ok = await convertToWav(src, dst);
      console.log(ok ? 'OK' : 'FAIL');
      trackList.push({ wavName, cnTitle: title, enTitle, album: album.name, albumEn: album.nameEn, artist: album.artist, artistEn: album.artistEn });
      trackNum++;
    }
  }

  console.log(`\n=== Generating TOC ===`);
  let toc = `CD_DA

CD_TEXT {
  LANGUAGE_MAP {
    0 : EN
  }

  LANGUAGE 0 {
    TITLE "Wan Neng Youth Hostel - Double Album"
    PERFORMER "Wan Neng Qing Nian Lv Dian"
  }
}
`;

  for (const t of trackList) {
    toc += `
TRACK AUDIO
CD_TEXT {
  LANGUAGE 0 {
    TITLE "${esc(t.enTitle)}"
    PERFORMER "${esc(t.artistEn)}"
  }
}
FILE "wav/${t.wavName}" 0
`;
  }

  const tocPath = path.join(outDir, 'wanneng_double.toc');
  fs.writeFileSync(tocPath, toc, 'utf8');
  console.log(`TOC: ${tocPath}`);
  console.log(`WAV dir: ${wavDir}`);
  console.log(`Total tracks: ${trackList.length}`);

  // Also generate TOC in wav dir so relative paths work
  const tocInWavDir = path.join(wavDir, 'album.toc');
  fs.writeFileSync(tocInWavDir, toc, 'utf8');
  console.log(`TOC in wav dir: ${tocInWavDir}`);
})().catch(console.error);
