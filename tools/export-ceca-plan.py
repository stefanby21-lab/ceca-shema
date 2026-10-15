#!/usr/bin/env python3
"""Генерира ceca-plan-svg.js - SVG схемата за браузъри без WebGL.

    python3 tools/export-ceca-plan.py [схема.html] [venue-data-ceca.js] [изход.js]

Без аргументи: ~/Downloads/ceca shema/ceca shema.html, venue-data-ceca.js и
ceca-plan-svg.js в корена на проекта. Само стандартна библиотека.

Идеята: чертежът на админа вече е точен и има ids S-<сектор>, R-<ред>,
M-<място>. Не се прерисува и не се търсят места по позиция - id-тата се
превръщат в data-key, които приложението познава:

  кръг място        -> data-kind="seat",     data-key="s:<сектор> r:<ред> t:<n>"
  група маса        -> data-kind="table",    data-key="t:Masa_<n>"
  група сектор      -> data-kind="section",  data-key="s:<сектор>"
  правостоящи       -> data-kind="standing", data-key="z:Standing"

Махат се всички следи от админа: id-та, metadata на Corel, цветовите класове
на цените (боядисва приложението от VENUE), заглавията, размерите на страницата.
<style> се ограничава до #ceca-plan-svg, за да не тече към иконите на страницата.

Скриптът се проваля, ако някое място, маса или зоната от venue-data-ceca.js
липсва в чертежа, или ако в чертежа има нещо, което venue не знае.
"""
import hashlib
import importlib.util
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(HERE)
DEFAULT_SVG = os.path.expanduser("~/Downloads/ceca shema/ceca shema.html")
DEFAULT_VENUE = os.path.join(ROOT_DIR, "venue-data-ceca.js")
DEFAULT_OUT = os.path.join(ROOT_DIR, "ceca-plan-svg.js")
PLAN_ID = "ceca-plan-svg"

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location("kb", os.path.join(HERE, "kupibileti-to-venue.py"))
kb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(kb)
NS = kb.NS
ET.register_namespace("", NS[1:-1])

# Класовете на Corel, които носят цена или статус на продажба в админа, и
# служебният "kur" на всяка група не се пренасят.
DROP_CLASSES = re.compile(r"^(color[-\w]*|multiplace|kur)$")
# Фигурите, на които формата идва от нашите правила: те губят старите fil/str.
SHAPES = {"sec-shape", "table", "table-hit", "standing", "standing-hit"}
REMOVE_TAGS = {"title", "metadata", "defs", "style"}

# Началните стойности и формата на зоните. Приложението (map-svg.js) боядисва
# местата и масите с вградени стилове; "&" е самият #ceca-plan-svg.
OWN_RULES = [
    ("circle", "fill:#C3CAD5;stroke:none"),
    ("text", "pointer-events:none"),
    (".sec-shape", "fill:#FFFFFF;stroke:#CBD5E4;stroke-width:1;pointer-events:all"),
    ('[data-kind="section"].is-focused > .sec-shape', "fill:#DCE6F6;stroke:#153D8A;stroke-width:2;vector-effect:non-scaling-stroke"),
    ('[data-kind="section"],[data-kind="seat"],[data-kind="table"],[data-kind="standing"]', "cursor:pointer"),
    ('[data-kind="seat"]:focus-visible', "outline:none;stroke:#0B1B3A !important;stroke-width:3px !important"),
    (".table-hit", "fill:transparent;stroke:none;pointer-events:all"),
    (".table", "fill:#8E44C8;stroke:#FFFFFF;stroke-width:.5"),
    (".standing-hit", "fill:transparent;stroke:none;pointer-events:all"),
    (".standing", "fill:#CFE0F5;stroke:#153D8A;stroke-width:2;stroke-dasharray:10 6;vector-effect:non-scaling-stroke"),
    ('[data-kind="standing"].is-selected .standing,[data-kind="standing"]:hover .standing', "fill:#B5CDEE"),
    ('[data-kind="standing"]:focus-visible .standing', "stroke:#0B1B3A;stroke-width:3px"),
    (".lb-min", "opacity:0"),
    ("&.z-near .lb-min", "opacity:1"),
]


def local(el):
    return el.tag.replace(NS, "")


def load_venue(path):
    text = open(path, encoding="utf-8").read()
    return json.loads(text.removeprefix("window.VENUE = ").strip().removesuffix(";"))


def mark(el, *names):
    classes = (el.get("class") or "").split()
    el.set("class", " ".join(classes + [n for n in names if n not in classes]))


# ------------------------------------------------------------------ ключове
class Collector:
    """Обхожда чертежа, слага data-ключовете и пази какво е намерил."""

    def __init__(self):
        self.seats, self.tables, self.sections, self.zones = [], [], [], []

    def walk(self, el, sector=None, row=None):
        for ch in el:
            tag = local(ch)
            if tag == "g":
                self.group(ch, sector, row)
            elif tag == "circle":
                self.seat(ch, sector, row)
            elif tag == "text":
                classes = (ch.get("class") or "").split()
                # Номерата на редовете по страните личат чак отблизо.
                if "fnt2" in classes and "fil2" in classes:
                    mark(ch, "lb-min")

    def seat(self, el, sector, row):
        m = re.match(r"M-(\d+)", el.get("id") or "")
        if not m or sector is None or row is None:
            sys.exit("Кръг, който не е място от сектор и ред: cx=%s cy=%s" % (el.get("cx"), el.get("cy")))
        key = "s:%s r:%s t:%d" % (sector, row, int(m.group(1)))
        el.set("data-key", key)
        el.set("data-kind", "seat")
        self.seats.append(key)

    def group(self, g, sector, row):
        raw = g.get("id") or ""
        table = re.match(r"S-Masa_(\d+)$", raw)
        if table:
            return self.table(g, "t:Masa_" + table.group(1))
        if raw == "S-Standing":
            return self.zone(g)
        gid = kb.clean(raw)
        if gid.startswith("S-"):
            return self.section(g, gid[2:])
        if gid.startswith("R-") and sector is not None:
            return self.walk(g, sector, gid[2:])
        self.walk(g, sector, row)

    def section(self, g, token):
        g.set("data-key", "s:" + token)
        g.set("data-kind", "section")
        mark(g, "sect")
        self.sections.append(token)
        for p in g:
            if local(p) == "polygon" and not (p.get("id") or "").startswith("M-"):
                mark(p, "sec-shape")
                break
        self.walk(g, token, None)

    def table(self, g, key):
        g.set("data-key", key)
        g.set("data-kind", "table")
        self.tables.append(key)
        # Квадратът е площта за натискане; първият път вътре е масата със
        # столчетата (кръг + 2 бар стола) и се боядисва в цвета на нивото.
        for p in g:
            if local(p) == "polygon":
                mark(p, "table-hit")
        first = next(g.iter(NS + "path"), None)
        if first is not None:
            mark(first, "table")

    def zone(self, g):
        g.set("data-key", "z:Standing")
        g.set("data-kind", "standing")
        self.zones.append("z:Standing")
        for p in g:
            if local(p) == "polygon":
                mark(p, "standing-hit")
        inner = [p for p in g.iter(NS + "polygon") if "standing-hit" not in (p.get("class") or "")]
        for p in inner:
            mark(p, "standing")


# ------------------------------------------------------------------ стилове
def canonical_rules(svg):
    """Слива класовете с еднакви правила (180 еднакви .strN, по един на маса).
    Връща (клас -> канонично име, [(име, правило)])."""
    style = svg.find(".//" + NS + "style")
    found = re.findall(r"\.([\w-]+)\s*\{([^}]*)\}", style.text if style is not None else "")
    canon, by_decl, rules = {}, {}, []
    for name, decl in found:
        if DROP_CLASSES.match(name):
            continue
        decl = re.sub(r"\s+", "", decl).strip(";")
        first = by_decl.setdefault(decl, name)
        canon[name] = first
        if first == name:
            rules.append((name, decl))
    return canon, rules


def scoped_selector(selector):
    out = []
    for part in selector.split(","):
        part = part.strip()
        out.append("#" + PLAN_ID + part[1:] if part.startswith("&") else "#%s %s" % (PLAN_ID, part))
    return ",".join(out)


def build_style(rules, used):
    text = "".join("#%s .%s{%s}" % (PLAN_ID, n, d) for n, d in rules if n in used)
    return text + "".join("%s{%s}" % (scoped_selector(s), d) for s, d in OWN_RULES)


def clean_tree(el, canon):
    """Маха id-тата, заглавията, metadata и админските класове; връща ползваните класове."""
    used = set()
    for parent in list(el.iter()):
        for ch in list(parent):
            if local(ch) in REMOVE_TAGS:
                parent.remove(ch)
    for node in el.iter():
        node.attrib.pop("id", None)
        classes = (node.get("class") or "").split()
        if not classes:
            continue
        if local(node) == "circle":
            node.attrib.pop("class")
            continue
        own = [c for c in classes if c in SHAPES]
        names = own or [canon.get(c, c) for c in classes if not DROP_CLASSES.match(c)]
        names = list(dict.fromkeys(names))
        used.update(names)
        if names:
            node.set("class", " ".join(names))
        else:
            node.attrib.pop("class")
    return used


# ------------------------------------------------------------------ проверки
def verify(found, venue):
    """Всяко място, маса, сектор и зоната от venue са точно веднъж в чертежа и обратно."""
    want = {
        "места": [f["properties"]["mk"] for f in venue["seats"]["features"]],
        "маси": [f["properties"]["mk"] for f in venue["tables"]["features"]],
        "сектори": [f["properties"]["token"] for f in venue["sections"]["features"]],
        "зони": [f["properties"]["mk"] for f in venue["standing"]["features"]],
    }
    have = {"места": found.seats, "маси": found.tables, "сектори": found.sections, "зони": found.zones}
    for name, keys in want.items():
        dup = [k for k, n in Counter(have[name]).items() if n > 1]
        missing, extra = set(keys) - set(have[name]), set(have[name]) - set(keys)
        if dup or missing or extra or len(keys) != len(set(keys)):
            sys.exit("%s: двойни %s, липсват %s, излишни %s" % (name, dup[:3], sorted(missing)[:3], sorted(extra)[:3]))


def build(svg_path, venue_path, out_path):
    html = kb.read_html(svg_path)
    original = html[html.find("<svg"): html.find("</svg>") + 6]
    svg = kb.extract_svg(html)
    venue = load_venue(venue_path)
    canon, rules = canonical_rules(svg)
    found = Collector()
    found.walk(svg)
    verify(found, venue)
    used = clean_tree(svg, canon)
    # Корен: само viewBox. Размерите, xml:space и inline стилът са на Corel.
    for name in list(svg.attrib):
        if name != "viewBox":
            del svg.attrib[name]
    svg.set("id", PLAN_ID)
    style = ET.Element(NS + "style")
    style.text = build_style(rules, used)
    svg.insert(0, style)
    markup = ET.tostring(svg, encoding="unicode")
    if re.search(r"<script|<foreignObject|\son\w+=|Corel|xodm|CorelCorpID", markup):
        sys.exit("В чертежа е останало нещо, което не бива да се публикува.")
    meta = {"source": "ceca shema.html#svg", "sha256": hashlib.sha256(original.encode("utf-8")).hexdigest(),
            "seats": len(found.seats), "tables": len(found.tables), "sections": len(found.sections)}
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Генерирано от tools/export-ceca-plan.py от чертежа на админа. Не се редактира на ръка.\n")
        f.write("window.CecaPlanSVG = " + json.dumps(markup, ensure_ascii=False) + ";\n")
        f.write("window.CecaPlanSource = " + json.dumps(meta) + ";\n")
    print("места: %d, маси: %d, сектори: %d, зона за правостоящи: %d (всичко точно веднъж)" % (
        len(found.seats), len(found.tables), len(found.sections), len(found.zones)))
    print("записано: %s (%.1f KB)" % (out_path, os.path.getsize(out_path) / 1024.0))


def main():
    args = sys.argv[1:]
    svg, venue, out = (args + [None] * 3)[:3]
    svg, venue, out = svg or DEFAULT_SVG, venue or DEFAULT_VENUE, out or DEFAULT_OUT
    for path in (svg, venue):
        if not os.path.exists(path):
            sys.exit("Липсва входен файл: " + path)
    build(svg, venue, out)


if __name__ == "__main__":
    main()
