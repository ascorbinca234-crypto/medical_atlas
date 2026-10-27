#!/usr/bin/env python3
"""Build the original complete atlas. --full also preserves legacy topic API packages."""
import argparse, json, os, re, sys
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import topic_build
ROOT = Path(__file__).resolve().parent
PRIV = Path(os.environ.get('ATLAS_PRIVATE') or ROOT.parent.parent / 'medical_atlas_private') / 'biochem-atlas'
NAMES = ['substances.json','reactions.json','formulas.json','mnemonics.json','pairs.json','cheatsheets.json']
def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--full', action='store_true')
    args = parser.parse_args()
    if args.full:
        base = PRIV / 'base'
        pub = {n: json.loads((base / 'data' / n).read_text()) for n in NAMES}
        private = {n: json.loads((PRIV / 'data' / n).read_text()) for n in NAMES}
        data = merged(pub, private)
        problems = check(data)
        if problems: sys.exit('\n'.join(problems))
        template = (base / 'src/template.html').read_text()
        style = re.search(r'<style>([\s\S]*?)</style>', template).group(1)
        markup = template.split('<body>', 1)[1].split('<script', 1)[0]
        app = re.search(r'<script type="text/plain" id="ma-app">([\s\S]*?)</script>', template).group(1)
        pack = {n[:-5]: value for n, value in data.items()}
        pack['locked'] = None
        code = 'document.getElementById("biochem-demo-style")?.remove();document.title="Атлас биохимии";document.body.innerHTML=' + encode(markup) + ';\n'
        code += 'var bxStyle=document.createElement("style");bxStyle.textContent=' + encode(style) + ';document.head.appendChild(bxStyle);\n'
        code += 'const BX=' + encode(pack) + ';\n' + (PRIV / 'src/locked.js').read_text() + '\n'
        # The original app has a formula fallback when SmilesDrawer is unavailable.
        code += app + '\nwindow.MA.mount(document.querySelectorAll("[data-ma-acct]"));\n'
        out = ROOT.parent / 'server/content/biochem.js'
        out.parent.mkdir(parents=True, exist_ok=True); out.write_text(code)
        topic_build.biochem(data, style, markup, app, (PRIV / 'src/locked.js').read_text())
        print('Полная биохимия:', len(data['substances.json']), 'веществ,', len(data['reactions.json']), 'реакций')
    import runpy
    runpy.run_path(str(ROOT / 'build_public.py'), run_name='__main__')
if __name__ == '__main__': main()
