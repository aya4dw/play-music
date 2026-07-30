import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function getFlacDuration(filepath) {
  const buf = readFileSync(filepath);
  if (buf.slice(0, 4).toString() !== 'fLaC') return 0;

  const b18 = buf[18], b19 = buf[19], b20 = buf[20];
  const sampleRate = (b18 << 12) | (b19 << 4) | (b20 >> 4);
  const total = ((buf[21] & 0x0F) << 32) | (buf[22] << 24) | (buf[23] << 16) | (buf[24] << 8) | buf[25];

  if (sampleRate === 0) return 0;
  return total / sampleRate;
}

const dir = join(process.env.USERPROFILE, 'Music', '一人一首成名曲');
const files = readdirSync(dir).filter(f => f.endsWith('.flac'));

let totalSeconds = 0;
for (const file of files) {
  totalSeconds += getFlacDuration(join(dir, file));
}

const hours = Math.floor(totalSeconds / 3600);
const minutes = Math.floor((totalSeconds % 3600) / 60);
const secs = Math.floor(totalSeconds % 60);

console.log(`${files.length} files, Total: ${hours}h ${minutes}m ${secs}s`);
