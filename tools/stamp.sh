#!/bin/bash
# Преизчислява отпечатъците „?v=" в index.html и checkout/index.html от
# СЪДЪРЖАНИЕТО на файловете.
#
# Файловете се кешират завинаги с този отпечатък. Забрави ли се, поправката
# просто не стига до хората, отваряли схемата преди - изглежда, че нищо не е
# променено. Затова: пусни го след всяка промяна по css/js, преди да комитваш.
#
# vendor/ нарочно се пропуска - там отпечатъкът е версията на библиотеката.
set -e
cd "$(dirname "$0")/.."
changed=0

# stamp <html> <файл> - файлът се търси в html по краткото му име (basename),
# защото checkout/index.html го сочи като "checkout.js" или "../seatfinder.js".
stamp() {
  html=$1; f=$2
  [ -f "$f" ] || return 0
  name=$(basename "$f")
  # Точката в името се екранира, за да не мине за произволен знак.
  esc=$(printf '%s' "$name" | sed 's/\./\\./g')
  old=$(grep -o "[/\"]$esc?v=[0-9a-f]*" "$html" | head -1 | sed "s|.*$esc?v=||")
  [ -n "$old" ] || return 0
  new=$(shasum -a 256 "$f" | cut -c1-10)
  if [ "$new" != "$old" ]; then
    sed -i '' "s|\([/\"]\)$esc?v=[0-9a-f]*|\1$name?v=$new|g" "$html"
    echo "  обновен: $html $f  $old -> $new"
    changed=1
  fi
}

for f in startup.js ceca-plan-svg.js map-svg.js styles.css venue-data-ceca.js arena-geometry.js arena-seatview.js map.js seatview3d.js seatfinder.js party-memory.js seatviews.js seatview-image.js ui.js app.js sheet.js; do
  stamp index.html "$f"
done
for f in assets/preview-map-desktop.webp assets/preview-map-mobile.webp assets/preview-plan-desktop.webp assets/preview-plan-mobile.webp; do
  stamp index.html "$f"
done
for f in checkout/checkout.css checkout/checkout.js venue-data-ceca.js seatfinder.js; do
  stamp checkout/index.html "$f"
done
[ "$changed" = "0" ] && echo "  всички отпечатъци са актуални"
exit 0
