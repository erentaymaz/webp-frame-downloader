'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./helpers/load-script');

const {
  parseFrameUrl,
  isZeroPadded,
  groupSequences,
  sequenceFromUrl,
  defaultRange,
  frameFileName,
  frameUrl,
  safeFileName,
  patternLabel
} = loadScript('frames.js', [
  'parseFrameUrl',
  'isZeroPadded',
  'groupSequences',
  'sequenceFromUrl',
  'defaultRange',
  'frameFileName',
  'frameUrl',
  'safeFileName',
  'patternLabel'
]);

const CDN = 'https://cdn.example.com/stories/abc/frames/';

/* ------------------------------------------------------------------ */

describe('parseFrameUrl', () => {
  test('splits a standard frame URL into its parts', () => {
    assert.deepEqual(parseFrameUrl(`${CDN}frame_0202.webp`), {
      dir: CDN,
      prefix: 'frame_',
      digits: '0202',
      number: 202,
      ext: '.webp',
      query: ''
    });
  });

  test('keeps the query string and drops the hash', () => {
    const p = parseFrameUrl(`${CDN}frame_0007.webp?v=3&sig=abc#top`);
    assert.equal(p.number, 7);
    assert.equal(p.query, '?v=3&sig=abc');
  });

  test('accepts an uppercase extension and keeps its case', () => {
    const p = parseFrameUrl(`${CDN}FRAME_0001.WEBP`);
    assert.equal(p.prefix, 'FRAME_');
    assert.equal(p.ext, '.WEBP');
  });

  test('uses the trailing digit run; digits inside the prefix stay in the prefix', () => {
    const p = parseFrameUrl(`${CDN}shot2_v3_0010.webp`);
    assert.equal(p.prefix, 'shot2_v3_');
    assert.equal(p.digits, '0010');
    assert.equal(p.number, 10);
  });

  test('allows a file name that is only a number', () => {
    const p = parseFrameUrl(`${CDN}0042.webp`);
    assert.equal(p.prefix, '');
    assert.equal(p.number, 42);
  });

  test('keeps the port and percent-encoding of the original URL', () => {
    const p = parseFrameUrl('http://localhost:8080/a%20b/my%20frame_01.webp');
    assert.equal(p.dir, 'http://localhost:8080/a%20b/');
    assert.equal(p.prefix, 'my%20frame_');
  });

  test('trims surrounding whitespace (pasted URLs)', () => {
    assert.equal(parseFrameUrl(`  ${CDN}frame_0001.webp \n`).number, 1);
  });

  test('rejects URLs that are not numbered .webp files', () => {
    for (const url of [
      `${CDN}frame_0001.png`,
      `${CDN}hero.webp`,
      `${CDN}0001/frame.webp`,
      `${CDN}frame_0001.webp.jpg`,
      `${CDN}`
    ]) {
      assert.equal(parseFrameUrl(url), null, url);
    }
  });

  test('rejects invalid and non-http(s) URLs', () => {
    for (const url of [
      'not a url',
      '',
      'ftp://cdn.example.com/frame_0001.webp',
      'chrome-extension://abc/frame_0001.webp',
      'data:image/webp;base64,AAAA'
    ]) {
      assert.equal(parseFrameUrl(url), null, url);
    }
  });
});

/* ------------------------------------------------------------------ */

describe('zero padding', () => {
  test('isZeroPadded recognises a leading zero only on multi-digit numbers', () => {
    assert.equal(isZeroPadded('0001'), true);
    assert.equal(isZeroPadded('01'), true);
    assert.equal(isZeroPadded('0'), false);
    assert.equal(isZeroPadded('1000'), false);
    assert.equal(isZeroPadded('7'), false);
  });

  test('a padded URL keeps its width when building other frames', () => {
    const seq = sequenceFromUrl(`${CDN}frame_0202.webp`);
    assert.equal(seq.pad, 4);
    assert.equal(frameFileName(seq, 7), 'frame_0007.webp');
    assert.equal(frameFileName(seq, 202), 'frame_0202.webp');
  });

  test('numbers wider than the padding are not truncated', () => {
    const seq = sequenceFromUrl(`${CDN}frame_0001.webp`);
    assert.equal(frameFileName(seq, 12345), 'frame_12345.webp');
  });

  test('an unpadded URL builds unpadded names', () => {
    const seq = sequenceFromUrl(`${CDN}frame_7.webp`);
    assert.equal(seq.pad, 0);
    assert.equal(frameFileName(seq, 12), 'frame_12.webp');
  });

  // Known limitation: from a single URL like frame_1000.webp we cannot tell
  // whether the series is padded to 4 digits. It is treated as unpadded, so
  // pasting the 1000th frame of a 0001..1000 series builds "frame_7.webp".
  // Pasting any frame below 1000 (or scanning the page) gets the padding right.
  test('a single unpadded multi-digit URL is treated as unpadded (known limitation)', () => {
    const seq = sequenceFromUrl(`${CDN}frame_1000.webp`);
    assert.equal(seq.pad, 0);
    assert.equal(frameFileName(seq, 7), 'frame_7.webp');
  });

  test('a group takes its padding from the padded members', () => {
    const [seq] = groupSequences([`${CDN}frame_0999.webp`, `${CDN}frame_1000.webp`]);
    assert.equal(seq.pad, 4);
    assert.equal(frameFileName(seq, 7), 'frame_0007.webp');
  });

  test('patternLabel shows one # per padded digit', () => {
    assert.equal(patternLabel(sequenceFromUrl(`${CDN}frame_0001.webp`)), 'frame_####.webp');
    assert.equal(patternLabel(sequenceFromUrl(`${CDN}frame_1.webp`)), 'frame_#.webp');
  });
});

/* ------------------------------------------------------------------ */

describe('query strings', () => {
  test('frameUrl carries the query string to every frame', () => {
    const seq = sequenceFromUrl(`${CDN}frame_0001.webp?token=xyz&v=2`);
    assert.equal(frameUrl(seq, 2), `${CDN}frame_0002.webp?token=xyz&v=2`);
  });

  test('frameFileName never contains the query string', () => {
    const seq = sequenceFromUrl(`${CDN}frame_0001.webp?token=xyz`);
    assert.equal(frameFileName(seq, 2), 'frame_0002.webp');
  });

  test('frames with different queries form one group; the first query is kept', () => {
    const groups = groupSequences([
      `${CDN}frame_0001.webp?sig=a`,
      `${CDN}frame_0002.webp?sig=b`
    ]);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].numbers, [1, 2]);
    assert.equal(groups[0].query, '?sig=a');
  });
});

/* ------------------------------------------------------------------ */

describe('groupSequences', () => {
  test('returns no groups for no numbered .webp URLs', () => {
    assert.deepEqual(groupSequences([]), []);
    assert.deepEqual(groupSequences([`${CDN}hero.webp`, `${CDN}frame_0001.png`, 'bad url']), []);
  });

  test('groups by folder + prefix + extension, deduplicated and sorted', () => {
    const groups = groupSequences([
      `${CDN}frame_0003.webp`,
      `${CDN}frame_0001.webp`,
      `${CDN}frame_0003.webp`,
      `${CDN}frame_0002.WEBP`
    ]);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].numbers, [1, 2, 3]);
    assert.equal(groups[0].source, 'scan');
  });

  test('keeps different folders and prefixes apart', () => {
    const groups = groupSequences([
      `${CDN}frame_0001.webp`,
      'https://cdn.example.com/other/frame_0001.webp',
      `${CDN}thumb_0001.webp`
    ]);
    assert.equal(groups.length, 3);
  });

  test('ranks sequences named "frame" first, then by number of frames', () => {
    const groups = groupSequences([
      `${CDN}img_01.webp`, `${CDN}img_02.webp`, `${CDN}img_03.webp`,
      `${CDN}tile_1.webp`, `${CDN}tile_2.webp`,
      `${CDN}Frame_0001.webp`
    ]);
    assert.deepEqual(groups.map((g) => g.prefix), ['Frame_', 'img_', 'tile_']);
  });
});

/* ------------------------------------------------------------------ */

describe('defaultRange', () => {
  test('uses min..max when several frames were seen', () => {
    const [seq] = groupSequences([`${CDN}frame_0005.webp`, `${CDN}frame_0040.webp`, `${CDN}frame_0012.webp`]);
    assert.deepEqual(defaultRange(seq), { start: 5, end: 40 });
  });

  test('starts at 1 for a single frame (frame_0202 → 1..202)', () => {
    assert.deepEqual(defaultRange(sequenceFromUrl(`${CDN}frame_0202.webp`)), { start: 1, end: 202 });
  });

  test('handles frame 0 and frame 1 on their own', () => {
    assert.deepEqual(defaultRange(sequenceFromUrl(`${CDN}frame_0000.webp`)), { start: 0, end: 0 });
    assert.deepEqual(defaultRange(sequenceFromUrl(`${CDN}frame_0001.webp`)), { start: 1, end: 1 });
  });
});

/* ------------------------------------------------------------------ */

describe('safeFileName', () => {
  test('decodes percent-encoding', () => {
    assert.equal(safeFileName('my%20frame_0001.webp'), 'my frame_0001.webp');
  });

  test('replaces characters that are invalid in file names', () => {
    assert.equal(safeFileName('a:b*c?d"e<f>g|h\\i.webp'), 'a_b_c_d_e_f_g_h_i.webp');
    assert.equal(safeFileName('a%2Fb.webp'), 'a_b.webp');
  });

  test('leaves malformed percent-encoding as it is', () => {
    assert.equal(safeFileName('frame_%E0%A4%A_01.webp'), 'frame_%E0%A4%A_01.webp');
  });
});
