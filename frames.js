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

/* ------------------------------------------------------------------ */
/* Otomatik aralık tespiti                                             */
/* ------------------------------------------------------------------ */

/**
 * Kare sunucuda var mı? <img> ile yüklemeyi dener.
 * Görsel yüklemesi CORS'a tabi olmadığı için ek izin gerektirmez.
 * @returns {Promise<boolean>}
 */
function frameExists(seq, n, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => finish(false), timeoutMs);
    function finish(ok) {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(ok);
    }
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = frameUrl(seq, n);
  });
}

/**
 * Var olduğu bilinen bir kareden ileriye doğru son kareyi bulur.
 * Önce adımları ikiye katlayarak ilerler (1, 2, 4, 8…), eksik kareye
 * rastlayınca ikili arama yapar. Karelerin kesintisiz olduğu varsayılır.
 * Örn. 202 kare için ~16 deneme yeterlidir.
 *
 * @param {FrameSequence} seq
 * @param {number} known      Var olduğu bilinen kare
 * @param {() => boolean} isCancelled
 * @returns {Promise<number | null>}  Son kare; iptal edildiyse null
 */
async function findLastFrame(seq, known, isCancelled) {
  let lo = known;   // var
  let hi = null;    // yok
  let step = 1;

  while (hi === null) {
    if (isCancelled()) return null;
    const probe = lo + step;
    if (probe - known > MAX_FRAMES) return lo; // güvenlik sınırı
    if (await frameExists(seq, probe)) {
      lo = probe;
      step *= 2;
    } else {
      hi = probe;
    }
  }

  while (hi - lo > 1) {
    if (isCancelled()) return null;
    const mid = Math.floor((lo + hi) / 2);
    if (await frameExists(seq, mid)) lo = mid; else hi = mid;
  }
  return lo;
}

/**
 * Var olduğu bilinen bir kareden geriye doğru ilk kareyi bulur (0'a kadar).
 * @returns {Promise<number | null>}  İlk kare; iptal edildiyse null
 */
async function findFirstFrame(seq, known, isCancelled) {
  if (known === 0) return 0;
  if (await frameExists(seq, 0)) return 0;
  if (isCancelled()) return null;

  let lo = 0;      // yok
  let hi = known;  // var
  while (hi - lo > 1) {
    if (isCancelled()) return null;
    const mid = Math.floor((lo + hi) / 2);
    if (await frameExists(seq, mid)) hi = mid; else lo = mid;
  }
  return hi;
}

/* ------------------------------------------------------------------ */
/* Site izni                                                           */
/* ------------------------------------------------------------------ */

/**
 * Verilen adresin sitesi için (optional_host_permissions) erişim izni ister.
 * Kullanıcı tıklamasının hemen ardından çağrılmalıdır.
 *
 * @param {string} url  İzin istenecek sitedeki herhangi bir adres
 * @returns {Promise<'granted' | 'denied' | 'unavailable'>}
 *   'unavailable': yüklü manifest'te optional_host_permissions yok
 *   (genellikle manifest değişti ama eklenti yeniden yüklenmedi).
 */
async function requestSitePermission(url) {
  const declared = chrome.runtime.getManifest().optional_host_permissions;
  if (!declared || !declared.length) return 'unavailable';

  const origins = [`${new URL(url).origin}/*`];
  try {
    if (await chrome.permissions.contains({ origins })) return 'granted';
    return (await chrome.permissions.request({ origins })) ? 'granted' : 'denied';
  } catch (err) {
    console.warn('Site izni istenemedi:', err);
    return 'unavailable';
  }
}

/** requestSitePermission 'unavailable' döndüğünde gösterilecek mesaj. */
const RELOAD_EXTENSION_HINT =
  'Eklentinin güncel ayarları yüklenmemiş. chrome://extensions sayfasında eklentiyi yenileyin (⟳) ve tekrar deneyin.';
