#!/usr/bin/env python3
"""Собирает index.html из шаблона src/template.html и данных из папки data/.

В data/ лежит открытая часть (аминокислоты, углеводы, ЦТК и нужные им коферменты).
Закрытая часть хранится в закрытом репозитории (../../medical_atlas_private/biochem-atlas
или путь из переменной ATLAS_PRIVATE): data/*.json и src/locked.js. Скрипт проверяет
данные вместе, собирает index.html и кладёт закрытую часть в ../server/content/biochem.js —
её отдаёт сервер только вошедшим пользователям.

Запуск из папки проекта:  python3 build.py
Нужен только Python 3, сторонние пакеты не требуются.
"""
import hashlib
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TEMPLATE = ROOT / "src" / "template.html"
OUTPUT = ROOT / "index.html"
SLOT = re.compile(r"/\*@([a-z]+\.json)\*/")
PRIV = Path(os.environ.get("ATLAS_PRIVATE") or ROOT.parent.parent / "medical_atlas_private") / "biochem-atlas"
CONTENT = ROOT.parent / "server" / "content" / "biochem.js"
STATS = ROOT / "data" / "locked_stats.json"
NAMES = ["substances.json", "reactions.json", "formulas.json", "mnemonics.json", "pairs.json", "cheatsheets.json"]


def load_priv(name):
    path = PRIV / "data" / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        sys.exit(f"Ошибка в закрытом {name}, строка {err.lineno}, позиция {err.colno}: {err.msg}")


def merged(pub, priv):
    """Повторяет слияние, которое делает страница после входа."""
    out = {k: (list(v) if isinstance(v, list) else dict(v)) for k, v in pub.items()}

    def ins(arr, items):
        for x in sorted(items, key=lambda x: x["at"]):
            arr.insert(x["at"], x["v"])
    for k in ("substances.json", "reactions.json", "pairs.json"):
        ins(out[k], priv[k])
    for k in ("formulas.json", "mnemonics.json"):
        out[k].update(priv[k])
    cheat = {k: list(v) for k, v in out["cheatsheets.json"].items()}
    for k, items in priv["cheatsheets.json"].items():
        ins(cheat.setdefault(k, []), items)
    out["cheatsheets.json"] = cheat
    return out


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
    data = {name: load(name) for name in names}

    problems = check(data)
    priv = None
    if (PRIV / "data").is_dir():
        priv = {n: load_priv(n) for n in NAMES}
        problems += ["вместе с закрытой частью: " + p for p in check(merged(data, priv))]
    else:
        print(f"Закрытая папка не найдена ({PRIV}) — собираю только открытую часть.")
    if problems:
        print("Сборка остановлена, исправьте данные:")
        for p in problems:
            print("  -", p)
        sys.exit(1)

    def inject(match):
        text = json.dumps(data[match.group(1)], ensure_ascii=False, separators=(",", ":"))
        if "</script" in text.lower():
            sys.exit(f"data/{match.group(1)}: текст «</script» внутри данных сломает страницу")
        return text

    html = SLOT.sub(inject, template)
    locked_hash = ""
    if priv is not None:
        locked_js = (PRIV / "src" / "locked.js").read_text(encoding="utf-8")
        pack = {k.replace(".json", ""): v for k, v in priv.items()}
        locked_js += """
/* закрытые данные: вставляются на исходные места */
(function (L) {
  const ins = (arr, items) => items.slice().sort((a, b) => a.at - b.at).forEach(x => arr.splice(x.at, 0, x.v));
  ins(BX.substances, L.substances); ins(BX.reactions, L.reactions); ins(BX.pairs, L.pairs);
  Object.assign(BX.formulas, L.formulas); Object.assign(BX.mnemonics, L.mnemonics);
  Object.keys(L.cheatsheets).forEach(k => { if (!BX.cheatsheets[k]) BX.cheatsheets[k] = []; ins(BX.cheatsheets[k], L.cheatsheets[k]); });
})(""" + json.dumps(pack, ensure_ascii=False, separators=(",", ":")) + ");\n"
        CONTENT.parent.mkdir(parents=True, exist_ok=True)
        CONTENT.write_text(locked_js, encoding="utf-8")
        locked_hash = hashlib.sha256(locked_js.encode("utf-8")).hexdigest()[:16]
        subs = priv["substances.json"]
        by_sec = {}
        for x in subs:
            by_sec[x["v"]["s"]] = by_sec.get(x["v"]["s"], 0) + 1
        stats = {"substances": len(subs), "bySec": by_sec, "reactions": len(priv["reactions.json"]),
                 "pairs": len(priv["pairs.json"]),
                 "cheat": {k: len(v) for k, v in priv["cheatsheets.json"].items()}}
        STATS.write_text(json.dumps(stats, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    stats_js = STATS.read_text(encoding="utf-8").strip() if STATS.exists() else "null"
    html = html.replace("/*%LOCKED%*/null", stats_js)
    boot = """(function () {
  var LOCKED_HASH = '%s';
  function run(code) { var s = document.createElement('script'); s.textContent = code; document.body.appendChild(s); }
  function start(code) { if (code) run(code); run(document.getElementById('ma-app').textContent); }
  var MA = window.MA;
  window.MA_STATE = {auth: 'none'};
  if (MA) MA.mount(document.querySelectorAll('[data-ma-acct]'));
  if (!MA || !MA.signedIn() || !LOCKED_HASH) { start(null); return; }
  window.MA_STATE.auth = 'loading';
  var note = document.createElement('div'); note.className = 'bootmsg'; note.textContent = 'Загружаю закрытую часть…';
  document.body.appendChild(note);
  MA.loadLocked('biochem', LOCKED_HASH).then(function (r) {
    window.MA_STATE.auth = r.status === 'ok' ? 'ok' : (r.status === 'signed-out' ? 'none' : 'error');
    note.remove(); start(r.code);
  });
})();""" % locked_hash
    html = html.replace("/*%BOOT%*/", boot)
    OUTPUT.write_text(html, encoding="utf-8")
    ns, nr = len(data["substances.json"]), len(data["reactions.json"])
    print(f"Готово: index.html — {ns} {plural(ns, 'вещество', 'вещества', 'веществ')}, "
          f"{nr} {plural(nr, 'реакция', 'реакции', 'реакций')}, {OUTPUT.stat().st_size // 1024} КБ")
    if locked_hash:
        print(f"Закрытая часть: {CONTENT.stat().st_size // 1024} КБ → server/content/biochem.js, hash {locked_hash}")


if __name__ == "__main__":
    main()
