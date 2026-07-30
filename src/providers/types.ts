export type SourceName = 'netease' | 'qq' | 'kugou' | 'kuwo';

export type Bitrate = '128k' | '320k' | 'flac';

export interface Song {
  id: string;
  source: SourceName;
  name: string;
  artist: string;
  album?: string;
  duration: number; // seconds
  cover?: string;
  ext?: string; // expected file extension (flac, mp3, etc)
  extra?: Record<string, unknown>;
}

export interface MusicProvider {
  readonly name: SourceName;
  search(keyword: string, limit?: number): Promise<Song[]>;
  getSongUrl(song: Song, bitrate?: Bitrate): Promise<string>;
  getLyrics(song: Song): Promise<string>;
}

export interface CliOutput<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function success<T>(data: T): CliOutput<T> {
  return { ok: true, data };
}

export function fail(error: string): CliOutput {
  return { ok: false, error };
}
