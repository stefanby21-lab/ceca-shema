#!/bin/bash
# Преизчислява отпечатъците „?v=" в index.html от СЪДЪРЖАНИЕТО на файловете.
#
# Файловете се кешират завинаги с този отпечатък. Забрави ли се, поправката
# просто не стига до хората, отваряли схемата преди - изглежда, че нищо не е
# променено. Затова: пусни го след всяка промяна по css/js, преди да комитваш.
#
# vendor/ нарочно се пропуска - там отпечатъкът е версията на библиотеката.
set -e
cd "$(dirname "$0")/.."
changed=0
for f in startup.js arena-plan-svg.js map-svg.js styles.css venue-data-arena.js arena-geometry.js arena-seatview.js map.js seatview3d.js seatfinder.js ui.js app.js sheet.js; do
  [ -f "$f" ] || continue
  new=$(shasum -a 256 "$f" | cut -c1-10)
  old=$(grep -o "$f?v=[0-9a-f]*" index.html | head -1 | sed "s|$f?v=||")
  if [ "$new" != "$old" ]; then
    # Точката в името се екранира, за да не мине за произволен знак.
    esc=$(printf '%s' "$f" | sed 's/\./\\./g')
    sed -i '' "s|$esc?v=[0-9a-f]*|$f?v=$new|g" index.html
    echo "  обновен: $f  $old -> $new"
    changed=1
  fi
done
[ "$changed" = "0" ] && echo "  всички отпечатъци са актуални"
exit 0
