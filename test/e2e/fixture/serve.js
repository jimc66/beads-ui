/**
 * Static file server for the layout fixture.
 *
 * ES modules are blocked over file:// by the browser's CORS rules, so the
 * fixture page and the view modules it imports have to be served over HTTP.
 * Serves the repository root so the fixture can reference `app/` directly.
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo_root = path.resolve(
  path.dirname(fileURLToPath(new URL(import.meta.url))),
  '../../..'
);

const app = express();
app.use(express.static(repo_root));
app.listen(4173, '127.0.0.1');
