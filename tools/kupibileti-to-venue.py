#!/usr/bin/env python3
"""Превръща запазена страница от kupibileti.bg във venue данни за схемата.

    python3 tools/kupibileti-to-venue.py "<път>/KUPIBILETI.BG.html" venue-data.js ARENA

Как е устроен оригиналът (важи и за НДК, и за Арена 8888):
  <g id="S-B.2.2"><title>B.2.2</title>        сектор
    <polygon class="fil6">                    контур на сектора
    <g id="R-27"><title>27</title>            ред
      <circle id="M-21" class="color8">       място; класът е ценовата категория
  Маси: <g id="S-1_x002f_1"><title>Маса 1/1</title> с <polygon id="M-..">, тоест
  цялата маса е една покупка, не отделни столове.
  Суфиксите "_1234" по id-тата са от графичния редактор и се махат.
  Сиво (#CCCCCC: color-free, multiplace, fil1, fil5) означава продадено.

Изходът е същият формат като venue-data-ndk.js, плюс `tables` за масите.
"""
import io
import json
import math
import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter, OrderedDict

NS = "{http://www.w3.org/2000/svg}"
SOLD_CLASSES = {"color-free", "multiplace", "fil1", "fil5", "fil6"}
# Скалата на схемата: колко единици да е разстоянието между две съседни места.
# Рендерът е настроен за тази стъпка, затова се запазва между залите.
TARGET_PITCH = 0.3703
FEE = 1.02  # такса за обслужване, както в НДК данните
UPPER_TIER = {"Арена 8888": ["B.", "204", "205", "206", "207"]}
EVENTS = {"Арена 8888": "Цеца"}


def clean(v):
    v = (v or "").replace("_x002f_", "/").replace("_x0020_", " ")
    return re.sub(r"_\d+$", "", v)


def tagname(e):
    return e.tag.replace(NS, "")


def read_html(path):
    return io.open(path, encoding="utf-8", errors="replace").read()


def extract_svg(html):
    i, j = html.find("<svg"), html.find("</svg>")
    if i < 0 or j < 0:
        sys.exit("Във файла няма вграден SVG.")
    return ET.fromstring(html[i : j + 6])


def price_legend(html, seat_classes, table_classes):
    """клас -> цена, разделено по вида на елемента.

    Един и същи цвят се ползва и за място, и за маса (color8 е 40 € място и
    2040 € маса). Легендата изрежда първо цените на местата, после на масите,
    затова първото попадение на клас, който се среща по кръговете, е цена на
    място, а следващото - на маса."""
    after = html[html.find("</svg>") :]
    pairs = []
    for m in re.finditer(r'class="[^"]*\bcolor(\d+)\b[^"]*"[\s\S]{0,400}?([\d\s]+[.,]\d{2})\s*€', after):
        c, p = int(m.group(1)), float(m.group(2).replace(" ", "").replace(",", "."))
        if not pairs or pairs[-1] != (c, p):
            pairs.append(("color%d" % c, p))
    seats, tables = OrderedDict(), OrderedDict()
    for key, p in pairs:
        if key in seat_classes and key not in seats:
            seats[key] = p
        elif key in table_classes and key not in tables:
            tables[key] = p
        elif key in seats:
            seats[key] = min(seats[key], p)
    return seats, tables


def class_colors(html):
    """.color8 {fill:#1bb9e0} -> цвета на ценовата категория от самата схема."""
    out = {}
    for m in re.finditer(r"\.(color\d+)\s*\{\s*fill:\s*(#[0-9a-fA-F]{3,6})", html):
        out[m.group(1)] = m.group(2)
    return out


def parse_schema(root):
    sectors, tables = OrderedDict(), OrderedDict()

    def pts_of(p):
        return [tuple(map(float, x.split(","))) for x in (p.get("points") or "").split() if "," in x]

    def walk(el, sec=None, name=None, outline=None):
        for ch in el:
            if tagname(ch) != "g":
                continue
            gid = clean(ch.get("id"))
            title = ch.find(NS + "title")
            tname = (title.text or "").strip() if title is not None else None
            if gid.startswith("S-"):
                token = gid[2:]
                shape = None
                for p in ch:
                    if tagname(p) == "polygon" and not (p.get("id") or "").startswith("M-"):
                        shape = pts_of(p)
                        break
                walk(ch, token, tname or token, shape)
            elif gid.startswith("R-") and sec is not None:
                row = gid[2:]
                for c in ch.iter(NS + "circle"):
                    m = re.match(r"M-(\d+)", c.get("id") or "")
                    if not m:
                        continue
                    sectors.setdefault(sec, {"name": name, "outline": outline, "rows": OrderedDict()})
                    sectors[sec]["rows"].setdefault(row, []).append(
                        {
                            "t": int(m.group(1)),
                            "x": float(c.get("cx")),
                            "y": float(c.get("cy")),
                            "cls": (c.get("class") or "").strip(),
                        }
                    )
                for p in ch.iter(NS + "polygon"):
                    if (p.get("id") or "").startswith("M-"):
                        q = pts_of(p)
                        if q:
                            tables[sec] = {"name": name, "row": row, "pts": q, "cls": (p.get("class") or "").strip()}
            else:
                walk(ch, sec, name, outline)

    walk(root)
    return sectors, tables


def find_stage(root, seat_bbox):
    """Сцената е най-голямата фигура без id извън редовете."""
    best, best_area = None, 0
    for p in root.iter(NS + "polygon"):
        if p.get("id"):
            continue
        q = [tuple(map(float, x.split(","))) for x in (p.get("points") or "").split() if "," in x]
        if len(q) < 3:
            continue
        xs, ys = [a for a, _ in q], [b for _, b in q]
        area = (max(xs) - min(xs)) * (max(ys) - min(ys))
        if area > best_area:
            best, best_area = q, area
    return best


def median_pitch(points):
    """Медианното разстояние до най-близкото място - стъпката на схемата."""
    sample = points[:: max(1, len(points) // 400)]
    dists = []
    for x, y in sample:
        best = float("inf")
        for a, b in points[:: max(1, len(points) // 1200)]:
            if a == x and b == y:
                continue
            d = (a - x) ** 2 + (b - y) ** 2
            if d < best:
                best = d
        if best < float("inf"):
            dists.append(math.sqrt(best))
    dists.sort()
    return dists[len(dists) // 2] if dists else 1.0


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    html_path, out_path = sys.argv[1], sys.argv[2]
    venue_name = sys.argv[3] if len(sys.argv) > 3 else "Зала"

    html = read_html(html_path)
    root = extract_svg(html)
    sectors, tables = parse_schema(root)
    seat_classes = {s["cls"] for v in sectors.values() for r in v["rows"].values() for s in r}
    table_classes = {t["cls"] for t in tables.values()}
    seat_prices, table_prices = price_legend(html, seat_classes, table_classes)
    cls_colors = class_colors(html)
    SEATS_PER_TABLE = 8  # маса се продава цяла, по 8 места

    all_pts = [(s["x"], s["y"]) for v in sectors.values() for r in v["rows"].values() for s in r]
    if not all_pts:
        sys.exit("Не намерих места в схемата.")
    xs, ys = [p[0] for p in all_pts], [p[1] for p in all_pts]
    cx, cy = (min(xs) + max(xs)) / 2.0, (min(ys) + max(ys)) / 2.0
    k = TARGET_PITCH / median_pitch(all_pts)

    def T(x, y):  # SVG (y надолу) -> данни (y нагоре, център в 0,0)
        return [round((x - cx) * k, 4), round(-(y - cy) * k, 4)]

    stage_pts = find_stage(root, None)
    stage_xy = [T(*p) for p in stage_pts] if stage_pts else None
    focus = (
        [round(sum(p[0] for p in stage_xy) / len(stage_xy), 4), round(sum(p[1] for p in stage_xy) / len(stage_xy), 4)]
        if stage_xy
        else [0, 0]
    )

    # --- ценови категории ---
    used = sorted({p for c, p in seat_prices.items()})
    palette = ["#1a9850", "#66bd63", "#a6d96a", "#fee08b", "#fdae61", "#f46d43", "#d73027", "#a50026"]
    tier_of_price = {p: i for i, p in enumerate(used)}
    tiers = [
        {"tier": i, "color": palette[min(i, len(palette) - 1)], "maxEur": None, "label": "%g €" % p}
        for i, p in enumerate(used)
    ]
    cls_price = dict(seat_prices)

    # --- места ---
    seats, index, runs = [], {}, []
    sections_fc, labels_fc, pins_fc, rowlabels_fc = [], [], [], []
    for token, sec in sectors.items():
        name = sec["name"] or token
        sec_prices = []
        seat_start = len(seats)
        for row, lst in sec["rows"].items():
            lst.sort(key=lambda s: s["t"])
            run = []
            for s in lst:
                price = cls_price.get(s["cls"])
                sold = s["cls"] in SOLD_CLASSES or price is None
                x, y = T(s["x"], s["y"])
                mk = "s:%s r:%s t:%d" % (token, row, s["t"])
                props = {
                    "mk": mk,
                    "s": token,
                    "r": row,
                    "t": s["t"],
                    "obstructed": False,
                    "sold": sold,
                    "eur": price if price is not None else None,
                    "eurAll": round(price + FEE, 2) if price is not None else None,
                    "tier": tier_of_price.get(price) if price is not None else None,
                    "view": 0.5,
                }
                index[mk] = len(seats)
                run.append(len(seats))
                seats.append({"type": "Feature", "properties": props, "geometry": {"type": "Point", "coordinates": [x, y]}})
                if price is not None and not sold:
                    sec_prices.append(price)
            if run:
                runs.append(run)
            if lst:
                first = seats[index["s:%s r:%s t:%d" % (token, row, lst[0]["t"])]]
                rowlabels_fc.append(
                    {
                        "type": "Feature",
                        "properties": {"label": row, "s": token, "side": "L"},
                        "geometry": {"type": "Point", "coordinates": first["geometry"]["coordinates"]},
                    }
                )
        pts = [s["geometry"]["coordinates"] for s in seats[seat_start:]]
        if not pts:
            continue
        ctr = [round(sum(p[0] for p in pts) / len(pts), 4), round(sum(p[1] for p in pts) / len(pts), 4)]
        pf = min(sec_prices) if sec_prices else None
        ring = [T(*p) for p in sec["outline"]] if sec["outline"] else None
        if ring and ring[0] != ring[-1]:
            ring = ring + [ring[0]]
        if not ring:  # без контур: правоъгълник около местата
            x0 = min(p[0] for p in pts); x1 = max(p[0] for p in pts)
            y0 = min(p[1] for p in pts); y1 = max(p[1] for p in pts)
            ring = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]
        props = {
            "mk": "s:" + token,
            "name": name,
            "token": token,
            "level": name.split(".")[0] if "." in name else "",
            "eur": pf,
            "priceFrom": pf,
            "priceFromAll": round(pf + FEE, 2) if pf is not None else None,
            "tier": tier_of_price.get(pf) if pf is not None else None,
            "bucketLabel": ("%g €" % pf) if pf is not None else None,
            "bucket": tier_of_price.get(pf) if pf is not None else None,
            "centroid": ctr,
            "seatCount": len(pts),
            "hasObstructed": False,
            "real": True,
            "photo": None,
            "pano": None,
        }
        sections_fc.append({"type": "Feature", "id": "s:" + token, "properties": props,
                            "geometry": {"type": "Polygon", "coordinates": [ring]}})
        labels_fc.append({"type": "Feature", "properties": {"label": name, "mk": "s:" + token},
                          "geometry": {"type": "Point", "coordinates": ctr}})
        # По едно балонче за всяка ценова категория в сектора, поставено в
        # средата на нейните места. Един сектор често има повече от една цена и
        # едно балонче "от X" скриваше останалите.
        by_tier = {}
        for s2 in seats[seat_start:]:
            q = s2["properties"]
            if q["sold"] or q["eur"] is None:
                continue
            by_tier.setdefault(q["tier"], []).append(s2["geometry"]["coordinates"])
        for tr, pl in sorted(by_tier.items()):
            price = used[tr]
            pins_fc.append({
                "type": "Feature",
                "properties": {"mk": "s:" + token, "name": name, "priceFrom": price,
                               "priceFromAll": round(price + FEE, 2), "tier": tr, "bucket": tr},
                "geometry": {"type": "Point",
                             "coordinates": [round(sum(c[0] for c in pl) / len(pl), 4),
                                             round(sum(c[1] for c in pl) / len(pl), 4)]},
            })

    # --- маси ---
    tbl = []
    for token, t in tables.items():
        ring = [T(*p) for p in t["pts"]]
        xs2 = [p[0] for p in ring]; ys2 = [p[1] for p in ring]
        ctr = [round(sum(xs2) / len(xs2), 4), round(sum(ys2) / len(ys2), 4)]
        price = table_prices.get(t["cls"])
        sold = t["cls"] in SOLD_CLASSES or price is None
        tbl.append({
            "type": "Feature",
            "properties": {
                "mk": "t:" + token, "name": t["name"] or token, "token": token,
                "eur": price, "eurAll": round(price + FEE, 2) if price is not None else None,
                "sold": sold,
                "seats": SEATS_PER_TABLE,
                "eurPerSeat": round(price / SEATS_PER_TABLE, 2) if price is not None else None,
                "color": cls_colors.get(t["cls"], "#c9a227"),
                # кръглата маса се вписва в квадрата, затова радиусът идва от
                # късата страна, иначе съседните маси се застъпват
                "radius": round(min(max(xs2) - min(xs2), max(ys2) - min(ys2)) / 2.0 * 0.86, 4),
            },
            "geometry": {"type": "Point", "coordinates": ctr},
        })

    venue = OrderedDict()
    venue["meta"] = {
        "venue": venue_name, "city": "София",
        "sections": len(sections_fc), "seats": len(seats), "tables": len(tbl),
        "runs": len(runs), "currency": "EUR", "fees": "flat-admin-fee-%.2f" % FEE,
        "seatPitch": TARGET_PITCH, "source": "kupibileti-svg",
        "sourceFile": os.path.basename(html_path),
    }
    # Кои сектори са на горен етаж - схемата на kupibileti не го записва никъде,
    # затова се води тук по зала. Префикс, завършващ на точка, хваща цялата
    # група ("B." = всички B.x.x); останалото е точно име.
    upper = UPPER_TIER.get(venue_name)
    if upper:
        venue["meta"]["upperTier"] = upper
    event = EVENTS.get(venue_name)
    if event:
        venue["meta"]["event"] = event
    venue["focus"] = focus
    venue["tiers"] = tiers
    venue["sections"] = {"type": "FeatureCollection", "features": sections_fc}
    venue["seats"] = {"type": "FeatureCollection", "features": seats}
    venue["tables"] = {"type": "FeatureCollection", "features": tbl}
    venue["adjacency"] = {"runs": runs}
    venue["rowLabels"] = {"type": "FeatureCollection", "features": rowlabels_fc}
    venue["sectionLabels"] = {"type": "FeatureCollection", "features": labels_fc}
    venue["pins"] = {"type": "FeatureCollection", "features": pins_fc}
    venue["objectLabels"] = {
        "type": "FeatureCollection",
        "features": [{"type": "Feature", "properties": {"label": "СЦЕНА"},
                      "geometry": {"type": "Point", "coordinates": focus}}],
    }
    if stage_xy:
        if stage_xy[0] != stage_xy[-1]:
            stage_xy = stage_xy + [stage_xy[0]]
        venue["stage"] = {"type": "Feature", "properties": {"part": "stage"},
                          "geometry": {"type": "Polygon", "coordinates": [stage_xy]}}

    io.open(out_path, "w", encoding="utf-8").write(
        "window.VENUE = " + json.dumps(venue, ensure_ascii=False, separators=(",", ":")) + ";\n"
    )
    sold = sum(1 for s in seats if s["properties"]["sold"])
    print("сектори: %d | места: %d (свободни %d, продадени %d)" % (len(sections_fc), len(seats), len(seats) - sold, sold))
    print("маси: %d (свободни %d) | редове: %d" % (len(tbl), sum(1 for t in tbl if not t["properties"]["sold"]), len(runs)))
    print("ценови категории места:", ", ".join(t["label"] for t in tiers))
    print("цени на маси:", ", ".join("%g €" % p for p in sorted(set(table_prices.values()))) or "няма")
    print("сцена:", "намерена, фокус %s" % focus if stage_xy else "НЕ е намерена")
    print("записано:", out_path, "(%.1f KB)" % (os.path.getsize(out_path) / 1024.0))


if __name__ == "__main__":
    main()
