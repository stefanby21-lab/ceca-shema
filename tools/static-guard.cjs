'use strict';
/* Кои пътища може да сервира локалният сървър на tools/render-previews.cjs: само файловете,
   които сайтът наистина качва (както .vercelignore). Чиста функция, без достъп до диска:
   връща относителен път по POSIX или null. Никога не връща точкови файлове (.env, .git),
   нищо извън корена, нито частните данни на друга зала. */
const path = require('node:path');

// Файловете в корена, които сайтът качва.
const ROOT_FILES = new Set([
  'index.html', 'startup.js', 'app.js', 'ui.js', 'sheet.js', 'map.js', 'map-svg.js', 'seatfinder.js',
  'party-memory.js', 'arena-geometry.js', 'arena-seatview.js', 'seatview3d.js', 'ceca-plan-svg.js',
  'venue-data-ceca.js', 'styles.css', 'kupibileti-logo.svg',
]);
// Папките, които сайтът качва изцяло.
const PUBLIC_DIRS = ['assets', 'vendor', 'font', 'fonts', 'checkout'];

function publicRelative(urlPath) {
  if (typeof urlPath !== 'string') return null;
  let decoded;
  try { decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]); } catch (_) { return null; }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  if (decoded.endsWith('/')) decoded += 'index.html';
  const rel = path.posix.normalize(decoded).replace(/^\/+/, '');
  if (!rel || rel === '.' || rel.startsWith('..')) return null;
  const parts = rel.split('/');
  // Точкови файлове и папки (.env, .git, .vercel) и излизане нагоре не се сервират никога.
  if (parts.some((part) => part === '..' || part.startsWith('.'))) return null;
  if (parts.length === 1) return ROOT_FILES.has(rel) ? rel : null;
  return PUBLIC_DIRS.includes(parts[0]) ? rel : null;
}

module.exports = { publicRelative, ROOT_FILES, PUBLIC_DIRS };
