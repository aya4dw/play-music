import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);
const FFMPEG = 'C:\\ffmpeg\\ffmpeg-8.1.2-essentials_build\\bin\\ffmpeg.exe';

function readFlacTags(filePath) {
  const buf = fs.readFileSync(filePath);
  let pos = 4;
  for (let i = 0; i < 10; i++) {
    const type = buf[pos] & 0x7F;
    const len = (buf[pos+1] << 16) | (buf[pos+2] << 8) | buf[pos+3];
    if (type === 4) {
      const data = buf.slice(pos + 4, pos + 4 + len);
      let p = 0;
      const vendorLen = data.readUInt32LE(p); p += 4 + vendorLen;
      const count = data.readUInt32LE(p); p += 4;
      const tags = {};
      for (let j = 0; j < count; j++) {
        const l = data.readUInt32LE(p); p += 4;
        const s = data.slice(p, p + l).toString('utf8');
        const eq = s.indexOf('=');
        if (eq > 0) { const k = s.substring(0, eq).toUpperCase(); if (!tags[k]) tags[k] = s.substring(eq + 1); }
        p += l;
      }
      return tags;
    }
    pos += 4 + len;
  }
  return {};
}

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
  '电台情歌': 'Radio Love Song',
  '他不爱我': 'He Does Not Love Me',
  '广岛之恋': 'Hiroshima Love',
  '午夜前的十分钟': 'Ten Minutes Before Midnight',
  'Love Yourself': 'Love Yourself',
  'Snacks': 'Snacks',
  '爱自己': 'Love Myself',
  '想一个男生': 'Thinking About a Guy',
  '拆信': 'Tearing Open a Letter',
  '更衣室': 'Locker Room',
  '信徒': 'Believer',
  '只有冰淇淋的烛光晚餐': 'Candlelight Dinner With Only Ice Cream',
  'Live for Romance': 'Live for Romance',
  '饿狼传说': 'Legend of the Hungry Wolf',
  '春风秋雨': 'Spring Wind Autumn Rain',
  '来来回回': 'Back and Forth',
  '天与地': 'Heaven and Earth',
  '只有你不知道': 'Only You Dont Know',
  '梦里再爱一次': 'Love Again in a Dream',
  '追钟': 'Chasing the Clock',
  '当爱变成习惯': 'When Love Becomes Habit',
  '非常夏日': 'Extraordinary Summer',
  '总有一天等到你': 'Someday I Will Wait for You',
  '我可以抱你吗': 'Can I Hold You',
  '当我开始偷偷的想你': 'When I Secretly Miss You',
  '爱什么稀罕': 'Love Is Precious',
  '好想见你': 'I Want to See You',
  '无悔': 'No Regrets',
  'Good Night,Good Bye': 'Good Night, Good Bye',
  '别在伤口上洒盐': 'Dont Pour Salt on the Wound',
  '三天三夜': 'Three Days and Three Nights',
  '离爱出走': 'Leaving Love',
  '给我感觉': 'Give Me a Feeling',
  '不在乎他': 'Dont Care About Him',
  '日出': 'Sunrise',
  '在梅边': 'In The Plum',
  '花田错': 'Flower Field Mistake',
  '盖世英雄': 'Heroes Of The World',
  'Kiss Goodbye': 'Kiss Goodbye',
  '完美的互动': 'Perfect Interaction',
  '大城小爱': 'Big City Small Love',
  '第一个清晨': 'First Morning',
  '哥儿们': 'Brothers',
  '让开': 'Move Aside',
  '爱因为在心中': 'Love Because In Heart',
};

const albumEnMap = {
  '黑色柳丁': 'Black Tangerine',
  '想和你去吹吹风': 'Want to Feel the Breeze With You',
  '做自己': 'To Be',
  '饿狼传说': 'Legend of the Hungry Wolf',
  '我可以抱你吗？爱人': 'Can I Hold You? Lover',
  '盖世英雄': 'Heroes Of The World',
};

const artistEnMap = {
  '陶喆': 'David Tao',
  '张学友': 'Jacky Cheung',
  '莫文蔚': 'Karen Mok',
  '张惠妹': 'A-mei',
  '王力宏': 'Wang Leehom',
};

async function prepareAndBurn(albumDir) {
  const wavDir = path.join(albumDir, '_wav_temp');
  fs.mkdirSync(wavDir, { recursive: true });

  const files = fs.readdirSync(albumDir).filter(f => f.endsWith('.flac')).sort();
  if (!files.length) { console.log('No FLAC files'); return; }

  // Convert FLAC to WAV
  console.log('Converting FLAC to WAV...\n');
  for (const file of files) {
    const src = path.join(albumDir, file);
    const wavName = path.basename(file, '.flac') + '.wav';
    const dst = path.join(wavDir, wavName);
    if (fs.existsSync(dst)) { console.log(`  Skip: ${wavName}`); continue; }
    console.log(`  ${file} → ${wavName}`);
    try {
      await execFileAsync(FFMPEG, ['-i', src, '-y', '-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2', dst], { timeout: 120000 });
    } catch (e) {
      console.log(`  ✗ Error: ${e.message}`);
    }
  }

  // Generate TOC
  const firstTags = readFlacTags(path.join(albumDir, files[0]));
  const albumTitle = albumEnMap[firstTags.ALBUM] || firstTags.ALBUM || 'Unknown Album';
  const performer = artistEnMap[firstTags.ARTIST] || firstTags.ARTIST || 'Unknown';

  const wavFiles = fs.readdirSync(wavDir).filter(f => f.endsWith('.wav')).sort();
  let toc = `CD_DA\n\nCD_TEXT {\n  LANGUAGE_MAP {\n    0 : EN\n  }\n\n  LANGUAGE 0 {\n    TITLE "${esc(albumTitle)}"\n    PERFORMER "${esc(performer)}"\n  }\n}\n`;

  for (const wav of wavFiles) {
    const origFlac = wav.replace('.wav', '.flac');
    const tags = readFlacTags(path.join(albumDir, origFlac));
    const cnTitle = tags.TITLE || path.basename(wav, '.wav');
    const enTitle = enMap[cnTitle] || cnTitle;
    const relPath = `_wav_temp/${wav}`;

    toc += `\nTRACK AUDIO\nCD_TEXT {\n  LANGUAGE 0 {\n    TITLE "${esc(enTitle)}"\n    PERFORMER "${esc(performer)}"\n  }\n}\nFILE "${relPath}" 0\n`;
  }

  const tocPath = path.join(albumDir, 'album_wav.toc');
  fs.writeFileSync(tocPath, toc, 'utf8');
  console.log(`\nGenerated: ${tocPath}`);
  console.log(`\nTOC content:\n${toc}`);

  // Cleanup
  console.log('\nWAV files ready in:', wavDir);
  console.log('\nTo burn:');
  console.log(`  & "C:\\cdrdao\\cdrdao.exe" simulate "${tocPath}" --device G: --speed 4 -n`);
  console.log(`  & "C:\\cdrdao\\cdrdao.exe" write "${tocPath}" --device G: --speed 4`);
}

const albumDir = process.argv[2] || '.';
prepareAndBurn(albumDir);
