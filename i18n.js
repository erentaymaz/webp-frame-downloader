/**
 * WebP Frame Downloader — arayüz dili (Türkçe / English)
 *
 * chrome.i18n dili yalnızca tarayıcı diline göre seçer ve arayüzden
 * değiştirilemez. Bu modül dili popup içinden anında değiştirmeyi sağlar.
 *
 * Kullanım:
 *   HTML  : <span data-i18n="key">, data-i18n-placeholder, data-i18n-title
 *   JS    : setText(el, 'key', { n: 3 })  — dil değişince otomatik yenilenir
 *           t('key', params)              — yalnızca metni döndürür
 *   Dil   : <button data-lang="tr">, <button data-lang="en"> (initI18n bağlar)
 *
 * Seçilen dil localStorage'da saklanır (ek izin gerekmez); popup ve
 * klasöre indirme penceresi aynı tercihi paylaşır.
 */

'use strict';

const LANG_STORAGE_KEY = 'wfd.lang';
const SUPPORTED_LANGS = ['tr', 'en'];

/* ------------------------------------------------------------------ */
/* Metinler                                                            */
/* ------------------------------------------------------------------ */

/** İngilizce tekil/çoğul: plural(1,'frame') -> "1 frame", plural(3,'frame') -> "3 frames" */
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** İndirmede hata sayısı eki: " · 3 başarısız" / " · 3 failed" */
const failSuffix = {
  tr: (n) => (n ? ` · ${n} başarısız` : ''),
  en: (n) => (n ? ` · ${n} failed` : '')
};

/**
 * Metin değeri ya bir dize ({param} yer tutucularıyla) ya da
 * params alıp dize döndüren bir fonksiyondur.
 */
const MESSAGES = {
  tr: {
    // Ortak
    appSubtitle: 'Sıralı animasyon karelerini toplu indir',
    languageLabel: 'Dil',
    sequenceTitle: 'Frame dizisi',
    downloadTitle: 'İndirme',
    cancel: 'İptal',
    downloading: 'İndiriliyor…',
    rangeSummary: ({ n, first, last }) => `${n} kare · ${first} → ${last}`,
    reloadExtension:
      'Eklentinin güncel ayarları yüklenmemiş. chrome://extensions sayfasında eklentiyi yenileyin (⟳) ve tekrar deneyin.',

    // Popup — tarama
    scanTitle: 'Sayfa taraması',
    rescan: 'Yeniden tara',
    deepScan: 'Derin tara',
    deepScanHint: 'Sayfayı yeniler, otomatik kaydırır ve tüm kareleri yakalar',
    scanning: 'Taranıyor…',
    cannotScan: 'Bu sayfa taranamıyor (tarayıcı sayfası veya erişim kısıtı). Aşağıya bir sayfa adresi yazabilirsiniz.',
    noWebp: ({ hint }) => `Sayfada .webp dosyası bulunamadı.${hint ? ' Kareler kaçmış olabilir — "Derin tara"yı deneyin.' : ''}`,
    noSequence: ({ n, hint }) =>
      `${n} .webp bulundu, ancak numaralı bir dizi yok.${hint ? ' Kareler kaçmış olabilir — "Derin tara"yı deneyin.' : ''}`,
    scanResult: ({ n, s, deep, hint }) =>
      `${deep ? 'Derin tarama: ' : ''}${n} .webp · ${s} dizi tespit edildi.${hint ? ' Kareler kaçmış olabilir — "Derin tara"yı deneyin.' : ''}`,
    sequenceOption: ({ pattern, n, host }) => `${pattern} (${n} kare) — ${host}`,

    // Popup — derin tarama
    deepStarting: 'Derin tarama: Başlatılıyor…',
    deepLoading: 'Derin tarama: Sayfa yükleniyor…',
    deepScrolling: 'Derin tarama: Sayfa kaydırılıyor, kareler yükleniyor…',
    deepCollecting: 'Derin tarama: Kaynaklar toplanıyor…',
    deepFailed: 'Derin tarama başarısız: {error}',
    deepNeedsPermission: 'Derin tarama için bu siteye erişim izni gerekli.',

    // Popup — URL ile analiz
    urlTitle: 'URL ile analiz',
    urlPlaceholder: 'Sayfa adresi veya …/frame_0202.webp',
    analyze: 'Analiz et',
    urlInvalid: 'Geçerli bir sayfa adresi (https://…) veya frame adresi (…/frame_0001.webp) girin.',

    // Popup — dizi ve aralık
    foundFromUrl: "URL'den çıkarıldı: {first}",
    foundOnPage: ({ n, first, last }) =>
      n === 1 ? `Sayfada 1 kare görüldü: ${first}` : `Sayfada ${n} kare görüldü: ${first} → ${last}`,
    detecting: '🔍 İlk ve son kare otomatik aranıyor…',
    detectUnreachable: 'Bu kareye erişilemedi; adresi kontrol edin.',
    detected: ({ first, last, n }) => `✓ Otomatik bulundu: ${first} → ${last} (${n} kare)`,
    start: 'Başlangıç',
    end: 'Bitiş',
    rangeNotInteger: 'Başlangıç ve bitiş 0 veya daha büyük tam sayı olmalı.',
    rangeOrder: 'Başlangıç, bitişten büyük olamaz.',
    rangeTooLarge: 'En fazla {max} kare indirilebilir.',

    // Popup — indirme
    pickFolder: 'Klasör seçip indir…',
    downloadToDownloads: "İndirilenler/{folder}'e indir",
    downloadBusy: 'Zaten devam eden bir indirme var.',
    downloadStartFailed: 'İndirme başlatılamadı.',
    progressRunning: ({ failed }) => `İndiriliyor…${failSuffix.tr(failed)}`,
    progressCancelled: ({ failed }) => `İptal edildi${failSuffix.tr(failed)}`,
    progressDone: ({ folder, failed }) => `Tamamlandı → İndirilenler/${folder}${failSuffix.tr(failed)}`,

    // Klasöre indirme penceresi
    saveDocTitle: 'Klasöre indir — WebP Frame Downloader',
    saveTitle: 'Klasöre indir',
    saveSubtitle: 'Kareler seçtiğiniz klasöre doğrudan kaydedilir',
    targetFolder: 'Hedef klasör',
    chooseFolder: 'Klasör seç…',
    noFolder: 'Henüz klasör seçilmedi.',
    startDownload: 'İndirmeyi başlat',
    folderPickFailed: 'Klasör seçilemedi: {error}',
    saveNeedsPermission: 'Kareleri klasöre yazabilmek için bu siteye erişim izni gerekli. Lütfen izin isteğini onaylayın.',
    saveInvalidParams: 'Geçersiz indirme bilgisi. Pencereyi kapatıp eklentiden tekrar deneyin.',
    saveNoPicker: 'Bu tarayıcı klasör seçmeyi desteklemiyor. Popup\'taki "İndirilenler\'e indir" seçeneğini kullanın.',
    saveDone: ({ folder, failed }) => `Tamamlandı → ${folder}${failSuffix.tr(failed)}`,
    failedFrames: ({ list, more }) => `İnmeyen kareler: ${list}${more ? ` ve ${more} tane daha` : ''}`
  },

  en: {
    // Common
    appSubtitle: 'Bulk download animation frames',
    languageLabel: 'Language',
    sequenceTitle: 'Frame sequence',
    downloadTitle: 'Download',
    cancel: 'Cancel',
    downloading: 'Downloading…',
    rangeSummary: ({ n, first, last }) => `${plural(n, 'frame')} · ${first} → ${last}`,
    reloadExtension:
      'The extension settings are out of date. Reload the extension (⟳) on chrome://extensions and try again.',

    // Popup — scan
    scanTitle: 'Page scan',
    rescan: 'Rescan',
    deepScan: 'Deep scan',
    deepScanHint: 'Reloads the page, scrolls it automatically and captures every frame',
    scanning: 'Scanning…',
    cannotScan: 'This page cannot be scanned (browser page or restricted). You can enter a page URL below.',
    noWebp: ({ hint }) => `No .webp files found on this page.${hint ? ' Frames may have been missed — try "Deep scan".' : ''}`,
    noSequence: ({ n, hint }) =>
      `Found ${plural(n, '.webp file')}, but no numbered sequence.${hint ? ' Frames may have been missed — try "Deep scan".' : ''}`,
    scanResult: ({ n, s, deep, hint }) =>
      `${deep ? 'Deep scan: ' : ''}${n} .webp · ${plural(s, 'sequence')} detected.${hint ? ' Frames may have been missed — try "Deep scan".' : ''}`,
    sequenceOption: ({ pattern, n, host }) => `${pattern} (${plural(n, 'frame')}) — ${host}`,

    // Popup — deep scan
    deepStarting: 'Deep scan: starting…',
    deepLoading: 'Deep scan: loading the page…',
    deepScrolling: 'Deep scan: scrolling the page, loading frames…',
    deepCollecting: 'Deep scan: collecting resources…',
    deepFailed: 'Deep scan failed: {error}',
    deepNeedsPermission: 'Deep scan needs access to this site.',

    // Popup — analyze URL
    urlTitle: 'Analyze URL',
    urlPlaceholder: 'Page URL or …/frame_0202.webp',
    analyze: 'Analyze',
    urlInvalid: 'Enter a valid page URL (https://…) or frame URL (…/frame_0001.webp).',

    // Popup — sequence and range
    foundFromUrl: 'From URL: {first}',
    foundOnPage: ({ n, first, last }) =>
      n === 1 ? `Seen 1 frame on the page: ${first}` : `Seen ${n} frames on the page: ${first} → ${last}`,
    detecting: '🔍 Looking for the first and last frame…',
    detectUnreachable: 'This frame could not be reached; check the URL.',
    detected: ({ first, last, n }) => `✓ Found automatically: ${first} → ${last} (${plural(n, 'frame')})`,
    start: 'Start',
    end: 'End',
    rangeNotInteger: 'Start and end must be whole numbers, 0 or greater.',
    rangeOrder: 'Start cannot be greater than end.',
    rangeTooLarge: 'At most {max} frames can be downloaded.',

    // Popup — download
    pickFolder: 'Choose folder and download…',
    downloadToDownloads: 'Download to Downloads/{folder}',
    downloadBusy: 'A download is already in progress.',
    downloadStartFailed: 'Could not start the download.',
    progressRunning: ({ failed }) => `Downloading…${failSuffix.en(failed)}`,
    progressCancelled: ({ failed }) => `Cancelled${failSuffix.en(failed)}`,
    progressDone: ({ folder, failed }) => `Done → Downloads/${folder}${failSuffix.en(failed)}`,

    // Save-to-folder window
    saveDocTitle: 'Save to folder — WebP Frame Downloader',
    saveTitle: 'Save to folder',
    saveSubtitle: 'Frames are saved straight into the folder you choose',
    targetFolder: 'Destination folder',
    chooseFolder: 'Choose folder…',
    noFolder: 'No folder chosen yet.',
    startDownload: 'Start download',
    folderPickFailed: 'Could not choose the folder: {error}',
    saveNeedsPermission: 'Saving frames to a folder needs access to this site. Please approve the permission request.',
    saveInvalidParams: 'Invalid download details. Close this window and try again from the extension.',
    saveNoPicker: 'This browser cannot choose folders. Use the "Download to Downloads" option in the popup.',
    saveDone: ({ folder, failed }) => `Done → ${folder}${failSuffix.en(failed)}`,
    failedFrames: ({ list, more }) => `Frames not downloaded: ${list}${more ? ` and ${more} more` : ''}`
  }
};

/* ------------------------------------------------------------------ */
/* Dil durumu                                                          */
/* ------------------------------------------------------------------ */

/** Kayıtlı tercih, yoksa tarayıcı dili (Türkçe değilse İngilizce). */
function detectLang() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (SUPPORTED_LANGS.includes(saved)) return saved;
  } catch (_) { /* depolama kapalı */ }
  return (navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

let currentLang = detectLang();

/** Dinamik metinler: dil değişince yeniden çevrilecek öğeler. */
const dynamicTexts = new Map();

/** Dil değişikliğini dinleyenler (örn. tarayıcının title'ı). */
const langListeners = [];

function getLang() {
  return currentLang;
}

/**
 * Anahtarın çevirisini döndürür. Eksik anahtarda İngilizceye, o da yoksa
 * anahtarın kendisine düşer.
 */
function t(key, params = {}) {
  const value = MESSAGES[currentLang][key] ?? MESSAGES.en[key] ?? key;
  if (typeof value === 'function') return value(params);
  return value.replace(/\{(\w+)\}/g, (_, name) => (params[name] ?? ''));
}

/**
 * Öğenin metnini çevirerek yazar ve dil değişince yeniden yazılması için kaydeder.
 * key boşsa metni temizler.
 */
function setText(el, key, params = {}) {
  if (!key) {
    dynamicTexts.delete(el);
    el.textContent = '';
    return;
  }
  dynamicTexts.set(el, { key, params });
  el.textContent = t(key, params);
}

/** Sayfadaki tüm sabit (data-i18n) ve dinamik metinleri geçerli dile çevirir. */
function applyI18n() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });

  for (const [el, { key, params }] of dynamicTexts) {
    if (el.isConnected) el.textContent = t(key, params);
    else dynamicTexts.delete(el);
  }

  document.querySelectorAll('[data-lang]').forEach((btn) => {
    const active = btn.dataset.lang === currentLang;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  langListeners.forEach((fn) => fn(currentLang));
}

/** Dili değiştirir, tercihi kaydeder ve ekranı günceller. */
function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang) || lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch (_) { /* depolama kapalı: yalnızca bu oturum için geçerli */ }
  applyI18n();
}

function onLangChange(fn) {
  langListeners.push(fn);
}

/** Dil düğmelerini bağlar ve ilk çeviriyi uygular. */
function initI18n() {
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });

  // Başka bir eklenti penceresinde dil değişirse bu sayfayı da güncelle.
  window.addEventListener('storage', (e) => {
    if (e.key === LANG_STORAGE_KEY && SUPPORTED_LANGS.includes(e.newValue) && e.newValue !== currentLang) {
      currentLang = e.newValue;
      applyI18n();
    }
  });

  applyI18n();
}
