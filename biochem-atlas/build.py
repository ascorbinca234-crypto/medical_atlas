#!/usr/bin/env python3
"""Собирает index.html из шаблона src/template.html и данных из папки data/.

Запуск из папки проекта:  python3 build.py
Нужен только Python 3, сторонние пакеты не требуются.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TEMPLATE = ROOT / "src" / "template.html"
OUTPUT = ROOT / "index.html"
SLOT = re.compile(r"/\*@([a-z]+\.json)\*/")


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

    OUTPUT.write_text(SLOT.sub(inject, template), encoding="utf-8")
    ns, nr = len(data["substances.json"]), len(data["reactions.json"])
    print(f"Готово: index.html — {ns} {plural(ns, 'вещество', 'вещества', 'веществ')}, "
          f"{nr} {plural(nr, 'реакция', 'реакции', 'реакций')}, {OUTPUT.stat().st_size // 1024} КБ")


if __name__ == "__main__":
    main()
