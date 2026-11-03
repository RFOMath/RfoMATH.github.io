#!/usr/bin/env python3
"""pdfs/ qovluğunu skan edib data.js yaradır.
İstifadə:  python generate.py
Qovluq quruluşu: pdfs/<Mövzu>/<fayl>.pdf  (alt qovluğun adı kateqoriya olur)
İl fayl adından avtomatik tapılır (məs. 2023 və ya 2019)."""
import json, re
from pathlib import Path

root = Path(__file__).parent
pdfs = root / "pdfs"
items = []
for f in sorted(pdfs.rglob("*.pdf")):
    rel = f.relative_to(root).as_posix()
    parts = f.relative_to(pdfs).parts
    cat = parts[0] if len(parts) > 1 else "Digər"
    m = re.search(r"(19|20)\d{2}", f.stem)
    name = re.sub(r"[_\-]+", " ", f.stem).strip()
    name = name[:1].upper() + name[1:]
    items.append({"name": name, "file": rel, "cat": cat, "year": int(m.group()) if m else 0})

(root / "data.js").write_text(
    "window.PDFS = " + json.dumps(items, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
print(f"{len(items)} PDF tapıldı -> data.js")
