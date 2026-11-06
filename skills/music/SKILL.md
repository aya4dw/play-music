---
name: music
description: Use when the user wants to search, play, or download Chinese music (网易云/QQ/酷狗/酷我/咪咕), especially whole albums. Covers multi-engine fallback (ting / go-music-dl / musicdl), per-track integrity validation, FLAC tagging, cover embedding, and M3U8 playlists. Triggers on play/search/download song or album, 下载专辑, 批量下歌, lossless music, 网易云/QQ音乐/酷狗/酷我/咪咕.
---

# Music Skill

搜索 / 播放 / 下载华语音乐。核心是**多引擎适配**：任一音源或引擎失效时自动降级，
且每次下载都过完整性校验，绝不把损坏文件写进曲库。

- 配套仓库：`aya4dw/play-music`（UNIX 通用版，macOS / Linux / Windows）
- CLI 本体：`ting`（本仓库 `src/`，Node ≥ 18）
- 本技能脚本目录：`skills/music/scripts/`

---

## 1. 前置依赖

```bash
# CLI 本体（必需）
npm install -g .            # 在本仓库目录执行，提供 ting / play-music / mu 三个别名

# 播放（必需）
brew install mpv            # macOS
sudo apt install mpv       # Debian / Ubuntu
sudo pacman -S mpv         # Arch

# 打标签 / 封面 / 校验（强烈建议）
brew install ffmpeg flac    # macOS
sudo apt install ffmpeg flac
```

可选的第二引擎（用于兜底，见 §3）：

```bash
# go-music-dl：静态单文件，无运行时依赖
curl -sL -o music-dl.tar.gz \
  https://github.com/guohuiyuan/go-music-dl/releases/latest/download/go-music-dl_$(uname -s | tr 'A-Z' 'a-z')_$(uname -m).tar.gz
tar xzf music-dl.tar.gz && mv music-dl ~/.local/bin/
~/.local/bin/music-dl web --port 8080 &     # 起 HTTP 服务，适配器通过它工作

# musicdl：Python 包，带咪咕源和 mgg 解密
python3 -m venv ~/.venvs/musicdl && ~/.venvs/musicdl/bin/pip install musicdl
```

---

## 2. CLI 命令速查

```bash
ting search "关键词" --json          # 跨源搜索，JSON 输出
ting play "歌曲名 歌手"              # 播放（mpv 后台）
ting download "歌名 歌手" -b flac -o DIR   # 下载（128k / 320k / flac）
ting pause | resume | stop | next | prev | volume 80
```

`--json` 输出形如 `{"ok":true,"data":{...}}`，失败时 `{"ok":false,"error":"..."}`。
所有控制命令在管道下自动切 JSON。

---

## 3. 引擎矩阵

三个引擎**音源不同、能力不同**，互为兜底：

| 引擎 | 形态 | 音源 | 独有优势 | 状态 |
|---|---|---|---|---|
| `ting` | 本仓库 CLI，进程内 | 酷我 / 网易 / QQ / 酷狗 | 零子进程开销，JSON 友好 | 上游 2026-04 停更，自维护 |
| `go-music-dl` | Go 静态二进制 + HTTP API | 上述 4 源 + **咪咕** / 千千 / 汽水 / 5sing / B站 | **自带 `/switch_source` 自动换源**、`/inspect` 解析体检、整张专辑队列 | 活跃（2026-11 v1.1.4） |
| `musicdl` | Python 包 | **咪咕** / 网易 / QQ / 酷我 / 千千 + 海外源 | **能解酷我加密 mgg**、优先 FLAC | 活跃（2026-10 v2.14.2） |

关键认知：**「引擎」和「音源」是正交的两条轴**。
实测同一首《康定情歌与溜溜调(采风版)》，`ting` 根本搜不到（它没有咪咕源），
而 `go-music-dl` 和 `musicdl` 都能拿到 —— 这不是引擎坏了，是音源缺失。

### 两条降级轴

```
轴一 换源：引擎活着，但该音源没有/下不了 → 同一引擎内换源
轴二 换引擎：引擎整体故障（进程挂 / URL 取不到 / 连续校验失败）→ 切下一个引擎
```

---

## 4. 多引擎适配器

`skills/music/scripts/engine-adapter.mjs` 把上面三条轴实现成了统一流程。

```bash
cd ~/play-music

# 体检：各引擎是否可用
MUSICDL_PYTHON=~/.venvs/musicdl/bin/python \
GO_MUSIC_DL_BASE=http://127.0.0.1:8080/music \
  node skills/music/scripts/engine-adapter.mjs health

# 跨引擎聚合搜索
node skills/music/scripts/engine-adapter.mjs search "谭维维 蝶"

# 取一首歌：自动跨引擎 × 跨音源降级，全程校验
node skills/music/scripts/engine-adapter.mjs fetch "康定情歌与溜溜调(采风版) 谭维维" \
  --out ~/Music/谭维维\ -\ 高原之心 --name "康定情歌与溜溜调(采风版)" --expect 279
```

| 参数 | 说明 |
|---|---|
| `--out` | 输出目录 |
| `--name` | **目标歌名**（用于同名消歧，强烈建议给） |
| `--expect` | 参考时长（秒），用于挡住「同名不同录音」 |
| `--album` | 目标专辑名，用于专辑过滤 |

环境变量：`GO_MUSIC_DL_BASE`（默认 `http://127.0.0.1:8080/music`）、
`MUSICDL_PYTHON`（musicdl 用的解释器）、`TING_BIN`、`PYTHON_BIN`。

### 候选筛选顺序

1. 歌名匹配：候选名必须**包含**目标名（目标名更完整时才不会误判为命中）
   —— 这样《康定情歌与溜溜调》不会被当成《康定情歌与溜溜调(采风版)》
2. 排除伴奏 / 铃声版
3. 艺人匹配（挡掉同名不同歌手，如《蝴蝶的翅膀》根呷版）
4. 专辑过滤（若给 `--album`）
5. 时长闸门：候选自报时长与 `--expect` 偏差 ≤ 6s
6. 排序：非 Live / 非翻唱优先 → 比特率高的优先

### 熔断

`(引擎, 音源)` 组合连续失败 3 次 → 冷却 5 分钟，期间直接跳过。
`health()` 失败的引擎整体跳过。

---

## 5. 专辑下载工作流

**第 0 步（最关键）：曲目表以平台官方专辑接口为准，不要信维基。**
实测《谭某某》维基列 9 首、官方实为 11 首（多《21克》和《离去之前叫醒我》长版）；
《乌龟的阿基里斯》实为 14 首（Track 12 是《Ich Liebe Dich》不是《我爱你》）。

```bash
# 网易云专辑曲目（含 id、时长）——最可靠
curl -s "https://music.163.com/api/v1/album/<albumId>" -H "User-Agent: Mozilla/5.0" \
  -H "Referer: https://music.163.com" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for i,s in enumerate(d['songs'],1):
    print(f'{i:02d} id={s[\"id\"]} {s[\"name\"]} | {s[\"dt\"]}ms')"

# Apple Music 专辑曲目（含官方封面、权威曲序）
curl -s "https://itunes.apple.com/lookup?id=<collectionId>&entity=song" | python3 -c "
import json,sys
for r in json.load(sys.stdin)['results']:
    if r.get('wrapperType')=='track': print(r['trackNumber'], r['trackName'])"
```

拿到曲目表后：

1. 逐首调适配器 `fetch`，传 `--name` + `--expect` + `--album`
2. 失败的曲目单独排查（换引擎 / 换音源 / 确认是否全平台下架）
3. 全平台都下不到的曲目，**用 Live 或其它版本替代并在文件名标注**
   （例：`06 往日时光 (Live·我是歌手第三季版).flac`）
4. 打标签 + 内嵌封面 + 生成播放列表 → `scripts/album-finalize.mjs`
5. 审计 → `scripts/album-audit.mjs`

参考实现见仓库根目录的 `album-tanweiwei.ts`（谭维维全专辑，11 张 90 首）。

---

## 6. 校验闸门（每次下载必过）

任何一项不过即判失败 → 熔断该 (引擎, 音源) → 换下一个组合。

| # | 检查 | 挡住的坑 |
|---|---|---|
| 1 | magic bytes：`fLaC` / `ID3` / `fff` / `ftyp` | 酷我 **加密 mgg 乱码**（文件 15MB 但不可解析） |
| 2 | `ffprobe` 时长 vs 参考时长（±25s） | **下载被截断**（如 267s 的歌只下了 113s） |
| 3 | 编码与扩展名一致 | **AAC 装在 .mp3** 里（浏览器能播，导入器报错） |
| 4 | `flac -t` 全量解码 | FLAC **尾部截断**（mpv 能播，Apple Music 静默拒收） |

```bash
flac -t 文件.flac      # 输出含 ERROR / LOST_SYNC 即损坏
ffmpeg -y -i 坏.flac -acodec flac -compression_level 8 修复.flac   # 无损重编码修复
```

**只校验 magic bytes 是不够的** —— 尾部截断的 FLAC 头是完好的。

---

## 7. 标签 / 封面 / 播放列表

```bash
node skills/music/scripts/album-finalize.mjs "~/Music/谭维维 - 3811" --artist 谭维维 --album 3811 --date 2020
```

脚本会：校验并修复 FLAC → 写 `TITLE/ARTIST/ALBUM/ALBUMARTIST/TRACK/DATE` →
内嵌封面 → 生成 M3U8。

内嵌封面时**必须把封面流一起带上**，否则 `-map 0:a` 会把它丢掉：

```bash
ffmpeg -y -i 歌.flac -i cover.jpg \
  -map 0:a -map 1:v -c:a copy -c:v copy -disposition:v attached_pic \
  -metadata title="歌名" -metadata artist="歌手" -metadata album="专辑" \
  -metadata album_artist="歌手" -metadata track="01" -metadata date="2020" \
  -metadata:s:v comment="Cover (front)" 输出.flac
```

封面来源（Apple Music 优先，缺失时退回音源自带的）：

```bash
curl -s "https://itunes.apple.com/search?term=<歌手>+<专辑>&media=music&entity=album&limit=1" \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['results'][0]['artworkUrl100'])"
# .../100x100bb.jpg → .../1000x1000bb.jpg
```

**M3U8 必须：无 BOM、LF 行尾、相对路径**。
旧写法 `'\ufeff' + '\r\n'` 会让部分播放器显示"空播放列表"。

---

## 8. 播放器兼容性

### macOS

- **Apple Music（音乐 app）不导入 FLAC**：只支持 MP3/AAC/ALAC/WAV/AIFF，
  FLAC/OGG 会**静默失败**（AppleScript `add` 不报错也不入库）。
  先转 ALAC：`ffmpeg -i 歌.flac -c:a alac -map_metadata 0 歌.m4a`，
  再用 AppleScript 导入（`add` 只接受文件 alias，不能传 track 对象）：
  ```applescript
  tell application "Music"
    make new playlist with properties {name:"专辑名"}
    set pl to first playlist whose name is "专辑名"
    add {POSIX file "/path/01 歌名.m4a" as alias} to pl
  end tell
  ```
- Apple Music 不擅长播放本地 m3u 播放列表（无法解析本地路径引用），会显示"空播放列表"。
- 推荐本地播放器：**Cog**（`brew install --cask cog-app`，开源原生、音乐专用）、
  **VLC** / **IINA**、foobar2000 Mac 版。

### Linux

- **Rhythmbox**（GNOME 自带，apt install rhythmbox）：支持 FLAC，但播放列表要选「文件夹」而非 m3u 文件。
- **Clementine**（apt install clementine）：曲库/播放列表引擎较强。
- **mpv**（本 CLI 底层）：`mpv ~/Music/专辑/01\ 歌名.flac` 直接播。
- **foobar2000 via Wine**、**Strawberry**（`pip install strawberry`）也可用。
- 桌面环境若用 m3u8 播放列表，优先用 VLC（支持相对路径）。

### 通用

- 本 CLI 基于 mpv，`ting play "..."` 命令行直接听。

---

## 9. 故障排查速查

| 症状 | 原因 | 处理 |
|---|---|---|
| 文件 15MB 但 ffprobe 报 0s | 酷我返回**加密 mgg** | 换音源/换引擎；musicdl 能解 |
| 时长只有应有的一半 | 下载被**截断** | 过校验闸门重下；换引擎 |
| 扩展名 .mp3 但 ffprobe 说 aac | 容器与扩展名不符 | 按实测编码改扩展名 |
| `flac -t` 报错但能播放 | FLAC **尾部截断** | ffmpeg 无损重编码修复 |
| 搜不到某首歌 | 该引擎没有对应**音源**（如 ting 无咪咕） | 换引擎：go-music-dl / musicdl |
| 下到同名别的歌手的歌 | 只按歌名搜 | 适配器加 `--name` + `--expect` + 艺人过滤 |
| 搜到宽泛版而非完整版（如缺「(采风版)」） | 模糊搜索 | 用 `--name` 指定完整版式名 |
| 4 个源全锁区 | 版权区域限制 | 换引擎；或确认全平台下架后用 Live 替代并标注 |
| QQ/酷狗 URL 拿不到 | 单曲 hash 随时间失效 | 走**专辑级** hash（`scripts/kg-album.ts`） |

---

## 10. 脚本清单

| 脚本 | 用途 |
|---|---|
| `scripts/engine-adapter.mjs` | 多引擎适配器：健康检查 / 聚合搜索 / 降级下载 / 校验闸门 / 熔断 |
| `scripts/musicdl_bridge.py` | musicdl 的 stdin/stdout JSON 桥接（把 Python 库变成可编排的子进程） |
| `scripts/album-finalize.mjs` | 校验修复 + 打标签 + 内嵌封面 + 生成 M3U8 |
| `scripts/album-audit.mjs` | 拉取平台参考时长，逐条比对本地文件，找出截断/错版/缺失 |
| `scripts/kg-album.ts` | 酷狗专辑级 hash 解析（origin/320/sq），绕过失效的单曲 hash |
| `album-tanweiwei.ts`（仓库根） | 完整专辑下载范例：按专辑约束匹配 + 逐候选回退 |
| `album-*.mjs`（仓库根） | 其它专辑的下载脚本模板 |
