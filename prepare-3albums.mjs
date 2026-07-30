import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);
const FFMPEG = 'C:\\ffmpeg\\ffmpeg-8.1.2-essentials_build\\bin\\ffmpeg.exe';

function esc(s) { return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }

const enMap = {
  '黑色柳丁': 'Black Tangerine', 'Melody': 'Melody', '蝴蝶': 'Butterfly',
  '讨厌红楼梦': "Let's Fall in Love", '二十二': '22', '月亮代表谁的心': 'Moon Over My Heart',
  'Dear God': 'Dear God', '宫保鸡丁': 'Kung Pao Chicken', 'My Anata': 'My Anata',
  'Angel': 'Angel', 'Katrina': 'Katrina', 'Katrina (Demo)': 'Katrina (Demo)', '摇篮曲': 'Lullaby',
  '想和你去吹吹风': 'Want to Feel the Breeze With You', '三天两夜': 'Three Days and Two Nights',
  '自由': 'Freedom', '台北不是伤心地': 'Taipei Is Not a Sad Place', '火花': 'Spark',
  '隐形眼镜': 'Contact Lenses', '纽约的司机驾着北京的梦': 'New York Driver Driving Beijing Dream',
  '演': 'Acting', '毛衣': 'Sweater', '什么世界': 'What World',
  '狗尿馆': 'Dog Pee Hall', '不万能的喜剧': 'Not Omni-Comedy',
  '揪心的玩笑与漫长的白日梦': 'Heartfelt Joke and Long Daydream',
  '大石碎胸口': 'Big Stone Crushes Chest', '洋鸟消夏录': 'Ocean Birds Summer Record',
  '秦皇岛': 'Qinhuangdao', '十万嬉皮': 'Ten Thousand Hippies',
  '杀死那个石家庄人': 'Kill That Person from Shijiazhuang',
  '早': 'Early', '泥河': 'Mud River', '平等云雾': 'Equal Clouds and Fog',
  '采石': 'Stone Quarrying', '山雀': 'Mountain Tit', '绕越': 'Detour',
  '河北墨麒麟': 'Hebei Black Unicorn', '郊眠寺': 'Jiaomian Temple',
  '电台情歌': 'Radio Love Song', '他不爱我': 'He Does Not Love Me',
  '广岛之恋': 'Hiroshima Love', '午夜前的十分钟': 'Ten Minutes Before Midnight',
  'Love Yourself': 'Love Yourself', 'Snacks': 'Snacks', '爱自己': 'Love Myself',
  '想一个男生': 'Thinking About a Guy', '拆信': 'Tearing Open a Letter',
  '更衣室': 'Locker Room', '信徒': 'Believer',
  '只有冰淇淋的烛光晚餐': 'Candlelight Dinner With Only Ice Cream',
  'Live for Romance': 'Live for Romance',
  '饿狼传说': 'Legend of the Hungry Wolf', '春风秋雨': 'Spring Wind Autumn Rain',
  '来来回回': 'Back and Forth', '天与地': 'Heaven and Earth',
  '只有你不知道': 'Only You Dont Know', '梦里再爱一次': 'Love Again in a Dream',
  '追钟': 'Chasing the Clock', '当爱变成习惯': 'When Love Becomes Habit',
  '非常夏日': 'Extraordinary Summer', '总有一天等到你': 'Someday I Will Wait for You',
  '我可以抱你吗': 'Can I Hold You', '当我开始偷偷的想你': 'When I Secretly Miss You',
  '爱什么稀罕': 'Love Is Precious', '好想见你': 'I Want to See You',
  '无悔': 'No Regrets', 'Good Night,Good Bye': 'Good Night, Good Bye',
  '别在伤口上洒盐': 'Dont Pour Salt on the Wound',
  '三天三夜': 'Three Days and Three Nights', '离爱出走': 'Leaving Love',
  '给我感觉': 'Give Me a Feeling', '不在乎他': 'Dont Care About Him', '日出': 'Sunrise',
};

const albumEnMap = {
  '黑色柳丁': 'Black Tangerine', '想和你去吹吹风': 'Want to Feel the Breeze With You',
  '做自己': 'To Be', '饿狼传说': 'Legend of the Hungry Wolf',
  '我可以抱你吗？爱人': 'Can I Hold You? Lover',
};

const artistEnMap = {
  '陶喆': 'David Tao', '张学友': 'Jacky Cheung', '莫文蔚': 'Karen Mok', '张惠妹': 'A-mei',
};

const albums = [
  { dir: 'C:\\Users\\weidi\\Music\\莫文蔚 - 做自己', name: '做自己', artist: '莫文蔚' },
  { dir: 'C:\\Users\\weidi\\Music\\张学友 - 饿狼传说', name: '饿狼传说', artist: '张学友' },
  { dir: 'C:\\Users\\weidi\\Music\\张惠妹 - 我可以抱你吗？爱人', name: '我可以抱你吗？爱人', artist: '张惠妹' },
];

async function convertToWav(src, dst) {
  if (fs.existsSync(dst)) return true;
  try {
    await execFileAsync(FFMPEG, ['-i', src, '-y', '-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2', dst], { timeout: 120000 });
    return true;
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    return false;
  }
}

async function prepareAlbum(album) {
  const wavDir = path.join(album.dir, '_wav_temp');
  fs.mkdirSync(wavDir, { recursive: true });

  const files = fs.readdirSync(album.dir).filter(f => f.endsWith('.flac') || f.endsWith('.mp3')).sort();
  console.log(`\n=== ${album.name} (${files.length} tracks) ===`);

  let trackNum = 1;
  const trackList = [];

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
    trackList.push({ wavName, cnTitle: title, enTitle, artistEn: artistEnMap[album.artist] || album.artist });
    trackNum++;
  }

  const albumTitleEn = albumEnMap[album.name] || album.name;
  const performerEn = artistEnMap[album.artist] || album.artist;

  let toc = `CD_DA

CD_TEXT {
  LANGUAGE_MAP {
    0 : EN
  }

  LANGUAGE 0 {
    TITLE "${esc(albumTitleEn)}"
    PERFORMER "${esc(performerEn)}"
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
FILE "${t.wavName}" 0
`;
  }

  const tocPath = path.join(wavDir, 'album.toc');
  fs.writeFileSync(tocPath, toc, 'utf8');
  console.log(`  TOC: ${tocPath}`);
  return tocPath;
}

(async () => {
  for (const album of albums) {
    await prepareAlbum(album);
  }
  console.log('\nAll done.');
})().catch(console.error);
