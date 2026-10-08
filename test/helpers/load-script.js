/**
 * Loads an extension script (a classic browser script with top-level
 * functions, no exports) into the current Node realm and returns the
 * requested names.
 *
 * The script runs unchanged, so tests cover exactly the code the browser runs.
 * Loading happens once per process: re-running a script would re-declare its
 * top-level `const`s. Because results live in this realm, deepStrictEqual
 * works on the objects they return.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const loaded = new Map();

/**
 * @param {string} file   Script path relative to the repository root
 * @param {string[]} names Top-level names to expose
 * @returns {Record<string, any>}
 */
function loadScript(file, names) {
  if (!loaded.has(file)) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const exportKey = `__exports_${file.replace(/\W/g, '_')}`;
    const exportLine = `\n;globalThis.${exportKey} = { ${names.join(', ')} };`;
    vm.runInThisContext(source + exportLine, { filename: file });
    loaded.set(file, globalThis[exportKey]);
  }
  return loaded.get(file);
}

module.exports = { loadScript };
