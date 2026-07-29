import 'core-js/stable';
import 'regenerator-runtime/runtime';
import 'whatwg-fetch';
import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';

function legacyRandomUUID(): `${string}-${string}-${string}-${string}-${string}` {
  const bytes = new Uint8Array(16);
  if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

if (window.crypto && typeof window.crypto.randomUUID !== 'function') {
  try {
    Object.defineProperty(window.crypto, 'randomUUID', {
      configurable: true,
      value: legacyRandomUUID,
    });
  } catch {
    // Some embedded WebViews expose a non-extensible Crypto object.
  }
}
