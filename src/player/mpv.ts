import { createConnection, Socket } from 'node:net';
import { spawn, ChildProcess } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';

const isWindows = process.platform === 'win32';

// Windows uses named pipe, Unix uses socket file
export const MPV_SOCKET = isWindows
  ? '\\\\.\\pipe\\mpv-ipc'
  : `${process.env.HOME}/.play-music/mpv.sock`;

export class MpvIPC {
  private socket: Socket | null = null;
  private requestId = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private buffer = '';

  async connect(target = MPV_SOCKET): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = createConnection(target, () => resolve());
      this.socket.setEncoding('utf-8');
      this.socket.on('data', (data: string) => this.onData(data));
      this.socket.on('error', reject);
    });
  }

  private onData(data: string) {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if ('request_id' in msg && this.pending.has(msg.request_id)) {
          const { resolve, reject } = this.pending.get(msg.request_id)!;
          this.pending.delete(msg.request_id);
          if (msg.error === 'success') {
            resolve(msg.data);
          } else {
            reject(new Error(msg.error));
          }
        }
      } catch {
        // ignore malformed lines
      }
    }
  }

  async command(args: (string | number | boolean)[]): Promise<any> {
    if (!this.socket) throw new Error('Not connected to mpv');
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('mpv command timeout'));
        }
      }, 5000);
      timer.unref(); // don't block Node.js exit
      this.pending.set(id, {
        resolve: (v: any) => { clearTimeout(timer); resolve(v); },
        reject: (e: Error) => { clearTimeout(timer); reject(e); },
      });
      const msg = JSON.stringify({ command: args, request_id: id }) + '\n';
      this.socket!.write(msg);
    });
  }

  async getProperty(name: string): Promise<any> {
    return this.command(['get_property', name]);
  }

  async setProperty(name: string, value: any): Promise<void> {
    await this.command(['set_property', name, value]);
  }

  disconnect() {
    this.socket?.destroy();
    this.socket = null;
    this.pending.clear();
  }
}

export function spawnMpv(url: string, ipcTarget = MPV_SOCKET, volume?: number): ChildProcess {
  const args = [
    '--no-video',
    '--audio-display=no',
    `--input-ipc-server=${ipcTarget}`,
    '--really-quiet',
  ];
  if (volume !== undefined) args.push(`--volume=${volume}`);
  args.push(url);
  const child = spawn('mpv', args, {
    detached: true,
    stdio: 'ignore',
    ...(isWindows ? { shell: false } : {}),
  });
  child.unref();
  return child;
}

export async function isMpvRunningAsync(ipcTarget = MPV_SOCKET): Promise<boolean> {
  if (isWindows) {
    // For named pipe, try to connect
    return new Promise<boolean>((resolve) => {
      const socket = createConnection(ipcTarget, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
      setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 500);
    });
  }

  if (!existsSync(ipcTarget)) return false;
  try {
    return statSync(ipcTarget).isSocket();
  } catch {
    return false;
  }
}

export function isMpvRunning(ipcTarget = MPV_SOCKET): boolean {
  if (isWindows) return false; // Use async version on Windows
  if (!existsSync(ipcTarget)) return false;
  try {
    return statSync(ipcTarget).isSocket();
  } catch {
    return false;
  }
}

export async function connectMpv(socketPath = MPV_SOCKET): Promise<MpvIPC> {
  const mpv = new MpvIPC();
  await mpv.connect(socketPath);
  return mpv;
}
