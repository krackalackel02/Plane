export {};

declare global {
  interface Window {
    // Dev-only hook set by KeyProvider (src/context/keyContext.tsx) so
    // Playwright can observe which keys a touch drag actually produced.
    __activeKeys?: Set<string>;
  }
}
