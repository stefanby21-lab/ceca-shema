#!/bin/bash
# Пренася общия код на схемата от kupibileti-seatmap, където живее оригиналът.
#
# Моторът (картата, търсачката на места, 3D изгледът) е един и същ с НДК Зала 1.
# Поправка се прави ТАМ и се пренася тук. Но тази папка носи и визията на
# Арена 8888, затова НЕ всичко се презаписва:
#
#   пренася се само       - seatfinder.js (чиста логика)
#   само се докладва      - styles.css, map.js, app.js, ui.js, seatview3d.js
#                           (носят марката, махнатите предложения и местните
#                           библиотеки)
#   не се докосва изобщо  - index.html, venue-data-ceca.js, ceca-plan-svg.js
#
# Употреба:  bash tools/sync-engine.sh [път до kupibileti-seatmap]
set -e
SRC="${1:-$HOME/Desktop/kupibileti-seatmap}"
cd "$(dirname "$0")/.."

[ -f "$SRC/map.js" ] || { echo "Не намирам kupibileti-seatmap в $SRC"; exit 1; }

echo "Пренасям чистата логика:"
moved=0
for f in seatfinder.js; do
  if diff -q "$SRC/$f" "$f" >/dev/null 2>&1; then
    echo "  в синхрон: $f"
  else
    cp "$SRC/$f" "$f"
    echo "  ПРЕНЕСЕН:  $f"
    moved=1
  fi
done

echo ""
echo "Файлове с марката на Арена (пипат се на ръка):"
for f in styles.css map.js app.js ui.js seatview3d.js; do
  if diff -q "$SRC/$f" "$f" >/dev/null 2>&1; then
    echo "  еднакъв с оригинала: $f"
  else
    n=$(diff "$SRC/$f" "$f" | grep -c '^[<>]' || true)
    echo "  различен ($n реда): $f"
    echo "      виж: diff \"$SRC/$f\" $f"
  fi
done

cat <<'TXT'

Тук нарочно се разминаваме с оригинала:
  styles.css  - целите токени в :root са на Арена 8888 (тъмно, Sofia Sans),
                знакът .brand, тъмният контрол за мащаба, тъмният фон на .map-pane
  map.js      - фонът на картата е #0A0B0E; избраното място е бяло ядро със син
                пръстен, а продаденото и извън филтъра потъмняват вместо да
                светят; слоят за препоръчани места свети само за избраното
  app.js      - заглавието се сглобя от името на залата; входът без питане за
                брой билети; целият блок с препоръчани места е махнат, така че
                един клик избира точно едно място
  ui.js       - без хапчето „Билети" в лентата с филтри
  seatview3d.js - Three.js се чете от vendor/, не от unpkg.com

Ако в оригинала има поправка в някой от тези пет, пренеси само нея, на ръка.
TXT

[ "$moved" = "1" ] && echo "" && echo "Прегледай с git diff, пусни локално и чак тогава комитвай."
exit 0
