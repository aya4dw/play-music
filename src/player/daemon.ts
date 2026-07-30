import { mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Song } from '../providers/types.js';

const isWindows = process.platform === 'win32';
const STATE_DIR = join(homedir(), '.play-music');
const STATE_FILE = join(STATE_DIR, 'state.json');

// Windows uses named pipe, Unix uses socket file
export const MPV_SOCKET = isWindows
  ? '\\\\.\\pipe\\mpv-ipc'
  : join(STATE_DIR, 'mpv.sock');

export type RepeatMode = 'off' | 'one' | 'all';

export interface PlayState {
  song: Song | null;
  playlist: Song[];
  currentIndex: number;
  volume: number;
  repeat?: RepeatMode;
}

export function ensureStateDir() {
  mkdirSync(STATE_DIR, { recursive: true });
}

export function readState(): PlayState {
  try {
    const raw = readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { song: null, playlist: [], currentIndex: -1, volume: 80 };
  }
}

export function writeState(state: PlayState) {
  ensureStateDir();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function cleanupSocket() {
  if (isWindows) {
    // TCP doesn't need cleanup, just ensure mpv process is stopped
    return;
  }
  try {
    if (existsSync(MPV_SOCKET)) unlinkSync(MPV_SOCKET);
  } catch {
    // ignore
  }
}
