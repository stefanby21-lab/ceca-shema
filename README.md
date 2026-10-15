# Схемата на Арена 8888

3D схема на залата с избор на места: 71 сектора, 13 617 места, 80 маси.
Отделен линк, за да може да се показва и вгражда сам, без останалия сайт.

**Живо:** https://arena-8888-shema.vercel.app (зад парола - искай я от Стефан)

Качва се само: Vercel билдва тази папка при всяко сливане в `main` (проектът е
закачен за репото с Root Directory `shema`). Ръчен `vercel deploy` от тази
папка НЕ работи - Vercel качва само нея и после търси в нея втора `shema`.

## Локално

```bash
python3 -m http.server 8791 -d .
```

После http://localhost:8791. Няма билд и няма бекенд - само статични файлове.

## Кое откъде идва

| Файл | Роля |
|---|---|
| `venue-data-arena.js` | залата: сектори, места, редове, съседства, цени |
| `map.js` | MapLibre картата, 3D местата, hover и клик |
| `seatfinder.js` | търсене на N съседни свободни места |
| `seatview3d.js` | изгледът от мястото |
| `ui.js` | сайдбар, филтри, модали, препоръки |
| `app.js` | свързва всичко и пълни шапката от `VENUE.meta` |
| `middleware.js` | паролата пред целия сайт (Vercel Edge) |

## Визията

Схемата носи дизайн системата на сайта, не тази на kupibileti: почти черно
`#0A0B0E`, Sofia Sans и Sofia Sans Condensed, синьото `#1D5AD0` и кехлибарът
`#F5A524`. Токените са в `:root` на `styles.css` и са преписани от
`prototype/styles.css`, за да не се разминават двете повърхности. Знакът в
шапката води обратно към сайта.

## Пренасяне на поправки от НДК

Моторът е общ с НДК Зала 1 и оригиналът му живее в
`stefanby21-lab/kupibileti-seatmap`:

```bash
bash tools/sync-engine.sh
```

Скриптът пренася само чистата логика (`seatfinder.js`, `seatview3d.js`,
`ui.js`). `styles.css`, `map.js` и `app.js` носят марката на Арена, затова
той само показва къде се различават и оставя сливането на човек. Иначе
първият синхрон би върнал светлата визия на kupibileti.

`index.html`, `venue-data-arena.js` и `middleware.js` не се пренасят изобщо.

Версията `?v=` до `venue-data-arena.js` се вдига при всяка промяна на
данните, иначе браузърите остават на старите места.

## Преди всеки комит по css/js

```bash
bash tools/stamp.sh
```

Обновява отпечатъците `?v=` в `index.html` от съдържанието на файловете.
Файловете се кешират завинаги с тях: забрави ли се, поправката просто не стига
до хората, които вече са отваряли схемата.

## Външни библиотеки

Няма. MapLibre и Three.js се сервират от `vendor/` - виж `vendor/README.md` за
версиите и отпечатъците. Чужд CDN в схемата не влиза: външният скрипт вижда
всичко на страницата, а версията му може да се смени под краката ни.


## Safari / browsers without WebGL (14 September 2026)

`startup.js` probes WebGL2 and WebGL1 before loading graphics dependencies. If both
are unavailable (including Safari Lockdown Mode), it loads `arena-plan-svg.js` and
`map-svg.js` with the same `venue-data-arena.js`, `seatfinder.js`, `app.js`, `ui.js`
and `sheet.js`. The public selection flow and demo checkout stay the same.
`?view=2d` opens this rendering path for local review without changing browser settings.

The 2D plan is the **existing SVG from `prototype/map.html#seatmap`**. It is not
redrawn from the 3D section hulls. `tools/export-svg-plan.py` preserves every path,
polygon and chair, attaching venue IDs using verified unique position matches.
The generator rejects missing, duplicate or mismatched chairs. Prices and sale
availability continue to come from VENUE, not the illustrative map categories.

After changing the source plan or venue data, run:

```sh
python3 tools/export-svg-plan.py
bash tools/stamp.sh
node --test tests/*.test.cjs
```

In 2D, “На схемата” locates selected seats instead of opening a blocked 3D viewer.
The original SVG's styles are scoped so they cannot affect other page icons.
WebGL-enabled browsers continue using MapLibre and the 3D seat view; they do not
download the SVG plan. This does not override browser security restrictions.
