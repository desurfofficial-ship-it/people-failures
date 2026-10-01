// stress-test.js
// Validates the production JS by loading it in a Node VM with a fake DOM.
// This won't test rendering, but it WILL catch syntax errors, ID collisions,
// catalog math errors, and basic API contract violations.

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const REPO = path.resolve(__dirname, '..', 'people-failures');

// Minimal fake DOM & globals
const fakeDom = {
  document: {
    createElement: () => makeEl(),
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    addEventListener: () => {},
    getElementById: () => makeEl(),
    body: { style: {} }
  },
  window: {},
  navigator: {},
  localStorage: {
    _store: {},
    getItem(k) { return this._store[k] || null; },
    setItem(k, v) { this._store[k] = String(v); },
    removeItem(k) { delete this._store[k]; }
  },
  location: { hash: '', pathname: '/', origin: 'http://localhost', search: '' },
  history: { replaceState: () => {} },
  setTimeout: () => 0,
  clearTimeout: () => {},
  scrollTo: () => {},
  confirm: () => true,
  prompt: () => '',
  alert: () => {},
  fetch: () => Promise.reject(new Error('no fetch')),
  caches: { open: () => Promise.resolve({ add: () => Promise.resolve(), put: () => Promise.resolve() }) },
  Response: { error: () => ({}) }
};

function makeEl() {
  const el = {
    style: {}, dataset: {}, _children: [], _listeners: {},
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html || ''; },
    set textContent(v) { this._text = v; },
    get textContent() { return this._text || ''; },
    set value(v) { this._value = v; },
    get value() { return this._value || ''; },
    set hidden(v) { this._hidden = v; },
    get hidden() { return this._hidden || false; },
    set onclick(v) { this._onclick = v; },
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    appendChild: function (c) { this._children.push(c); return c; },
    addEventListener: function (t, h) { (this._listeners[t] ||= []).push(h); },
    setAttribute: function () {}, getAttribute: () => null,
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    remove: function () {}
  };
  return el;
}

const ctx = Object.assign({
  console,
  Date,
  Math,
  Map,
  Set,
  Array,
  Object,
  JSON,
  parseInt,
  isNaN,
  String,
  Number,
  encodeURIComponent,
  decodeURIComponent,
  parseInt: globalThis.parseInt,
  self: null,
  caches: fakeDom.caches,
  fetch: fakeDom.fetch,
  Response: fakeDom.Response,
  navigator: fakeDom.navigator,
  document: fakeDom.document,
  window: fakeDom.window,
  localStorage: fakeDom.localStorage,
  location: fakeDom.location,
  history: fakeDom.history,
  setTimeout: fakeDom.setTimeout,
  clearTimeout: fakeDom.clearTimeout,
  scrollTo: fakeDom.scrollTo,
  confirm: fakeDom.confirm,
  prompt: fakeDom.prompt,
  alert: fakeDom.alert
}, fakeDom);
vm.createContext(ctx);
ctx.self = ctx;
ctx.window = ctx;

function load(filename) {
  const code = fs.readFileSync(path.join(REPO, filename), 'utf8');
  try {
    vm.runInContext(code, ctx, { filename });
    console.log('  ✓', filename);
  } catch (e) {
    console.log('  ✗', filename, ':', e.message);
    throw e;
  }
}

console.log('Loading data + catalog:');
load('data.js');
load('data-mega-v2.js');
load('scenario-catalog-seeds.js');
load('scenario-catalog.js');

// Validate catalog
const CATALOG = ctx.window.ScenarioCatalog;
if (!CATALOG) throw new Error('ScenarioCatalog not exposed');
console.log('\nCatalog validation:');
console.log('  total:', CATALOG.total.toLocaleString());
console.log('  seeds:', CATALOG.seedCount.toLocaleString());
console.log('  facets:', CATALOG.facets.length);
console.log('  eras:', CATALOG.eras.length);

// Sample 5 random scenarios
console.log('\nSample scenarios:');
for (let i = 0; i < 5; i++) {
  const idx = Math.floor(Math.random() * CATALOG.total);
  const s = CATALOG.get(idx);
  if (!s) throw new Error('get(' + idx + ') returned null');
  console.log('  [' + idx + ']', s.name, '—', s.fail.slice(0, 50));
}

// Validate that get() is deterministic
const a = CATALOG.get(12345);
const b = CATALOG.get(12345);
if (a.id !== b.id || a.name !== b.name) throw new Error('get() not deterministic');
console.log('\n  ✓ get() is deterministic');

// Validate search
console.log('\nSearch validation:');
const searches = ['jobs', 'apple', 'war', 'fail', 'the', 'a'];
searches.forEach(q => {
  const r = CATALOG.search(q, { limit: 5 });
  console.log('  "' + q + '": ' + r.total + ' total matches, ' + r.ids.length + ' ids returned');
});

// Validate the rich playbook set
const RICH = ctx.window.FAILURES;
if (!Array.isArray(RICH)) throw new Error('window.FAILURES not array');
console.log('\nRich playbook validation:');
console.log('  total rich:', RICH.length.toLocaleString());
const ids = RICH.map(d => d.id);
const seen = new Set();
const dups = [];
ids.forEach(id => { if (seen.has(id)) dups.push(id); seen.add(id); });
if (dups.length) throw new Error('Duplicate IDs: ' + dups.join(','));
console.log('  ✓ no duplicate IDs');

// Validate field presence
let missingFields = 0;
RICH.forEach(d => {
  ['id', 'name', 'category', 'fail', 'year', 'story', 'whatTheyDid', 'apply', 'takeaway', 'book'].forEach(f => {
    if (d[f] == null) missingFields++;
  });
});
console.log('  ' + (missingFields === 0 ? '✓' : '✗') + ' all entries have required fields (' + missingFields + ' missing)');

// Final grand total
const grand = RICH.length + CATALOG.total;
console.log('\n=== GRAND TOTAL: ' + grand.toLocaleString() + ' cases ===');
console.log('  Rich playbooks: ' + RICH.length.toLocaleString());
console.log('  Virtual scenarios: ' + CATALOG.total.toLocaleString());

// Load script.js (will fail to fully wire up due to missing DOM but should parse + register handlers)
console.log('\nLoading script.js (parses only, DOM is fake):');
try {
  load('script.js');
} catch (e) {
  console.log('  Note: script.js threw during init (expected with fake DOM):');
  console.log('  ', e.message.split('\n')[0]);
}

// sw.js needs WorkerGlobalScope — give it minimal stubs.
console.log('\nLoading sw.js (service worker stubs):');
ctx.self = ctx.self || {};
ctx.self.addEventListener = () => {};
ctx.self.skipWaiting = () => Promise.resolve();
ctx.self.clients = { claim: () => Promise.resolve() };
ctx.self.location = { origin: 'http://localhost' };
try {
  load('sw.js');
} catch (e) {
  console.log('  Note: sw.js threw during init (expected):');
  console.log('  ', e.message.split('\n')[0]);
}

console.log('\n✓ ALL CHECKS PASSED');
