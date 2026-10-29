"""Read-only integrity checks for this design handoff; no game/runtime claims."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]

def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def check_manifest(root, manifest_name):
    data = read_json(root / manifest_name)
    entries = data["files"]
    for item in entries:
        path = root / item["path"]
        assert path.is_file(), f"Missing file: {path.relative_to(ROOT)}"
        assert digest(path) == item["sha256"], f"SHA mismatch: {path.relative_to(ROOT)}"
        if "bytes" in item:
            assert path.stat().st_size == item["bytes"], f"Size mismatch: {path.relative_to(ROOT)}"
    return len(entries)

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ("href", "src") and value:
                self.refs.append(value)

def check_links(path):
    parser = Links()
    parser.feed(path.read_text(encoding="utf-8"))
    count = 0
    for ref in parser.refs:
        parsed = urlsplit(ref)
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        target = path.parent / unquote(parsed.path)
        assert target.exists(), f"Broken local link in {path.relative_to(ROOT)}: {ref}"
        count += 1
    return count

def main():
    outer = check_manifest(ROOT, "交接清单.json")
    gdd = check_manifest(ROOT / "GDD_基础规则", "manifest.json")
    monsters = check_manifest(ROOT / "怪物100种设计", "manifest.json")
    data = read_json(ROOT / "怪物100种设计/怪物100种_数据.json")
    rows = data["monsters"]
    assert len(rows) == 100
    assert sum(row["rank"] == "normal" for row in rows) == 80
    assert sum(row["rank"] == "elite" for row in rows) == 20
    assert len({row["id"] for row in rows}) == 100
    assert all(row["runtime_validation"] == "not_yet_verified" for row in rows)
    enchant_path = ROOT / "附魔格50种/附魔格50种_数据.json"
    enchants = read_json(enchant_path)["enchants"]
    assert len(enchants) == 50
    assert len({row["id"] for row in enchants}) == 50
    assert all(row["design_enabled"] is True for row in enchants)
    assert enchant_path.read_bytes() == (ROOT / "GDD_基础规则/03_数值与配置/enchants.json").read_bytes()
    local_links = sum(check_links(p) for p in [
        ROOT / "GDD_基础规则/阅读入口.html",
        ROOT / "怪物100种设计/阅读入口.html",
    ])
    ignored = [p for p in ROOT.rglob("*") if p.name == "__pycache__" or p.suffix == ".pyc" or p.name == ".DS_Store"]
    assert not ignored, f"Unwanted cache files: {ignored}"
    print(json.dumps({
        "status": "pass",
        "handoff_manifest_files": outer,
        "gdd_original_manifest_files": gdd,
        "monster_original_manifest_files": monsters,
        "normal": 80,
        "elite": 20,
        "enchants": 50,
        "enchant_copies_identical": True,
        "local_html_links": local_links,
        "scope": "Read-only file integrity and static catalog checks; not game runtime, controls, or balance.",
    }, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()

