#!/usr/bin/env node
/**
 * 专辑收尾：校验修复 → 打标签 → 内嵌封面 → 生成 M3U8
 *
 * 用法:
 *   node album-finalize.mjs "<专辑目录>" --artist 谭维维 --album 3811 --date 2020
 *   node album-finalize.mjs "$HOME/Music/谭维维 - 3811" --artist 谭维维 --album 3811 --date 2020
 *
 * 目录内的音频文件需按 "NN 歌名.ext" 命名（NN 从 01 起）。
 */
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const execFileAsync = promisify(execFile);

function arg(name, dflt = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

const dir = process.argv[2];
if (!dir) {
  console.error('用法: album-finalize.mjs "<专辑目录>" --artist <歌手> --album <专辑名> [--date <年>]');
  process.exit(2);
}
const artist = arg('artist', 'Unknown Artist');
const albumName = arg('album', path.basename(dir).replace(/^.* - /, ''));
const date = arg('date', '');

async function sh(cmd, args) {
  const { stdout } = await execFileAsync(cmd, args, { timeout: 300000 });
  return stdout;
}

/** 取封面：Apple Music 优先，取不到就用音源自带的 */
async function downloadCover() {
  const coverPath = path.join(dir, 'cover.jpg');
  if (fs.existsSync(coverPath)) return coverPath;
  try {
    const q = encodeURIComponent(`${artist} ${albumName}`);
    const out = await sh('curl', ['-s', `https://itunes.apple.com/search?term=${q}&media=music&entity=album&limit=1`]);
    const url = JSON.parse(out).results?.[0]?.artworkUrl100;
    if (url) {
      await sh('curl', ['-sL', '-o', coverPath, url.replace(/100x100bb/, '1000x1000bb')]);
      if (fs.statSync(coverPath).size > 1000) return coverPath;
      fs.rmSync(coverPath, { force: true });
    }
  } catch { }
  return null;
}

async function validateAndRepair(fp) {
  try {
    await sh('flac', ['-t', '-s', fp]);
  } catch {
    const tmp = path.join(dir, '.repair-' + path.basename(fp));
    await sh('ffmpeg', ['-y', '-v', 'error', '-i', fp, '-acodec', 'flac', '-compression_level', '8', tmp]);
    fs.renameSync(tmp, fp);
    console.log('    (已无损重编码修复)');
  }
}

async function tagAndCover(fp, title, trackNum, cover) {
  const tmp = path.join(dir, '.tag-' + path.basename(fp));
  const args = ['-y', '-v', 'error', '-i', fp];
  if (cover) args.push('-i', cover);
  args.push('-map', '0:a');
  // 重新 mux 时必须把封面流一起带上，否则 -map 0:a 会把它丢掉
  if (cover) args.push('-map', '1:v', '-c:v', 'copy', '-disposition:v', 'attached_pic');
  args.push('-c:a', 'copy',
    '-metadata', `title=${title}`,
    '-metadata', `artist=${artist}`,
    '-metadata', `album=${albumName}`,
    '-metadata', `album_artist=${artist}`,
    '-metadata', `track=${String(trackNum).padStart(2, '0')}`);
  if (date) args.push('-metadata', `date=${date}`);
  if (cover) args.push('-metadata:s:v', 'comment=Cover (front)', '-metadata:s:v', 'title=Album cover');
  args.push(tmp);
  await sh('ffmpeg', args);
  fs.renameSync(tmp, fp);
}

async function main() {
  if (!fs.existsSync(dir)) {
    console.error(`目录不存在: ${dir}`);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter(f => /\.(flac|mp3|m4a|aac)$/i.test(f)).sort();
  if (!files.length) {
    console.error('目录内没有音频文件');
    process.exit(1);
  }

  const cover = await downloadCover();
  console.log(`封面: ${cover ? path.basename(cover) : '未找到'}`);

  for (const f of files) {
    const fp = path.join(dir, f);
    process.stdout.write(`  处理 ${f} ... `);
    if (/\.flac$/i.test(f)) await validateAndRepair(fp);
    const title = f.replace(/^\d+\s+/, '').replace(/\.[^.]+$/, '');
    await tagAndCover(fp, title, parseInt(f, 10), cover);
    console.log('✓');
  }

  // M3U8：无 BOM、LF 行尾、相对路径（否则部分播放器显示"空播放列表"）
  const lines = ['#EXTM3U'];
  for (const f of files) {
    lines.push(`#EXTINF:-1,${f.replace(/\.(flac|mp3|m4a|aac)$/i, '')}`);
    lines.push(f);
  }
  const pl = path.join(dir, `${albumName}.m3u8`);
  fs.writeFileSync(pl, lines.join('\n') + '\n', 'utf8');

  console.log(`${files.length} 首 → ${pl}`);
}

main().catch(e => { console.error(e); process.exit(1); });
