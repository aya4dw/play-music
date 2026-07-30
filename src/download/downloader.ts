import { createWriteStream, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { Song, Bitrate } from '../providers/types.js';
import { getProvider } from '../providers/registry.js';
import { sanitizeFilename } from '../utils/format.js';

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
}

export async function downloadSong(
  song: Song,
  outputDir: string,
  onProgress?: (p: DownloadProgress) => void,
  bitrate?: Bitrate,
): Promise<string> {
  const provider = getProvider(song.source);
  if (!provider) throw new Error(`Provider ${song.source} not found`);

  const url = await provider.getSongUrl(song, bitrate);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);

  const contentType = res.headers.get('content-type') ?? '';
  // Always detect from response - don't trust song.ext
  const ext = detectExt(contentType, url);
  const filename = sanitizeFilename(`${song.artist} - ${song.name}.${ext}`);

  mkdirSync(outputDir, { recursive: true });
  const filepath = join(outputDir, filename);

  const total = parseInt(res.headers.get('content-length') ?? '0', 10);
  let downloaded = 0;

  const fileStream = createWriteStream(filepath);
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  await new Promise<void>((resolve, reject) => {
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);

    (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fileStream.write(value);
        downloaded += value.length;
        if (onProgress && total > 0) {
          onProgress({
            downloaded,
            total,
            percent: Math.floor((downloaded / total) * 100),
          });
        }
      }
      fileStream.end();
    })().catch(reject);
  });

  // Validate file header and rename if extension is wrong
  const actualExt = detectFormatFromHeader(filepath);
  if (actualExt && actualExt !== ext) {
    const newFilename = sanitizeFilename(`${song.artist} - ${song.name}.${actualExt}`);
    const newFilepath = join(outputDir, newFilename);
    renameSync(filepath, newFilepath);
    return newFilepath;
  }

  return filepath;
}

function detectFormatFromHeader(filepath: string): string | null {
  try {
    const buf = readFileSync(filepath);
    if (buf.length < 4) return null;
    
    const magic = buf.slice(0, 4).toString('hex');
    const ascii = buf.slice(0, 4).toString('ascii');
    
    // FLAC: fLaC
    if (magic === '664c6143') return 'flac';
    // MP3: ID3 tag or frame sync
    if (ascii === 'ID3' || (magic.startsWith('fff') && (buf[0] & 0xe0) === 0xe0)) return 'mp3';
    // OGG: OggS
    if (ascii === 'OggS') return 'ogg';
    // M4A/MP4: ftyp
    if (buf.slice(4, 8).toString('ascii') === 'ftyp') return 'm4a';
    
    return null;
  } catch {
    return null;
  }
}

function detectExt(contentType: string, url: string): string {
  if (contentType.includes('flac')) return 'flac';
  if (contentType.includes('ogg')) return 'ogg';
  if (contentType.includes('m4a') || contentType.includes('mp4')) return 'm4a';
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3';

  // try from URL
  const urlPath = url.split('?')[0];
  const urlExt = urlPath.split('.').pop()?.toLowerCase();
  if (urlExt && ['mp3', 'flac', 'ogg', 'm4a', 'wav', 'aac'].includes(urlExt)) {
    return urlExt;
  }

  // Check URL for flac indicator
  if (url.includes('flac') || url.includes('2000k')) return 'flac';

  return 'mp3';
}
