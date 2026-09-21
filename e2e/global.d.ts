export {};

declare global {
  interface Window {
    // Dev-only hook set by KeyProvider (src/context/keyContext.tsx) so
    // Playwright can observe which keys a touch drag actually produced.
    __activeKeys?: Set<string>;
    // Dev-only hook set by ProjectProvider (src/context/projectContext.tsx)
    // so Playwright can open a project's popup directly.
    __setActiveProjectId?: (id: string | null) => void;
  }
}
