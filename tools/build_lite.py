#!/usr/bin/env python3
"""Build a development-only ZIP from this repository without changing its files.

Only the Python standard library is used. --dry-run never creates a stage or ZIP.
The full source is read once per build; a concurrent source change aborts the build.
"""
from pathlib import Path, PurePosixPath
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
from collections import Counter, defaultdict, deque
import argparse
import hashlib
import html
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
import zlib

ROOT = Path(__file__).resolve().parents[1]
ZIP_NAME = "pinball-knight-development-lite.zip"
ZIP_ROOT = "pinball-knight-development-lite"
DEFAULT_FULL_URL = (
    "https://github.com/luhaobin-lab/pinball-knight-dev-handoff/releases/download/"
    "handoff-2026-10-29/pinball-knight-complete-handoff.zip"
)
SKIP_PARTS = {
    ".git", "node_modules", "__pycache__", "dist", ".DS_Store", ".venv",
    ".pytest_cache", ".ruff_cache", ".mypy_cache", ".vite", ".cache", "coverage",
}
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".svg", ".avif"}
TEXT_SUFFIXES = {".txt", ".md", ".json", ".csv", ".tsv", ".yaml", ".yml", ".log"}
RESEARCH_SUFFIXES = TEXT_SUFFIXES | {".xlsx", ".xls"}
ROOT_HASH_FILES = {"MANIFEST.json", "SHA256SUMS.txt", "PACKAGE_PROFILE.json"}
ENTRY_PAGES = [
    "index.html",
    "art/ui-v10/集中审核.html",
    "art/icons-v6/index.html",
    "art/icons-v6/docs/integration.html",
    "design/GDD_基础规则/阅读入口.html",
    "design/怪物100种设计/阅读入口.html",
    "research/video-research/研究说明与证据索引.html",
    "game/delivery/独立战斗场景.html",
]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def under(path, root):
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def safe_relative(value):
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or "\\" in value:
        raise ValueError("Unsafe relative path: " + value)
    return path.as_posix()


def source_files(root):
    """Do not walk symlink directories or machine caches."""
    for folder, directories, files in os.walk(root, followlinks=False):
        directories[:] = sorted(
            name for name in directories
            if name not in SKIP_PARTS and not (Path(folder) / name).is_symlink()
        )
        for name in sorted(files):
            path = Path(folder) / name
            if path.is_symlink():
                continue
            if path.is_file():
                yield path


def classify(relative, ui_files):
    parts = relative.parts
    name = relative.name
    suffix = relative.suffix.lower()
    if any(part in SKIP_PARTS for part in parts):
        return "machine_cache_or_dependency"
    if name == ".env" or name.startswith(".env.") or suffix in {".pyc", ".zip"}:
        return "secret_cache_or_nested_archive"
    if len(parts) == 1:
        return "regenerated_profile_metadata" if name in ROOT_HASH_FILES else None
    top = parts[0]
    if top == "archive":
        return "historical_archive"
    if top in {"design", "docs", "tools"}:
        return None
    if top == "game":
        if len(parts) >= 2 and parts[1] == "artifacts":
            if len(parts) >= 3 and parts[2] == "migration-validation":
                return None
            return "old_game_artifacts_full_package_only"
        return None
    if top == "art":
        if len(parts) == 2:
            return None
        if parts[1] == "icons-v6":
            if "mothers" in parts[2:]:
                return "high_resolution_icon_mothers_never_distributed"
            if parts[2] == "qa" and suffix in IMAGE_SUFFIXES:
                return "icon_qa_images_full_package_only"
            return None
        if parts[1] == "ui-v10":
            rel = relative.as_posix()
            if rel in ui_files:
                return None
            if len(parts) == 3 and name in {"交付清单.json", "交付说明.txt"}:
                return None
            if len(parts) == 3 and name == "集中审核.html":
                return "replaced_with_lite_ui_gallery"
            if parts[2] in {"提示词", "生成记录", "研究", "目视核对"} and suffix in TEXT_SUFFIXES:
                return None
            return "ui_intermediate_reference_or_comparison_image"
        return "other_art_outside_current_profile"
    if top == "research":
        if len(parts) == 2 and suffix in TEXT_SUFFIXES:
            return None
        if len(parts) >= 3 and parts[1] == "video-research":
            if "证据截图" in parts[2:] or suffix in IMAGE_SUFFIXES:
                return "video_evidence_images_full_package_only"
            if name == "研究说明与证据索引.html":
                return "replaced_with_lite_research_navigation"
            if name == "SHA256SUMS.txt":
                return "regenerated_video_data_hashes"
            return None if suffix in RESEARCH_SUFFIXES else "other_video_research_binary"
        return "duplicate_or_archival_source_research"
    return "outside_development_profile"


def build_plan(root):
    ui_manifest = read_json(root / "art/ui-v10/交付清单.json")
    ui_items = ui_manifest.get("items", [])
    if len(ui_items) != 12 or len({item["id"] for item in ui_items}) != 12:
        raise RuntimeError("Expected exactly 12 unique selected UI images.")
    ui_files = set()
    for item in ui_items:
        local = safe_relative(item["file"])
        if not local.startswith("交付原图/") or not local.lower().endswith(".png"):
            raise RuntimeError("UI manifest must name selected PNGs in 交付原图/.")
        ui_files.add("art/ui-v10/" + local)
    selected, excluded = [], []
    for path in source_files(root):
        relative = path.relative_to(root)
        stat = path.stat()
        entry = {
            "path": relative.as_posix(),
            "bytes": stat.st_size,
            "mtime_ns": stat.st_mtime_ns,
        }
        reason = classify(relative, ui_files)
        if reason is None:
            selected.append(entry)
        else:
            entry["reason"] = reason
            excluded.append(entry)
    selected.sort(key=lambda item: item["path"])
    excluded.sort(key=lambda item: item["path"])
    paths = {item["path"] for item in selected}
    for required in (
        "game/package.json", "game/package-lock.json", "game/AGENTS.md",
        "game/delivery/独立战斗场景.html", "tools/verify_handoff.py",
        "art/icons-v6/pixel-master-map.json", "art/icons-v6/runtime/manifest.json",
        "design/设计权威与进度.txt",
    ):
        if required not in paths:
            raise RuntimeError("Required development file is missing: " + required)
    if not any(name.startswith("game/artifacts/migration-validation/") for name in paths):
        raise RuntimeError("Current game migration-validation evidence must be present.")
    if not any(name.startswith("game/studio/golden/") for name in paths):
        raise RuntimeError("Required game test golden fixtures must be preserved.")
    pngs = [name for name in paths if name.startswith("art/icons-v6/pixels/") and name.endswith(".png")]
    if len(pngs) != 616:
        raise RuntimeError("Expected all 616 delivered icon PNG variants.")
    for width in ("128", "256"):
        if sum(name.startswith("art/icons-v6/pixels/" + width + "/") for name in pngs) != 308:
            raise RuntimeError("Expected 308 PNGs in each icon size.")
    atlas_pngs = [name for name in paths if name.startswith("art/icons-v6/atlas/") and name.endswith(".png")]
    if len(atlas_pngs) != 7:
        raise RuntimeError("Expected all 7 production atlas pages.")
    if not ui_files.issubset(paths):
        raise RuntimeError("A selected UI PNG is missing.")
    for item in ui_items:
        path = root / "art/ui-v10" / item["file"]
        if path.stat().st_size != item["bytes"] or sha256(path) != item["sha256"]:
            raise RuntimeError("Selected UI file differs from its delivery manifest: " + item["file"])
    icon_manifest = read_json(root / "art/icons-v6/manifest.json")
    icons = icon_manifest.get("icons", [])
    if len(icons) != 308:
        raise RuntimeError("Expected 308 icon records.")
    for icon in icons:
        for name in icon["files"].values():
            if "art/icons-v6/" + safe_relative(name) not in paths:
                raise RuntimeError("An icon manifest path is missing: " + name)
        if "art/icons-v6/" + safe_relative(icon["pixelMaster"]) not in paths:
            raise RuntimeError("An editable pixel master is missing.")
    for atlas in icon_manifest.get("atlases", []):
        for key in ("image", "data"):
            if "art/icons-v6/" + safe_relative(atlas[key]) not in paths:
                raise RuntimeError("An atlas resource is missing: " + atlas[key])
    return {"selected": selected, "excluded": excluded, "ui_items": ui_items}


def groups(entries, reason=False):
    result = defaultdict(lambda: {"files": 0, "bytes": 0})
    for entry in entries:
        key = entry["reason"] if reason else "/".join(PurePosixPath(entry["path"]).parts[:2])
        result[key]["files"] += 1
        result[key]["bytes"] += entry["bytes"]
    return dict(sorted(result.items()))


CSS = """
*{box-sizing:border-box}body{margin:0;background:#17151b;color:#eee7dc;font:16px/1.65 system-ui,sans-serif}
main{max-width:1180px;margin:auto;padding:32px 22px 64px}h1{font-size:32px;line-height:1.3}h2{font-size:22px}
a{color:#eac88e}.notice{background:#302832;border-left:4px solid #d4ab66;padding:16px 20px;margin:22px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.card{display:block;padding:18px;border:1px solid #514452;border-radius:7px;background:#242129;color:inherit;text-decoration:none}
.card strong{color:#eac88e}.card p{color:#c2b9c3;font-size:14px;margin:8px 0 0}
button{font:inherit;background:#342c37;color:#f2dfb9;border:1px solid #796449;border-radius:5px;padding:9px 16px;cursor:pointer}
img{max-width:100%;height:auto}.hero{width:100%;display:block;background:#0b0b0e}.bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:16px 0}
.thumbs{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.thumb{padding:6px;text-align:left}
.thumb img{display:block}.thumb span{display:block;font-size:13px;padding:7px 2px}.muted{color:#b9aebb;font-size:14px}
li{margin:8px 0}code,pre{background:#28222c;padding:3px 6px}pre{padding:14px;overflow:auto}
"""


def page(title, body):
    return (
        '<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        "<title>" + html.escape(title) + "</title><style>" + CSS +
        "</style><main>" + body + "</main></html>\n"
    )


def root_index(full_url):
    links = [
        ("art/ui-v10/集中审核.html", "UI v10 · 12张交付整图", "保留3200×1440原始交付像素；精简离线浏览。"),
        ("art/icons-v6/index.html", "ICON v6 · 308件", "616张两档PNG、7页图集；256档作为像素编辑母版。"),
        ("game/delivery/独立战斗场景.html", "真实单场战斗", "当前可运行底盘；新循环和新美术尚未接入。"),
        ("design/GDD_基础规则/阅读入口.html", "核心GDD", "完整基础设计快照；先读设计权威说明。"),
        ("design/怪物100种设计/阅读入口.html", "100种怪物设计", "80普通+20精英；新机制仍待运行实现。"),
        ("design/附魔格50种/附魔格50种.xlsx", "50种附魔表格", "完整正式设计；运行接线与平衡仍待验证。"),
        ("research/video-research/研究说明与证据索引.html", "研究数据导航", "保留JSON/CSV/XLSX；截图索引指向完整资料包。"),
        ("AI接手Prompt.txt", "AI接手Prompt", "阅读范围、已实现与未实现边界。"),
        ("design/设计权威与进度.txt", "设计权威与进度", "无尽目标、两层切片和最新规则覆盖关系。"),
        ("docs/项目进度与下一步.txt", "项目进度", "分阶段实现及验证任务。"),
        ("docs/game-validation.txt", "本次游戏验证", "保留当前迁移验证，不把旧基线失败称为全绿。"),
        ("art/美术制作流程.txt", "美术制作流程", "提示词、处理方法和接入说明。"),
        ("docs/精简包范围.txt", "精简包范围", "保留项、省略项、完整包入口。"),
        ("PACKAGE_PROFILE.json", "精简profile清单", "本次选择范围和省略文件记录。"),
        ("THIRD_PARTY_NOTICES.txt", "来源与许可说明", "研究与生成资产来源继续保留。"),
    ]
    cards = "".join(
        '<a class="card" href="' + html.escape(href, quote=True) + '"><strong>' +
        html.escape(title) + "</strong><p>" + html.escape(note) + "</p></a>"
        for href, title, note in links
    )
    return page("弹球骑士 · 开发精简包", (
        "<h1>弹球骑士 · 开发精简包</h1>"
        "<p>代码、正式设计、当前UI与像素图标的离线入口。</p>"
        '<div class="notice">保留开发和测试所需内容。UI过程图、对照图、视频证据截图和旧归档请查看'
        '<a href="' + html.escape(full_url, quote=True) + '">完整资料包</a>。'
        "任何公开包都不包含高分辨率图标原始母稿。</div>"
        '<div class="grid">' + cards + "</div>"
        '<p class="muted">先读 <a href="README.md">README</a> 和 <a href="AGENTS.md">接手约定</a>。'
        "静态图与离线数据检查不代表运行、平衡或真实手机验收。</p>"
    ))


def ui_gallery(items, full_url):
    first = items[0]
    thumbs = "".join(
        '<button type="button" class="thumb" data-index="' + str(index) + '">'
        '<img loading="lazy" src="' + html.escape(item["file"], quote=True) + '" alt="' +
        html.escape(item["title"], quote=True) + '"><span>' + html.escape(item["id"] + " · " + item["title"]) +
        "</span></button>" for index, item in enumerate(items)
    )
    data = json.dumps([
        {"id": item["id"], "title": item["title"], "file": item["file"], "note": item.get("note", "")}
        for item in items
    ], ensure_ascii=False).replace("<", "\\u003c")
    body = (
        '<p><a href="../../index.html">返回总入口</a></p><h1>UI v10 · 12张交付整图</h1>'
        '<div class="notice">此页只展示最终交付图。前后比较、参考截图和原始生成过程见'
        '<a href="' + html.escape(full_url, quote=True) + '">完整资料包</a>。图片没有缩小或重编码；'
        "保险箱采用已确认的多物品滚动栏位版。</div>"
        '<div class="bar"><button id="prev" type="button">上一张</button>'
        '<button id="next" type="button">下一张</button><b id="heading">' + html.escape(first["title"]) +
        '</b><a id="open" href="' + html.escape(first["file"], quote=True) + '" target="_blank">打开原图</a></div>'
        '<img id="hero" class="hero" src="' + html.escape(first["file"], quote=True) + '" alt="' +
        html.escape(first["title"], quote=True) + '"><p id="note" class="muted"></p>'
        '<div class="thumbs">' + thumbs + '</div><p><a href="交付清单.json">原交付清单与SHA256</a> · '
        '<a href="交付说明.txt">交付说明</a></p><script id="ui-data" type="application/json">' + data + """</script>
<script>
const items=JSON.parse(document.getElementById('ui-data').textContent);let current=0;
function show(index){current=(index+items.length)%items.length;const item=items[current];
document.getElementById('hero').src=item.file;document.getElementById('hero').alt=item.title;
document.getElementById('heading').textContent=item.id+' · '+item.title;
document.getElementById('open').href=item.file;document.getElementById('note').textContent=item.note;
document.querySelectorAll('.thumb').forEach((button,i)=>button.setAttribute('aria-current',i===current?'true':'false'));}
document.getElementById('prev').addEventListener('click',()=>show(current-1));
document.getElementById('next').addEventListener('click',()=>show(current+1));
document.querySelectorAll('.thumb').forEach(button=>button.addEventListener('click',()=>show(Number(button.dataset.index))));
document.addEventListener('keydown',event=>{if(event.key==='ArrowLeft')show(current-1);if(event.key==='ArrowRight')show(current+1);});
show(0);
</script>"""
    )
    return page("UI v10 · 开发精简浏览", body)


def research_navigation(selected, full_url):
    prefix = "research/video-research/"
    links = []
    for entry in selected:
        name = entry["path"]
        if name.startswith(prefix):
            relative = name[len(prefix):]
            if PurePosixPath(relative).suffix.lower() in RESEARCH_SUFFIXES and relative != "SHA256SUMS.txt":
                links.append((relative, entry["bytes"]))
    rows = "".join(
        '<li><a href="' + html.escape(name, quote=True) + '">' + html.escape(name) +
        "</a> <small>" + format(size / 1024, ".1f") + " KiB</small></li>"
        for name, size in links
    )
    body = (
        '<p><a href="../../index.html">返回总入口</a></p><h1>视频研究 · 数据导航</h1>'
        '<div class="notice">开发精简包保留研究数据与来源记录，省略714张证据截图。'
        "JSON和表格中的截图路径是完整资料包的历史索引，不是本包丢失的运行资源。"
        '<a href="' + html.escape(full_url, quote=True) + '">查看完整资料包</a>。</div>'
        "<p>视频观测、原作字段和项目设计仍须分开；缺失或裁切内容不得根据图标造型猜补。</p>"
        "<ul>" + rows + "</ul>"
        '<p><a href="SHA256SUMS.txt">本精简目录SHA256清单</a> · '
        '<a href="../../design/GDD_基础规则/01_研究与依据/原始表格/视频内容研究总表.xlsx">GDD原表副本</a></p>'
    )
    return page("视频研究 · 开发精简导航", body)


def lite_scope(full_url):
    return """开发精简包范围
profile: development-lite

保留：
- game全部源码、测试、必要fixtures、spec、studio、依赖锁文件、工具和离线HTML；保留当前artifacts/migration-validation。
- design全部正式快照、配置、表格、算法和权威说明。
- ICON v6全部616张128/256两档PNG、7页图集、runtime、256档像素编辑母版索引、提示词、回执、脚本、参考和全部QA JSON。
- UI v10最终12张3200×1440交付PNG原字节、交付清单/说明、提示词、生成记录和文字/JSON研究及核对记录。
- 视频研究JSON/CSV/XLSX及使用说明；根文档和当前验证报告。

省略：
- 所有高分辨率原始图标母稿（任何公开profile都不包含）。
- ICON qa目录的大幅图片、构建缓存和dist。
- UI原始生成中间图、参考截图、前后对照大图与旧缩览截图。
- 视频证据截图、research/source-data重复大表、research/source-docs历史研究副本。
- archive全部历史目录，以及game/artifacts中migration-validation之外的旧运行截图/报告。
省略的旧运行与研究图可在完整资料包中查看；高分辨率图标原稿不在完整包。

离线阅读：
- 根index.html、UI集中审核和视频研究导航在临时stage生成精简版本，不修改原仓库viewer。
- UI交付清单里的sourceFile/before及研究数据中的截图路径继续作为完整包的来源索引，精简viewer不会请求这些缺省图片。
- 128与256是两份已交付像素版本，256档只是后续像素编辑母版，不能精确还原原高分辨率母稿或原128档。
- 原docs中的完整包审计、历史文件数量与生成回执保留作来源；本包实际文件范围以PACKAGE_PROFILE.json与MANIFEST.json为准。

验证：
在根目录运行 python3 tools/verify_handoff.py，核对本包独立MANIFEST。
tools/check_readers.mjs可在安装game依赖与Playwright后验证精简离线阅读页。
打包时执行文件SHA256核验、入口本地链接核验和ZIP CRC/成员SHA核验；不把这些当作运行、玩法、性能或手机测试。

再打包：
build_lite.py只在临时stage筛选和生成文件，原始资料不会被删除或重编码。
完整打包器看到PACKAGE_PROFILE.json会拒绝把本目录误标为完整包。
要重新制作完整资料包，使用完整资料或Git仓库克隆，不用精简目录补造省略文件。

完整资料包：
""" + full_url + "\n"


def lite_readme(full_url):
    return """# 弹球骑士 · 开发精简包

这是 development-lite profile：保留代码、全部正式设计、12张UI交付原图、616张像素PNG、7页图集及制作资料，省略大部分历史图片和重复研究附件。

先打开 [离线总入口](index.html)，再读 [AI接手Prompt](AI接手Prompt.txt)、[AGENTS](AGENTS.md)、[设计权威](design/设计权威与进度.txt) 和 [精简范围](docs/精简包范围.txt)。

当前仍是可操作的独立单场战斗；100怪、50附魔、新循环、UI v10与ICON v6还未完成游戏集成。原图/表格不是运行验收。无尽是产品方向，两层是初步验证切片。

## 启动

使用Node.js 24或更高版本，在game目录执行：

    npm ci
    npx playwright install chromium
    npm run dev

也可直接打开 game/delivery/独立战斗场景.html。
开发检查与导出：

    npm run check
    npm run package:battle
    node tools/battle-smoke.mjs

全量测试有已知基线失败；必须阅读 [当前验证报告](docs/game-validation.txt)，不要报告全绿。
浏览器路径可用CHROME_PATH；默认使用Playwright Chromium。

## 文件完整性

在本包根目录执行：

    python3 tools/verify_handoff.py

本包MANIFEST.json与SHA256SUMS.txt独立生成；修改源码后文件哈希变化是预期行为。
PACKAGE_PROFILE.json记录本profile保留与省略的源文件。核验仅针对交付文件，不代表游戏运行或平衡验收。

## 图片与来源

256档PNG直接作为像素编辑母版；两档原像素与哈希均保留。所有公开包都不带高分辨率原始图标母稿。
UI交付图保持原字节，精简图库不提供原始过程/前后对照。视频研究导航保留数据入口，截图索引属于完整资料包。
字体与第三方来源说明仍见 [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt)。

[下载完整资料包](""" + full_url + """)可取得被省略的研究证据图、UI过程与历史附件。重新做完整包应使用完整资料或Git克隆；完整打包器会拒绝把带development-lite标记的目录误标为完整包。
"""


def make_overrides(root, plan, full_url):
    overrides = {
        "index.html": root_index(full_url),
        "README.md": lite_readme(full_url),
        "art/ui-v10/集中审核.html": ui_gallery(plan["ui_items"], full_url),
        "research/video-research/研究说明与证据索引.html": research_navigation(plan["selected"], full_url),
        "docs/精简包范围.txt": lite_scope(full_url),
    }
    prefixes = {
        "AI接手Prompt.txt": "当前目录是开发精简包，开发素材与正式规则齐全。先读docs/精简包范围.txt；原始过程、对照和证据截图按需看完整资料包，不要把省略的历史图误当功能缺失。\n\n",
        "game/README.md": "# 开发精简包补充\n\n源码、测试、fixtures、studio、离线HTML与当前migration-validation均保留。以下原始README所述旧artifacts/battle-smoke等证据在完整资料包，本包不重复携带；本次验证看上级docs/game-validation.txt。\n\n",
        "research/video-research/使用说明.txt": "开发精简包说明：本目录保留JSON/CSV/XLSX及来源文本，省略714张证据截图。阅读入口已换为资料导航。以下为完整研究包原说明，截图和旧索引描述仅供追溯，完整包链接见导航页。\n\n",
    }
    for relative, prefix in prefixes.items():
        path = root / relative
        if path.is_file():
            overrides[relative] = prefix + path.read_text(encoding="utf-8")
    profile = {
        "profile": "development-lite",
        "schemaVersion": 1,
        "fullPackageUrl": full_url,
        "highResolutionIconMothersIncluded": False,
        "sourceFiles": [{"path": x["path"], "bytes": x["bytes"]} for x in plan["selected"]],
        "omittedSourceFiles": [
            {"path": x["path"], "bytes": x["bytes"], "reason": x["reason"]}
            for x in plan["excluded"]
        ],
        "selectedSourceGroups": groups(plan["selected"]),
        "omittedSourceGroups": groups(plan["excluded"], reason=True),
        "stageGeneratedOrRewritten": sorted(list(overrides) + [
            "PACKAGE_PROFILE.json", "MANIFEST.json", "SHA256SUMS.txt",
            "research/video-research/SHA256SUMS.txt",
        ]),
        "boundaries": [
            "Original repository files are not changed; only a temporary stage is written.",
            "High-resolution icon mothers are excluded from every published profile.",
            "All game source/tests/fixtures/studio are preserved; only old game artifact outputs are omitted.",
            "Manifest before/sourceFile and research evidence paths remain full-package provenance.",
            "File, link and ZIP checks are not gameplay or device usability validation.",
        ],
    }
    overrides["PACKAGE_PROFILE.json"] = json.dumps(profile, ensure_ascii=False, indent=2) + "\n"
    return overrides, profile


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in {"href", "src"} and value:
                self.links.append((tag, key, value))


def normalize_link(page_name, value):
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or not parsed.path:
        return None
    # Resolve only a logical path; no filesystem write or current-machine dependency.
    value = unquote(parsed.path)
    if value.startswith("/") or "\\" in value:
        raise RuntimeError("Nonportable local URL in " + page_name + ": " + value)
    stack = list(PurePosixPath(page_name).parent.parts)
    for part in PurePosixPath(value).parts:
        if part == "..":
            if not stack:
                raise RuntimeError("URL escapes package root in " + page_name)
            stack.pop()
        elif part not in {"", "."}:
            stack.append(part)
    return "/".join(stack)


def check_virtual_links(root, plan, overrides):
    existing = {item["path"] for item in plan["selected"]} | set(overrides) | {
        "MANIFEST.json", "SHA256SUMS.txt", "research/video-research/SHA256SUMS.txt",
    }
    checked, local_count, errors = set(), 0, []
    queue = deque(ENTRY_PAGES)
    while queue:
        name = queue.popleft()
        if name in checked:
            continue
        checked.add(name)
        if name not in existing:
            errors.append({"page": name, "error": "entry page absent"})
            continue
        content = overrides.get(name)
        if content is None:
            content = (root / name).read_text(encoding="utf-8")
        parser = LinkParser()
        parser.feed(content)
        for tag, attribute, value in parser.links:
            target = normalize_link(name, value)
            if target is None:
                continue
            local_count += 1
            if target not in existing:
                errors.append({"page": name, "attribute": attribute, "target": target})
            elif PurePosixPath(target).suffix.lower() == ".html" and target not in checked:
                queue.append(target)
    if errors:
        raise RuntimeError("Broken lite entry links: " + json.dumps(errors, ensure_ascii=False))
    return {"pass": True, "htmlPages": len(checked), "localLinks": local_count}


def verify_source_unchanged(root, selected):
    for item in selected:
        path = root / item["path"]
        stat = path.stat()
        if stat.st_size != item["bytes"] or stat.st_mtime_ns != item["mtime_ns"]:
            raise RuntimeError("Source changed during build; retry after it is stable: " + item["path"])


def deflated_size(path, level):
    compressor = zlib.compressobj(level, zlib.DEFLATED, -15)
    total = 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            total += len(compressor.compress(chunk))
    return total + len(compressor.flush())


def estimate_zip(root, plan, overrides, level):
    total = 22
    paths = {item["path"] for item in plan["selected"]} | set(overrides)
    for name in sorted(paths):
        if name in overrides:
            compressor = zlib.compressobj(level, zlib.DEFLATED, -15)
            data = overrides[name].encode("utf-8")
            compressed = len(compressor.compress(data)) + len(compressor.flush())
        else:
            compressed = deflated_size(root / name, level)
        encoded_name = (ZIP_ROOT + "/" + name).encode("utf-8")
        total += compressed + 76 + 2 * len(encoded_name)
    # Manifest/hash-list and local research hash list are generated later. No ZIP is created here.
    return {
        "compressedSelectedAndGeneratedBytes": total,
        "estimatedFinalBytesRange": [total, total + 2 * 1024 * 1024],
        "note": "Read-only DEFLATE estimate; final metadata may add up to roughly 2 MiB. No ZIP or stage was created.",
    }


def write_stage(stage, root, plan, overrides):
    for item in plan["selected"]:
        destination = stage / item["path"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root / item["path"], destination)
    for name, content in overrides.items():
        destination = stage / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(content, encoding="utf-8")
    video = stage / "research/video-research"
    lines = []
    for path in sorted(video.rglob("*")):
        if path.is_file() and path.name != "SHA256SUMS.txt":
            lines.append(sha256(path) + "  " + path.relative_to(video).as_posix() + "\n")
    (video / "SHA256SUMS.txt").write_text("".join(lines), encoding="utf-8")
    verify_source_unchanged(root, plan["selected"])
    entries = []
    for path in sorted(stage.rglob("*")):
        if path.is_file() and path.relative_to(stage).as_posix() not in {"MANIFEST.json", "SHA256SUMS.txt"}:
            entries.append({
                "path": path.relative_to(stage).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            })
    manifest = {
        "profile": "development-lite",
        "description": "Independent frozen lite payload; excludes the root manifest and root SHA256 list.",
        "fullPackageUrl": read_json(stage / "PACKAGE_PROFILE.json")["fullPackageUrl"],
        "files": entries,
    }
    (stage / "MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (stage / "SHA256SUMS.txt").write_text(
        "".join(item["sha256"] + "  " + item["path"] + "\n" for item in entries),
        encoding="utf-8",
    )
    return entries


def standard_verify(stage):
    result = subprocess.run(
        [sys.executable, "-B", str(stage / "tools/verify_handoff.py")],
        cwd=stage, capture_output=True, text=True, encoding="utf-8",
        env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
    )
    if result.returncode:
        raise RuntimeError("Standard hash verification failed:\n" + result.stdout + result.stderr)
    report = json.loads(result.stdout)
    if report.get("pass") is not True:
        raise RuntimeError("Standard verifier did not report pass.")
    return report


def build_zip(stage, destination, entries, level):
    files = sorted(path for path in stage.rglob("*") if path.is_file())
    temporary = destination.with_suffix(".zip.tmp")
    if temporary.exists():
        raise RuntimeError("Temporary output already exists; choose a clean output directory: " + str(temporary))
    try:
        with zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED, compresslevel=level, allowZip64=True) as archive:
            for path in files:
                archive.write(path, ZIP_ROOT + "/" + path.relative_to(stage).as_posix())
        expected = {ZIP_ROOT + "/" + item["path"]: item for item in entries}
        for name in ("MANIFEST.json", "SHA256SUMS.txt"):
            path = stage / name
            expected[ZIP_ROOT + "/" + name] = {"bytes": path.stat().st_size, "sha256": sha256(path)}
        with zipfile.ZipFile(temporary) as archive:
            if len(archive.infolist()) != len(expected) or set(archive.namelist()) != set(expected):
                raise RuntimeError("ZIP members differ from the stage.")
            bad = archive.testzip()
            if bad:
                raise RuntimeError("ZIP CRC failure: " + bad)
            for name, item in expected.items():
                digest = hashlib.sha256()
                count = 0
                with archive.open(name) as stream:
                    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                        count += len(chunk)
                        digest.update(chunk)
                if count != item["bytes"] or digest.hexdigest() != item["sha256"]:
                    raise RuntimeError("ZIP member SHA256 mismatch: " + name)
        os.replace(temporary, destination)
    except BaseException:
        if temporary.is_file():
            temporary.unlink()
        raise
    return {"file": destination.name, "bytes": destination.stat().st_size, "sha256": sha256(destination), "members": len(files)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, help="Release directory outside this repository.")
    parser.add_argument("--dry-run", action="store_true", help="Read-only selection/link audit; never create stage or ZIP.")
    parser.add_argument("--estimate-zip", action="store_true", help="With --dry-run, stream a read-only DEFLATE size estimate.")
    parser.add_argument("--full-package-url", default=DEFAULT_FULL_URL)
    parser.add_argument("--level", type=int, default=6, choices=range(10))
    args = parser.parse_args()
    if args.estimate_zip and not args.dry_run:
        parser.error("--estimate-zip is only valid with --dry-run.")
    if not args.dry_run and args.out is None:
        parser.error("--out is required unless --dry-run is used.")
    if args.out is not None and under(args.out, ROOT):
        parser.error("--out must be outside the source repository.")
    if urlsplit(args.full_package_url).scheme not in {"https", "http"}:
        parser.error("--full-package-url must be an HTTP(S) URL.")
    plan = build_plan(ROOT)
    overrides, profile = make_overrides(ROOT, plan, args.full_package_url)
    links = check_virtual_links(ROOT, plan, overrides)
    summary = {
        "profile": "development-lite",
        "dryRun": args.dry_run,
        "selectedSourceFiles": len(plan["selected"]),
        "selectedSourceBytes": sum(item["bytes"] for item in plan["selected"]),
        "omittedSourceFiles": len(plan["excluded"]),
        "omittedSourceBytes": sum(item["bytes"] for item in plan["excluded"]),
        "selectedGroups": groups(plan["selected"]),
        "omittedGroups": groups(plan["excluded"], reason=True),
        "stageRewrites": sorted(overrides),
        "links": links,
        "assetCounts": {"uiOriginals": 12, "iconPngs": 616, "atlasPages": 7, "pixelMasters": 308},
    }
    if args.dry_run:
        if args.estimate_zip:
            summary["zipEstimate"] = estimate_zip(ROOT, plan, overrides, args.level)
        verify_source_unchanged(ROOT, plan["selected"])
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return
    args.out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="pinball-knight-lite-") as temporary:
        stage = Path(temporary) / ZIP_ROOT
        stage.mkdir()
        entries = write_stage(stage, ROOT, plan, overrides)
        verification = standard_verify(stage)
        product = build_zip(stage, args.out / ZIP_NAME, entries, args.level)
        summary.update({
            "payloadFiles": len(entries),
            "payloadBytes": sum(item["bytes"] for item in entries),
            "hashVerification": verification,
            "product": product,
        })
        # Never overwrite the full packager's release-files.json or SHA256SUMS.txt.
        (args.out / "lite-release.json").write_text(json.dumps(product, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        profile["buildReport"] = summary
        (args.out / "lite-profile.json").write_text(json.dumps(profile, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, RuntimeError, AssertionError) as error:
        print("build_lite: " + str(error), file=sys.stderr)
        sys.exit(1)

