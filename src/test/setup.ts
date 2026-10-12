// Mở rộng matcher của Vitest với jest-dom (bản /vitest để type được augment đúng)
import '@testing-library/jest-dom/vitest';

// Mock Web Crypto API for jsdom if needed
if (!globalThis.crypto) {
  const nodeCrypto = await import('crypto');
  // @ts-ignore
  globalThis.crypto = nodeCrypto.webcrypto;
}
