/**
 * WebP Frame Downloader — popup
 *
 * Bölümler:
 *   1. Sabitler
 *   2. Sayfa tarayıcı (sayfaya enjekte edilen fonksiyon)
 *   3. Dizi (sequence) çözümleme yardımcıları
 *   4. Arayüz durumu ve render
 *   5. Olay bağlama ve başlatma
 */

'use strict';

/* ================================================================== */
/* 1. Sabitler                                                         */
/* ================================================================== */

/** İndirilen dosyaların konacağı klasör (varsayılan İndirilenler altında). */
const DOWNLOAD_FOLDER = 'animation_frames';

/** Yanlışlıkla devasa aralık girilmesine karşı üst sınır. */
const MAX_FRAMES = 5000;

/** Dosya adı: <önek><rakamlar>.webp  (örn. frame_0001.webp) */
const FRAME_NAME_RE = /^(.*?)(\d+)(\.webp)$/i;

/* ================================================================== */
/* 2. Sayfa tarayıcı                                                   */
/* ================================================================== */

/**
 * Aktif sekmede çalışır (chrome.scripting.executeScript ile enjekte edilir).
 * Bu yüzden tamamen bağımsız olmalı; dışarıdaki hiçbir şeye erişemez.
 *
 * Kaynaklar:
 *   - Sayfanın kendi URL'si (doğrudan .webp açıldıysa)
 *   - Performance API: sayfanın yüklediği tüm kaynaklar (fetch/XHR/canvas dahil)
 *   - <img>, <source>, <video poster>, <link>, SVG <image>, lazy-load data-* öznitelikleri
 *   - Satır içi ve hesaplanmış CSS background-image değerleri
 *
 * @returns {string[]} Benzersiz, mutlak .webp URL'leri
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
  performance.getEntriesByType('resource').forEach((e) => add(e.name));

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

  return [...found];
}

/* ================================================================== */
/* 3. Dizi çözümleme                                                   */
/* ================================================================== */

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

/* ================================================================== */
/* 4. Arayüz durumu ve render                                          */
/* ================================================================== */

const $ = (id) => document.getElementById(id);

const ui = {
  rescanBtn: $('rescanBtn'),
  scanStatus: $('scanStatus'),
  sequenceSelect: $('sequenceSelect'),
  urlForm: $('urlForm'),
  urlInput: $('urlInput'),
  urlError: $('urlError'),
  sequenceCard: $('sequenceCard'),
  patternText: $('patternText'),
  foundText: $('foundText'),
  startInput: $('startInput'),
  endInput: $('endInput'),
  rangeInfo: $('rangeInfo'),
  downloadBtn: $('downloadBtn'),
  progressCard: $('progressCard'),
  progressText: $('progressText'),
  progressBar: $('progressBar'),
  progressInfo: $('progressInfo'),
  cancelBtn: $('cancelBtn')
};

const state = {
  /** @type {FrameSequence[]} */
  scanned: [],
  /** @type {FrameSequence | null} */
  current: null,
  downloading: false
};

/** Seçili diziyi ekrana basar ve aralık alanlarını doldurur. */
function showSequence(seq) {
  state.current = seq;
  ui.sequenceCard.hidden = !seq;
  if (!seq) return;

  const { start, end } = defaultRange(seq);
  ui.patternText.textContent = seq.dir + patternLabel(seq);
  ui.patternText.title = seq.dir + patternLabel(seq);

  const first = frameFileName(seq, seq.numbers[0]);
  const last = frameFileName(seq, seq.numbers[seq.numbers.length - 1]);
  ui.foundText.textContent = seq.source === 'url'
    ? `URL'den çıkarıldı: ${first}. Başlangıç tahmini ${start}; gerekirse değiştirin.`
    : seq.numbers.length > 1
      ? `Sayfada ${seq.numbers.length} kare bulundu: ${first} → ${last}`
      : `Sayfada 1 kare bulundu: ${first}`;

  ui.startInput.value = start;
  ui.endInput.value = end;
  updateRangeInfo();
}

/** Aralığı okur ve doğrular. */
function readRange() {
  const start = Number(ui.startInput.value);
  const end = Number(ui.endInput.value);
  if (ui.startInput.value === '' || ui.endInput.value === '' ||
      !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0) {
    return { error: 'Başlangıç ve bitiş 0 veya daha büyük tam sayı olmalı.' };
  }
  if (start > end) return { error: 'Başlangıç, bitişten büyük olamaz.' };
  const count = end - start + 1;
  if (count > MAX_FRAMES) return { error: `En fazla ${MAX_FRAMES} kare indirilebilir.` };
  return { start, end, count };
}

function updateRangeInfo() {
  const seq = state.current;
  if (!seq) return;
  const r = readRange();
  if (r.error) {
    ui.rangeInfo.textContent = r.error;
    ui.rangeInfo.classList.add('error');
  } else {
    ui.rangeInfo.textContent =
      `${r.count} kare · ${frameFileName(seq, r.start)} → ${frameFileName(seq, r.end)} · ${DOWNLOAD_FOLDER}/`;
    ui.rangeInfo.classList.remove('error');
  }
  ui.downloadBtn.disabled = Boolean(r.error) || state.downloading;
}

/** Arka plandan gelen ilerleme durumunu ekrana basar. */
function renderProgress(status) {
  if (!status || status.state === 'idle') {
    ui.progressCard.hidden = true;
    state.downloading = false;
    updateRangeInfo();
    return;
  }

  const { total, done, failed } = status;
  const running = status.state === 'running';
  state.downloading = running;

  ui.progressCard.hidden = false;
  ui.progressText.textContent = `${done} / ${total}`;
  ui.progressBar.style.width = total ? `${(done / total) * 100}%` : '0%';
  ui.progressBar.classList.toggle('is-done', status.state === 'done' && failed === 0);
  ui.cancelBtn.hidden = !running;

  const failText = failed ? ` · ${failed} başarısız` : '';
  ui.progressInfo.textContent =
    running ? `İndiriliyor…${failText}`
    : status.state === 'cancelled' ? `İptal edildi${failText}`
    : `Tamamlandı → İndirilenler/${DOWNLOAD_FOLDER}${failText}`;

  ui.downloadBtn.textContent = running ? 'İndiriliyor…' : 'Tümünü İndir';
  updateRangeInfo();
}

/* ------------------------------------------------------------------ */
/* Eylemler                                                            */
/* ------------------------------------------------------------------ */

/** Aktif sekmeyi tarar ve bulunan dizileri listeler. */
async function scanPage() {
  ui.scanStatus.textContent = 'Taranıyor…';
  ui.sequenceSelect.hidden = true;

  let urls = [];
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: collectWebpUrls
    });
    urls = injection?.result || [];
  } catch (err) {
    ui.scanStatus.textContent = 'Bu sayfa taranamıyor (tarayıcı sayfası veya erişim kısıtı). URL yapıştırarak devam edebilirsiniz.';
    return;
  }

  state.scanned = groupSequences(urls);

  if (!urls.length) {
    ui.scanStatus.textContent = 'Sayfada .webp dosyası bulunamadı.';
    return;
  }
  if (!state.scanned.length) {
    ui.scanStatus.textContent = `${urls.length} .webp bulundu, ancak numaralı bir dizi tespit edilemedi.`;
    return;
  }

  ui.scanStatus.textContent =
    `${urls.length} .webp bulundu · ${state.scanned.length} dizi tespit edildi.`;

  // Birden fazla dizi varsa seçim kutusunu göster
  if (state.scanned.length > 1) {
    ui.sequenceSelect.replaceChildren(
      ...state.scanned.map((seq, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = `${patternLabel(seq)} (${seq.numbers.length} kare) — ${new URL(seq.dir).hostname}`;
        return opt;
      })
    );
    ui.sequenceSelect.hidden = false;
  }

  // Kullanıcı elle URL girmediyse en olası diziyi seç
  if (!state.current || state.current.source === 'scan') {
    showSequence(state.scanned[0]);
  }
}

/** Yapıştırılan URL'den dizi çıkarır. */
function analyzeUrl(event) {
  event.preventDefault();
  const seq = sequenceFromUrl(ui.urlInput.value);
  if (!seq) {
    ui.urlError.textContent = 'URL "…/isim_0123.webp" biçiminde, sonu numara + .webp ile bitmeli.';
    ui.urlError.hidden = false;
    return;
  }
  ui.urlError.hidden = true;
  showSequence(seq);
}

/** Aralıktaki tüm kareleri background'a indirme işi olarak gönderir. */
async function startDownload() {
  const seq = state.current;
  const range = readRange();
  if (!seq || range.error) return;

  const items = [];
  for (let n = range.start; n <= range.end; n++) {
    items.push({
      url: frameUrl(seq, n),
      filename: `${DOWNLOAD_FOLDER}/${safeFileName(frameFileName(seq, n))}`
    });
  }

  ui.downloadBtn.disabled = true;
  const res = await chrome.runtime.sendMessage({ type: 'START_DOWNLOAD', items });
  if (!res?.ok) {
    ui.rangeInfo.textContent = res?.error || 'İndirme başlatılamadı.';
    ui.rangeInfo.classList.add('error');
  }
  renderProgress(res?.status);
}

async function cancelDownload() {
  const res = await chrome.runtime.sendMessage({ type: 'CANCEL_DOWNLOAD' });
  renderProgress(res?.status);
}

/* ================================================================== */
/* 5. Olay bağlama ve başlatma                                         */
/* ================================================================== */

ui.rescanBtn.addEventListener('click', scanPage);
ui.urlForm.addEventListener('submit', analyzeUrl);
ui.sequenceSelect.addEventListener('change', () => {
  showSequence(state.scanned[Number(ui.sequenceSelect.value)]);
});
ui.startInput.addEventListener('input', updateRangeInfo);
ui.endInput.addEventListener('input', updateRangeInfo);
ui.downloadBtn.addEventListener('click', startDownload);
ui.cancelBtn.addEventListener('click', cancelDownload);

// Background'dan canlı ilerleme bildirimleri
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'PROGRESS') renderProgress(msg.status);
});

(async function init() {
  // Popup yeniden açıldığında devam eden indirmeyi göster
  const res = await chrome.runtime.sendMessage({ type: 'GET_STATUS' }).catch(() => null);
  renderProgress(res?.status);
  await scanPage();
})();
