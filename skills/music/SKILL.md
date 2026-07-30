---
name: music
description: Use when the user wants to search, play, or download Chinese music. Supports keywords like play, search, download, song, music, singer, artist. Use for commands like "play [song]", "download [song]", "search [song]", "pause", "stop", "next", "prev".
---

# Music Player Skill

A CLI tool for searching, playing, and downloading Chinese music from Kuwo, QQ Music, KuGou, and NetEase.

## Prerequisites

- mpv installed at `C:\mpv\mpv.exe`
- Node.js project at `C:\Users\weidi\play-music`
- cdrdao 1.2.6 installed at `C:\cdrdao\cdrdao.exe` (for CD burning)
- ffmpeg 8.1.2 installed at `C:\ffmpeg\ffmpeg-8.1.2-essentials_build\bin\ffmpeg.exe` (FLAC→WAV conversion)

## Commands

### Search

```bash
node "C:\Users\weidi\play-music\dist\index.js" search "关键词" --json
```

### Play

```bash
node "C:\Users\weidi\play-music\dist\index.js" play "歌曲名 歌手"
```

### Download

```bash
# Download FLAC (highest quality)
node "C:\Users\weidi\play-music\dist\index.js" download "歌曲名 歌手" -b flac -o "输出目录"

# Download MP3 320k
node "C:\Users\weidi\play-music\dist\index.js" download "歌曲名 歌手" -b 320k -o "输出目录"

# Download with default quality
node "C:\Users\weidi\play-music\dist\index.js" download "歌曲名 歌手" -o "输出目录"
```

### Playback Control

```bash
node "C:\Users\weidi\play-music\dist\index.js" pause
node "C:\Users\weidi\play-music\dist\index.js" resume
node "C:\Users\weidi\play-music\dist\index.js" stop
node "C:\Users\weidi\play-music\dist\index.js" next
node "C:\Users\weidi\play-music\dist\index.js" prev
node "C:\Users\weidi\play-music\dist\index.js" volume 80
```

## Music Sources

| Platform | FLAC | MP3 | Notes |
|----------|------|-----|-------|
| Kuwo | ✅ 2000kflac | ✅ 320k/128k | Best free FLAC support |
| QQ Music | ⚠️ VIP | ✅ 320k/128k | Hot songs need VIP |
| KuGou | ⚠️ VIP | ✅ 320k/128k | Hot songs need VIP |
| NetEase | ⚠️ Copyright | ✅ 320k/128k | Some songs restricted |

## Album Download Workflow

When downloading an album, follow these steps:

### 1. 联网搜索获取完整曲目列表及英文名

先用 WebSearch 搜索专辑，记录：
- 歌曲数量
- 歌曲中文名称
- 歌曲英文名称（用于 CD-Text）
- 歌曲顺序编号

搜索关键词示例：`"歌手名 专辑名 album tracklist English"`

### 2. 软件搜索对比

用 `search` 命令搜索专辑名，对比网络搜索结果：
- 标记已找到的歌曲
- 标记缺失的歌曲

### 3. 单独搜索缺失歌曲

对缺失歌曲单独搜索，可能需要：
- 换用不同关键词（如英文名、别名）
- 换用其他平台

### 4. 下载并编号

下载到以专辑命名的文件夹，文件按编号命名：

```
~/Music/歌手名 - 专辑名/
  01 歌曲名.flac
  02 歌曲名.flac
  ...
```

### 5. 写入 FLAC Tag

 下载完成后，必须为每个 FLAC 文件写入正确的 Tag：
 - `TITLE` - 歌曲名称
 - `ARTIST` - 歌手名称
 - `ALBUM` - 专辑名称
 - `TRACKNUMBER` - 曲目序号（必须）

 使用 Node.js 脚本直接修改 FLAC 文件的 Vorbis Comment 块。

### 5.1 生成 Playlist

 下载完成后，在专辑文件夹内生成 M3U8 播放列表（UTF-8编码，支持中文）。

 ```javascript
 // generate-playlist.mjs
 import fs from 'fs';
 import path from 'path';

 function generatePlaylist(albumDir, albumName, files) {
   const lines = ['#EXTM3U', ''];
   for (const file of files) {
     lines.push(`#EXTINF:-1,${file.replace('.flac', '')}`);
     lines.push(file);
   }
   const m3u8Path = path.join(albumDir, `${albumName}.m3u8`);
   fs.writeFileSync(m3u8Path, '\ufeff' + lines.join('\r\n'), 'utf8');
   console.log(`Playlist: ${m3u8Path}`);
 }
 ```

 或直接在下载脚本末尾添加（参考完整模板）。

### 6. FLAC → WAV 转换

Audio CD 只接受 44.1kHz/16bit/stereo WAV。FLAC → WAV 是**无损解码**（不是转码）。

```bash
# 使用 ffmpeg 转换（无损）
C:\ffmpeg\ffmpeg-8.1.2-essentials_build\bin\ffmpeg.exe -i input.flac -c:a pcm_s16le -ar 44100 output.wav
```

批量转换脚本示例：
```javascript
import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';

const ffmpeg = 'C:\\ffmpeg\\ffmpeg-8.1.2-essentials_build\\bin\\ffmpeg.exe';
const dir = 'C:\\Users\\weidi\\wav_temp';

readdirSync(dir).filter(f => f.endsWith('.flac')).forEach(f => {
  const out = f.replace('.flac', '.wav');
  execSync(`"${ffmpeg}" -i "${join(dir, f)}" -c:a pcm_s16le -ar 44100 "${join(dir, out)}"`);
  console.log(`Converted: ${f} -> ${out}`);
});
```

### 7. 生成 TOC 文件（用于 CD 刻录）

TOC 文件是 cdrdao 的刻录描述文件，包含 CD-Text 元数据。

**TOC 文件格式示例：**
```
CD_DA

CD_TEXT {
  LANGUAGE_MAP { 0 : EN }
  LANGUAGE 0 {
    TITLE "Album Name"
    PERFORMER "Artist Name"
  }
}

TRACK AUDIO
CD_TEXT {
  LANGUAGE 0 {
    TITLE "Track 1 English Name"
    PERFORMER "Artist Name"
  }
}
FILE "01 Track1.wav" 0

TRACK AUDIO
CD_TEXT {
  LANGUAGE 0 {
    TITLE "Track 2 English Name"
    PERFORMER "Artist Name"
  }
}
FILE "02 Track2.wav" 0
```

**重要规则：**
- FILE 路径使用**相对路径**（相对于 TOC 文件所在目录）
- 路径使用**正斜杠**或**不带路径**（仅文件名）
- 不要使用 Windows 反斜杠 `C:\path\file.wav`
- WAV 文件名必须与 FILE 行完全匹配
- INDEX 行不需要（cdrdao 自动计算）

**生成方式：** 手动创建或用脚本生成 TOC 文件，放在 WAV 文件同一目录。

### 8. 刻录 Audio CD

**工具：** cdrdao 1.2.6 (`C:\cdrdao\cdrdao.exe`)

**刻录前必须做的事：**
```powershell
# 1. 禁用休眠（最重要！休眠会导致刻录失败）
powercfg -h off
powercfg -change -standby-timeout-ac 0

# 2. 停止 Windows 自动播放（防止干扰）
Stop-Service -Name "ShellHWDetection" -Force -ErrorAction SilentlyContinue

# 3. 禁用自动运行
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\cdrom" -Name "AutoRun" -Value 0
```

**查看光驱设备：**
```powershell
$env:PATH = "C:\cdrdao;$env:PATH"
& "C:\cdrdao\cdrdao.exe" scanbus
# 输出示例：G:\ : PIONEER, BD-RW   BDR-209D, 1.34
```

**验证 TOC 文件：**
```powershell
& "C:\cdrdao\cdrdao.exe" show-toc "C:\path\to\album.toc"
# 必须在 WAV 文件所在目录运行（cdrdao 用相对路径找文件）
```

**模拟刻录（不写激光）：**
```powershell
& "C:\cdrdao\cdrdao.exe" write --simulate --speed 4 --device "G:\" --driver generic-mmc --overburn --eject -n "C:\path\to\album.toc"
```

**正式刻录：**
```powershell
& "C:\cdrdao\cdrdao.exe" write --speed 16 --device "G:\" --driver generic-mmc --overburn --eject -n "C:\path\to\album.toc"
```

**参数说明：**
- `--speed 16`：写入速度（4x=600KB/s 约14分钟，16x=2400KB/s 约4分钟）
- `--device "G:\"`：光驱设备路径（从 scanbus 获取）
- `--driver generic-mmc`：通用 MMC 驱动
- `--overburn`：允许超刻（超过标称容量）
- `--eject`：刻录完成后弹出
- `-n`：不暂停，直接开始

**刻录时间估算：**
- 4x：约 14 分钟（515 MB）
- 16x：约 4 分钟
- 48x：约 1.5 分钟

**退出码：** 0=成功，非0=失败

## 完整刻录流程速查

```powershell
# 1. 准备环境（每次刻录前执行）
powercfg -h off
powercfg -change -standby-timeout-ac 0
Stop-Service -Name "ShellHWDetection" -Force -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\cdrom" -Name "AutoRun" -Value 0

# 2. FLAC → WAV 转换
C:\ffmpeg\ffmpeg-8.1.2-essentials_build\bin\ffmpeg.exe -i input.flac -c:a pcm_s16le -ar 44100 output.wav

# 3. 创建 TOC 文件（放在 WAV 同一目录）

# 4. 验证 TOC
cd C:\path\to\wav\directory
C:\cdrdao\cdrdao.exe show-toc album.toc

# 5. 模拟刻录
C:\cdrdao\cdrdao.exe write --simulate --speed 4 --device "G:\" --driver generic-mmc --overburn --eject -n album.toc

# 6. 正式刻录（放入新 CD-R）
C:\cdrdao\cdrdao.exe write --speed 16 --device "G:\" --driver generic-mmc --overburn --eject -n album.toc
```

## 故障排除

### 刻录中途失败（COMMAND SEQUENCE ERROR 0x5/0x2c）

**原因：** 系统休眠或 Windows 后台服务干扰光驱。

**解决：**
1. 确认 `powercfg -h off` 已执行
2. 停止 ShellHWDetection 服务
3. 关闭 Windows 资源管理器（可选）
4. 刻录期间不要操作电脑

### cdrdao 模拟刻录实际写入激光

**原因：** cdrdao 1.2.5 的 `--simulate` 有 bug，会实际写入。

**解决：** 使用 cdrdao 1.2.6（`C:\cdrdao\cdrdao.exe`），模拟刻录正常。

### TOC 文件解析错误（Illegal token: \）

**原因：** TOC 文件中使用了 Windows 反斜杠路径。

**解决：** 使用相对路径或正斜杠。

### WAV 文件找不到（Cannot open audio file）

**原因：** cdrdao 从不同目录运行，相对路径失效。

**解决：** 使用 `workdir` 参数指定 WAV 文件所在目录，或使用绝对路径。

### 最后一首歌不完整

**原因：** 刻录中途失败，CD 被 finalize 但数据不完整。

**解决：** 重新刻录，确保刻录过程不被中断。

## Download Script Template

 ```javascript
 // album-download.mjs
 import { execFile } from 'child_process';
 import { promisify } from 'util';
 import fs from 'fs';
 import path from 'path';

 const execFileAsync = promisify(execFile);
 const CLI = 'C:\\Users\\weidi\\play-music\\dist\\index.js';

 const album = {
   artist: '歌手名',
   artistEn: 'English Name',
   name: '专辑名',
   nameEn: 'English Album Name',
   tracks: [
     { cn: '歌曲1', en: 'Song 1' },
     { cn: '歌曲2', en: 'Song 2' },
     // ... 完整曲目列表
   ]
 };

 const outDir = path.join(process.env.HOME || process.env.USERPROFILE, 'Music', `${album.artist} - ${album.name}`);

 function generatePlaylist(albumDir, files) {
   const lines = ['#EXTM3U', ''];
   for (const file of files) {
     lines.push(`#EXTINF:-1,${file.replace('.flac', '')}`);
     lines.push(file);
   }
   const m3u8Path = path.join(albumDir, `${album.name}.m3u8`);
   fs.writeFileSync(m3u8Path, '\ufeff' + lines.join('\r\n'), 'utf8');
   console.log(`Playlist: ${m3u8Path}`);
 }

 async function downloadAlbum() {
   fs.mkdirSync(outDir, { recursive: true });

   for (let i = 0; i < album.tracks.length; i++) {
     const track = album.tracks[i];
     const num = String(i + 1).padStart(2, '0');
     const query = `${track.cn} ${album.artist}`;
     console.log(`\n[${num}/${String(album.tracks.length).padStart(2, '0')}] ${track.cn} → ${track.en}`);

     try {
       const { stdout } = await execFileAsync('node', [CLI, 'download', query, '-b', 'flac', '-o', outDir], { timeout: 300000 });
       if (stdout.includes('Saved to:')) {
         console.log(`  ✓ Downloaded`);
       } else {
         console.log(`  ✗ Failed`);
       }
     } catch (e) {
       console.log(`  ✗ Error: ${e.message}`);
     }
   }

   // 生成 M3U8 播放列表
   const files = fs.readdirSync(outDir).filter(f => f.endsWith('.flac')).sort();
   if (files.length > 0) {
     generatePlaylist(outDir, files);
   }
 }

 downloadAlbum();
 ```

## Batch Download

For the pre-selected 99 Chinese classic songs:

```bash
cd C:\Users\weidi\play-music
node download100.mjs
```

Downloads to `~/Music/一人一首成名曲/`.

## FLAC Duration

To calculate total duration of FLAC files:

```bash
cd C:\Users\weidi\play-music
node get-duration.mjs
```
