# play-music

**Tingge CLI** — UNIX 通用版（macOS / Linux / Windows）

> 原项目：[gxcsoccer/play-music](https://github.com/gxcsoccer/play-music)（MIT License）
>
> 本仓库在原项目基础上做了 UNIX 通用化适配，并新增了**多引擎下载适配层**
> （引擎失效自动降级 + 逐曲完整性校验）。
>
> Windows 专用适配见 [aya4dw/play-music-win](https://github.com/aya4dw/play-music-win)。

## 特性

- **四大音乐源** — 网易云、QQ音乐、酷狗、酷我，并发搜索，智能换源
- **多引擎下载适配** — `ting` / `go-music-dl` / `musicdl` 三引擎互为兜底，
  任一引擎或音源失效自动降级；每次下载都过完整性校验（详见 `skills/music/SKILL.md`）
- **在线播放** — 基于 mpv，后台播放不阻塞终端
- **AI 友好** — 所有命令支持 `--json` 输出，控制命令 <50ms 响应，可作为 Claude Code skill
- **交互式 TUI** — 基于 ink，搜索/选歌/播放/歌词一站式体验
- **歌词同步** — 播放时实时滚动显示 LRC 歌词
- **下载** — 支持 MP3/FLAC 下载到本地，位率选择（128k/320k/flac）
- **下载质量排序** — FLAC > 320k > 128k；按歌手名匹配优先；过滤 Live/合唱版本
- **文件校验** — 下载后校验 magic bytes（FLAC/MP3/OGG/M4A），无效文件自动删除重试
- **Statusline** — 集成 Claude Code statusline，编码时底栏显示当前播放

## 与原版的差异

| 修改 | 说明 |
|------|------|
| UNIX 通用化 | `os.homedir()` 跨平台路径；Unix socket 保留；安装步骤给出 brew / apt / pacman 三路 |
| 多引擎下载适配层 | `skills/music/scripts/engine-adapter.mjs`：跨引擎 × 跨音源降级、校验闸门、熔断 |
| 移除光盘刻录 | 不再依赖 cdrdao / CD-Text / TOC，相关脚本与文档已删除 |
| 实用脚本路径适配 | `album-*.mjs` / `add-tracknum.mjs` / `get-duration.mjs` 使用 `os.homedir()` |

## 部署

### 前置依赖

1. **Node.js** ≥ 18 — [nodejs.org](https://nodejs.org)，或 `brew install node` / `apt install nodejs`
2. **mpv** — 播放需要：
   - macOS：`brew install mpv`
   - Debian / Ubuntu：`sudo apt install mpv`
   - Arch：`sudo pacman -S mpv`
3. **ffmpeg** + **flac**（打 Tag / 校验用）：`brew install ffmpeg flac` 或 `sudo apt install ffmpeg flac`
4. **Git**（可选，用于更新）

### 安装

```bash
# 克隆本仓库
git clone https://github.com/aya4dw/play-music.git
cd play-music

# 安装依赖
npm install

# 构建
npm run build

# 全局安装（可在任意目录使用）
npm install -g .
```

安装后可使用以下别名：
- `play-music` / `pm`
- `ting`
- `mu`

### 使用

```bash
# 搜索
play-music search "周杰伦 晴天"

# 播放
play-music play "晴天 周杰伦"

# 下载 FLAC
play-music download "许巍 蓝莲花" -b flac -o ~/Music

# 下载（自动选择最佳质量）
play-music download "许巍 蓝莲花" -o ~/Music

# 播放控制
play-music pause
play-music resume
play-music stop
play-music volume 80

# 状态查询
play-music status
```

### 下载选项

```bash
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

### 交互式 TUI

```bash
pm
```

快捷键：

| 视图 | 按键 | 功能 |
|------|------|------|
| 搜索 | `Enter` | 执行搜索 |
| 搜索 | `q` | 退出 |
| 结果 | `j/k` 或 `↑↓` | 上下选择 |
| 结果 | `Enter` | 播放选中歌曲 |
| 结果 | `Esc` | 返回搜索 |
| 播放 | `Space` | 暂停/恢复 |
| 播放 | `←→` | 前进/后退 5 秒 |
| 播放 | `↑↓` | 音量加减 |
| 播放 | `Esc` | 返回列表 |

### 构建

```bash
npm run build
```

输出到 `dist/` 目录。

## 技能文件

本仓库包含完整的下载技能：

```
skills/music/
  SKILL.md                     # 主文档：多引擎、专辑工作流、校验闸门、排错表
  scripts/
    engine-adapter.mjs         # 多引擎适配器：健康检查 / 聚合搜索 / 降级下载 / 熔断
    musicdl_bridge.py          # musicdl 的 stdin/stdout JSON 桥接
    album-finalize.mjs         # 校验修复 + 打标签 + 内嵌封面 + 生成 M3U8
    album-audit.mjs            # 对照平台官方曲目表审计本地文件
    kg-album.ts                # 酷狗专辑级 hash 解析（绕过失效的单曲 hash）
```

安装到 opencode 技能目录：

```bash
cp -R skills/music ~/.config/opencode/skills/music
```

或直接让 AI 工具引用 `skills/music/SKILL.md`。

### 多引擎适配层

```bash
# 体检
MUSICDL_PYTHON=~/.venvs/musicdl/bin/python \
GO_MUSIC_DL_BASE=http://127.0.0.1:8080/music \
  node skills/music/scripts/engine-adapter.mjs health

# 取一首歌（引擎 × 音源自动降级，全程校验）
node skills/music/scripts/engine-adapter.mjs fetch "康定情歌与溜溜调(采风版) 谭维维" \
  --out ~/Music --name "康定情歌与溜溜调(采风版)" --expect 279
```

| 引擎 | 形态 | 独有优势 |
|------|------|---------|
| `ting`（本仓库 CLI） | 进程内，零子进程开销 | 最快，JSON 友好 |
| `go-music-dl` | Go 静态二进制 + HTTP API | 自带自动换源、解析体检；多出咪咕/汽水/B站等源 |
| `musicdl` | Python 包 | 能解酷我加密 mgg，优先 FLAC |

## 实用脚本

- `album-*.mjs` / `album-tanweiwei.ts` — 专辑下载脚本（自动编号 + FLAC Tag + M3U8）
- `download100.mjs` — 批量下载 100 首经典中文歌曲
- `add-tracknum.mjs` — 为 FLAC 写入 TRACKNUMBER
- `get-duration.mjs` — 计算 FLAC 总时长

## 开发

```bash
# 开发模式（tsx 直接运行）
npm run dev -- download "许巍 蓝莲花" -b flac

# 运行测试
npm test

# 测试覆盖率
npm run test:coverage
```

## License

MIT — 同原项目
