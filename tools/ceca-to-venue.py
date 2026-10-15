#!/usr/bin/env python3
"""Генерира venue-data-ceca.js за концерта на Цеца (07.11.2026, Арена 8888).

    python3 tools/ceca-to-venue.py [схема.html] [цени.xlsx] [изход.js] [--date ГГГГ-ММ-ДД]

Без аргументи ползва файловете в ~/Downloads (виж DEFAULT_*) и пише
venue-data-ceca.js в корена на проекта. Само стандартна библиотека.

Входове (остават извън repo-то; в изхода няма нищо освен геометрия и цени):
  1. "ceca shema.html" - запазена админ страница на kupibileti с един SVG.
     Правилата за сектори, редове и места са като в kupibileti-to-venue.py
     (ползваме неговия парсер). Допълнително: маси <g id="S-Masa_N"> с
     квадрат 40x40, зона <g id="S-Standing"> и правоъгълници на пода
     (Stage, FOH, BAR), намирани по надписа, който лежи вътре в тях.
  2. "CECA Tickets & VIP Tables Price.xlsx" - лист 1 цени на трибуните,
     лист 2 цени и блокирани маси.

Правила за цените на трибуните (лист 1):
  * имената на сектори се нормализират: кирилски близнаци (А, В, С) стават
    латински, завършващата точка се маха;
  * цена 0 или "не е в продажба" - целият сектор не се продава;
  * сектор, който го няма в листа (ложи 200-214, V.I.P, D.2.x) - не се продава;
  * "от N ред в продажба" - редовете под N не се продават;
  * "Блокирани места": "6-ти ред", "ред 1" - този ред не се продава;
  * "от ред A до ред B" и "ред 14,15,16" - цена по ред; ред без допълнителна
    информация - цена за всички редове, които не са изброени изрично;
  * ред без цена и без информация (напр. залутано "C.3.6") се прескача.
Маси: само номера 1..TABLE_COUNT (новият план е 180, листът помни стария с 300);
цената и "Блокирана" се взимат по номер.

Предположения за потвърждение от Stefan (всичките са константи по-долу):
  * STANDING_EUR и STANDING_CAPACITY на зоната за правостоящи;
  * SEATS_PER_TABLE: ВИП масите са коктейлни, за 6 души (2 бар стола към маса);
  * извън листа с цените не се продава нищо (D.2.x включително);
  * мащабът е закован на този на Тони Стораро (SVG_PITCH), за да не мърдат
    координатите, на които разчитат камерата и arena-geometry.js;
  * availabilitySource "demo": всичко е свободно, освен неприсъстващото в
    продажба. Датата е днешната (--date за повторяем изход).
"""
import datetime
import importlib.util
import io
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(HERE)
DEFAULT_SVG = os.path.expanduser("~/Downloads/ceca shema/ceca shema.html")
DEFAULT_XLSX = os.path.expanduser("~/Downloads/Spreadsheets/CECA Tickets & VIP Tables Price.xlsx")
DEFAULT_OUT = os.path.join(ROOT_DIR, "venue-data-ceca.js")

# --- предположения (за потвърждение) ---
SEATS_PER_TABLE = 6          # ВИП маса = коктейлна маса за 6 души
TABLE_COUNT = 180            # номера 1..180, новият план
STANDING_EUR = 50            # цена на билет за правостоящи
STANDING_CAPACITY = 738      # капацитет на зоната
ORGANIZER = "C'est La Vie Restaurant & Club"
VIP_TABLE_INCLUDES = [
    "Премиум алкохол (700 мл.) - 1 бутилка",
    "Минерална вода (330 мл.) - 5 бутилки",
    "Безалкохолни напитки Vidas (250 мл.) - 5 кена",
    "Ядки",
    "VIP паркомясто - 1 бр.",
    "2 бар стола към всяка коктейлна маса",
]
EVENT, EVENT_DATE, VENUE_NAME, CITY = "CECA", "2026-11-07", "Арена 8888", "София"
UPPER_TIER = ["B.", "204", "205", "206", "207"]
SEAT_PALETTE = ["#1a9850", "#66bd63", "#a6d96a", "#fee08b", "#fdae61", "#f46d43", "#d73027", "#a50026"]
# Нива на масите: най-скъпата е ниво 0. color е за схемата, pill - по-тъмен
# вариант за балончето с бял текст (контраст над 4.5:1).
TABLE_LEVEL_STYLE = [("#8E44C8", "#6A2FA0"), ("#D42839", "#B31B2B"), ("#0A8CB0", "#0A6C86")]
BLOCKED_TABLE_COLOR = "#3A4150"
# Мащаб. kb.median_pitch мери на подизвадка и дава различен резултат според
# броя на местата (тук 14.46, при Тони Стораро 20.45). Приложението (arena-geometry.js,
# камерата) е настроено за мащаба на Тони, затова го фиксираме: 20.45 SVG единици
# стават TARGET_PITCH. Така трибуните съвпадат със SVG-то на Тони с точност
# около 0.0001, с изключение на B.2.7/B.2.8 (имената са разменени между двата
# SVG файла, разлика до около 3.5 единици) и C.3.6 (изместен с един ред, около
# 0.19). Източник на истината е SVG-то на Цеца.
SVG_PITCH = 20.45

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location("kb", os.path.join(HERE, "kupibileti-to-venue.py"))
kb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(kb)
NS, FEE = kb.NS, kb.FEE
XNS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
LOOKALIKE = str.maketrans("АВСЕНКМОРТХ", "ABCEHKMOPTX")


# ---------------------------------------------------------------- xlsx
def read_xlsx(path):
    """-> списък от листове, всеки списък от редове {колона: текст}."""
    z = zipfile.ZipFile(path)
    shared = [
        "".join(t.text or "" for t in si.iter(XNS + "t"))
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(XNS + "si")
    ]
    rels = {
        r.get("Id"): r.get("Target")
        for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    }
    rid = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    sheets = []
    for sh in ET.fromstring(z.read("xl/workbook.xml")).find(XNS + "sheets"):
        target = rels[sh.get(rid)].lstrip("/")
        root = ET.fromstring(z.read(target if target.startswith("xl/") else "xl/" + target))
        rows = []
        for row in root.iter(XNS + "row"):
            cells = {}
            for c in row:
                v = c.find(XNS + "v")
                if v is None or v.text is None:
                    continue
                text = shared[int(v.text)] if c.get("t") == "s" else v.text
                cells[re.match(r"[A-Z]+", c.get("r")).group(0)] = text.strip()
            rows.append(cells)
        sheets.append(rows)
    return sheets


def num(text):
    """"80" -> 80, "12.5" -> 12.5, "" -> None."""
    if text is None or text == "":
        return None
    v = float(text.replace(",", "."))
    return int(v) if v == int(v) else v


def norm_sector(name):
    return (name or "").strip().translate(LOOKALIKE).rstrip(".").strip()


# ---------------------------------------------------------- цени: трибуни
def blocked_rows(text):
    """"6-ти ред", "ред 1", "ред 3, 4" -> {6}, {1}, {3, 4}."""
    out = {int(n) for n in re.findall(r"(\d+)\s*-\s*[а-я]+\s+ред", text)}
    for group in re.findall(r"ред\s*(\d[\d,\s]*)", text):
        out |= {int(n) for n in re.findall(r"\d+", group)}
    return out


def parse_tribune_rules(rows):
    """sector -> {"off", "default", "rows": {ред: цена}, "first", "blocked": {ред}}."""
    rules = OrderedDict()
    for r in rows:
        sector = norm_sector(r.get("A"))
        if not sector or r.get("A", "").strip() == "Сектор":
            continue
        price, info, blocked = num(r.get("B")), r.get("C", "").lower(), r.get("D", "").lower()
        if price is None and not info:
            continue
        rule = rules.setdefault(sector, {"off": False, "default": None, "rows": {}, "first": 1, "blocked": set()})
        rule["blocked"] |= blocked_rows(blocked)
        if price == 0 or "не е в продажба" in info:
            rule["off"] = True
            continue
        span = re.search(r"от ред (\d+) до ред (\d+)", info)
        listed = re.match(r"ред\s+([\d,\s]+)", info)
        if span:
            for n in range(int(span.group(1)), int(span.group(2)) + 1):
                rule["rows"][n] = price
        elif listed:
            for n in re.findall(r"\d+", listed.group(1)):
                rule["rows"][int(n)] = price
        else:
            rule["default"] = price
            start = re.search(r"от (\d+) ред в продажба", info)
            if start:
                rule["first"] = int(start.group(1))
    return rules


def tribune_price(rule, row):
    """Цена на място в този ред или None, ако не се продава."""
    if rule is None or not str(row).isdigit():
        return None
    n = int(row)
    if rule["off"] and not rule["rows"] and rule["default"] is None:
        return None
    if n < rule["first"] or n in rule["blocked"]:
        return None
    return rule["rows"].get(n, rule["default"])


def parse_table_rules(rows):
    """номер -> (цена, блокирана) за 1..TABLE_COUNT."""
    out = {}
    for r in rows:
        a = r.get("A", "")
        if a.isdigit() and 1 <= int(a) <= TABLE_COUNT and num(r.get("B")) is not None:
            out[int(a)] = (num(r["B"]), "блокирана" in r.get("C", "").lower())
    missing = [n for n in range(1, TABLE_COUNT + 1) if n not in out]
    if missing:
        sys.exit("В листа с масите липсват номера: %s" % missing[:10])
    return out


# ------------------------------------------------------- геометрия от SVG
def pts_of(el):
    return [tuple(map(float, p.split(","))) for p in (el.get("points") or "").split() if "," in p]


def first_polygon(g):
    for p in g:
        if p.tag == NS + "polygon":
            return pts_of(p)
    return []


def parse_tables_and_standing(root):
    tables, standing = {}, None
    for g in root.iter(NS + "g"):
        gid = g.get("id") or ""
        m = re.match(r"S-Masa_(\d+)$", gid)
        if m:
            tables[int(m.group(1))] = first_polygon(g)
        elif gid == "S-Standing":
            standing = first_polygon(g)
    return tables, standing


def parse_floor_objects(root):
    """Правоъгълниците Stage/FOH/BAR - по надписа, който е вътре в тях."""
    rects = []
    for r in root.iter(NS + "rect"):
        if "str1" in (r.get("class") or "") and r.get("x") and not r.get("transform"):
            rects.append(tuple(float(r.get(k)) for k in ("x", "y", "width", "height")))
    found = {"Stage": [], "FOH": [], "BAR": []}
    for t in root.iter(NS + "text"):
        label = (t.text or "").strip()
        if label not in found:
            continue
        tx, ty = float(t.get("x")), float(t.get("y"))
        for x, y, w, h in rects:
            if x <= tx <= x + w and y <= ty <= y + h:
                found[label].append((x, y, w, h))
    return {k: sorted(set(v)) for k, v in found.items()}


def rect_ring(rect):
    x, y, w, h = rect
    return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]


def zero(v):
    return v + 0.0  # -0.0 става 0.0, за да е изходът чист


def mean_point(points):
    return [zero(round(sum(p[0] for p in points) / len(points), 4)), zero(round(sum(p[1] for p in points) / len(points), 4))]


def closed(ring):
    return ring if ring[0] == ring[-1] else ring + [ring[0]]


# ------------------------------------------------------------- изграждане
def tier_ladder(prices):
    used = sorted(set(prices))
    tiers = [
        {"tier": i, "color": SEAT_PALETTE[min(i, len(SEAT_PALETTE) - 1)], "maxEur": None, "label": "%g €" % p}
        for i, p in enumerate(used)
    ]
    return used, {p: i for i, p in enumerate(used)}, tiers


def seat_feature(token, row, s, price, T, tier_of):
    free = price is not None
    props = OrderedDict(
        mk="s:%s r:%s t:%d" % (token, row, s["t"]), s=token, r=row, t=s["t"], obstructed=False, sold=not free,
        eur=price, eurAll=round(price + FEE, 2) if free else None, tier=tier_of[price] if free else None, view=0.5,
    )
    if not free:
        props["offsale"] = True
    return {"type": "Feature", "properties": props, "geometry": {"type": "Point", "coordinates": T(s["x"], s["y"])}}


def mark_runs(features, idx):
    """run = дължина на непрекъснатия свободен отрязък, в който е мястото."""
    seg = []
    for i in idx + [None]:
        if i is not None and not features[i]["properties"]["sold"]:
            seg.append(i)
            continue
        for j in seg:
            features[j]["properties"]["run"] = len(seg)
        seg = []


def sector_features(token, sec, seats, runs, T, tier_of, used, rules):
    """Добавя местата на сектора към seats/runs; връща (секция, етикет, пинове, редови етикети)."""
    start, rowlabels, rule = len(seats), [], rules.get(token)
    for row, lst in sec["rows"].items():
        lst.sort(key=lambda s: s["t"])
        price = tribune_price(rule, row)
        idx = []
        for s in lst:
            idx.append(len(seats))
            seats.append(seat_feature(token, row, s, price, T, tier_of))
        mark_runs(seats, idx)
        runs.append(idx)
        rowlabels.append({"type": "Feature", "properties": {"label": row, "s": token, "side": "L"},
                          "geometry": {"type": "Point", "coordinates": seats[idx[0]]["geometry"]["coordinates"]}})
    mine = seats[start:]
    pts = [f["geometry"]["coordinates"] for f in mine]
    free = [f["properties"] for f in mine if not f["properties"]["sold"]]
    pf = min(p["eur"] for p in free) if free else None
    name = sec["name"] or token
    ring = closed([list(T(*p)) for p in sec["outline"]]) if sec["outline"] else None
    props = OrderedDict(
        mk="s:" + token, name=name, token=token, level=name.split(".")[0] if "." in name else "",
        eur=pf, priceFrom=pf, priceFromAll=round(pf + FEE, 2) if free else None,
        tier=tier_of[pf] if free else None, bucketLabel=("%g €" % pf) if free else None,
        bucket=tier_of[pf] if free else None, centroid=mean_point(pts), seatCount=len(pts),
        hasObstructed=False, real=True, photo=None, pano=None,
    )
    if not free:
        props["offsale"] = True
    section = {"type": "Feature", "id": "s:" + token, "properties": props,
               "geometry": {"type": "Polygon", "coordinates": [ring]}}
    label = {"type": "Feature", "properties": {"label": name, "mk": "s:" + token},
             "geometry": {"type": "Point", "coordinates": props["centroid"]}}
    by_tier = {}
    for f in mine:
        if not f["properties"]["sold"]:
            by_tier.setdefault(f["properties"]["tier"], []).append(f["geometry"]["coordinates"])
    pins = []
    for tr in sorted(by_tier):
        price = used[tr]
        pins.append({"type": "Feature",
                     "properties": {"mk": "s:" + token, "name": name, "priceFrom": price,
                                    "priceFromAll": round(price + FEE, 2), "tier": tr, "bucket": tr},
                     "geometry": {"type": "Point", "coordinates": mean_point(by_tier[tr])}})
    return section, label, pins, rowlabels


def table_levels(table_rules):
    prices = sorted({p for p, blocked in table_rules.values()}, reverse=True)
    if len(prices) > len(TABLE_LEVEL_STYLE):
        sys.exit("Повече ценови нива на масите (%s), отколкото цветове." % prices)
    levels = []
    for i, p in enumerate(prices):
        per = round(p / float(SEATS_PER_TABLE), 2)
        color, pill = TABLE_LEVEL_STYLE[i]
        levels.append(OrderedDict(level=i, color=color, eurPerSeat=per, eurTable=p, label="%g €" % p,
                                  perSeat="%d € на място" % round(per), pill=pill))
    return levels


def table_features(tables, table_rules, levels, T):
    by_price = {lv["eurTable"]: lv for lv in levels}
    out = []
    for n in sorted(tables):
        ring = [T(*p) for p in tables[n]]
        xs, ys = [p[0] for p in ring], [p[1] for p in ring]
        price, blocked = table_rules[n]
        lv = by_price[price]
        props = OrderedDict(
            mk="t:Masa_%d" % n, name="Маса %d" % n, token="Masa_%d" % n,
            eur=None if blocked else price, eurAll=None if blocked else round(price + FEE, 2), sold=blocked,
            seats=SEATS_PER_TABLE, eurPerSeat=None if blocked else lv["eurPerSeat"],
            color=BLOCKED_TABLE_COLOR if blocked else lv["color"],
            radius=round(min(max(xs) - min(xs), max(ys) - min(ys)) / 2.0 * 0.86, 4),
        )
        if blocked:
            props["offsale"] = True
        props["tableLevel"] = None if blocked else lv["level"]
        out.append({"type": "Feature", "properties": props, "geometry": {"type": "Point", "coordinates": mean_point(ring)}})
    return out


def standing_feature(ring):
    props = OrderedDict(mk="z:Standing", name="Правостоящи", token="Standing", eur=STANDING_EUR,
                        eurAll=round(STANDING_EUR + FEE, 2), capacity=STANDING_CAPACITY, offsale=False)
    return {"type": "Feature", "id": "z:Standing", "properties": props,
            "geometry": {"type": "Polygon", "coordinates": [closed(ring)]}}


def label_feature(text, rect, T):
    x, y, w, h = rect
    # size - ширина и дълбочина на правоъгълника в единиците на залата (за 3D
    # изгледа: бар и FOH се строят по реалния си размер, не по гадания).
    (ax, ay), (bx, by) = T(x, y), T(x + w, y + h)
    return {"type": "Feature", "properties": OrderedDict(label=text, size=[round(abs(bx - ax), 4), round(abs(by - ay), 4)]),
            "geometry": {"type": "Point", "coordinates": T(x + w / 2.0, y + h / 2.0)}}


def make_transform(sectors):
    pts = [(s["x"], s["y"]) for v in sectors.values() for r in v["rows"].values() for s in r]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    cx, cy = (min(xs) + max(xs)) / 2.0, (min(ys) + max(ys)) / 2.0
    k = kb.TARGET_PITCH / SVG_PITCH
    return lambda x, y: [zero(round((x - cx) * k, 4)), zero(round(-(y - cy) * k, 4))]


def fc(features):
    return {"type": "FeatureCollection", "features": features}


def build_venue(svg_path, xlsx_path, date):
    root = kb.extract_svg(kb.read_html(svg_path))
    sectors, _ = kb.parse_schema(root)
    tables, standing = parse_tables_and_standing(root)
    floor = parse_floor_objects(root)
    sheets = read_xlsx(xlsx_path)
    rules, table_rules = parse_tribune_rules(sheets[0]), parse_table_rules(sheets[1])
    if sorted(tables) != list(range(1, TABLE_COUNT + 1)) or not standing or len(floor["Stage"]) != 1:
        sys.exit("Схемата не съдържа очакваните маси, правостоящи и сцена.")
    T = make_transform(sectors)

    prices = [p for t, sec in sectors.items() for row in sec["rows"] for p in [tribune_price(rules.get(t), row)] if p is not None]
    used, tier_of, tiers = tier_ladder(prices)
    seats, runs, secs, labels, pins, rowlabels = [], [], [], [], [], []
    for token, sec in sectors.items():
        s, lab, pn, rl = sector_features(token, sec, seats, runs, T, tier_of, used, rules)
        secs.append(s); labels.append(lab); pins += pn; rowlabels += rl
    levels = table_levels(table_rules)
    tbl = table_features(tables, table_rules, levels, T)

    stage_rect = floor["Stage"][0]
    focus = label_feature("", stage_rect, T)["geometry"]["coordinates"]
    objects = [label_feature("СЦЕНА", stage_rect, T)]
    for name in ("FOH", "BAR"):
        objects += [label_feature(name, r, T) for r in floor[name]]

    venue = OrderedDict()
    venue["meta"] = OrderedDict(
        venue=VENUE_NAME, city=CITY, event=EVENT, date=EVENT_DATE, organizer=ORGANIZER,
        sections=len(secs), seats=len(seats), tables=len(tbl), runs=len(runs), currency="EUR",
        fees="flat-admin-fee-%.2f" % FEE, seatPitch=kb.TARGET_PITCH, upperTier=UPPER_TIER, source="kupibileti-svg",
        sourceFile=os.path.basename(svg_path), availabilitySource="demo", availabilityDate=date,
        tableLevels=levels, vipTableIncludes=VIP_TABLE_INCLUDES,
    )
    venue["focus"] = focus
    venue["tiers"] = tiers
    venue["sections"], venue["seats"], venue["tables"] = fc(secs), fc(seats), fc(tbl)
    venue["adjacency"] = {"runs": runs}
    venue["rowLabels"], venue["sectionLabels"], venue["pins"] = fc(rowlabels), fc(labels), fc(pins)
    venue["objectLabels"] = fc(objects)
    venue["stage"] = {"type": "Feature", "properties": {"part": "stage"},
                      "geometry": {"type": "Polygon", "coordinates": [closed([T(*p) for p in rect_ring(stage_rect)])]}}
    venue["standing"] = fc([standing_feature([T(*p) for p in standing])])
    return venue


def summary(venue, out_path):
    seats = venue["seats"]["features"]
    off = sum(1 for f in seats if f["properties"]["sold"])
    print("сектори: %d (изцяло извън продажба: %d)" % (len(venue["sections"]["features"]),
          sum(1 for f in venue["sections"]["features"] if f["properties"].get("offsale"))))
    print("места: %d (свободни %d, извън продажба %d) | редове: %d" % (len(seats), len(seats) - off, off, len(venue["adjacency"]["runs"])))
    for lv in venue["meta"]["tableLevels"]:
        mine = [f["properties"] for f in venue["tables"]["features"] if f["properties"]["tableLevel"] == lv["level"]]
        print("маси ниво %d (%s): %d свободни" % (lv["level"], lv["label"], len(mine)))
    blocked = sum(1 for f in venue["tables"]["features"] if f["properties"].get("offsale"))
    print("маси: %d (блокирани %d, по %d места)" % (len(venue["tables"]["features"]), blocked, SEATS_PER_TABLE))
    st = venue["standing"]["features"][0]["properties"]
    print("правостоящи: %s, %g €, капацитет %d" % (st["name"], st["eur"], st["capacity"]))
    print("ценови категории места:", ", ".join(t["label"] for t in venue["tiers"]))
    print("сцена: намерена, фокус %s" % venue["focus"])
    print("записано:", out_path, "(%.1f KB)" % (os.path.getsize(out_path) / 1024.0))


def main():
    args, date = sys.argv[1:], datetime.date.today().isoformat()
    if "--date" in args:
        i = args.index("--date")
        date = args[i + 1]
        del args[i : i + 2]
    svg, xlsx, out = (args + [None] * 3)[:3]
    svg, xlsx, out = svg or DEFAULT_SVG, xlsx or DEFAULT_XLSX, out or DEFAULT_OUT
    for path in (svg, xlsx):
        if not os.path.exists(path):
            sys.exit("Липсва входен файл: " + path)
    venue = build_venue(svg, xlsx, date)
    with io.open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("window.VENUE = " + json.dumps(venue, ensure_ascii=False, separators=(",", ":")) + ";\n")
    summary(venue, out)


if __name__ == "__main__":
    main()
