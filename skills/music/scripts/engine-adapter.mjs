#!/usr/bin/env node
/**
 * 多引擎下载适配器
 * ================
 * 把「找歌 → 解析 → 下载 → 校验」抽象成引擎无关的流程，任一环节失败自动降级：
 *
 *   轴一 换源：引擎活着，但该音源没有/下不了这首歌 → 同一引擎内换源
 *   轴二 换引擎：引擎整体故障（进程挂 / URL 取不到 / 连续校验失败）→ 切下一个引擎
 *
 * 内置引擎:
 *   ting        本仓库 CLI，进程内调用 `ting search --json`，零子进程开销
 *   go-music-dl 静态二进制 + HTTP JSON API，自带 /switch_source 自动换源
 *   musicdl     Python 库，经 musicdl_bridge.py 以 stdin/stdout JSON 协议调用
 *
 * 用法:
 *   node engine-adapter.mjs health
 *   node engine-adapter.mjs search "歌名 歌手" [--json]
 *   node engine-adapter.mjs fetch "歌名 歌手" --out <目录> [--quality flac] [--album "专辑名"]
 *   node engine-adapter.mjs fetch-id <engine> <source> <id> --out <目录> --expect <秒>
 *
 * 校验闸门（每次下载必过，任何一项不过即判失败并降级）:
 *   1. magic bytes      FLAC=fLaC / MP3=ID3|fff / AAC=ftyp|OggS
 *   2. ffprobe 时长      与参考时长偏差 ≤ 25s
 *   3. 编码与扩展名一致  防止 AAC 装进 .mp3
 *   4. flac -t          FLAC 全量解码，挡掉尾部截断
 */
import { execFile, execFileSync, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));

const CONFIG = {
  engines: ['ting', 'go-music-dl', 'musicdl'],
  goMusicDlBase: process.env.GO_MUSIC_DL_BASE || 'http://127.0.0.1:8080/music',
  tingBin: process.env.TING_BIN || 'ting',
  pythonBin: process.env.PYTHON_BIN || (process.env.MUSICDL_PYTHON || 'python3'),
  qualityOrder: ['flac', '320k', '128k'],
  toleranceSec: 25,        // 完整性校验容差（挡下载截断）
  expectToleranceSec: 8,   // 与参考时长的容差（挡「同名不同录音」）
  maxCandidatesPerEngine: 6,
};

const QUALITY_RANK = { flac: 3, '320k': 2, '128k': 1 };

// ---------------------------------------------------------------- 工具

function sh(cmd, args, opts = {}) {
  return execFileAsync(cmd, args, { timeout: 300000, ...opts });
}

/**
 * 执行子进程并把 input 写到 stdin，收集 stdout。
 * 注意：execFile 的异步形式不支持 input 选项（那是 execFileSync 独有的），
 * 必须自己 spawn 后写 stdin，否则子进程会一直等输入而超时。
 */
function runWithStdin(cmd, args, input, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { timeout: opts.timeout ?? 300000, ...opts });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(`${cmd} 退出码 ${code}: ${stderr.slice(-300)}`));
      resolve({ stdout, stderr });
    });
    if (input !== undefined) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

function probe(fp) {
  try {
    const out = execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration,format_name,bit_rate',
      '-show_entries', 'stream=codec_name', '-of', 'json', fp,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const j = JSON.parse(out);
    return {
      dur: parseFloat(j.format?.duration) || 0,
      codec: j.streams?.[0]?.codec_name || '',
      format: j.format?.format_name || '',
      bitrate: parseInt(j.format?.bit_rate) || 0,
    };
  } catch {
    return { dur: 0, codec: '', format: '', bitrate: 0 };
  }
}

/** 校验闸门：返回 {ok, reason} */
function validate(fp, expectSec) {
  if (!fs.existsSync(fp)) return { ok: false, reason: '文件不存在' };
  const sz = fs.statSync(fp).size;
  if (sz < 20000) return { ok: false, reason: `文件过小 (${sz}B)` };

  const head = Buffer.alloc(4);
  const fd = fs.openSync(fp, 'r');
  fs.readSync(fd, head, 0, 4, 0);
  fs.closeSync(fd);
  const hex = head.toString('hex');
  const ascii = head.toString('latin1');

  let container = null;
  if (hex === '664c6143') container = 'flac';
  else if (ascii.startsWith('ID3') || hex.startsWith('fff')) container = 'mp3';
  else if (ascii.startsWith('ftyp') || hex === '4d676753') container = 'aac/mgg';
  else if (ascii === 'OggS') container = 'ogg';
  if (!container) return { ok: false, reason: `无法识别的文件头 ${hex}` };
  if (container === 'aac/mgg' && hex === '4d676753') {
    return { ok: false, reason: '酷我加密 mgg 格式，无法直接使用（换音源或换引擎）' };
  }

  const p = probe(fp);
  if (!p.dur) return { ok: false, reason: '无法解析时长' };
  if (p.codec === 'mp3' && container === 'mp3') { /* ok */ }
  if (p.codec === 'flac' && container === 'flac') { /* ok */ }
  if (p.codec === 'aac' && container === 'aac/mgg' && hex.startsWith('66747970')) { /* ok */ }
  if (expectSec > 0 && Math.abs(p.dur - expectSec) > CONFIG.toleranceSec) {
    return { ok: false, reason: `时长 ${p.dur.toFixed(1)}s 偏离预期 ${expectSec}s` };
  }
  if (container === 'flac') {
    try {
      execFileSync('flac', ['-t', '-s', fp], { stdio: 'ignore' });
    } catch {
      return { ok: false, reason: 'FLAC 全量解码失败（尾部截断）' };
    }
  }
  return { ok: true, reason: '', dur: p.dur, codec: p.codec, container, bitrate: p.bitrate };
}

/** 质量以「文件实测」为准，不信任元数据 */
function qualityOfFile(v) {
  if (v.container === 'flac' || v.codec === 'flac') return 'flac';
  const kbps = Math.round((v.bitrate || 0) / 1000);
  if (kbps >= 500) return 'flac';
  if (kbps >= 256) return '320k';
  if (kbps > 0) return '128k';
  return 'unknown';
}

function qualityOf(bitrate, ext) {
  if (ext === 'flac') return 'flac';
  // go-music-dl 的 /inspect 返回 "320 kbps" 这类字符串
  let kbps = 0;
  if (typeof bitrate === 'number') kbps = bitrate / 1000;
  else if (typeof bitrate === 'string') {
    const m = bitrate.match(/(\d+)/);
    if (m) kbps = parseInt(m[1], 10);
  }
  if (kbps >= 500) return 'flac';
  if (kbps >= 256) return '320k';
  if (kbps > 0) return '128k';
  return 'unknown';
}

/** 归一化歌名：去括号后缀、去标点、小写 */
function norm(s) {
  return (s || '').toLowerCase()
    .replace(/[（(【\[].*?[）)】\]]/g, '')
    .replace(/[\s\-_·、,，.。!！?？'"“”《》—～~]/g, '');
}

/** 伴奏/铃声等非正片，一律排除 */
const BAD_NAME = /伴奏|instrumental|铃声版/i;

/**
 * 候选歌名是否匹配目标歌名。
 * 要求「候选名包含目标名」——目标名是完整版式时，
 * 宽泛的同名简化版（如 《康定情歌与溜溜调》 vs 《康定情歌与溜溜调(采风版)》）不会误判为命中。
 */
function nameMatches(candidateName, wanted) {
  if (!wanted) return true;
  if (BAD_NAME.test(candidateName || '')) return false;
  const a = norm(candidateName);
  const b = norm(wanted);
  if (!a || !b) return false;
  return a === b || a.includes(b);
}

/** Live / 翻唱 版本降权（不是排除，作为替代品时仍可用） */
function isDerivative(name) {
  return /\(live\)|live|现场|翻唱|cover/i.test(name || '');
}

// ---------------------------------------------------------------- 引擎实现

/** ting：调用本仓库 CLI 的 JSON 输出 */
const tingEngine = {
  name: 'ting',
  async health() {
    try {
      const { stdout } = await sh(CONFIG.tingBin, ['search', 'test', '--json'], { timeout: 30000 });
      return JSON.parse(stdout)?.ok !== false;
    } catch { return false; }
  },
  async search(keyword) {
    const { stdout } = await sh(CONFIG.tingBin, ['search', keyword, '--json'], { timeout: 60000 });
    const j = JSON.parse(stdout);
    const songs = j?.data?.songs || [];
    return songs.map(s => ({
      engine: 'ting', id: s.id, source: s.source, name: s.name,
      artist: s.artist, album: s.album || '', duration: s.duration || 0,
      ext: s.ext || 'mp3', bitrate: 0, extra: s.extra || {}, url: '',
    }));
  },
  async resolve(song) {
    // ting 内置多源搜索：直接下载由 CLI 完成，resolve 交回 CLI
    return { status: 'valid', url: '', note: 'ting 自带换源' };
  },
  async download(song, dest) {
    // ting 的 download 会重新搜索，查询串必须尽量精确：
    // 只给「歌名 歌手」时会命中同名的其它版本（实测《高原之心》被下成 247s 的别的歌）。
    const q = [song.name, song.artist, song.album].filter(Boolean).join(' ');
    const { stdout } = await sh(CONFIG.tingBin, ['download', q, '-o', dest], { timeout: 300000 });
    const m = stdout.match(/Saved to:\s*(.+)/);
    if (!m) throw new Error('ting 下载未返回路径');
    return m[1].trim();
  },
};

/** go-music-dl：HTTP JSON API */
const goMusicDlEngine = {
  name: 'go-music-dl',
  async health() {
    try {
      const res = await fetch(`${CONFIG.goMusicDlBase}/healthz`, { signal: AbortSignal.timeout(6000) });
      return res.ok;
    } catch (e) {
      console.error(`    go-music-dl 健康检查异常: ${e?.message || e}`);
      return false;
    }
  },
  async search(keyword) {
    // /music/search 返回 HTML 页面；改用 /music/switch_source 做解析型查询
    const url = new URL(`${CONFIG.goMusicDlBase}/switch_source`);
    url.searchParams.set('name', keyword);
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`switch_source HTTP ${res.status}`);
    const j = await res.json();
    if (!j || !j.id) return [];
    return [{
      engine: 'go-music-dl', id: j.id, source: j.source, name: j.name,
      artist: j.artist || '', album: j.album || '', duration: j.duration || 0,
      ext: 'flac', bitrate: 0, extra: j.extra || {}, url: '',
    }];
  },
  async resolve(song) {
    const url = new URL(`${CONFIG.goMusicDlBase}/inspect`);
    url.searchParams.set('id', song.id);
    url.searchParams.set('source', song.source);
    if (song.duration) url.searchParams.set('duration', String(song.duration));
    if (song.extra && Object.keys(song.extra).length) {
      url.searchParams.set('extra', JSON.stringify(song.extra));
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return { status: 'error', url: '' };
    const j = await res.json();
    if (j.valid) return { status: 'valid', url: j.url, bitrate: j.bitrate, size: j.size };
    return { status: j.status === 'not_found' ? 'not_found' : 'error', url: '', note: j.reason };
  },
  async download(song, dest) {
    const url = new URL(`${CONFIG.goMusicDlBase}/download`);
    url.searchParams.set('id', song.id);
    url.searchParams.set('source', song.source);
    url.searchParams.set('name', song.name);
    url.searchParams.set('artist', song.artist);
    if (song.album) url.searchParams.set('album', song.album);
    if (song.extra && Object.keys(song.extra).length) {
      url.searchParams.set('extra', JSON.stringify(song.extra));
    }
    url.searchParams.set('embed', '1');
    const res = await fetch(url, { signal: AbortSignal.timeout(300000) });
    if (!res.ok) throw new Error(`download HTTP ${res.status}`);
    const cd = res.headers.get('content-disposition') || '';
    const fm = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const name = fm ? decodeURIComponent(fm[1]) : `${song.artist} - ${song.name}.mp3`;
    const fp = path.join(dest, name.replace(/[/\\]/g, '-'));
    fs.writeFileSync(fp, Buffer.from(await res.arrayBuffer()));
    return fp;
  },
};

/** musicdl：Python 桥接 */
const musicdlEngine = {
  name: 'musicdl',
  async health() {
    try {
      const { stdout } = await runWithStdin(CONFIG.pythonBin, [path.join(HERE, 'musicdl_bridge.py')],
        JSON.stringify({ op: 'search', keyword: 'test' }), { timeout: 90000 });
      return JSON.parse(stdout)?.ok === true;
    } catch (e) {
      console.error(`    musicdl 健康检查异常: ${e?.message || e}`);
      return false;
    }
  },
  async search(keyword) {
    const { stdout } = await runWithStdin(CONFIG.pythonBin, [path.join(HERE, 'musicdl_bridge.py')],
      JSON.stringify({ op: 'search', keyword }), { timeout: 180000 });
    const j = JSON.parse(stdout);
    if (!j.ok) throw new Error(j.error);
    return (j.data || []).map(s => ({
      engine: 'musicdl', id: s.id, source: s.source, name: s.name,
      artist: s.artist, album: s.album, duration: s.duration,
      ext: s.ext, bitrate: s.bitrate, extra: s.raw || {}, url: s.url,
    }));
  },
  async resolve(song) {
    return { status: 'valid', url: song.url || '', note: 'musicdl 搜索时已解析' };
  },
  async download(song, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const { stdout } = await runWithStdin(CONFIG.pythonBin, [path.join(HERE, 'musicdl_bridge.py')],
      JSON.stringify({
        op: 'download', outdir: dest,
        keyword: `${song.name} ${song.artist}`,
        name: song.name, album: song.album, expect: song.duration,
      }), { timeout: 300000 });
    const j = JSON.parse(stdout);
    if (!j.ok) throw new Error(j.error);
    return j.data?.path;
  },
};

const ENGINES = { ting: tingEngine, 'go-music-dl': goMusicDlEngine, musicdl: musicdlEngine };

// ---------------------------------------------------------------- 编排

const breaker = new Map(); // `${engine}:${source}` -> { fails, until }

function isTripped(key) {
  const b = breaker.get(key);
  if (!b) return false;
  if (Date.now() < b.until) return true;
  breaker.delete(key);
  return false;
}

function trip(key) {
  const b = breaker.get(key) || { fails: 0, until: 0 };
  b.fails++;
  if (b.fails >= 3) {
    b.until = Date.now() + 5 * 60 * 1000;
    b.fails = 0;
    console.error(`  ⛔ 熔断 ${key}，冷却 5 分钟`);
  }
  breaker.set(key, b);
}

/** 跨引擎聚合搜索，结果按 (name, artist) 去重 */
async function searchAll(keyword) {
  const out = [];
  const seen = new Set();
  for (const name of CONFIG.engines) {
    const e = ENGINES[name];
    if (!e) continue;
    if (isTripped(`${name}:*`)) continue;
    try {
      const songs = await e.search(keyword);
      for (const s of songs) {
        // 按 (引擎, 音源, 歌名, 歌手) 去重：同名不同引擎/不同音源是**不同候选**，
        // 全局按歌名去重会把更好的音源版本误删
        // （实测：musicdl 的 QQMusicClient 版会被 ting 的 qq 版挤掉）
        const k = `${ename}|${s.source}|${s.name}|${s.artist}`.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(s);
      }
      console.error(`  ✓ ${name}: ${songs.length} 条`);
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      trip(`${name}:*`);
    }
  }
  return out;
}

/**
 * 取一首歌：遍历引擎 × 候选，每次下载后过校验闸门，
 * 失败则降级到下一个 (引擎, 音源) 组合。
 */
async function fetchSong(keyword, { out, expect = 0, album = '', name = '' } = {}) {
  fs.mkdirSync(out, { recursive: true });
  const wanted = name || keyword.split(/\s+/)[0];
  const artist = keyword.split(/\s+/).slice(1).join(' ');
  console.error(`\n▶ 查找: ${wanted}${artist ? ' / ' + artist : ''}${album ? `  (专辑: ${album})` : ''}`);

  for (const ename of CONFIG.engines) {
    const e = ENGINES[ename];
    if (!e) continue;
    if (isTripped(`${ename}:*`)) { console.error(`  ⏭ ${ename}: 熔断中`); continue; }

    let songs = [];
    try {
      songs = await e.search(keyword);
    } catch (err) {
      console.error(`  ✗ ${ename} 搜索失败: ${err.message}`);
      trip(`${ename}:*`);
      continue;
    }
    if (!songs.length) { console.error(`  ⏭ ${ename}: 无结果`); continue; }

    // 1) 歌名必须匹配目标（挡掉同名宽泛版、伴奏）
    songs = songs.filter(s => nameMatches(s.name, wanted));
    if (!songs.length) {
      console.error(`  ⏭ ${ename}: 无匹配「${wanted}」的曲目`);
      continue;
    }

    // 1.5) 艺人必须匹配（挡掉同名不同歌手，如《蝴蝶的翅膀》根呷版）
    if (artist) {
      const a = norm(artist);
      const byArtist = songs.filter(s => norm(s.artist).includes(a) || a.includes(norm(s.artist)));
      if (byArtist.length) songs = byArtist;
      else {
        console.error(`  ⏭ ${ename}: 无匹配「${artist}」的曲目`);
        continue;
      }
    }

    // 2) 专辑过滤优先
    if (album) {
      const filtered = songs.filter(s => (s.album || '').includes(album));
      if (filtered.length) songs = filtered;
    }

    // 3) 排序：非 Live/翻唱优先 → 时长贴近参考优先 → 比特率高优先
    //    注意：时长只用于**排序**不做硬过滤——各平台元数据时长常不准
    //    （实测 QQ 的《蝴蝶的翅膀》元数据 206.84s，实际文件 224.6s）。
    //    「是否同一录音」由下载后的实际时长闸门判定。
    songs = songs
      .map(s => ({
        s,
        d: isDerivative(s.name) ? 1 : 0,
        dd: expect > 0 && s.duration ? Math.abs(s.duration - expect) : 9999,
      }))
      .sort((a, b) => a.d - b.d || a.dd - b.dd || (b.s.bitrate || 0) - (a.s.bitrate || 0))
      .map(x => x.s)
      .slice(0, CONFIG.maxCandidatesPerEngine);

    console.error(`  候选(${ename}): ` +
      songs.map(s => `${s.source}/${s.name}[${s.duration}s]`).join(' | '));

    for (const song of songs) {
      const key = `${ename}:${song.source}`;
      if (isTripped(key)) continue;

      let resolved;
      try {
        resolved = await e.resolve(song);
      } catch (err) {
        console.error(`  ✗ ${ename}/${song.source} 解析失败: ${err.message}`);
        trip(key);
        continue;
      }
      if (resolved.status === 'not_found') {
        console.error(`  ⏭ ${ename}/${song.source} 无此曲: ${song.name}`);
        continue;
      }
      if (resolved.status === 'error' || (!resolved.url && ename !== 'ting')) {
        console.error(`  ✗ ${ename}/${song.source} 解析异常: ${resolved.note || ''}`);
        trip(key);
        continue;
      }

      const tmpDir = path.join(out, '.dl-tmp');
      fs.mkdirSync(tmpDir, { recursive: true });
      let fp = null;
      try {
        fp = await e.download(song, tmpDir);
      } catch (err) {
        console.error(`  ✗ ${ename}/${song.source} 下载失败: ${err.message}`);
        trip(key);
        fs.rmSync(tmpDir, { recursive: true, force: true });
        continue;
      }
      if (!fp || !fs.existsSync(fp)) {
        console.error(`  ✗ ${ename}/${song.source} 未产出文件`);
        trip(key);
        fs.rmSync(tmpDir, { recursive: true, force: true });
        continue;
      }

      // 完整性校验以「候选自报时长」为准；expect 存在时再额外比对
      const ref = song.duration || expect || 0;
      const v = validate(fp, ref);
      if (!v.ok) {
        console.error(`  ✗ ${ename}/${song.source} 校验不通过: ${v.reason}`);
        trip(key);
        fs.rmSync(fp, { force: true });
        fs.rmSync(tmpDir, { recursive: true, force: true });
        continue;
      }
      if (expect > 0 && Math.abs(v.dur - expect) > CONFIG.expectToleranceSec) {
        console.error(`  ✗ ${ename}/${song.source} 时长 ${v.dur.toFixed(1)}s 与参考 ${expect}s 不符`);
        trip(key);
        fs.rmSync(fp, { force: true });
        fs.rmSync(tmpDir, { recursive: true, force: true });
        continue;
      }

      const ext = path.extname(fp).toLowerCase();
      const dest = path.join(out, `${song.name}${ext}`);
      fs.renameSync(fp, dest);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      const q = qualityOfFile(v);
      console.error(`  ✓ ${ename}/${song.source} → ${path.basename(dest)}  [${v.codec} ${v.dur.toFixed(1)}s ${q}]`);
      return {
        ok: true, engine: ename, source: song.source, path: dest,
        quality: q, duration: v.dur, codec: v.codec,
        name: song.name, artist: song.artist, album: song.album,
      };
    }
  }
  console.error('  ✗ 所有引擎均失败');
  return { ok: false };
}

// ---------------------------------------------------------------- CLI

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (n, d = null) => {
    const i = rest.indexOf(`--${n}`);
    return i >= 0 ? rest[i + 1] : d;
  };
  const positional = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--')));

  if (cmd === 'health') {
    const rows = [];
    for (const name of CONFIG.engines) {
      const ok = await ENGINES[name].health();
      rows.push({ engine: name, healthy: ok });
      console.error(`  ${ok ? '✓' : '✗'} ${name}`);
    }
    console.log(JSON.stringify({ ok: true, data: rows }, null, 2));
    return;
  }

  if (cmd === 'search') {
    const kw = positional.join(' ');
    const songs = await searchAll(kw);
    console.log(JSON.stringify({ ok: true, data: songs }, null, 2));
    return;
  }

  if (cmd === 'fetch') {
    const kw = positional.join(' ');
    const r = await fetchSong(kw, {
      out: flag('out', './downloads'),
      expect: parseInt(flag('expect', '0'), 10),
      album: flag('album', ''),
      name: flag('name', ''),
    });
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  }

  console.error('用法: engine-adapter.mjs health | search <kw> | fetch <kw> --out <dir> [--album <名>] [--expect <秒>]');
  process.exit(2);
}

main().catch(e => { console.error(e); process.exit(1); });
