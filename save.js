/**
 * WebP Frame Downloader — klasöre indirme penceresi
 *
 * chrome.downloads yalnızca İndirilenler klasörüne yazabildiği için
 * bu sayfa File System Access API ile kullanıcının seçtiği klasöre yazar:
 *   1. Kullanıcı klasör seçer (showDirectoryPicker)
 *   2. "İndirmeyi başlat" ile CDN için tek seferlik erişim izni istenir
 *   3. Kareler fetch ile çekilip klasöre dosya olarak yazılır
 *
 * Popup'tan URL parametreleriyle açılır:
 *   save.html?seq=<JSON {dir,prefix,ext,query,pad}>&start=1&end=202
 */

'use strict';

/** Aynı anda en fazla kaç kare çekilecek. */
const MAX_PARALLEL = 4;

/** Başarısız karelerden kaç tanesinin adı listelenecek. */
const MAX_FAILED_SHOWN = 5;

const $ = (id) => document.getElementById(id);

const ui = {
  patternText: $('patternText'),
  rangeText: $('rangeText'),
  pickBtn: $('pickBtn'),
  folderText: $('folderText'),
  startBtn: $('startBtn'),
  errorText: $('errorText'),
  progressCard: $('progressCard'),
  progressText: $('progressText'),
  progressBar: $('progressBar'),
  progressInfo: $('progressInfo'),
  cancelBtn: $('cancelBtn'),
  failedText: $('failedText')
};

const state = {
  /** @type {FrameSequence | null} */
  seq: null,
  start: 0,
  end: 0,
  /** @type {FileSystemDirectoryHandle | null} */
  dirHandle: null,
  /** @type {AbortController | null} */
  abort: null,
  /** fetch çerez modu: host izni varsa 'include', yoksa 'omit' */
  credentials: 'omit',
  running: false
};

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

function showError(message) {
  ui.errorText.textContent = message;
  ui.errorText.hidden = !message;
}

/** URL parametrelerinden diziyi ve aralığı okur. */
function readParams() {
  const params = new URLSearchParams(location.search);
  try {
    const seq = JSON.parse(params.get('seq'));
    const start = Number(params.get('start'));
    const end = Number(params.get('end'));
    const valid =
      seq && typeof seq.dir === 'string' && /^https?:\/\//.test(seq.dir) &&
      Number.isInteger(start) && Number.isInteger(end) &&
      start >= 0 && start <= end && end - start + 1 <= MAX_FRAMES;
    return valid ? { seq, start, end } : null;
  } catch (_) {
    return null;
  }
}

/**
 * İzin olmadan da indirilebilir mi? Sunucu CORS'a izin veriyorsa
 * (Access-Control-Allow-Origin) fetch izin gerektirmeden çalışır.
 * İlk kareyle denenir; herhangi bir HTTP yanıtı gelmesi yeterli.
 */
async function canFetchWithoutPermission() {
  try {
    await fetch(frameUrl(state.seq, state.start), { credentials: 'omit', cache: 'no-store' });
    return true;
  } catch (_) {
    return false; // CORS engeli (TypeError)
  }
}

/** Tek bir kareyi indirip klasöre yazar. Başarılıysa true döner. */
async function saveFrame(n, signal) {
  const url = frameUrl(state.seq, n);
  const name = safeFileName(frameFileName(state.seq, n));

  const res = await fetch(url, { signal, credentials: state.credentials });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();

  const fileHandle = await state.dirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

function renderSummary() {
  const { seq, start, end } = state;
  ui.patternText.textContent = seq.dir + patternLabel(seq);
  ui.rangeText.textContent =
    `${end - start + 1} kare · ${frameFileName(seq, start)} → ${frameFileName(seq, end)}`;
}

function renderProgress({ done, total, failed, phase }) {
  ui.progressCard.hidden = false;
  ui.progressText.textContent = `${done} / ${total}`;
  ui.progressBar.style.width = total ? `${(done / total) * 100}%` : '0%';
  ui.progressBar.classList.toggle('is-done', phase === 'done' && failed.length === 0);
  ui.cancelBtn.hidden = phase !== 'running';

  const failText = failed.length ? ` · ${failed.length} başarısız` : '';
  const folder = state.dirHandle?.name ?? '';
  ui.progressInfo.textContent =
    phase === 'running' ? `İndiriliyor…${failText}`
    : phase === 'cancelled' ? `İptal edildi${failText}`
    : `Tamamlandı → ${folder}${failText}`;

  if (failed.length) {
    const shown = failed.slice(0, MAX_FAILED_SHOWN).join(', ');
    const more = failed.length > MAX_FAILED_SHOWN ? ` ve ${failed.length - MAX_FAILED_SHOWN} tane daha` : '';
    ui.failedText.textContent = `İnmeyen kareler: ${shown}${more}`;
    ui.failedText.hidden = false;
  } else {
    ui.failedText.hidden = true;
  }
}

function setRunning(running) {
  state.running = running;
  ui.pickBtn.disabled = running;
  ui.startBtn.disabled = running || !state.dirHandle;
  ui.startBtn.textContent = running ? 'İndiriliyor…' : 'İndirmeyi başlat';
}

/* ------------------------------------------------------------------ */
/* Eylemler                                                            */
/* ------------------------------------------------------------------ */

async function pickFolder() {
  showError('');
  try {
    state.dirHandle = await window.showDirectoryPicker({
      id: 'webp-frames',   // tarayıcı son seçilen konumu hatırlar
      mode: 'readwrite'
    });
  } catch (err) {
    if (err.name !== 'AbortError') showError(`Klasör seçilemedi: ${err.message}`);
    return;
  }
  ui.folderText.textContent = `📁 ${state.dirHandle.name}`;
  ui.folderText.classList.remove('muted');
  setRunning(false);
}

async function startDownload() {
  showError('');
  if (!state.dirHandle) return;

  // İzin isteği kullanıcı tıklamasının hemen ardından yapılmalı.
  ui.startBtn.disabled = true;
  const permission = await requestSitePermission(state.seq.dir);

  if (permission === 'granted') {
    state.credentials = 'include'; // izinle CORS devre dışı; çerezler de gönderilir
  } else if (await canFetchWithoutPermission()) {
    state.credentials = 'omit';    // sunucu CORS'a izin veriyor; izin gerekmez
  } else {
    showError(permission === 'unavailable'
      ? RELOAD_EXTENSION_HINT
      : 'Kareleri klasöre yazabilmek için bu siteye erişim izni gerekli. Lütfen izin isteğini onaylayın.');
    setRunning(false);
    return;
  }

  const { start, end } = state;
  const numbers = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const progress = { done: 0, total: numbers.length, failed: [], phase: 'running' };

  state.abort = new AbortController();
  const { signal } = state.abort;
  setRunning(true);
  renderProgress(progress);

  // Basit iş havuzu: MAX_PARALLEL işçi sıradaki numarayı alır.
  let next = 0;
  async function worker() {
    while (next < numbers.length && !signal.aborted) {
      const n = numbers[next++];
      try {
        await saveFrame(n, signal);
      } catch (err) {
        if (signal.aborted) return;
        console.warn('Kare indirilemedi:', n, err);
        progress.failed.push(frameFileName(state.seq, n));
      }
      progress.done++;
      renderProgress(progress);
    }
  }

  await Promise.all(Array.from({ length: MAX_PARALLEL }, worker));

  progress.phase = signal.aborted ? 'cancelled' : 'done';
  progress.failed.sort();
  renderProgress(progress);
  setRunning(false);
}

function cancelDownload() {
  state.abort?.abort();
}

/* ------------------------------------------------------------------ */
/* Başlatma                                                            */
/* ------------------------------------------------------------------ */

(function init() {
  const params = readParams();
  if (!params) {
    showError('Geçersiz indirme bilgisi. Pencereyi kapatıp eklentiden tekrar deneyin.');
    ui.pickBtn.disabled = true;
    return;
  }
  Object.assign(state, params);
  renderSummary();

  if (typeof window.showDirectoryPicker !== 'function') {
    showError('Bu tarayıcı klasör seçmeyi desteklemiyor. Popup\'taki "İndirilenler\'e indir" seçeneğini kullanın.');
    ui.pickBtn.disabled = true;
    return;
  }

  ui.pickBtn.addEventListener('click', pickFolder);
  ui.startBtn.addEventListener('click', startDownload);
  ui.cancelBtn.addEventListener('click', cancelDownload);

  // İndirme sürerken pencere kapatılmak istenirse uyar.
  window.addEventListener('beforeunload', (e) => {
    if (state.running) e.preventDefault();
  });
})();
