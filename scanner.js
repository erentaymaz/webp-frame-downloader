/**
 * WebP Frame Downloader — sayfaya enjekte edilen fonksiyonlar
 *
 * Bu dosya hem popup'ta (<script>) hem background'da (importScripts) yüklenir.
 * Fonksiyonlar chrome.scripting.executeScript ile hedef sayfada çalıştırılır;
 * bu yüzden tamamen bağımsız olmalıdır, dışarıdaki hiçbir şeye erişemezler.
 */

'use strict';

/**
 * Sayfadaki tüm .webp kaynaklarını toplar.
 *
 * Kaynaklar:
 *   - Sayfanın kendi URL'si (doğrudan .webp açıldıysa)
 *   - Performance API: sayfanın yüklediği tüm kaynaklar (fetch/XHR/canvas dahil)
 *   - <img>, <source>, <video poster>, <link>, SVG <image>, lazy-load data-* öznitelikleri
 *   - Satır içi ve hesaplanmış CSS background-image değerleri
 *   - Satır içi <script> / JSON içinde geçen .webp adresleri
 *
 * @returns {{urls: string[], resourceCount: number}}
 *   resourceCount: Performance API'deki kaynak sayısı. Varsayılan arabellek
 *   250 kaynakla sınırlı olduğundan bu sayı 250'ye ulaştıysa bazı kaynaklar
 *   kaçırılmış olabilir (derin tarama önerilir).
 */
function collectWebpUrls() {
  const found = new Set();
  const isWebp = /\.webp(?:[?#]|$)/i;

  const add = (value) => {
    if (!value || typeof value !== 'string') return;
    try {
      const abs = new URL(value.trim(), document.baseURI).href;
      if (isWebp.test(abs)) found.add(abs);
    } catch (_) { /* geçersiz URL */ }
  };

  const addSrcset = (srcset) => {
    if (!srcset) return;
    srcset.split(',').forEach((part) => add(part.trim().split(/\s+/)[0]));
  };

  const addCssUrls = (css) => {
    if (!css || css === 'none') return;
    for (const m of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) add(m[2]);
  };

  // 1) Sayfanın kendisi
  add(location.href);

  // 2) Yüklenen tüm kaynaklar
  const resources = performance.getEntriesByType('resource');
  resources.forEach((e) => add(e.name));

  // 3) DOM öğeleri
  document.querySelectorAll('img, source, video, link, image, [data-src], [data-srcset]').forEach((el) => {
    add(el.currentSrc);
    add(el.getAttribute('src'));
    add(el.getAttribute('href'));
    add(el.getAttribute('xlink:href'));
    add(el.getAttribute('poster'));
    add(el.getAttribute('data-src'));
    addSrcset(el.getAttribute('srcset'));
    addSrcset(el.getAttribute('data-srcset'));
  });

  // 4) CSS arka planları
  document.querySelectorAll('*').forEach((el) => {
    addCssUrls(getComputedStyle(el).backgroundImage);
  });

  // 5) Satır içi script / JSON verisi (örn. Next.js __NEXT_DATA__)
  // JSON içinde "/" karakteri "\/" olarak kaçışlı olabilir.
  const urlInText = /https?:\\?\/\\?\/[^\s"'<>()]+?\.webp(?:\?[^\s"'<>()\\]*)?/gi;
  document.querySelectorAll('script:not([src])').forEach((s) => {
    for (const m of s.textContent.matchAll(urlInText)) add(m[0].replace(/\\\//g, '/'));
  });

  return { urls: [...found], resourceCount: resources.length };
}

/**
 * Sayfayı yavaşça en alta kadar kaydırır; kaydırmayla yüklenen (lazy-load,
 * scroll animasyonu) karelerin indirilmesini tetikler. Sonunda başa döner.
 *
 * @param {number} [maxMs=20000] En fazla kaydırma süresi
 * @returns {Promise<boolean>}
 */
async function autoScrollPage(maxMs = 20000) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const scroller = document.scrollingElement || document.documentElement;
  const startedAt = Date.now();
  let stuck = 0;

  while (Date.now() - startedAt < maxMs) {
    const before = scroller.scrollTop;
    window.scrollBy(0, Math.max(200, window.innerHeight * 0.7));
    await sleep(350);

    const atBottom = scroller.scrollTop + window.innerHeight >= scroller.scrollHeight - 2;
    // En altta veya kaydırma ilerlemiyorsa birkaç tur bekle (yeni içerik yüklenebilir)
    if (atBottom || scroller.scrollTop === before) {
      if (++stuck >= 3) break;
    } else {
      stuck = 0;
    }
  }

  window.scrollTo(0, 0);
  return true;
}
