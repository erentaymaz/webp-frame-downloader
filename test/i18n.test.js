'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// i18n.js reads localStorage/navigator at load time, so it runs in a small
// sandbox instead of the shared test realm.
const ROOT = path.resolve(__dirname, '..');
const sandbox = {
  localStorage: { getItem: () => null, setItem: () => {} },
  navigator: { language: 'en-US' }
};
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8') + '\n;this.MESSAGES = MESSAGES;',
  sandbox,
  { filename: 'i18n.js' }
);
const { tr, en } = sandbox.MESSAGES;

/** Sample parameters that cover every placeholder used in the messages. */
const PARAMS = {
  n: 2, s: 1, first: 'a.webp', last: 'b.webp', max: 5000, folder: 'out', failed: 1,
  error: 'boom', pattern: 'frame_####.webp', host: 'cdn.example.com', list: 'x, y',
  more: 3, deep: true, hint: true
};

const render = (value) => (typeof value === 'function'
  ? value(PARAMS)
  : value.replace(/\{(\w+)\}/g, (_, k) => String(PARAMS[k])));

test('Turkish and English define the same keys', () => {
  assert.deepEqual(Object.keys(tr).sort(), Object.keys(en).sort());
});

test('every message renders to a complete string in both languages', () => {
  for (const [lang, messages] of Object.entries({ tr, en })) {
    for (const [key, value] of Object.entries(messages)) {
      const text = render(value);
      assert.equal(typeof text, 'string', `${lang}.${key}`);
      assert.ok(text.length > 0, `${lang}.${key} is empty`);
      assert.doesNotMatch(text, /undefined|\{\w+\}/, `${lang}.${key}: ${text}`);
    }
  }
});

test('every key used in the HTML pages exists', () => {
  for (const file of ['popup.html', 'save.html']) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const [, key] of html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) {
      assert.ok(key in en, `${file}: missing key "${key}"`);
    }
  }
});
