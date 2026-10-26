/* global console */
// jsdom does not implement the Web Storage API, so window.localStorage is
// undefined and any code that touches it throws under the jsdom environment.
// Provide a minimal in-memory localStorage so view code under test can run.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  /** @type {Storage} */
  const localStorage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(String(key));
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    }
  };
  globalThis.localStorage = localStorage;
  if (typeof globalThis.window !== 'undefined') {
    globalThis.window.localStorage = localStorage;
  }
}

// Suppress Lit dev-mode warning in Vitest
// Provided snippet: overrides console.warn but forwards all other messages
const { warn } = console;
console.warn = /** @type {function(...*): void} */ (
  (...args) => {
    // Filter out the noisy Lit dev-mode banner in tests
    if (!args[0].startsWith('Lit is in dev mode.')) {
      warn.call(console, ...args);
    }
  }
);

// Keep frame-scheduled rendering deterministic without waiting for JSDOM's
// timer-backed animation frames in every view test.
globalThis.requestAnimationFrame = (
  /** @type {FrameRequestCallback} */ callback
) => {
  globalThis.queueMicrotask(() => callback(globalThis.performance.now()));
  return 0;
};
