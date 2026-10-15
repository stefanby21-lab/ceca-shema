#!/usr/bin/env python3
"""Сверява генериран venue файл срещу оригиналната схема на kupibileti.bg.

    python3 tools/verify-venue.py "<път>/KUPIBILETI.BG.html" venue-data-arena.js

Сравнява по сектори: брой места, етикети на редовете, номера на местата във
всеки ред, брой маси. Излиза с код 1 при разлика.
"""
import json
import os
import subprocess
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importlib import import_module

conv = import_module("kupibileti-to-venue".replace("-", "_")) if False else None
import importlib.util

spec = importlib.util.spec_from_file_location(
    "conv", os.path.join(os.path.dirname(os.path.abspath(__file__)), "kupibileti-to-venue.py")
)
conv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(conv)


def load_venue(path):
    js = 'global.window={};require("%s");console.log(JSON.stringify(window.VENUE));' % os.path.abspath(path)
    r = subprocess.run(["node", "-e", js], capture_output=True, text=True)
    if r.returncode:
        sys.exit("Не мога да прочета " + path + ":\n" + r.stderr)
    return json.loads(r.stdout)


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    html_path, venue_path = sys.argv[1], sys.argv[2]

    root = conv.extract_svg(conv.read_html(html_path))
    orig_sectors, orig_tables = conv.parse_schema(root)
    venue = load_venue(venue_path)

    ours = {}
    for f in venue["seats"]["features"]:
        p = f["properties"]
        ours.setdefault(p["s"], {}).setdefault(str(p["r"]), []).append(p["t"])

    print("сектор".ljust(12), "места".rjust(12), "редове".rjust(9), " статус")
    problems = 0
    for token, sec in orig_sectors.items():
        mine = ours.get(token, {})
        o_rows = {r: sorted(s["t"] for s in lst) for r, lst in sec["rows"].items()}
        m_rows = {r: sorted(v) for r, v in mine.items()}
        ok = o_rows == m_rows
        problems += not ok
        o_n = sum(len(v) for v in o_rows.values())
        m_n = sum(len(v) for v in m_rows.values())
        if not ok:
            print(
                token.ljust(12),
                ("%d/%d" % (o_n, m_n)).rjust(12),
                ("%d/%d" % (len(o_rows), len(m_rows))).rjust(9),
                " РАЗЛИКА",
            )
            only_o = set(o_rows) - set(m_rows)
            only_m = set(m_rows) - set(o_rows)
            if only_o:
                print("    редове само в оригинала:", sorted(only_o))
            if only_m:
                print("    редове само при нас:", sorted(only_m))
            for r in sorted(set(o_rows) & set(m_rows)):
                if o_rows[r] != m_rows[r]:
                    print("    ред %s: оригинал %s / наши %s" % (r, o_rows[r], m_rows[r]))

    o_total = sum(len(l) for v in orig_sectors.values() for l in v["rows"].values())
    m_total = len(venue["seats"]["features"])
    o_tables, m_tables = len(orig_tables), len(venue.get("tables", {}).get("features", []))
    extra = set(ours) - set(orig_sectors)
    if extra:
        problems += 1
        print("сектори само при нас:", sorted(extra))

    print("-" * 48)
    print("сектори: %d в оригинала, %d при нас" % (len(orig_sectors), len(ours)))
    print("места:   %d в оригинала, %d при нас" % (o_total, m_total))
    print("маси:    %d в оригинала, %d при нас" % (o_tables, m_tables))
    sold = sum(1 for f in venue["seats"]["features"] if f["properties"].get("sold"))
    print("от местата: %d свободни, %d продадени" % (m_total - sold, sold))
    if problems or o_total != m_total or o_tables != m_tables:
        print("РЕЗУЛТАТ: има разлики")
        sys.exit(1)
    print("РЕЗУЛТАТ: 1:1 по сектори, редове, номера на местата и маси")


if __name__ == "__main__":
    main()
