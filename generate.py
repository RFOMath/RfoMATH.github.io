#!/usr/bin/env python3
"""Qovluqları skan edib data.js yaradır.  İstifadə:  python generate.py

arxiv/   -> "Keçmiş illərin arxivi" bölməsi (istənilən dərinlikdə qovluqlar)
           məs: arxiv/Keçmiş illərin RFO-su/2019-2020/Final/Riyaziyyat 9-cu sinif.pdf
           arxiv/ içindəki hər yeni qovluq avtomatik yeni bölmə olur.
pdfs/    -> "Mövzular üzrə" bölməsi (pdfs/<Mövzu>/fayl.pdf)
kitablar/ -> "Kitablar" bölməsi (alt qovluq = kateqoriya; eyni adlı .jpg/.png kitabın üz qabığı olur)

Word (.docx) faylları varsa və kompüterdə LibreOffice qurulubsa, PDF-ə özü çevrilir."""
import json, re, shutil, subprocess
from pathlib import Path

root = Path(__file__).parent

def disp(stem):
    s = re.sub(r"_+", " ", stem).strip()
    return s[:1].upper() + s[1:]

def convert_docs(base):
    docs = [p for p in base.rglob("*") if p.suffix.lower() in (".docx", ".doc")
            and not p.name.startswith("~$") and not p.with_suffix(".pdf").exists()]
    if not docs:
        return
    cands = [shutil.which("soffice"), shutil.which("libreoffice"),
             r"C:\Program Files\LibreOffice\program\soffice.exe",
             r"C:\Program Files (x86)\LibreOffice\program\soffice.exe"]
    office = next((c for c in cands if c and Path(c).exists()), None)
    if not office:
        print(f"! {len(docs)} Word faylı PDF-ə çevrilməyib, sayt yalnız PDF göstərir. Məsələn: {docs[0].name}")
        print("  Həll: Word-də 'Fərqli saxla > PDF' və ya LibreOffice qur, sonra yenidən işlət.")
        return
    for d in docs:
        print("çevrilir:", d.name)
        subprocess.run([office, "--headless", "--convert-to", "pdf", "--outdir", str(d.parent), str(d)],
                       capture_output=True)

def build_tree(base):
    tree = {"d": {}, "f": []}
    if not base.exists():
        return tree
    for f in sorted(base.rglob("*.pdf")):
        n = tree
        for part in f.relative_to(base).parts[:-1]:
            n = n["d"].setdefault(part, {"d": {}, "f": []})
        n["f"].append({"name": disp(f.stem), "file": f.relative_to(root).as_posix()})
    return tree

def build_topics(base):
    items = []
    if not base.exists():
        return items
    for f in sorted(base.rglob("*.pdf")):
        parts = f.relative_to(base).parts
        m = re.search(r"(19|20)\d{2}", f.stem)
        items.append({"name": disp(f.stem), "file": f.relative_to(root).as_posix(),
                      "cat": parts[0] if len(parts) > 1 else "Digər", "year": int(m.group()) if m else 0})
    return items

for folder in ("arxiv", "pdfs", "kitablar"):
    convert_docs(root / folder)
def build_books(base):
    items = []
    if not base.exists():
        return items
    for f in sorted(base.rglob("*.pdf")):
        parts = f.relative_to(base).parts
        cover = next((f.with_suffix("." + e) for e in ("jpg", "jpeg", "png", "webp") if f.with_suffix("." + e).exists()), None)
        b = {"name": disp(f.stem), "file": f.relative_to(root).as_posix(),
             "cat": parts[0] if len(parts) > 1 else "Kitablar", "size": round(f.stat().st_size / 1048576, 1)}
        if cover:
            b["cover"] = cover.relative_to(root).as_posix()
        items.append(b)
    return items

topics, tree, books = build_topics(root / "pdfs"), build_tree(root / "arxiv"), build_books(root / "kitablar")
(root / "data.js").write_text(
    "window.PDFS = " + json.dumps(topics, ensure_ascii=False, indent=1) + ";\n"
    "window.TREE = " + json.dumps(tree, ensure_ascii=False, indent=1) + ";\n"
    "window.BOOKS = " + json.dumps(books, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
total = sum(1 for _ in (root / "arxiv").rglob("*.pdf")) if (root / "arxiv").exists() else 0
print(f"arxiv: {total} PDF, kitab: {len(books)}, mövzular: {len(topics)} -> data.js")
