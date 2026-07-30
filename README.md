# play-music-win

**Tingge CLI** — Windows 适配版

> 原项目：[gxcsoccer/play-music](https://github.com/gxcsoccer/play-music)（MIT License）
>
> 本分支在原项目基础上做了 Windows 兼容适配 + 下载功能增强。

## 与原版的差异

| 修改 | 说明 |
|------|------|
| Windows 兼容 | 命名管道替代 Unix socket；`os.homedir()` 替代 `$HOME`；`where` 替代 `which` |
| 位率选择 | 新增 `-b` / `--bitrate` 参数，支持 `128k`、`320k`、`flac` |
| 下载质量排序 | FLAC > 320k > 128k；按歌手名匹配优先；过滤 Live/合唱版本 |
| 文件校验 | 下载后校验 magic bytes（FLAC/MP3/OGG/M4A），无效文件自动删除重试 |
| 跨平台状态目录 | 使用 `os.homedir()` 确保 Windows 兼容 |

## Windows 部署

### 前置依赖

1. **Node.js** ≥ 18 — 从 [nodejs.org](https://nodejs.org) 下载安装
2. **mpv** — 播放需要，从 [mpv.io](https://mpv.io/) 下载，将 `mpv.exe` 所在目录加入 PATH
3. **ffmpeg**（可选，用于格式转换）— 下载后将 `bin` 目录加入 PATH
4. **Git**（可选，用于更新）— 从 [git-scm.com](https://git-scm.com) 下载

### 安装

```powershell
# 克隆本仓库
git clone https://github.com/aya4dw/play-music-win.git
cd play-music-win

# 安装依赖
npm install

# 构建
npm run build

# 全局安装（可选，可在任意目录使用）
npm install -g .
```

安装后可使用以下别名：
- `play-music` / `pm`
- `ting`
- `mu`

### 使用

```powershell
# 搜索
play-music search "周杰伦 晴天"

# 播放
play-music play "晴天 周杰伦"

# 下载 FLAC
play-music download "许巍 蓝莲花" -b flac -o D:\Music

# 下载（自动选择最佳质量）
play-music download "许巍 蓝莲花" -o D:\Music

# 播放控制
play-music pause
play-music resume
play-music stop
play-music volume 80

# 状态查询
play-music status
```

### 下载选项

```powershell
play-music download "<关键词>" [选项]

选项：
  -o, --output <路径>     输出目录（默认 ~/Music）
  -b, --bitrate <格式>    位率：128k, 320k, flac
  -s, --source <源>       指定源：kuwo, qq, kugou, netease
  --json                  JSON 格式输出
```

下载逻辑：
1. 并发搜索所有平台，按质量排序（FLAC > 320k > 128k）
2. 优先匹配歌手名称，过滤 Live/合唱版本
3. 下载后验证文件头 magic bytes，无效则自动重试其他源
4. 酷我（kuwo）推荐：免费 FLAC 最多

### 构建

```powershell
npm run build
```

输出到 `dist/` 目录。

## CD 刻录

支持使用 cdrdao 将 FLAC 刻录为 Audio CD（含 CD-Text）。

### 安装 cdrdao

1. 从 [cdrdao 官网](https://cdrdao.sourceforge.net/) 下载 Windows 版本（推荐 1.2.6）
2. 解压到 `C:\cdrdao\`，确保 `C:\cdrdao\cdrdao.exe` 存在
3. 将 `C:\cdrdao` 加入 PATH：
   ```powershell
   [Environment]::SetEnvironmentVariable("Path", "$env:Path;C:\cdrdao", "User")
   ```

### 使用前准备

每次刻录前，必须禁用系统休眠和自动播放：

```powershell
powercfg -h off
powercfg -change -standby-timeout-ac 0
Stop-Service -Name "ShellHWDetection" -Force -ErrorAction SilentlyContinue
```

### 查看光驱

```powershell
cdrdao scanbus
# 输出示例：G:\ : PIONEER, BD-RW   BDR-209D, 1.34
```

### FLAC → WAV 转换

Audio CD 只接受 44.1kHz/16bit/stereo WAV：

```powershell
ffmpeg -i input.flac -c:a pcm_s16le -ar 44100 output.wav
```

### 生成 TOC 文件

TOC 文件是 cdrdao 的刻录描述文件，包含 CD-Text 元数据：

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
    TITLE "Track 1"
    PERFORMER "Artist Name"
  }
}
FILE "01 Track1.wav" 0
```

**规则：** FILE 路径使用**相对路径**（仅文件名），不要用反斜杠。

### 刻录

```powershell
# 验证 TOC
cdrdao show-toc album.toc

# 模拟刻录（不写激光）
cdrdao write --simulate --speed 4 --device "G:\" --driver generic-mmc --overburn --eject -n album.toc

# 正式刻录
cdrdao write --speed 16 --device "G:\" --driver generic-mmc --overburn --eject -n album.toc
```

参数说明：
- `--speed`：4x=14 分钟，16x=4 分钟，48x=1.5 分钟
- `--device`：从 `scanbus` 获取的光驱路径
- `--overburn`：允许超刻
- `--eject`：刻录完成弹出光盘

完整流程详见 `skills/music/SKILL.md`。

## 技能文件

本仓库包含 opencode 的下载/刻录技能：

```
skills/music/SKILL.md
```

该技能定义了搜索、播放、下载、CD 刻录等完整工作流。安装方式：

```powershell
# 复制到 opencode 技能目录
copy-item -Recurse skills\music $env:USERPROFILE\.opencode\skills\music
```

或直接让 AI 工具引用该文件。

## 开发

```powershell
# 开发模式（tsx 直接运行）
npm run dev -- download "许巍 蓝莲花" -b flac

# 运行测试
npm test

# 测试覆盖率
npm run test:coverage
```

## License

MIT — 同原项目
