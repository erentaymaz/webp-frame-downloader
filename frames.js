/**
 * WebP Frame Downloader — ortak frame dizisi yardımcıları
 *
 * popup.js ve save.js tarafından paylaşılır (klasik <script> ile yüklenir).
 */

'use strict';

/** Yanlışlıkla devasa aralık girilmesine karşı üst sınır. */
const MAX_FRAMES = 5000;

/** Dosya adı: <önek><rakamlar>.webp  (örn. frame_0001.webp) */
const FRAME_NAME_RE = /^(.*?)(\d+)(\.webp)$/i;

/**
 * @typedef {Object} FrameSequence
 * @property {string}   dir      URL'nin dosya adına kadar olan kısmı (sonu "/")
 * @property {string}   prefix   Sayıdan önceki dosya adı kısmı (örn. "frame_")
 * @property {string}   ext      Uzantı (".webp")
 * @property {string}   query    Varsa sorgu dizesi ("?v=1")
 * @property {number}   pad      Sıfırla doldurma genişliği (0 = doldurma yok)
 * @property {number[]} numbers  Sayfada bulunan kare numaraları (sıralı)
 * @property {'scan'|'url'} source
 */

/**
 * Bir URL'yi önek + numara + uzantı parçalarına ayırır.
 * @param {string} rawUrl
 * @returns {null | {dir: string, prefix: string, digits: string, number: number, ext: string, query: string}}
 */
function parseFrameUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch (_) {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const slash = url.pathname.lastIndexOf('/');
  const fileName = url.pathname.slice(slash + 1);
  const match = FRAME_NAME_RE.exec(fileName);
  if (!match) return null;

  const [, prefix, digits, ext] = match;
  return {
    dir: url.origin + url.pathname.slice(0, slash + 1),
    prefix,
    digits,
    number: parseInt(digits, 10),
    ext,
    query: url.search
  };
}

/** "0042" gibi başında sıfır olan sayı mı? (sıfır doldurma göstergesi) */
function isZeroPadded(digits) {
  return digits.length > 1 && digits[0] === '0';
}

/**
 * URL listesini aynı klasör + önek + uzantıya sahip dizilere gruplar.
 * "frame" içeren ve daha çok kare barındıran diziler önce gelir.
 * @param {string[]} urls
 * @returns {FrameSequence[]}
 */
function groupSequences(urls) {
  const groups = new Map();

  for (const raw of urls) {
    const p = parseFrameUrl(raw);
    if (!p) continue;

    const key = `${p.dir}|${p.prefix}|${p.ext.toLowerCase()}`;
    let g = groups.get(key);
    if (!g) {
      g = { dir: p.dir, prefix: p.prefix, ext: p.ext, query: p.query, pad: 0, numbers: new Set(), source: 'scan' };
      groups.set(key, g);
    }
    g.numbers.add(p.number);
    if (isZeroPadded(p.digits)) g.pad = Math.max(g.pad, p.digits.length);
  }

  const score = (g) => (/frame/i.test(g.prefix) ? 1e6 : 0) + g.numbers.size;

  return [...groups.values()]
    .map((g) => ({ ...g, numbers: [...g.numbers].sort((a, b) => a - b) }))
    .sort((a, b) => score(b) - score(a));
}

/**
 * Tek bir kare URL'sinden dizi oluşturur.
 * @param {string} rawUrl
 * @returns {FrameSequence | null}
 */
function sequenceFromUrl(rawUrl) {
  const p = parseFrameUrl(rawUrl);
  if (!p) return null;
  return {
    dir: p.dir,
    prefix: p.prefix,
    ext: p.ext,
    query: p.query,
    pad: isZeroPadded(p.digits) ? p.digits.length : 0,
    numbers: [p.number],
    source: 'url'
  };
}

/**
 * Varsayılan aralık: birden çok kare bulunduysa min–max;
 * tek kare varsa 1'den (ya da 0'dan) o kareye kadar.
 * Örn. frame_0202.webp -> 1..202
 */
function defaultRange(seq) {
  const first = seq.numbers[0];
  const last = seq.numbers[seq.numbers.length - 1];
  if (seq.numbers.length > 1) return { start: first, end: last };
  return { start: Math.min(1, first), end: first };
}

/** Kare numarasından dosya adı üretir: 7 -> "frame_0007.webp" */
function frameFileName(seq, n) {
  const num = seq.pad ? String(n).padStart(seq.pad, '0') : String(n);
  return `${seq.prefix}${num}${seq.ext}`;
}

/** Kare numarasından tam URL üretir. */
function frameUrl(seq, n) {
  return seq.dir + frameFileName(seq, n) + seq.query;
}

/** Dosya adını yerel dosya sistemi için güvenli hale getirir. */
function safeFileName(name) {
  let decoded = name;
  try { decoded = decodeURIComponent(name); } catch (_) { /* olduğu gibi kalsın */ }
  return decoded.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
}

/** Kullanıcıya gösterilecek kalıp: "frame_####.webp" */
function patternLabel(seq) {
  const hashes = '#'.repeat(seq.pad || 1);
  return `${seq.prefix}${hashes}${seq.ext}`;
}
