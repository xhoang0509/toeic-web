import '@testing-library/jest-dom';

// Mock Web Crypto API for jsdom if needed
if (!globalThis.crypto) {
  const nodeCrypto = await import('crypto');
  // @ts-ignore
  globalThis.crypto = nodeCrypto.webcrypto;
}
