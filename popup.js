/**
 * WebP Frame Downloader — popup
 *
 * Bölümler:
 *   1. Sabitler ve durum
 *   2. Render
 *   3. Tarama (hızlı + derin)
 *   4. Dizi seçimi ve otomatik aralık tespiti
 *   5. İndirme
 *   6. Olay bağlama ve başlatma
 *
 * Bağımlılıklar:
 *   i18n.js    — arayüz metinleri (t, setText), dil seçici
 *   frames.js  — dizi çözümleme, aralık tespiti, site izni
 *   scanner.js — sayfaya enjekte edilen collectWebpUrls
 *
 * Ekrandaki metinler setText ile yazılır; böylece dil değiştirildiğinde
 * o anki durum korunarak yeniden çevrilir.
 */

'use strict';

/* ================================================================== */
/* 1. Sabitler ve durum                                                */
/* ================================================================== */

/** İndirilen dosyaların konacağı klasör (İndirilenler altında). */
const DOWNLOAD_FOLDER = 'animation_frames';

/** Tarayıcının varsayılan kaynak kaydı sınırı; dolduysa kaynak kaçmış olabilir. */
const RESOURCE_BUFFER_LIMIT = 250;

/** Background'dan gelen derin tarama aşaması -> metin anahtarı */
const DEEP_PHASE_KEYS = {
  starting: 'deepStarting',
  loading: 'deepLoading',
  scrolling: 'deepScrolling',
  collecting: 'deepCollecting'
};

const $ = (id) => document.getElementById(id);

const ui = {
  rescanBtn: $('rescanBtn'),
  deepScanBtn: $('deepScanBtn'),
  scanStatus: $('scanStatus'),
  sequenceSelect: $('sequenceSelect'),
  urlForm: $('urlForm'),
  urlInput: $('urlInput'),
  urlError: $('urlError'),
  sequenceCard: $('sequenceCard'),
  patternText: $('patternText'),
  foundText: $('foundText'),
  detectText: $('detectText'),
  startInput: $('startInput'),
  endInput: $('endInput'),
  rangeInfo: $('rangeInfo'),
  pickFolderBtn: $('pickFolderBtn'),
  downloadBtn: $('downloadBtn'),
  progressCard: $('progressCard'),
  progressText: $('progressText'),
  progressBar: $('progressBar'),
  progressInfo: $('progressInfo'),
  cancelBtn: $('cancelBtn')
};

const state = {
  /** Aktif sekme */
  tabId: null,
  tabUrl: '',
  /** Hızlı taramada bulunan URL'ler (derin tarama sonucuyla birleştirilir) */
  quickUrls: [],
  /** @type {FrameSequence[]} */
  scanned: [],
  /** @type {FrameSequence | null} */
  current: null,
  /** Kullanıcı aralığı elle değiştirdiyse otomatik tespit üzerine yazmaz */
  rangeEdited: false,
  /** Her yeni otomatik tespitte artar; eski tespitleri iptal eder */
  detectToken: 0,
  downloading: false,
  deepScanning: false
};

/* ================================================================== */
/* 2. Render                                                           */
/* ================================================================== */

/** Seçili diziyi ekrana basar, varsayılan aralığı doldurur ve tespiti başlatır. */
function showSequence(seq) {
  state.current = seq;
  state.rangeEdited = false;
  ui.sequenceCard.hidden = !seq;
  if (!seq) return;

  const { start, end } = defaultRange(seq);
  ui.patternText.textContent = seq.dir + patternLabel(seq);
  ui.patternText.title = seq.dir + patternLabel(seq);

  const first = frameFileName(seq, seq.numbers[0]);
  const last = frameFileName(seq, seq.numbers[seq.numbers.length - 1]);
  if (seq.source === 'url') setText(ui.foundText, 'foundFromUrl', { first });
  else setText(ui.foundText, 'foundOnPage', { n: seq.numbers.length, first, last });

  ui.startInput.value = start;
  ui.endInput.value = end;
  updateRangeInfo();
  detectRange(seq);
}

/**
 * Aralığı okur ve doğrular.
 * @returns {{start: number, end: number, count: number} | {errorKey: string, params?: object}}
 */
function readRange() {
  const start = Number(ui.startInput.value);
  const end = Number(ui.endInput.value);
  if (ui.startInput.value === '' || ui.endInput.value === '' ||
      !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0) {
    return { errorKey: 'rangeNotInteger' };
  }
  if (start > end) return { errorKey: 'rangeOrder' };
  const count = end - start + 1;
  if (count > MAX_FRAMES) return { errorKey: 'rangeTooLarge', params: { max: MAX_FRAMES } };
  return { start, end, count };
}

function updateRangeInfo() {
  const seq = state.current;
  if (!seq) return;
  const r = readRange();
  if (r.errorKey) {
    setText(ui.rangeInfo, r.errorKey, r.params);
    ui.rangeInfo.classList.add('error');
  } else {
    setText(ui.rangeInfo, 'rangeSummary', {
      n: r.count,
      first: frameFileName(seq, r.start),
      last: frameFileName(seq, r.end)
    });
    ui.rangeInfo.classList.remove('error');
  }
  ui.pickFolderBtn.disabled = Boolean(r.errorKey);
  ui.downloadBtn.disabled = Boolean(r.errorKey) || state.downloading;
}

/** Otomatik aralık tespiti satırı. key boşsa satır gizlenir. */
function setDetectText(key, params = {}, isError = false) {
  setText(ui.detectText, key, params);
  ui.detectText.hidden = !key;
  ui.detectText.classList.toggle('error', isError);
}

/** Arka plandan gelen indirme ilerlemesini ekrana basar. */
function renderProgress(status) {
  const running = status?.state === 'running';
  state.downloading = running;
  setText(ui.downloadBtn, running ? 'downloading' : 'downloadToDownloads', { folder: DOWNLOAD_FOLDER });

  if (!status || status.state === 'idle') {
    ui.progressCard.hidden = true;
    updateRangeInfo();
    return;
  }

  const { total, done, failed } = status;
  ui.progressCard.hidden = false;
  ui.progressText.textContent = `${done} / ${total}`;
  ui.progressBar.style.width = total ? `${(done / total) * 100}%` : '0%';
  ui.progressBar.classList.toggle('is-done', status.state === 'done' && failed === 0);
  ui.cancelBtn.hidden = !running;

  const infoKey =
    running ? 'progressRunning'
    : status.state === 'cancelled' ? 'progressCancelled'
    : 'progressDone';
  setText(ui.progressInfo, infoKey, { failed, folder: DOWNLOAD_FOLDER });

  updateRangeInfo();
}

/** Derin tarama durumunu ekrana basar; bittiyse sonuçları uygular. */
function renderDeepScan(scan) {
  if (!scan) return;
  state.deepScanning = !['done', 'error'].includes(scan.phase);
  ui.deepScanBtn.disabled = state.deepScanning || !state.tabUrl;
  ui.rescanBtn.disabled = state.deepScanning;

  if (state.deepScanning) {
    setText(ui.scanStatus, DEEP_PHASE_KEYS[scan.phase] || 'deepStarting');
  } else if (scan.phase === 'error') {
    setText(ui.scanStatus, 'deepFailed', { error: scan.error || '' });
  } else {
    applyUrls([...state.quickUrls, ...(scan.urls || [])], { deep: true });
  }
}

/* ================================================================== */
/* 3. Tarama                                                           */
/* ================================================================== */

/**
 * Bulunan URL'leri dizilere ayırır ve listeler.
 * @param {string[]} urls
 * @param {{deep?: boolean, resourceCount?: number}} [info]
 */
function applyUrls(urls, info = {}) {
  const unique = [...new Set(urls)];
  state.scanned = groupSequences(unique);
  ui.sequenceSelect.hidden = true;

  const bufferFull = !info.deep && info.resourceCount >= RESOURCE_BUFFER_LIMIT;
  const hint = bufferFull || !state.scanned.length;

  if (!unique.length) {
    setText(ui.scanStatus, 'noWebp', { hint });
    return;
  }
  if (!state.scanned.length) {
    setText(ui.scanStatus, 'noSequence', { n: unique.length, hint });
    return;
  }

  setText(ui.scanStatus, 'scanResult', {
    n: unique.length,
    s: state.scanned.length,
    deep: Boolean(info.deep),
    hint
  });

  // Birden fazla dizi varsa seçim kutusunu göster
  if (state.scanned.length > 1) {
    ui.sequenceSelect.replaceChildren(
      ...state.scanned.map((seq, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        setText(opt, 'sequenceOption', {
          pattern: patternLabel(seq),
          n: seq.numbers.length,
          host: new URL(seq.dir).hostname
        });
        return opt;
      })
    );
    ui.sequenceSelect.hidden = false;
  }

  // Kullanıcı elle frame URL'si girmediyse en olası diziyi seç
  if (!state.current || state.current.source === 'scan') {
    showSequence(state.scanned[0]);
  }
}

/** Aktif sekmeyi hızlıca tarar (yenilemeden). */
async function quickScan() {
  setText(ui.scanStatus, 'scanning');
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: state.tabId },
      func: collectWebpUrls
    });
    const result = injection?.result || { urls: [], resourceCount: 0 };
    state.quickUrls = result.urls;
    applyUrls(result.urls, { resourceCount: result.resourceCount });
  } catch (_) {
    setText(ui.scanStatus, 'cannotScan');
  }
}

/**
 * Derin taramayı başlatır: site izni alınır, background sayfayı
 * yeniler/açar, otomatik kaydırır ve tüm kaynakları toplar.
 * @param {string} pageUrl
 * @param {boolean} navigate  Sekmeyi bu adrese götür (false: yenile)
 */
async function startDeepScan(pageUrl, navigate) {
  const permission = await requestSitePermission(pageUrl);
  if (permission !== 'granted') {
    setText(ui.scanStatus, permission === 'unavailable' ? 'reloadExtension' : 'deepNeedsPermission');
    return;
  }

  renderDeepScan({ phase: 'starting' });
  state.current = null;
  ui.sequenceCard.hidden = true;
  if (navigate) state.quickUrls = [];

  await chrome.runtime.sendMessage({
    type: 'DEEP_SCAN',
    tabId: state.tabId,
    pageUrl,
    navigate
  });
}

/* ================================================================== */
/* 4. Dizi seçimi ve otomatik aralık tespiti                           */
/* ================================================================== */

/**
 * Seçili dizinin gerçek ilk ve son karesini sunucuyu yoklayarak bulur
 * ve aralık alanlarını günceller (kullanıcı elle değiştirmediyse).
 */
async function detectRange(seq) {
  const token = ++state.detectToken;
  const isCancelled = () => token !== state.detectToken || state.current !== seq;

  const knownFirst = seq.numbers[0];
  const knownLast = seq.numbers[seq.numbers.length - 1];

  setDetectText('detecting');

  // URL'den gelen kare gerçekten erişilebilir mi?
  if (seq.source === 'url' && !(await frameExists(seq, knownLast))) {
    if (!isCancelled()) setDetectText('detectUnreachable', {}, true);
    return;
  }

  const [first, last] = await Promise.all([
    findFirstFrame(seq, knownFirst, isCancelled),
    findLastFrame(seq, knownLast, isCancelled)
  ]);
  if (isCancelled() || first === null || last === null) return;

  setDetectText('detected', {
    first: frameFileName(seq, first),
    last: frameFileName(seq, last),
    n: last - first + 1
  });
  if (!state.rangeEdited) {
    ui.startInput.value = first;
    ui.endInput.value = last;
    updateRangeInfo();
  }
}

/**
 * URL alanı: frame adresi girildiyse diziyi çıkarır;
 * sayfa adresi girildiyse o sayfayı açıp derin tarar.
 */
async function analyzeUrl(event) {
  event.preventDefault();
  ui.urlError.hidden = true;
  const value = ui.urlInput.value.trim();

  const seq = sequenceFromUrl(value);
  if (seq) {
    showSequence(seq);
    return;
  }

  let pageUrl;
  try {
    pageUrl = new URL(value);
  } catch (_) { /* aşağıda hata gösterilir */ }
  if (!pageUrl || !/^https?:$/.test(pageUrl.protocol) || state.tabId === null) {
    setText(ui.urlError, 'urlInvalid');
    ui.urlError.hidden = false;
    return;
  }

  await startDeepScan(pageUrl.href, true);
}

/* ================================================================== */
/* 5. İndirme                                                          */
/* ================================================================== */

/** Aralıktaki tüm kareleri background'a indirme işi olarak gönderir. */
async function startDownload() {
  const seq = state.current;
  const range = readRange();
  if (!seq || range.errorKey) return;

  const items = [];
  for (let n = range.start; n <= range.end; n++) {
    items.push({
      url: frameUrl(seq, n),
      filename: `${DOWNLOAD_FOLDER}/${safeFileName(frameFileName(seq, n))}`
    });
  }

  ui.downloadBtn.disabled = true;
  const res = await chrome.runtime.sendMessage({ type: 'START_DOWNLOAD', items });
  renderProgress(res?.status);
  if (!res?.ok) {
    setText(ui.rangeInfo, res?.errorCode === 'busy' ? 'downloadBusy' : 'downloadStartFailed');
    ui.rangeInfo.classList.add('error');
  }
  // Popup en fazla 600px; ilerleme kartı aşağıda kalırsa görünür hale getir.
  ui.progressCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Klasör seçerek indirme penceresini açar.
 * Klasör seçici popup içinde açılırsa popup kapanır ve işlem yarım kalır;
 * bu yüzden seçim ve indirme ayrı bir eklenti penceresinde (save.html) yapılır.
 */
async function openSaveWindow() {
  const seq = state.current;
  const range = readRange();
  if (!seq || range.errorKey) return;

  const { dir, prefix, ext, query, pad } = seq;
  const params = new URLSearchParams({
    seq: JSON.stringify({ dir, prefix, ext, query, pad }),
    start: String(range.start),
    end: String(range.end)
  });

  await chrome.windows.create({
    url: chrome.runtime.getURL(`save.html?${params}`),
    type: 'popup',
    width: 440,
    height: 520,
    focused: true
  });
  window.close();
}

async function cancelDownload() {
  const res = await chrome.runtime.sendMessage({ type: 'CANCEL_DOWNLOAD' });
  renderProgress(res?.status);
}

/* ================================================================== */
/* 6. Olay bağlama ve başlatma                                         */
/* ================================================================== */

initI18n();

ui.rescanBtn.addEventListener('click', quickScan);
ui.deepScanBtn.addEventListener('click', () => startDeepScan(state.tabUrl, false));
ui.urlForm.addEventListener('submit', analyzeUrl);
ui.sequenceSelect.addEventListener('change', () => {
  showSequence(state.scanned[Number(ui.sequenceSelect.value)]);
});
for (const input of [ui.startInput, ui.endInput]) {
  input.addEventListener('input', () => {
    state.rangeEdited = true;
    updateRangeInfo();
  });
}
ui.pickFolderBtn.addEventListener('click', openSaveWindow);
ui.downloadBtn.addEventListener('click', startDownload);
ui.cancelBtn.addEventListener('click', cancelDownload);

// Background'dan canlı bildirimler
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'PROGRESS') renderProgress(msg.status);
  if (msg?.type === 'DEEP_SCAN_UPDATE' && msg.tabId === state.tabId) renderDeepScan(msg.scan);
});

(async function init() {
  setText(ui.scanStatus, 'scanning');
  renderProgress(null); // indirme butonunun metnini hemen yaz

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tabId = tab?.id ?? null;
  state.tabUrl = /^https?:/.test(tab?.url || '') ? tab.url : '';
  ui.deepScanBtn.disabled = !state.tabUrl;

  // Popup yeniden açıldığında devam eden indirmeyi göster
  const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' }).catch(() => null);
  renderProgress(status?.status);

  if (state.tabId === null) return;

  // Bu sekmede derin tarama sürüyor ya da bitmişse onu göster
  const deep = await chrome.runtime
    .sendMessage({ type: 'GET_DEEP_SCAN', tabId: state.tabId })
    .catch(() => null);

  if (deep?.scan && !['done', 'error'].includes(deep.scan.phase)) {
    renderDeepScan(deep.scan);
    return;
  }

  await quickScan();

  // Yalnızca aynı siteye ait bitmiş derin tarama sonucunu kullan
  const sameSite = deep?.scan?.pageUrl && state.tabUrl &&
    new URL(deep.scan.pageUrl).origin === new URL(state.tabUrl).origin;
  if (deep?.scan?.phase === 'done' && sameSite) renderDeepScan(deep.scan);
})();
