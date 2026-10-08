/**
 * A stand-in for the browser's Image, used to test frame probing.
 *
 * frames.js decides whether a frame exists by loading it as an <img>.
 * installFakeServer() replaces globalThis.Image so that a URL "loads" when
 * the frame number in it passes `exists(n)`, and records every requested URL.
 */

'use strict';

/**
 * @param {(n: number, url: string) => boolean | 'hang'} exists
 *   true → onload, false → onerror, 'hang' → never answers (timeout tests)
 * @returns {{ requests: string[], restore: () => void }}
 */
function installFakeServer(exists) {
  const previous = globalThis.Image;
  const requests = [];

  globalThis.Image = class FakeImage {
    constructor() {
      this.onload = null;
      this.onerror = null;
    }

    set src(url) {
      requests.push(url);
      const match = /(\d+)\.webp(?:[?#]|$)/i.exec(url);
      const answer = match ? exists(parseInt(match[1], 10), url) : false;
      if (answer === 'hang') return;
      setImmediate(() => {
        const handler = answer ? this.onload : this.onerror;
        if (typeof handler === 'function') handler.call(this);
      });
    }
  };

  return {
    requests,
    restore() {
      globalThis.Image = previous;
    }
  };
}

/** exists() for a server holding frames first..last (inclusive). */
const range = (first, last) => (n) => n >= first && n <= last;

module.exports = { installFakeServer, range };
