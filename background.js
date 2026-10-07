/**
 * WebP Frame Downloader — background service worker
 *
 * Popup'tan gelen indirme listesini sırayla (sınırlı paralellikle) indirir.
 * İndirme işi burada yürütüldüğü için popup kapansa bile devam eder.
 *
 * Mesaj protokolü (popup -> background):
 *   { type: 'START_DOWNLOAD', items: [{ url, filename }] }
 *   { type: 'GET_STATUS' }
 *   { type: 'CANCEL_DOWNLOAD' }
 *
 * Bildirim (background -> popup):
 *   { type: 'PROGRESS', status }
 */

'use strict';

/** Aynı anda en fazla kaç dosya indirilecek. */
const MAX_PARALLEL = 4;

/**
 * Aktif indirme işi. Tek seferde yalnızca bir iş çalışır.
 * @type {null | {
 *   items: {url: string, filename: string}[],
 *   nextIndex: number,          // sıradaki başlatılacak öğe
 *   starting: number,           // download() çağrısı henüz dönmemiş öğe sayısı
 *   active: Set<number>,        // devam eden downloadId'ler
 *   done: number,               // biten (başarılı + hatalı)
 *   failed: number,
 *   state: 'running' | 'done' | 'cancelled'
 * }}
 */
let job = null;

/**
 * download() promise'i çözülmeden önce bitmiş olabilecek indirmelerin
 * durumları (çok küçük dosyalarda nadiren olur).
 * @type {Map<number, string>}
 */
const earlyStates = new Map();

/* ------------------------------------------------------------------ */
/* Durum                                                               */
/* ------------------------------------------------------------------ */

function getStatus() {
  if (!job) return { state: 'idle', total: 0, done: 0, failed: 0 };
  return {
    state: job.state,
    total: job.items.length,
    done: job.done,
    failed: job.failed
  };
}

/** İlerlemeyi açık popup'a bildirir. Popup kapalıysa hata yutulur. */
function broadcast() {
  chrome.runtime
    .sendMessage({ type: 'PROGRESS', status: getStatus() })
    .catch(() => { /* popup kapalı */ });
}

/* ------------------------------------------------------------------ */
/* İndirme kuyruğu                                                     */
/* ------------------------------------------------------------------ */

function startJob(items) {
  if (job && job.state === 'running') {
    throw new Error('Zaten devam eden bir indirme var.');
  }
  earlyStates.clear();
  job = {
    items,
    nextIndex: 0,
    starting: 0,
    active: new Set(),
    done: 0,
    failed: 0,
    state: 'running'
  };
  pump();
  broadcast();
}

/** Boş slot oldukça kuyruktan yeni indirme başlatır. */
function pump() {
  if (!job || job.state !== 'running') return;

  while (
    job.active.size + job.starting < MAX_PARALLEL &&
    job.nextIndex < job.items.length
  ) {
    const item = job.items[job.nextIndex++];
    startOne(job, item);
  }

  finishIfComplete();
}

function startOne(currentJob, item) {
  currentJob.starting++;
  chrome.downloads
    .download({
      url: item.url,
      filename: item.filename,
      conflictAction: 'uniquify',
      saveAs: false // "Her indirmede konum sor" ayarı açık olsa bile sorma
    })
    .then((downloadId) => {
      currentJob.starting--;
      if (currentJob !== job) return; // iş değişmiş

      if (currentJob.state === 'cancelled') {
        chrome.downloads.cancel(downloadId).catch(() => {});
        return;
      }

      // İndirme, promise çözülmeden bitmiş olabilir.
      if (earlyStates.has(downloadId)) {
        const state = earlyStates.get(downloadId);
        earlyStates.delete(downloadId);
        markFinished(state === 'complete');
      } else {
        currentJob.active.add(downloadId);
      }
    })
    .catch((err) => {
      currentJob.starting--;
      if (currentJob !== job) return;
      console.warn('İndirme başlatılamadı:', item.url, err);
      markFinished(false);
    });
}

function markFinished(success) {
  if (!job) return;
  job.done++;
  if (!success) job.failed++;
  pump();
  broadcast();
}

function finishIfComplete() {
  if (
    job &&
    job.state === 'running' &&
    job.done >= job.items.length
  ) {
    job.state = 'done';
    earlyStates.clear();
  }
}

function cancelJob() {
  if (!job || job.state !== 'running') return;
  job.state = 'cancelled';
  for (const id of job.active) {
    chrome.downloads.cancel(id).catch(() => {});
  }
  job.active.clear();
  earlyStates.clear();
  broadcast();
}

/* ------------------------------------------------------------------ */
/* Olay dinleyicileri                                                  */
/* ------------------------------------------------------------------ */

chrome.downloads.onChanged.addListener((delta) => {
  if (!delta.state || !job || job.state !== 'running') return;

  const state = delta.state.current;
  if (state !== 'complete' && state !== 'interrupted') return;

  if (job.active.has(delta.id)) {
    job.active.delete(delta.id);
    markFinished(state === 'complete');
  } else if (job.starting > 0) {
    // download() promise'i henüz dönmedi; sonucu sakla.
    earlyStates.set(delta.id, state);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg?.type) {
    case 'START_DOWNLOAD':
      try {
        startJob(msg.items || []);
        sendResponse({ ok: true, status: getStatus() });
      } catch (err) {
        sendResponse({ ok: false, error: err.message, status: getStatus() });
      }
      break;

    case 'GET_STATUS':
      sendResponse({ ok: true, status: getStatus() });
      break;

    case 'CANCEL_DOWNLOAD':
      cancelJob();
      sendResponse({ ok: true, status: getStatus() });
      break;

    default:
      return false;
  }
  return false; // yanıt senkron gönderildi
});
