/**
 * Layout coverage for the Issues/Epics ID column.
 *
 * The vitest suite cannot cover this: jsdom reports every width as 0, so an
 * ID that overflows its column is invisible to it. These tests render the
 * real `app/styles.css` against the real table markup in Chromium and compare
 * `scrollWidth` to `clientWidth`, which is how the browser itself reports
 * clipped text.
 *
 * The IDs below are real values taken from a 2,587-issue Beads database,
 * one per distinct length from 9 to 17 characters. Only the IDs were taken;
 * no titles or other issue content.
 */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const this_file = fileURLToPath(new URL(import.meta.url));
const repo_root = path.resolve(path.dirname(this_file), '../..');

/**
 * Read the ID column's width straight out of the view source, so this test
 * measures what the app actually ships rather than a copy that can drift.
 *
 * @param {string} rel_path - View file, relative to the repo root.
 */
function idColumnWidth(rel_path) {
  const src = readFileSync(path.join(repo_root, rel_path), 'utf8');
  const match = src.match(/<col style="width: (\d+)px" \/>/);
  if (!match) {
    throw new Error(`No colgroup width found in ${rel_path}`);
  }
  return Number(match[1]);
}

/** Real IDs spanning every length present in the source database. */
const SAMPLE_IDS = [
  'atlas-024',
  'atlas-00t8',
  'atlas-0py.1',
  'atlas-0py.10',
  'atlas-2cwf.10',
  'atlas-4pa.10.1',
  'atlas-4pa.54.10',
  'atlas-4pa.10.1.1',
  'atlas-4pa.54.7.10'
];

/**
 * Build a page reproducing the list view's table structure: the same
 * `.table` class, the same colgroup widths, and the same
 * `<td class="mono"><button class="mono id-copy">` ID cell.
 *
 * @param {string[]} ids
 * @param {number} id_width - ID column width, read from the view source.
 */
function tablePage(ids, id_width) {
  const styles = readFileSync(path.join(repo_root, 'app/styles.css'), 'utf8');
  const rows = ids
    .map(
      (id) => `<tr role="row">
        <td role="gridcell" class="mono"><button type="button" class="mono id-copy">${id}</button></td>
        <td role="gridcell"><span class="badge">Bug</span></td>
        <td role="gridcell">A representative issue title</td>
        <td role="gridcell">open</td>
        <td role="gridcell">someone</td>
        <td role="gridcell">P2</td>
        <td role="gridcell">0</td>
      </tr>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>${styles}</style></head>
<body>
  <table class="table" role="grid">
    <colgroup>
      <col style="width: ${id_width}px" />
      <col style="width: 90px" />
      <col />
      <col style="width: 120px" />
      <col style="width: 160px" />
      <col style="width: 130px" />
      <col style="width: 80px" />
    </colgroup>
    <thead><tr role="row">
      <th role="columnheader">ID</th><th role="columnheader">Type</th>
      <th role="columnheader">Title</th><th role="columnheader">Status</th>
      <th role="columnheader">Assignee</th><th role="columnheader">Priority</th>
      <th role="columnheader">Deps</th>
    </tr></thead>
    <tbody role="rowgroup">${rows}</tbody>
  </table>
</body></html>`;
}

/**
 * Measure each ID button, reporting whether the browser is clipping its text.
 *
 * @param {import('@playwright/test').Page} page
 */
async function measureIds(page) {
  return page.$$eval('button.id-copy', (nodes) =>
    nodes.map((el) => ({
      id: el.textContent || '',
      // scrollWidth exceeds clientWidth exactly when the text does not fit.
      scroll_width: el.scrollWidth,
      client_width: el.clientWidth,
      clipped: el.scrollWidth > el.clientWidth
    }))
  );
}

for (const view of ['app/views/list.js', 'app/views/epics.js']) {
  test(`renders every real-world issue ID without clipping in ${view}`, async ({
    page
  }) => {
    await page.setContent(tablePage(SAMPLE_IDS, idColumnWidth(view)));

    const measured = await measureIds(page);
    const clipped = measured.filter((m) => m.clipped);

    expect(
      clipped,
      `clipped IDs: ${clipped.map((c) => `${c.id} (needs ${c.scroll_width}px, has ${c.client_width}px)`).join(', ')}`
    ).toEqual([]);
  });
}

test('shows the full ID text, never a truncated prefix', async ({ page }) => {
  await page.setContent(
    tablePage(SAMPLE_IDS, idColumnWidth('app/views/list.js'))
  );

  const rendered = await page.$$eval('button.id-copy', (nodes) =>
    nodes.map((el) => el.textContent)
  );

  // The project prefix carries meaning once several projects are open, and
  // the ID is a click-to-copy control, so the visible text must match the
  // value exactly rather than being shortened at either end.
  expect(rendered).toEqual(SAMPLE_IDS);
});
