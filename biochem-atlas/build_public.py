#!/usr/bin/env python3
"""Собирает index.html из шаблона src/template.html, данных из папки data/
и конспекта из папки notes/.

Запуск из папки проекта:  python3 build.py
Нужен только Python 3, сторонние пакеты не требуются.
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TEMPLATE = ROOT / "src" / "template.html"
OUTPUT = ROOT / "index.html"
NOTES_DIR = ROOT / "notes"
SLOT = re.compile(r"/\*@([a-z]+\.json)\*/")

SECTIONS = {"aa", "carb", "tca", "lip", "nit", "neuro", "vit", "nuc", "horm", "drug"}
PATHS = {"glyc", "tca", "urea", "trp"}
ANIMS = {"etc", "kin", "hb", "box", "camp"}
CALLOUTS = {"Клиника": "clin", "Регуляция": "reg", "Запомни": "key", "Важно": "key"}


def plural(n, one, few, many):
    if n % 10 == 1 and n % 100 != 11:
        return one
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return few
    return many


def load(name):
    path = ROOT / "data" / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        sys.exit(f"Нет файла data/{name}")
    except json.JSONDecodeError as err:
        sys.exit(f"Ошибка в data/{name}, строка {err.lineno}, позиция {err.colno}: {err.msg}")


# ---------- конспект ----------

INLINE = re.compile(r"\*\*(.+?)\*\*|\[\[([a-z0-9_]+)(?:\|([^\]]+))?\]\]")
CAPITAL = re.compile(r"^((?:[A-Za-zα-ω0-9,′]+-)*)([А-ЯЁA-Z])(?=[а-яёa-z])")


def link_text(name):
    """«Глюкоза» → «глюкоза», «L-Лактат» → «L-лактат», «АТФ» и «ГМГ-КоА» без изменений."""
    return CAPITAL.sub(lambda m: m.group(1) + m.group(2).lower(), name, count=1)


def inline(text, names, used, where, problems):
    out, pos = [], 0
    for m in INLINE.finditer(text):
        out.append(html.escape(text[pos:m.start()], quote=False))
        if m.group(1) is not None:
            out.append("<b>" + html.escape(m.group(1), quote=False) + "</b>")
        else:
            sid = m.group(2)
            if sid not in names:
                problems.append(f"{where}: неизвестное вещество «{sid}» в ссылке [[{sid}]]")
                label = m.group(3) or sid
            else:
                label = m.group(3) or link_text(names[sid])
                used.append(sid)
            out.append(f'<a href="#" class="tk nl" data-go="{sid}">{html.escape(label, quote=False)}</a>')
        pos = m.end()
    out.append(html.escape(text[pos:], quote=False))
    return "".join(out)


def parse_note(path, num, names, problems):
    tid = re.sub(r"^\d+-", "", path.stem)
    where = f"notes/{path.name}"
    lines = path.read_text(encoding="utf-8").splitlines()
    meta, i = {}, 0
    while i < len(lines) and lines[i].strip():
        key, sep, val = lines[i].partition(":")
        if not sep:
            break
        meta[key.strip()] = val.strip()
        i += 1
    topic = {"id": tid, "num": num, "title": meta.get("title", tid), "color": meta.get("color", "aa"),
             "paths": [p for p in meta.get("paths", "").replace(",", " ").split() if p],
             "anims": [a for a in meta.get("anims", "").replace(",", " ").split() if a],
             "sum": [], "secs": [], "quiz": [], "subs": []}
    if "title" not in meta:
        problems.append(f"{where}: нет строки «title: …» в начале файла")
    if topic["color"] not in SECTIONS:
        problems.append(f"{where}: color «{topic['color']}» — допустимо: {', '.join(sorted(SECTIONS))}")
    for p in topic["paths"]:
        if p not in PATHS:
            problems.append(f"{where}: неизвестная схема «{p}» — допустимо: {', '.join(sorted(PATHS))}")
    for a in topic["anims"]:
        if a not in ANIMS:
            problems.append(f"{where}: неизвестная анимация «{a}» — допустимо: {', '.join(sorted(ANIMS))}")

    used, para, lst, tbl = [], [], None, None
    sec = None

    def fx(text, ln):
        return inline(text, names, used, f"{where}, строка {ln}", problems)

    def flush():
        nonlocal para, lst, tbl
        target = sec["b"] if sec else None
        if para:
            if target is None:
                problems.append(f"{where}: текст до первого заголовка «## …»")
            else:
                target.append(["p", " ".join(para)])
            para = []
        if lst:
            if target is not None:
                target.append(lst)
            lst = None
        if tbl:
            if target is not None:
                head, *rows = tbl
                target.append(["tbl", head, rows])
            tbl = None

    for ln, raw in enumerate(lines[i:], start=i + 1):
        line = raw.rstrip()
        s = line.strip()
        if not s:
            flush()
            continue
        if s.startswith("! "):
            flush()
            topic["sum"].append(fx(s[2:], ln))
        elif s.startswith("## "):
            flush()
            sec = {"h": html.escape(s[3:].strip(), quote=False), "b": []}
            topic["secs"].append(sec)
        elif s.startswith("? "):
            flush()
            topic["quiz"].append([fx(s[2:], ln), ""])
        elif s.startswith("= "):
            flush()
            if not topic["quiz"] or topic["quiz"][-1][1]:
                problems.append(f"{where}, строка {ln}: ответ «= …» без вопроса «? …» перед ним")
            else:
                topic["quiz"][-1][1] = fx(s[2:], ln)
        elif s.startswith("> "):
            flush()
            body = s[2:]
            label, sep, rest = body.partition(":")
            kind = CALLOUTS.get(label.strip()) if sep else None
            if not kind:
                problems.append(f"{where}, строка {ln}: врезка должна начинаться с «Клиника:», «Регуляция:», «Запомни:» или «Важно:»")
                kind, label, rest = "key", "Важно", body
            if sec is None:
                problems.append(f"{where}, строка {ln}: врезка до первого заголовка «## …»")
            else:
                sec["b"].append(["note", kind, html.escape(label.strip(), quote=False), fx(rest.strip(), ln)])
        elif s.startswith("|"):
            if para or lst:
                flush()
            cells = [c.strip() for c in s.strip("|").split("|")]
            if all(re.fullmatch(r":?-{3,}:?", c) for c in cells if c):
                continue
            tbl = (tbl or []) + [[fx(c, ln) for c in cells]]
        elif s.startswith("- "):
            if para or tbl or (lst and lst[0] != "ul"):
                flush()
            lst = lst or ["ul", []]
            lst[1].append(fx(s[2:], ln))
        elif re.match(r"\d+\.\s", s):
            if para or tbl or (lst and lst[0] != "ol"):
                flush()
            if not lst:
                start = int(re.match(r"\d+", s).group())
                lst = ["ol", []] + ([start] if start != 1 else [])
            lst[1].append(fx(re.sub(r"^\d+\.\s+", "", s), ln))
        else:
            if lst or tbl:
                flush()
            para.append(fx(s, ln))
    flush()

    for q in topic["quiz"]:
        if not q[1]:
            problems.append(f"{where}: у вопроса «{re.sub('<[^>]+>', '', q[0])[:50]}» нет ответа «= …»")
    if not topic["secs"]:
        problems.append(f"{where}: нет ни одного раздела «## …»")
    seen = []
    for sid in used:
        if sid not in seen:
            seen.append(sid)
    topic["subs"] = seen
    text = " ".join(json.dumps([topic["sum"], topic["secs"]], ensure_ascii=False).split())
    words = len(re.sub(r"<[^>]+>", " ", text).split())
    topic["min"] = max(1, round(words / 120))
    return topic


def parse_notes(substances, problems):
    names = {s["id"]: s.get("sn") or s["n"] for s in substances}
    files = sorted(NOTES_DIR.glob("*.md")) if NOTES_DIR.exists() else []
    topics = [parse_note(p, k, names, problems) for k, p in enumerate(files, 1)]
    ids = [t["id"] for t in topics]
    for tid in set(ids):
        if ids.count(tid) > 1:
            problems.append(f"notes: тема «{tid}» встречается в нескольких файлах")
    return topics


# ---------- проверка данных ----------

def check(data):
    """Проверяет, что все ссылки на вещества указывают на существующие id."""
    ids = {s["id"] for s in data["substances.json"]}
    problems = []

    def need(where, sid):
        if sid not in ids:
            problems.append(f"{where}: неизвестное вещество «{sid}»")

    seen = set()
    for s in data["substances.json"]:
        if s["id"] in seen:
            problems.append(f"substances.json: id «{s['id']}» встречается дважды")
        seen.add(s["id"])
    for i, r in enumerate(data["reactions.json"], 1):
        for tok in r["s"] + r["p"]:
            if tok[1]:
                need(f"reactions.json, реакция {i}", tok[1])
        for sid in r["x"]:
            need(f"reactions.json, реакция {i}", sid)
    for key in data["formulas.json"]:
        need("formulas.json", key)
    for key in data["mnemonics.json"]:
        need("mnemonics.json", key)
    for p in data["pairs.json"]:
        need("pairs.json", p[0])
        need("pairs.json", p[1])
    cheat = data["cheatsheets.json"]
    for _, group in cheat["aa"]:
        for sid in group:
            need("cheatsheets.json, аминокислоты", sid)
    for row in cheat["vit"]:
        need("cheatsheets.json, витамины", row[1])
    for row in cheat["dis"]:
        need("cheatsheets.json, ферментопатии", row[1])
    return problems


def main():
    template = TEMPLATE.read_text(encoding="utf-8")
    names = SLOT.findall(template)
    data = {name: load(name) for name in names if name != "notes.json"}
    problems = check(data)
    if "notes.json" in names:
        data["notes.json"] = parse_notes(data["substances.json"], problems)

    if problems:
        print("Сборка остановлена, исправьте данные:")
        for p in problems:
            print("  -", p)
        sys.exit(1)

    def inject(match):
        text = json.dumps(data[match.group(1)], ensure_ascii=False, separators=(",", ":"))
        if "</script" in text.lower():
            sys.exit(f"{match.group(1)}: текст «</script» внутри данных сломает страницу")
        return text

    OUTPUT.write_text(SLOT.sub(inject, template), encoding="utf-8")
    ns, nr = len(data["substances.json"]), len(data["reactions.json"])
    nt = len(data.get("notes.json", []))
    print(f"Готово: index.html — {ns} {plural(ns, 'вещество', 'вещества', 'веществ')}, "
          f"{nr} {plural(nr, 'реакция', 'реакции', 'реакций')}, "
          f"{nt} {plural(nt, 'тема', 'темы', 'тем')} конспекта, {OUTPUT.stat().st_size // 1024} КБ")


if __name__ == "__main__":
    main()
