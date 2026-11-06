/**
 * 通过酷狗专辑接口获取完整哈希（origin/320/sq），逐个尝试 tracker 下载。
 * 用法: npx tsx kg-album.ts <albumId> <期望时长秒> [期望文件名]
 */
import { createHash } from 'node:crypto';
import { sourceGet } from '../play-music/src/utils/http.js';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

export async function kgAlbumSongs(albumId: string) {
  const res = await sourceGet('kugou', `http://mobilecdn.kugou.com/api/v3/album/song?albumid=${albumId}&page=1&pagesize=-1`);
  const j: any = await res.json();
  return j?.data?.info || [];
}

export async function kgTracker(hash: string): Promise<string[]> {
  const key = md5(hash + 'kgcloudv2');
  const params = new URLSearchParams({ cdnBackup: '1', behavior: 'download', pid: '1', cmd: '21', appid: '1001', hash, key });
  const res = await sourceGet('kugou', `https://trackercdn.kugou.com/i/v2/?${params.toString()}`);
  const j: any = await res.json();
  return j?.url || [];
}

/** 返回第一个可用的音频 URL */
export async function kgResolve(entry: any): Promise<{ url: string; quality: string } | null> {
  const candidates: Array<[string, string]> = [
    [entry.sqhash, 'flac'],
    [entry['320hash'], '320k'],
    [entry.hash, '128k'],
    [entry.origin_hash, '128k'],
  ].filter(([h]) => !!h) as Array<[string, string]>;

  for (const [h, q] of candidates) {
    const urls = await kgTracker(h);
    if (!urls.length) continue;
    const r = await fetch(urls[0], { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.kugou.com/' } });
    const buf = Buffer.from(await r.arrayBuffer());
    const head = buf.subarray(0, 4).toString('hex');
    const good = head.startsWith('494433') || head === '664c6143' || head.startsWith('fff');
    if (good) return { url: urls[0], quality: q };
  }
  return null;
}

if (process.argv[1]?.endsWith('kg-album.ts')) {
  const albumId = process.argv[2];
  const expect = parseInt(process.argv[3] || '0', 10);
  const songs = await kgAlbumSongs(albumId);
  console.log(`专辑 ${albumId}: ${songs.length} 首`);
  for (const s of songs) {
    const res = await kgResolve(s);
    console.log(`  ${String(s.filename ?? s.name).padEnd(24)} ${s.duration}s -> ${res ? res.quality + ' ✓' : '✗ 不可用'}`);
  }
}
