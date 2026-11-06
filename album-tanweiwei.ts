/**
 * 谭维维 全专辑下载
 * 用法:
 *   npx tsx album-tanweiwei.ts            # 下载全部
 *   npx tsx album-tanweiwei.ts --plan     # 只探测匹配情况，不下载
 *   npx tsx album-tanweiwei.ts "3811"     # 只处理指定专辑（可多个）
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';

import { register, searchAll } from './src/providers/registry.js';
import { kuwoProvider } from './src/providers/kuwo.js';
import { qqProvider } from './src/providers/qq.js';
import { kugouProvider } from './src/providers/kugou.js';
import { neteaseProvider } from './src/providers/netease.js';
import { downloadSong } from './src/download/downloader.js';
import type { Song } from './src/providers/types.js';

register(kuwoProvider);
register(qqProvider);
register(kugouProvider);
register(neteaseProvider);

const execFileAsync = promisify(execFile);
const MUSIC = path.join(homedir(), 'Music');
const ARTIST = '谭维维';

/** cn = 展示/文件名；names = 可接受的其他写法；exclude = 需要排除的写法 */
interface Track { cn: string; names?: string[]; exclude?: string[]; }
interface Album { name: string; date: string; albumKeys: string[]; tracks: Track[]; }

const albums: Album[] = [
  {
    name: '高原之心', date: '2005', albumKeys: ['高原之心'], tracks: [
      { cn: '高原之心' },
      { cn: '康定情歌与溜溜调' },
      { cn: '神鹰传说' },
      { cn: '走进西藏' },
      { cn: '阿娃兹古丽' },
      { cn: '海市蜃楼' },
      { cn: '永远的那达慕' },
      { cn: '牧歌' },
      { cn: '乌兰巴托之夜', names: ['乌兰巴托之夜', '乌兰巴托的夜'] },
      { cn: '康定情歌与溜溜调 (采风版)' },
    ],
  },
  {
    name: '耳界', date: '2007', albumKeys: ['耳界'], tracks: [
      { cn: '蝶' },
      { cn: '钢琴' },
      { cn: '做错' },
      { cn: '不穿高跟鞋' },
      { cn: '视而不见' },
      { cn: '爱的光' },
      { cn: '达子的春天' },
      { cn: '也许也许' },
      { cn: '向日葵' },
      { cn: '雪落下的声音' },
      { cn: '传说' },
    ],
  },
  {
    name: '传说', date: '2009', albumKeys: ['传说'], tracks: [
      { cn: '蝴蝶的翅膀' },
      { cn: '阿爸' },
      { cn: '传说' },
      { cn: '高原红' },
      { cn: '我要和你去飞翔' },
      { cn: '洗衣歌' },
      { cn: '梦中的唐古拉' },
      { cn: '献给阿妈的歌', names: ['献给阿妈的歌', '献歌阿妈的歌'] },
      { cn: '走进西藏' },
      { cn: '天路' },
      { cn: '梦中的绿洲' },
      { cn: '花的海洋' },
      { cn: '四姑娘山下雪了吗' },
    ],
  },
  {
    name: '谭某某', date: '2010', albumKeys: ['谭某某'], tracks: [
      { cn: '如果有来生' },
      { cn: '如果你' },
      { cn: 'Fight' },
      { cn: '离去之前叫醒我 (父亲版)', names: ['离去之前叫醒我'], exclude: ['合作'] },
      { cn: '悲哀而真实' },
      { cn: '往日时光' },
      { cn: '石头在歌唱', names: ['石头在歌唱'] },
      { cn: '匹诺曹' },
      { cn: '谭某某' },
      { cn: '21克' },
      { cn: '离去之前叫醒我 (合作珍藏版)', names: ['离去之前叫醒我(合作版本)', '离去之前叫醒我'] },
    ],
  },
  {
    name: '3', date: '2011', albumKeys: ['3'], tracks: [
      { cn: '我是怎么了' },
      { cn: '想见' },
      { cn: 'Hold不住' },
      { cn: '尘埃' },
      { cn: '睡吧宝贝', names: ['睡吧宝贝', '睡吧 宝贝'] },
      { cn: '演' },
      { cn: '艳阳天' },
      { cn: '在那遥远的地方' },
      { cn: '我' },
      { cn: '开放' },
    ],
  },
  {
    name: '乌龟的阿基里斯', date: '2013', albumKeys: ['乌龟的阿基里斯'], tracks: [
      { cn: '序', names: ['序', '序+Intro'] },
      { cn: '拥抱' },
      { cn: '玩耍' },
      { cn: '恶之花' },
      { cn: '树' },
      { cn: '我反对' },
      { cn: '什么' },
      { cn: '墙' },
      { cn: '黑则明' },
      { cn: '为什么' },
      { cn: '当' },
      { cn: 'Ich Liebe Dich', names: ['Ich Liebe Dich', 'Ich Liebe Dich (德语：我爱你)', '我爱你'] },
      { cn: '天堂口处莲花开' },
      { cn: '拥抱 (London Version)', names: ['拥抱'] },
    ],
  },
  {
    name: '3811', date: '2020', albumKeys: ['3811', '姐码3811', '姐放3811'], tracks: [
      { cn: '章存仙' },
      { cn: '鱼玄机', names: ['鱼玄机'] },
      { cn: '阿果' },
      { cn: '吴春芳' },
      { cn: '如花' },
      { cn: '钱夫人' },
      { cn: '赵桂灵' },
      { cn: '卡利' },
      { cn: '小娟（化名）', names: ['小娟'] },
      { cn: 'Tare Ma', names: ['Tare Ma', 'ཏཱ་རེ་མ'] },
      { cn: '谭艳梅' },
    ],
  },
  {
    name: '观照·夏长', date: '2016', albumKeys: ['夏长'], tracks: [
      { cn: 'Blah Blah Blah' },
      { cn: '城市病人' },
      { cn: '盛女时代' },
    ],
  },
  {
    name: '观照·秋收', date: '2016', albumKeys: ['秋收'], tracks: [
      { cn: '飞' },
      { cn: '三厘米' },
      { cn: '取墨' },
    ],
  },
  {
    name: '观照·冬藏', date: '2017', albumKeys: ['冬藏'], tracks: [
      { cn: '错过' },
      { cn: '一箱子云朵' },
    ],
  },
  {
    name: '观照·春生', date: '2017', albumKeys: ['春生'], tracks: [
      { cn: '昨天涯——献给布宜诺斯艾利斯', names: ['昨天涯'] },
      { cn: '失眠书' },
    ],
  },
];

const SOURCE_PRIORITY: Record<string, number> = { kuwo: 0, kugou: 1, qq: 2, netease: 3 };

function sanitize(name: string): string {
  return name.replace(/[/:]/g, '-').replace(/[*?"<>|]/g, '').trim();
}

/** 归一化歌名：去括号后缀、去标点、小写 */
function norm(s: string): string {
  return s.toLowerCase()
    .replace(/[（(【\[].*?[）)】\]]/g, '')
    .replace(/[\s\-_·、,，.。!！?？'"“”《》—～~]/g, '');
}

function hasFlac(song: Song): boolean {
  const e = song.extra as any;
  if (!e) return false;
  if (typeof e.sizeflac === 'number' && e.sizeflac > 0) return true;
  if (typeof e.sqFileHash === 'string' && e.sqFileHash.length > 0) return true;
  if (typeof e.minfo === 'string' && e.minfo.includes('format:flac')) return true;
  return false;
}

function albumMatches(songAlbum: string | undefined, keys: string[]): boolean {
  if (!songAlbum) return false;
  const a = norm(songAlbum);
  return keys.some(k => {
    const kk = norm(k);
    if (!kk) return false;
    if (kk.length <= 2) return a === kk;
    return a.includes(kk) || kk.includes(a);
  });
}

function score(song: Song, track: Track, album: Album): number {
  // 硬性条件：艺人必须包含 谭维维
  if (!song.artist.includes(ARTIST)) return -1;
  // 硬性排除
  if ((track.exclude ?? []).some(x => song.name.includes(x))) return -1;

  const n = norm(song.name);
  const names = (track.names ?? [track.cn]).map(norm);
  const inAlbum = albumMatches(song.album, album.albumKeys);

  let s = 0;
  if (names.some(t => n === t)) s += 1000;
  else if (names.some(t => t.length >= 2 && (n.includes(t) || t.includes(n)))) s += 350;
  else return -1;

  // 原始名精确命中（区分「父亲版 / 合作版」这类同名词）
  const rawNames = [track.cn, ...(track.names ?? [])].map(x => x.trim());
  const raw = song.name.trim();
  if (raw === track.cn.trim()) s += 1300;
  else if (rawNames.includes(raw)) s += 1200;

  if (inAlbum) s += 800;

  if (/伴奏|instrumental|铃声版/i.test(song.name)) s -= 900;
  if (/\(live\)|live|现场/i.test(song.name)) s -= 500;
  if (/dj|remix|混音|超级版|特别版/i.test(song.name)) s -= 700;
  if (/铃声版/.test(song.name)) s -= 900;
  if (/cover/i.test(song.name)) s -= 900;
  if (song.artist.includes('/') || song.artist.includes('&')) s -= 50;

  if (hasFlac(song)) s += 80;
  s -= (SOURCE_PRIORITY[song.source] ?? 5);
  return s;
}

async function pickCandidates(track: Track, album: Album): Promise<Array<{ song: Song; score: number }>> {
  const queries = [track.cn, ...(track.names ?? [])].map(x => `${x} ${ARTIST}`);
  let songs: Song[] = [];
  for (const q of [...new Set(queries)]) {
    try {
      songs.push(...(await searchAll(q, undefined, 20)));
    } catch { /* ignore */ }
  }
  if (!songs.length) return [];

  // 去重（source+id）
  const seen = new Set<string>();
  const uniq = songs.filter(s => {
    const k = `${s.source}:${s.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return uniq
    .map(s => ({ song: s, score: score(s, track, album) }))
    .filter(x => x.score >= 0)
    .sort((a, b) => b.score - a.score);
}

async function sh(cmd: string, args: string[], opts: any = {}) {
  const { stdout } = await execFileAsync(cmd, args, opts);
  return stdout;
}

async function downloadCover(outDir: string, albumName: string): Promise<string | null> {
  const coverPath = path.join(outDir, 'cover.jpg');
  if (fs.existsSync(coverPath)) return coverPath;
  try {
    const q = encodeURIComponent(`${ARTIST} ${albumName.replace('观照·', '')}`);
    const out = await sh('curl', ['-s', `https://itunes.apple.com/search?term=${q}&media=music&entity=album&limit=1`]);
    const url = JSON.parse(out).results?.[0]?.artworkUrl100;
    if (!url) return null;
    await sh('curl', ['-sL', '-o', coverPath, url.replace(/100x100bb/, '1000x1000bb')]);
    return coverPath;
  } catch {
    return null;
  }
}

async function validateAndRepair(fp: string) {
  try {
    await sh('flac', ['-t', '-s', fp]);
  } catch {
    const tmp = path.join(path.dirname(fp), '.repair-' + path.basename(fp));
    await sh('ffmpeg', ['-y', '-v', 'error', '-i', fp, '-acodec', 'flac', '-compression_level', '8', tmp]);
    fs.renameSync(tmp, fp);
  }
}

async function tagAndCover(fp: string, title: string, trackNum: number, albumName: string, date: string, cover: string | null) {
  const tmp = path.join(path.dirname(fp), '.tag-' + path.basename(fp));
  const args = ['-y', '-v', 'error', '-i', fp];
  if (cover) args.push('-i', cover);
  args.push('-map', '0:a');
  if (cover) args.push('-map', '1:v', '-c:v', 'copy', '-disposition:v', 'attached_pic');
  args.push('-c:a', 'copy',
    '-metadata', `title=${title}`,
    '-metadata', `artist=${ARTIST}`,
    '-metadata', `album=${albumName}`,
    '-metadata', `album_artist=${ARTIST}`,
    '-metadata', `track=${String(trackNum).padStart(2, '0')}`,
    '-metadata', `date=${date}`);
  if (cover) args.push('-metadata:s:v', 'comment=Cover (front)', '-metadata:s:v', 'title=Album cover');
  args.push(tmp);
  await sh('ffmpeg', args);
  fs.renameSync(tmp, fp);
}

function genPlaylist(outDir: string, albumName: string, files: string[]) {
  const lines = ['#EXTM3U'];
  for (const f of files) {
    lines.push(`#EXTINF:-1,${f.replace(/\.(flac|mp3)$/i, '')}`);
    lines.push(f);
  }
  const p = path.join(outDir, `${albumName}.m3u8`);
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8');
  return p;
}

const PLAN = process.argv.includes('--plan');
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));

const missing: string[] = [];
const summary: string[] = [];

async function processAlbum(album: Album) {
  const outDir = path.join(MUSIC, `${sanitize(ARTIST)} - ${sanitize(album.name)}`);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`\n=== ${ARTIST} - ${album.name} (${album.tracks.length} tracks) ===`);

  const picked: Array<{ track: Track; num: number; cands: Array<{ song: Song; score: number }> }> = [];

  for (let i = 0; i < album.tracks.length; i++) {
    const t = album.tracks[i];
    const num = String(i + 1).padStart(2, '0');
    const target = path.join(outDir, `${num} ${sanitize(t.cn)}.flac`);
    const targetMp3 = path.join(outDir, `${num} ${sanitize(t.cn)}.mp3`);

    if (!PLAN && (fs.existsSync(target) || fs.existsSync(targetMp3))) {
      console.log(`  [${num}] ${t.cn} ... 已存在`);
      picked.push({ track: t, num, cands: [] });
      continue;
    }

    process.stdout.write(`  [${num}] ${t.cn} ... `);
    const cands = await pickCandidates(t, album);
    if (!cands.length) {
      console.log('✗ 未找到匹配');
      missing.push(`${album.name} - ${t.cn}`);
      picked.push({ track: t, num, cands: [] });
      continue;
    }
    const top = cands[0];
    console.log(`${top.song.name} [${top.song.source}/${top.song.album || '-'}] score=${top.score}`);
    picked.push({ track: t, num, cands });
  }

  if (PLAN) return;

  for (const p of picked) {
    if (!p.cands.length) continue;
    const num = String(p.num).padStart(2, '0');
    const have = fs.readdirSync(outDir).some(f => f.startsWith(`${num} `) && /\.(flac|mp3)$/i.test(f));
    if (have) continue;

    let done = false;
    for (const cand of p.cands.slice(0, 6)) {
      for (const br of (hasFlac(cand.song) ? ['flac', undefined] : [undefined, 'flac'])) {
        try {
          const fp = await downloadSong(cand.song, outDir, undefined, br as any);
          const base = path.basename(fp);
          const ext = path.extname(base).toLowerCase();
          const newName = `${num} ${sanitize(p.track.cn)}${ext}`;
          if (base !== newName) {
            try { fs.renameSync(path.join(outDir, base), path.join(outDir, newName)); } catch {}
          }
          done = true;
          break;
        } catch (e: any) {
          // 试下一个
        }
      }
      if (done) break;
    }
    if (!done) {
      console.log(`    ✗ 下载失败: ${p.track.cn}`);
      missing.push(`${album.name} - ${p.track.cn}`);
    }
  }

  const cover = await downloadCover(outDir, album.name);
  const files = fs.readdirSync(outDir).filter(f => /\.(flac|mp3)$/i.test(f)).sort();
  for (const f of files) {
    if (!/\.flac$/i.test(f)) continue;
    const fp = path.join(outDir, f);
    process.stdout.write(`  处理 ${f} ... `);
    await validateAndRepair(fp);
    const title = f.replace(/^\d+\s+/, '').replace(/\.flac$/i, '');
    await tagAndCover(fp, title, parseInt(f, 10), album.name, album.date, cover);
    console.log('✓');
  }

  const pl = genPlaylist(outDir, album.name, files);
  console.log(`  ${files.length}/${album.tracks.length} tracks -> ${pl}`);
  summary.push(`${album.name}: ${files.length}/${album.tracks.length}`);
}

async function main() {
  const list = only.length ? albums.filter(a => only.some(o => a.name.includes(o))) : albums;
  for (const album of list) {
    await processAlbum(album);
  }
  console.log('\n=== SUMMARY ===');
  for (const s of summary) console.log('  ' + s);
  if (missing.length) {
    console.log('\n=== MISSING ===');
    for (const m of missing) console.log('  ' + m);
  }
  console.log('\n=== ALL DONE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
