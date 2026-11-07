#!/usr/bin/env python3
"""
musicdl 桥接器 —— 把 musicdl 的 Python API 暴露成一行 JSON 的 stdin/stdout 协议，
供 engine-adapter.mjs 以子进程方式调用。

用法（stdin 传 JSON）:
  {"op":"search","keyword":"歌名 歌手","sources":["MiguMusicClient",...]}
  {"op":"download","song":{...SongInfo 字段...},"outdir":"/path"}

输出（stdout 单行 JSON）:
  {"ok":true,"data":[...]}
  {"ok":false,"error":"..."}
"""
import json
import os
import sys
import time


def brief(s):
    """把 SongInfo 压成扁平的 JSON 友好 dict。"""
    d = s.__dict__ if hasattr(s, "__dict__") else dict(s)
    return {
        "id": d.get("identifier") or d.get("id") or "",
        "source": d.get("source") or "",
        "name": d.get("song_name") or "",
        "artist": d.get("singers") or "",
        "album": d.get("album") or "",
        "duration": d.get("duration_s") or 0,
        "ext": d.get("ext") or "",
        "bitrate": d.get("bitrate") or 0,
        "url": d.get("download_url") or "",
        "cover": d.get("cover_url") or "",
        "raw": {k: v for k, v in d.items() if isinstance(v, (str, int, float, bool, type(None)))},
    }


def wait_file_stable(path, timeout=180.0, quiet=1.0):
    """
    等待文件写入结束。

    musicdl 的 download() 在后台线程里写文件，函数返回时文件可能只写了一半，
    此时立刻校验会得到「FLAC 尾部截断」的假阳性。
    这里轮询文件大小，直到连续 quiet 秒内不再变化才算写完。
    """
    if not path or not os.path.exists(path):
        return False
    deadline = time.time() + timeout
    last_size = -1
    stable_since = time.time()
    while time.time() < deadline:
        try:
            size = os.path.getsize(path)
        except OSError:
            size = -1
        if size != last_size:
            last_size = size
            stable_since = time.time()
        elif size > 0 and (time.time() - stable_since) >= quiet:
            return True
        time.sleep(0.25)
    return False


def main():
    # musicdl 会往 stdout 打进度条，会污染 JSON 协议流。
    # 在 import 之前把 stdout 整体挪到 stderr，最终结果写到保存下来的真 stdout。
    real_stdout = sys.stdout
    sys.stdout = sys.stderr

    try:
        req = json.loads(sys.stdin.read() or "{}")
    except Exception as e:
        real_stdout.write(json.dumps({"ok": False, "error": f"bad request: {e}"}))
        return

    try:
        from musicdl import musicdl
    except Exception as e:
        real_stdout.write(json.dumps({"ok": False, "error": f"musicdl 未安装: {e}"}, ensure_ascii=False))
        return

    op = req.get("op")
    sources = req.get("sources") or [
        "MiguMusicClient", "NeteaseMusicClient",
        "QQMusicClient", "KuwoMusicClient", "QianqianMusicClient",
    ]

    def emit(obj):
        real_stdout.write(json.dumps(obj, ensure_ascii=False))
        real_stdout.flush()

    try:
        # work_dir 必须通过 init_music_clients_cfg 传，musicdl 才会把产物写到这里
        client = musicdl.MusicClient(
            music_sources=sources,
            init_music_clients_cfg={"work_dir": req.get("outdir") or "musicdl_outputs"},
        )

        if op == "search":
            res = client.search(req.get("keyword", ""))
            out = []
            for src, songs in (res or {}).items():
                for s in songs:
                    out.append(brief(s))
            emit({"ok": True, "data": out})
            return

        if op == "download":
            # 关键：必须在同一次调用里完成「搜索 → 选曲 → 下载」，
            # 因为 musicdl 的下载依赖 SongInfo 对象内部状态
            # （raw_data / download_url_status 等），从扁平 dict 重建会丢失并导致不产出文件。
            res = client.search(req.get("keyword", ""))
            want_name = req.get("name") or ""
            want_album = req.get("album") or ""
            expect = req.get("expect") or 0

            def norm(s):
                return (s or "").lower().replace("（", "(").replace("）", ")")

            best = None
            for src, songs in (res or {}).items():
                for s in songs:
                    d = s.__dict__
                    if want_name and norm(d.get("song_name")) != norm(want_name):
                        continue
                    if want_album and want_album not in str(d.get("album", "")):
                        continue
                    if expect and abs((d.get("duration_s") or 0) - expect) > 6:
                        continue
                    if best is None:
                        best = s
            if best is None:
                emit({"ok": False, "error": "没有匹配的曲目"})
                return

            # download() 会返回「下载后」的 SongInfo 列表，_save_path 是在那里被赋值的，
            # 原对象上的 _save_path 仍是 None，必须取返回值。
            downloaded = client.download([best])
            target = (downloaded or [None])[0] or best
            saved = getattr(target, "_save_path", "") or ""
            if not saved or not os.path.exists(saved):
                emit({"ok": False, "error": f"下载后未找到文件: {saved}"})
                return
            # 必须等文件写完，否则校验会误判为「尾部截断」
            if not wait_file_stable(saved):
                emit({"ok": False, "error": f"文件写入未完成: {saved}"})
                return
            emit({
                "ok": True,
                "data": {
                    "path": saved,
                    "name": best.__dict__.get("song_name"),
                    "artist": best.__dict__.get("singers"),
                    "album": best.__dict__.get("album"),
                    "duration": best.__dict__.get("duration_s"),
                    "ext": best.__dict__.get("ext"),
                },
            })
            return

        emit({"ok": False, "error": f"未知 op: {op}"})
    except Exception as e:
        emit({"ok": False, "error": f"{type(e).__name__}: {e}"})


if __name__ == "__main__":
    main()
