/**
 * Playwright global setup: bundle the fixture harness.
 *
 * The harness imports the real view modules, so it has to be rebuilt before
 * every run. Building it here rather than committing the bundle means the
 * tests cannot silently measure a stale copy of the views.
 */
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixture_dir = path.dirname(fileURLToPath(new URL(import.meta.url)));

export default async function globalSetup() {
  await build({
    entryPoints: [path.join(fixture_dir, 'harness.js')],
    outfile: path.join(fixture_dir, 'harness.bundle.js'),
    bundle: true,
    format: 'esm',
    logLevel: 'silent'
  });
}
