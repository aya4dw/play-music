import { searchAll, getProvider } from '../providers/registry.js';
import { SourceName, Song, Bitrate, success, fail } from '../providers/types.js';
import { downloadSong } from '../download/downloader.js';
import { join } from 'node:path';
import { readFileSync, unlinkSync } from 'node:fs';

interface DownloadOptions {
  json?: boolean;
  source?: string;
  output?: string;
  bitrate?: string;
}

// Check if a song has FLAC available
function hasFlac(song: Song): boolean {
  const extra = song.extra;
  if (!extra) return false;

  // QQ Music: sizeflac > 0
  if (typeof extra.sizeflac === 'number' && extra.sizeflac > 0) return true;

  // KuGou: sqFileHash exists
  if (extra.sqFileHash && typeof extra.sqFileHash === 'string' && extra.sqFileHash.length > 0) return true;

  // Kuwo: parse minfo field for flac format
  if (extra.minfo && typeof extra.minfo === 'string') {
    // minfo format: "level:ff,bitrate:2000,format:flac,size:52.83Mb;..."
    const formats = extra.minfo.split(';');
    for (const fmt of formats) {
      if (fmt.includes('format:flac')) return true;
    }
  }

  return false;
}

// Score a song's quality (higher = better)
function qualityScore(song: Song): number {
  if (hasFlac(song)) return 3; // FLAC
  const extra = song.extra;
  if (!extra) return 0;

  // QQ Music: check size320
  if (typeof extra.size320 === 'number' && extra.size320 > 0) return 2; // 320k

  return 1; // Default (128k or unknown)
}

export async function downloadCommand(
  keyword: string,
  opts: DownloadOptions,
): Promise<void> {
  try {
    const sources = opts.source ? [opts.source as SourceName] : undefined;
    const bitrate = opts.bitrate as Bitrate | undefined;

    // Search all sources
    const songs = await searchAll(keyword, sources, 10);
    if (songs.length === 0) throw new Error(`No songs found for: ${keyword}`);

    // Sort by quality: FLAC > 320k > 128k, then by source priority
    const sourcePriority: Record<SourceName, number> = {
      kuwo: 1,    // Best free FLAC support
      kugou: 2,
      qq: 3,
      netease: 4,
    };

    // Filter by artist name if keyword contains Chinese artist name
    const artistWords = keyword.match(/[\u4e00-\u9fff]{2,}/g);
    const artistName = artistWords ? artistWords[artistWords.length - 1] : null;
    const matchedSearch = artistName ? songs.filter(s => s.artist.includes(artistName)) : [];
    const sorted = [...(matchedSearch.length > 0 ? matchedSearch : songs)].sort((a, b) => {
      const scoreA = qualityScore(a);
      const scoreB = qualityScore(b);
      if (scoreA !== scoreB) return scoreB - scoreA; // Higher quality first
      // Prefer non-Live, non-duet versions
      const aHasLive = /\(live\)|\(合唱|&/i.test(a.name) || a.artist.includes('&');
      const bHasLive = /\(live\)|\(合唱|&/i.test(b.name) || b.artist.includes('&');
      if (!aHasLive && bHasLive) return -1;
      if (aHasLive && !bHasLive) return 1;
      return (sourcePriority[a.source] ?? 5) - (sourcePriority[b.source] ?? 5);
    });

    const outputDir = opts.output ?? join(process.env.HOME ?? '.', 'Music');
    let lastError = '';
    const failedCombinations = new Set<string>();

    // Try each song until we get a valid download
    for (const song of sorted) {
      const hasFlacQuality = hasFlac(song);
      // Determine what bitrate to actually request
      // If user specified bitrate, use it; otherwise let provider decide (default order)
      const downloadBitrate = bitrate ?? undefined;
      const qualityLabel = bitrate?.toUpperCase() ?? (hasFlacQuality ? 'BEST' : 'DEFAULT');

      const comboKey = `${song.source}:${qualityLabel}`;

      // Skip if this source+quality combination already failed
      if (failedCombinations.has(comboKey)) continue;

      if (!opts.json) {
        console.log(`Trying: ${song.name} - ${song.artist} [${song.source}] (${qualityLabel})`);
      }

      try {
        const filepath = await downloadSong(song, outputDir, (p) => {
          if (!opts.json) {
            process.stdout.write(`\r  ${p.percent}% (${(p.downloaded / 1024 / 1024).toFixed(1)}MB)`);
          }
        }, downloadBitrate);

        // Validate the downloaded file
        if (isValidAudioFile(filepath)) {
          if (!opts.json) {
            process.stdout.write('\n');
            console.log(`Saved to: ${filepath}`);
          } else {
            console.log(JSON.stringify(success({ song, filepath, quality: qualityLabel }), null, 2));
          }
          return;
        } else {
          // Invalid file, delete and mark this combination as failed
          unlinkSync(filepath);
          failedCombinations.add(comboKey);
          if (!opts.json) {
            process.stdout.write('\n');
            console.log(`  Invalid file, skipping ${song.source} ${qualityLabel}...`);
          }
          lastError = 'Downloaded file is not valid audio';
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        failedCombinations.add(comboKey);
        if (!opts.json) {
          console.log(`  Failed: ${lastError}`);
        }
      }
    }

    throw new Error(`All download attempts failed: ${lastError}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (opts.json) {
      console.log(JSON.stringify(fail(msg)));
    } else {
      console.error('Error:', msg);
    }
    process.exit(1);
  }
}

function isValidAudioFile(filepath: string): boolean {
  try {
    const buf = readFileSync(filepath);
    if (buf.length < 12) return false;

    const magic = buf.slice(0, 4).toString('hex');
    const ascii = buf.slice(0, 4).toString('ascii');

    // FLAC: fLaC
    if (magic === '664c6143') return true;
    // MP3: ID3 tag or frame sync (ID3 header is "ID3" + version byte)
    if (ascii.startsWith('ID3')) return true;
    if ((buf[0] & 0xff) === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
    // OGG: OggS
    if (ascii.startsWith('OggS')) return true;
    // M4A/MP4: ftyp
    if (buf.slice(4, 8).toString('ascii') === 'ftyp') return true;

    return false;
  } catch {
    return false;
  }
}
