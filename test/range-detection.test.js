'use strict';

const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./helpers/load-script');
const { installFakeServer, range } = require('./helpers/fake-image');

const {
  MAX_FRAMES,
  sequenceFromUrl,
  frameExists,
  findFirstFrame,
  findLastFrame
} = loadScript('frames.js', [
  'MAX_FRAMES',
  'sequenceFromUrl',
  'frameExists',
  'findFirstFrame',
  'findLastFrame'
]);

const CDN = 'https://cdn.example.com/frames/';
const notCancelled = () => false;

let server = null;
const serve = (exists) => (server = installFakeServer(exists));
afterEach(() => server?.restore());

/** Upper bound for exponential + binary search over a range of size n. */
const maxProbes = (n) => 2 * Math.ceil(Math.log2(n + 1)) + 2;

/* ------------------------------------------------------------------ */

describe('frameExists', () => {
  test('is true when the image loads and false when it fails', async () => {
    serve(range(1, 10));
    const seq = sequenceFromUrl(`${CDN}frame_0001.webp`);
    assert.equal(await frameExists(seq, 5), true);
    assert.equal(await frameExists(seq, 11), false);
  });

  test('requests the padded URL with the query string', async () => {
    serve(range(1, 10));
    const seq = sequenceFromUrl(`${CDN}frame_0001.webp?sig=1`);
    await frameExists(seq, 7);
    assert.deepEqual(server.requests, [`${CDN}frame_0007.webp?sig=1`]);
  });

  test('gives up after the timeout', async () => {
    serve(() => 'hang');
    const seq = sequenceFromUrl(`${CDN}frame_0001.webp`);
    assert.equal(await frameExists(seq, 1, 20), false);
  });
});

/* ------------------------------------------------------------------ */

describe('findLastFrame', () => {
  const cases = [
    { name: 'typical: 37 seen, 202 exist', first: 1, last: 202, known: 37 },
    { name: 'the known frame is already the last', first: 1, last: 202, known: 202 },
    { name: 'a single-frame sequence', first: 1, last: 1, known: 1 },
    { name: 'the last frame is a power-of-two step away', first: 1, last: 65, known: 1 },
    { name: 'a long sequence', first: 1, last: 4000, known: 1 },
    { name: 'starting from frame 0', first: 0, last: 90, known: 0 }
  ];

  for (const c of cases) {
    test(c.name, async () => {
      serve(range(c.first, c.last));
      const seq = sequenceFromUrl(`${CDN}frame_${String(c.known).padStart(4, '0')}.webp`);
      assert.equal(await findLastFrame(seq, c.known, notCancelled), c.last);
      assert.ok(
        server.requests.length <= maxProbes(c.last - c.known + 1),
        `${server.requests.length} probes`
      );
    });
  }

  test('202 frames take only a handful of probes', async () => {
    serve(range(1, 202));
    const seq = sequenceFromUrl(`${CDN}frame_0001.webp`);
    await findLastFrame(seq, 1, notCancelled);
    assert.ok(server.requests.length <= 16, `${server.requests.length} probes`);
  });

  test('stops at the MAX_FRAMES safety limit when every frame seems to exist', async () => {
    serve(() => true);
    const seq = sequenceFromUrl(`${CDN}frame_0001.webp`);
    const last = await findLastFrame(seq, 1, notCancelled);
    assert.ok(last > 1 && last - 1 <= MAX_FRAMES, `stopped at ${last}`);
  });

  test('returns null when cancelled', async () => {
    serve(range(1, 202));
    const seq = sequenceFromUrl(`${CDN}frame_0001.webp`);
    assert.equal(await findLastFrame(seq, 1, () => true), null);
  });

  test('can be cancelled half-way', async () => {
    serve(range(1, 5000));
    const seq = sequenceFromUrl(`${CDN}frame_0001.webp`);
    let calls = 0;
    const result = await findLastFrame(seq, 1, () => ++calls > 3);
    assert.equal(result, null);
    assert.ok(server.requests.length <= 3);
  });
});

/* ------------------------------------------------------------------ */

describe('findFirstFrame', () => {
  test('finds frame 1 when frame 0 does not exist', async () => {
    serve(range(1, 202));
    const seq = sequenceFromUrl(`${CDN}frame_0037.webp`);
    assert.equal(await findFirstFrame(seq, 37, notCancelled), 1);
  });

  test('finds frame 0 with a single probe', async () => {
    serve(range(0, 202));
    const seq = sequenceFromUrl(`${CDN}frame_0037.webp`);
    assert.equal(await findFirstFrame(seq, 37, notCancelled), 0);
    assert.equal(server.requests.length, 1);
  });

  test('finds a sequence that starts later than 1', async () => {
    serve(range(5, 90));
    const seq = sequenceFromUrl(`${CDN}frame_0040.webp`);
    assert.equal(await findFirstFrame(seq, 40, notCancelled), 5);
  });

  test('returns the known frame when nothing exists before it', async () => {
    serve(range(1, 202));
    const seq = sequenceFromUrl(`${CDN}frame_0001.webp`);
    assert.equal(await findFirstFrame(seq, 1, notCancelled), 1);
  });

  test('does not probe at all when the known frame is 0', async () => {
    serve(range(0, 10));
    const seq = sequenceFromUrl(`${CDN}frame_0000.webp`);
    assert.equal(await findFirstFrame(seq, 0, notCancelled), 0);
    assert.equal(server.requests.length, 0);
  });

  test('returns null when cancelled', async () => {
    serve(range(5, 90));
    const seq = sequenceFromUrl(`${CDN}frame_0040.webp`);
    assert.equal(await findFirstFrame(seq, 40, () => true), null);
  });
});
