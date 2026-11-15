#!/usr/bin/env python3
"""Собирает защищённый публичный biochem-atlas/index.html (2 открытых раздела и 2 темы конспекта)
и нарезанные серверные пакеты /server/content/topics/biochem/*.js + manifest.json.

Запуск: python3 original_site/biochem-atlas/build_public.py
"""
import hashlib
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TEMPLATE = ROOT / "src" / "template.html"
OUTPUT = ROOT / "index.html"
NOTES_DIR = ROOT / "notes"
TOPICS_JSON = ROOT / "topics.json"
SERVER_TOPICS_DIR = ROOT.parent / "server" / "content" / "topics" / "biochem"

SLOT = re.compile(r"/\*@([a-z_]+\.json)\*/")

SECTIONS = [
    ("aa", "Аминокислоты"),
    ("carb", "Углеводы и гликолиз"),
    ("tca", "ЦТК и биоэнергетика"),
    ("lip", "Липиды"),
    ("nit", "Азотистый обмен"),
    ("neuro", "Нейромедиаторы"),
    ("vit", "Витамины и коферменты"),
    ("nuc", "Нуклеотиды"),
    ("horm", "Гормоны"),
    ("drug", "Лекарства"),
]
SECTION_IDS = {s[0] for s in SECTIONS}
OPEN_SECS = {"aa", "carb"}
OPEN_NOTES = {"proteins", "enzymes"}

PATHS_META = [
    {"id": "glyc", "name": "Гликолиз", "sec": "carb", "locked": True},
    {"id": "tca", "name": "Цикл Кребса", "sec": "tca", "locked": True},
    {"id": "urea", "name": "Орнитиновый цикл", "sec": "nit", "locked": True},
    {"id": "trp", "name": "Обмен триптофана", "sec": "neuro", "locked": True},
]

ANIMS_META = [
    {"id": "etc", "name": "Дыхательная цепь и АТФ-синтаза", "short": "Дыхательная цепь", "ac": "#E0601B", "mountFn": "mountETC"},
    {"id": "kin", "name": "Кинетика ферментов", "short": "Кинетика ферментов", "ac": "#3865DF", "mountFn": "mountKin"},
    {"id": "hb", "name": "Кривая диссоциации оксигемоглобина", "short": "Гемоглобин и O₂", "ac": "#D52B45", "mountFn": "mountHb"},
    {"id": "box", "name": "β-Окисление жирных кислот", "short": "β-Окисление", "ac": "#7A5ADB", "mountFn": "mountBox"},
    {"id": "camp", "name": "Каскад цАМФ и распад гликогена", "short": "Каскад цАМФ", "ac": "#B23FA7", "mountFn": "mountCamp"},
]

PATHS_SET = {p["id"] for p in PATHS_META}
ANIMS_SET = {a["id"] for a in ANIMS_META}
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
    topic = {
        "id": tid,
        "num": num,
        "title": meta.get("title", tid),
        "color": meta.get("color", "aa"),
        "paths": [p for p in meta.get("paths", "").replace(",", " ").split() if p],
        "anims": [a for a in meta.get("anims", "").replace(",", " ").split() if a],
        "sum": [],
        "secs": [],
        "quiz": [],
        "subs": [],
    }
    if "title" not in meta:
        problems.append(f"{where}: нет строки «title: …» в начале файла")
    if topic["color"] not in SECTION_IDS:
        problems.append(f"{where}: color «{topic['color']}»")
    for p in topic["paths"]:
        if p not in PATHS_SET:
            problems.append(f"{where}: неизвестная схема «{p}»")
    for a in topic["anims"]:
        if a not in ANIMS_SET:
            problems.append(f"{where}: неизвестная анимация «{a}»")

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
                problems.append(f"{where}, строка {ln}: ответ «= …» без вопроса")
            else:
                topic["quiz"][-1][1] = fx(s[2:], ln)
        elif s.startswith("> "):
            flush()
            body = s[2:]
            label, sep, rest = body.partition(":")
            kind = CALLOUTS.get(label.strip()) if sep else None
            if not kind:
                kind, label, rest = "key", "Важно", body
            if sec is not None:
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
    return [parse_note(p, k, names, problems) for k, p in enumerate(files, 1)]


def rx_primary_sec(rx, sub_by_id):
    for tok in rx["s"]:
        if tok[1] and tok[1] in sub_by_id:
            return sub_by_id[tok[1]]["s"]
    for tok in rx["p"]:
        if tok[1] and tok[1] in sub_by_id:
            return sub_by_id[tok[1]]["s"]
    return None


def rx_all_secs(rx, sub_by_id):
    secs = set()
    for tok in rx["s"] + rx["p"]:
        if tok[1] and tok[1] in sub_by_id:
            secs.add(sub_by_id[tok[1]]["s"])
    for sid in rx.get("x", []):
        if sid in sub_by_id:
            secs.add(sub_by_id[sid]["s"])
    return secs


def extract_paths_from_template(template_text):
    m = re.search(r"const PATHS = (\[[\s\S]*?\n\]);\nif \(P_PATCH && P_PATCH\.kind === \"path\"", template_text)
    if not m:
        sys.exit("Не найден массив PATHS в src/template.html")
    raw_block = m.group(1)
    # Extract each top-level object literal by tracking brace depth
    objs = {}
    i = 0
    n = len(raw_block)
    while i < n:
        if raw_block[i] == "{":
            start = i
            depth = 0
            in_str = None
            esc_next = False
            while i < n:
                ch = raw_block[i]
                if esc_next:
                    esc_next = False
                elif in_str:
                    if ch == "\\":
                        esc_next = True
                    elif ch == in_str:
                        in_str = None
                else:
                    if ch in ('"', "'"):
                        in_str = ch
                    elif ch == "{":
                        depth += 1
                    elif ch == "}":
                        depth -= 1
                        if depth == 0:
                            obj_str = raw_block[start:i + 1]
                            idm = re.search(r'^\{\s*id:\s*"([a-z0-9]+)"', obj_str)
                            if idm:
                                objs[idm.group(1)] = obj_str
                            break
                i += 1
        i += 1
    return m.start(1), m.end(1), objs


def extract_anims_from_template(template_text):
    m = re.search(r"/\*@ANIMS_CODE_START\*/([\s\S]*?)/\*@ANIMS_CODE_END\*/", template_text)
    if not m:
        sys.exit("Не найдены маркеры /*@ANIMS_CODE_START*/ ... /*@ANIMS_CODE_END*/ в src/template.html")
    block = m.group(1)

    fn_codes = {}
    for meta in ANIMS_META:
        fn_name = meta["mountFn"]
        fm = re.search(rf"function {fn_name}\(box, a\)\s*\{{", block)
        if not fm:
            sys.exit(f"Не найдена функция {fn_name} в ANIMS_CODE")
        start = fm.start()
        i = fm.end() - 1
        depth = 0
        in_str = None
        esc_next = False
        while i < len(block):
            ch = block[i]
            if esc_next:
                esc_next = False
            elif in_str:
                if ch == "\\":
                    esc_next = True
                elif ch == in_str:
                    in_str = None
            else:
                if ch in ('"', "'"):
                    in_str = ch
                elif ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        fn_codes[meta["id"]] = block[start:i + 1]
                        break
            i += 1

    am = re.search(r"const ANIMS = (\[[\s\S]*\]);", block)
    if not am:
        sys.exit("Не найден массив ANIMS в ANIMS_CODE")
    arr_block = am.group(1)
    entries = {}
    i = 0
    while i < len(arr_block):
        if arr_block[i] == "{":
            start = i
            depth = 0
            in_str = None
            esc_next = False
            while i < len(arr_block):
                ch = arr_block[i]
                if esc_next:
                    esc_next = False
                elif in_str:
                    if ch == "\\":
                        esc_next = True
                    elif ch == in_str:
                        in_str = None
                else:
                    if ch in ('"', "'"):
                        in_str = ch
                    elif ch == "{":
                        depth += 1
                    elif ch == "}":
                        depth -= 1
                        if depth == 0:
                            obj_str = arr_block[start:i + 1]
                            idm = re.search(r'^\{\s*id:\s*"([a-z0-9]+)"', obj_str)
                            if idm:
                                entries[idm.group(1)] = obj_str
                            break
                i += 1
        i += 1
    return m.start(), m.end(), fn_codes, entries


def main():
    template = TEMPLATE.read_text(encoding="utf-8")
    all_subs = load("substances.json")
    all_tx = load("formulas.json")
    all_mn = load("mnemonics.json")
    all_pairs = load("pairs.json")
    all_cheat = load("cheatsheets.json")
    all_rx = load("reactions.json")

    problems = []
    all_notes = parse_notes(all_subs, problems)
    if problems:
        for p in problems:
            print("  -", p)
        sys.exit(1)

    sub_by_id = {s["id"]: s for s in all_subs}
    sub_meta = {s["id"]: [s.get("sn") or s["n"], s["s"]] for s in all_subs}
    sec_counts = {sid: sum(1 for s in all_subs if s["s"] == sid) for sid, _ in SECTIONS}
    sec_counts["_rxTotal"] = len(all_rx)

    # 1. Build topics catalog
    topics_list = [{"id": f"sec-{sid}", "title": title} for sid, title in SECTIONS]
    topics_list += [{"id": f"note-{t['id']}", "title": f"Конспект {t['num']}. {t['title']}"} for t in all_notes]
    topics_list += [{"id": f"path-{p['id']}", "title": f"Путь: {p['name']}"} for p in PATHS_META]
    topics_list += [{"id": f"anim-{a['id']}", "title": f"Анимация: {a['name']}"} for a in ANIMS_META]

    aliases = {f"s={s['id']}": f"sec-{s['s']}" for s in all_subs}
    for t in all_notes:
        aliases[f"n-{t['id']}"] = f"note-{t['id']}"

    topics_catalog = {
        "topics": topics_list,
        "aliases": aliases,
        "demo": ["sec-aa", "sec-carb", "note-proteins", "note-enzymes"],
        "publicRoutes": ["", "atlas"],
    }
    TOPICS_JSON.write_text(json.dumps(topics_catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 2. Extract PATHS and ANIMS source objects from template
    p_start, p_end, path_objs = extract_paths_from_template(template)
    a_start, a_end, anim_fns, anim_entries = extract_anims_from_template(template)

    # 3. Write all 34 server topic packages + manifest.json
    SERVER_TOPICS_DIR.mkdir(parents=True, exist_ok=True)
    for old_file in SERVER_TOPICS_DIR.glob("*"):
        if old_file.is_file():
            old_file.unlink()
    manifest_topics = {}

    def write_pkg(topic_id, js_code):
        if "</script" in js_code.lower():
            sys.exit(f"{topic_id}: небезопасный </script внутри пакета")
        out_path = SERVER_TOPICS_DIR / f"{topic_id}.js"
        out_path.write_text(js_code, encoding="utf-8")
        raw = out_path.read_bytes()
        manifest_topics[topic_id] = {
            "sha256": hashlib.sha256(raw).hexdigest(),
            "bytes": len(raw),
        }

    # 3a. Section packages (10)
    for sid, _ in SECTIONS:
        sec_subs = [s for s in all_subs if s["s"] == sid]
        sec_ids = {s["id"] for s in sec_subs}
        sec_tx = {k: v for k, v in all_tx.items() if k in sec_ids}
        sec_mn = {k: v for k, v in all_mn.items() if k in sec_ids}
        sec_pairs = [p for p in all_pairs if p[0] in sec_ids or p[1] in sec_ids]
        sec_rxs = [r for r in all_rx if sid in rx_all_secs(r, sub_by_id)]
        pkg = {
            "kind": "sec",
            "sec": sid,
            "substances": sec_subs,
            "formulas": sec_tx,
            "mnemonics": sec_mn,
            "pairs": sec_pairs,
            "reactions": sec_rxs,
            "subMeta": sub_meta,
        }
        if sid == "vit":
            pkg["cheat"] = {
                "vit": all_cheat["vit"],
                "vitmn": all_cheat["vitmn"],
                "dis": all_cheat["dis"],
            }
        write_pkg(f"sec-{sid}", "window.BX_PATCH=" + json.dumps(pkg, ensure_ascii=False, separators=(",", ":")) + ";\n")

    # 3b. Note packages (15)
    for t in all_notes:
        note_full = dict(t, locked=False)
        pkg = {
            "kind": "note",
            "noteId": t["id"],
            "note": note_full,
            "subMeta": sub_meta,
        }
        write_pkg(f"note-{t['id']}", "window.BX_PATCH=" + json.dumps(pkg, ensure_ascii=False, separators=(",", ":")) + ";\n")

    # 3c. Path packages (4)
    for pmeta in PATHS_META:
        pid = pmeta["id"]
        obj_js = path_objs[pid]
        js_code = (
            "window.BX_PATCH={kind:\"path\",pathId:" + json.dumps(pid) +
            ",path:Object.assign(" + obj_js + ",{locked:false}),subMeta:" +
            json.dumps(sub_meta, ensure_ascii=False, separators=(",", ":")) + "};\n"
        )
        write_pkg(f"path-{pid}", js_code)

    # 3d. Anim packages (5)
    for ameta in ANIMS_META:
        aid = ameta["id"]
        fn_js = anim_fns[aid]
        entry_js = anim_entries[aid]
        js_code = (
            "window.BX_PATCH={kind:\"anim\",animId:" + json.dumps(aid) + ",animFactory:function(api){\n"
            "var anShell=api.anShell,anLoop=api.anLoop,sv=api.sv,svgText=api.svgText,statBox=api.statBox,"
            "cGroup=api.cGroup,cBtn=api.cBtn,cToggle=api.cToggle,cRadio=api.cRadio,cSlider=api.cSlider,"
            "playCtrl=api.playCtrl,rnd=api.rnd,clamp=api.clamp,ease=api.ease,lnk=api.lnk,fmt1=api.fmt1,esc=api.esc;\n"
            + fn_js + "\nreturn Object.assign(" + entry_js + ",{locked:false});\n}};\n"
        )
        write_pkg(f"anim-{aid}", js_code)

    manifest = {"policy": "topic-delivery-v1", "topics": manifest_topics}
    (SERVER_TOPICS_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 4. Prepare public filtered data for index.html (ONLY 2 sections + 2 notes)
    open_subs = [s for s in all_subs if s["s"] in OPEN_SECS]
    open_ids = {s["id"] for s in open_subs}
    open_tx = {k: v for k, v in all_tx.items() if k in open_ids}
    open_mn = {k: v for k, v in all_mn.items() if k in open_ids}
    open_pairs = [p for p in all_pairs if p[0] in open_ids and p[1] in open_ids]
    open_rxs = [r for r in all_rx if rx_primary_sec(r, sub_by_id) in OPEN_SECS]
    open_cheat = {
        "aa": all_cheat["aa"],
        "aamn": all_cheat["aamn"],
        "vit": [],
        "vitmn": [],
        "dis": [d for d in all_cheat["dis"] if d[1] in open_ids],
    }

    public_notes = []
    for t in all_notes:
        if t["id"] in OPEN_NOTES:
            public_notes.append(dict(t, locked=False))
        else:
            public_notes.append({
                "id": t["id"],
                "num": t["num"],
                "title": t["title"],
                "color": t["color"],
                "paths": [],
                "anims": [],
                "sum": [],
                "secs": [],
                "quiz": [],
                "subs": [],
                "min": 0,
                "locked": True,
            })

    # Replace PATHS and ANIMS in template with locked stubs for public index.html
    anims_stub_json = json.dumps(
        [{"id": a["id"], "name": a["name"], "short": a["short"], "ac": a["ac"], "locked": True} for a in ANIMS_META],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    paths_stub_json = json.dumps(PATHS_META, ensure_ascii=False, separators=(",", ":"))

    # Replace from end to start so character offsets stay valid
    assert a_start > p_end
    stripped_template = (
        template[:p_start]
        + paths_stub_json
        + template[p_end:a_start]
        + "const ANIMS = "
        + anims_stub_json
        + ";"
        + template[a_end:]
    )

    slots = {
        "substances.json": open_subs,
        "formulas.json": open_tx,
        "mnemonics.json": open_mn,
        "pairs.json": open_pairs,
        "cheatsheets.json": open_cheat,
        "reactions.json": open_rxs,
        "notes.json": public_notes,
        "submeta.json": sub_meta,
        "seccounts.json": sec_counts,
        "topics_inline.json": topics_catalog,
    }

    def inject(match):
        name = match.group(1)
        if name not in slots:
            sys.exit(f"Неизвестный слот /*@{name}*/")
        text = json.dumps(slots[name], ensure_ascii=False, separators=(",", ":"))
        if "</script" in text.lower():
            sys.exit(f"{name}: текст «</script» внутри данных сломает страницу")
        return text

    OUTPUT.write_text(SLOT.sub(inject, stripped_template), encoding="utf-8")
    print(
        f"Готово (public + {len(manifest_topics)} topic packages): "
        f"open_subs={len(open_subs)}/{len(all_subs)}, "
        f"open_rx={len(open_rxs)}/{len(all_rx)}, "
        f"open_notes={sum(1 for n in public_notes if not n['locked'])}/{len(public_notes)}, "
        f"index.html={OUTPUT.stat().st_size // 1024} КБ"
    )


if __name__ == "__main__":
    main()
