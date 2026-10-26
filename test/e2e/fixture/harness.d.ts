/**
 * The fixture harness exposes its mount function on `window` so the specs can
 * drive the real views from the page context.
 */
declare global {
  interface Window {
    mountView: (
      view_name: 'issues' | 'epics',
      issues: Array<Record<string, unknown>>
    ) => Promise<void>;
  }
}

export {};
