#!/usr/bin/env node
/**
 * 专辑审计：拉取平台官方曲目表（含标准时长），与本地文件逐条比对，
 * 找出「被截断 / 错版 / 缺失」的曲目。
 *
 * 用法:
 *   node album-audit.mjs "<专辑目录>" --netease <网易云专辑id>
 *   node album-audit.mjs "<专辑目录>" --itunes <Apple Music collectionId>
 *   node album-audit.mjs "<专辑目录>" --ref <参考曲目JSON文件>
 *
 * 参考曲目 JSON 格式: [{"name":"歌名","dur":秒}, ...]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function arg(name, dflt = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

const dir = process.argv[2];
if (!dir) {
  console.error('用法: album-audit.mjs "<专辑目录>" [--netease <id>] [--itunes <id>] [--ref <json>]');
  process.exit(2);
}

const norm = s => (s || '').toLowerCase()
  .replace(/[（(【\[].*?[）)】\]]/g, '')
  .replace(/[\s\-_·、,，.。!！?？'"“”《》—～~]/g, '');

function probe(fp) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries',
      'format=duration,format_name', '-show_entries', 'stream=codec_name',
      '-of', 'json', fp], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const j = JSON.parse(out);
    return {
      dur: parseFloat(j.format?.duration) || 0,
      codec: j.streams?.[0]?.codec_name || '',
      format: j.format?.format_name || '',
    };
  } catch {
    return { dur: 0, codec: '', format: '' };
  }
}

async function neteaseRef(id) {
  const res = await fetch(`https://music.163.com/api/v1/album/${id}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://music.163.com/' },
  });
  const j = await res.json();
  return (j.songs || []).map(s => ({
    name: s.name,
    dur: Math.round((s.dt || 0) / 1000),
    id: String(s.id),
  }));
}

async function itunesRef(id) {
  const res = await fetch(`https://itunes.apple.com/lookup?id=${id}&entity=song`);
  const j = await res.json();
  return j.results
    .filter(r => r.wrapperType === 'track')
    .map(r => ({ name: r.trackName, dur: Math.round((r.trackTimeMillis || 0) / 1000), id: r.trackId }));
}

async function main() {
  let ref = [];
  if (arg('netease')) ref = await neteaseRef(arg('netease'));
  else if (arg('itunes')) ref = await itunesRef(arg('itunes'));
  else if (arg('ref')) ref = JSON.parse(fs.readFileSync(arg('ref'), 'utf8'));
  else {
    console.error('需要 --netease / --itunes / --ref 之一作为参考曲目来源');
    process.exit(2);
  }

  const files = fs.readdirSync(dir).filter(f => /\.(flac|mp3|m4a|aac)$/i.test(f)).sort();
  console.log(`目录: ${path.basename(dir)}`);
  console.log(`参考曲目 ${ref.length} 首 | 本地文件 ${files.length} 个\n`);

  const used = new Set();
  const problems = [];

  for (const f of files) {
    const fp = path.join(dir, f);
    const p = probe(fp);
    const base = norm(f.replace(/^\d+\s+/, '').replace(/\.[^.]+$/, ''));

    let best = null, bestScore = -1;
    ref.forEach((r, i) => {
      if (used.has(i)) return;
      const rn = norm(r.name);
      // 参考名可能带括号别名（如 ཏཱ་རེ་མ།(Tare Ma)），别名也要参与匹配
      const alias = r.name.match(/[（(【\[]([^）)】\]]+)[）)】\]]/);
      const rnAlias = alias ? norm(alias[1]) : '';
      let sc = -1;
      if (rn === base) sc = 100;
      else if (rnAlias && rnAlias === base) sc = 95;
      else if (base && rn && (base.includes(rn) || rn.includes(base))) sc = 70;
      else if (rnAlias && base && (base.includes(rnAlias) || rnAlias.includes(base))) sc = 65;
      if (sc > bestScore) { bestScore = sc; best = { ...r, i }; }
    });

    let status = '✓';
    if (!p.dur) status = '✗ 无法解码';
    else if (best && bestScore > 0 && Math.abs(p.dur - best.dur) > 25) {
      status = `✗ 时长 ${p.dur.toFixed(0)}s ≠ 参考 ${best.dur}s`;
    }
    if (best && bestScore > 0) used.add(best.i);
    if (status !== '✓') problems.push(`${f}: ${status}`);
    console.log(`  ${status} ${f} [${p.codec}] ${p.dur.toFixed(1)}s` +
      (best && bestScore > 0 ? ` (参考 ${best.dur}s ${best.name})` : ''));
  }

  ref.forEach((r, i) => {
    if (!used.has(i)) {
      problems.push(`缺失: ${r.name} (${r.dur}s)`);
      console.log(`  ✗ 缺失 ${r.name} [id=${r.id}]`);
    }
  });

  console.log('\n================ 问题汇总 ================');
  if (!problems.length) console.log('全部正常 ✓');
  else problems.forEach(p => console.log('  ' + p));
  process.exit(problems.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
