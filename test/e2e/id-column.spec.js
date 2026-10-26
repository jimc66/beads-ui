/**
 * Layout coverage for the Issues/Epics ID column.
 *
 * The vitest suite cannot cover this: jsdom reports every width as 0, so an
 * ID that overflows its column is invisible to it. These tests mount the real
 * views in Chromium against the app's own stylesheet and measure what the
 * browser actually lays out.
 *
 * The IDs below are real values taken from a 2,587-issue Beads database, one
 * per distinct length from 9 to 17 characters. Only the IDs were taken; no
 * titles or other issue content.
 */
import { expect, test } from '@playwright/test';

const FIXTURE_PATH = '/test/e2e/fixture/index.html';

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

/** An id deeper than anything observed, to exercise the ellipsis backstop. */
const OVERLONG_ID = 'atlas-4pa.54.7.10.22.31';

/**
 * @param {string[]} ids
 * @returns {Array<Record<string, unknown>>} Issue records for the stores.
 */
function issuesFrom(ids) {
  return ids.map((id, i) => ({
    id,
    title: `Issue ${i + 1}`,
    status: 'open',
    issue_type: i % 2 === 0 ? 'bug' : 'task',
    priority: 2,
    assignee: 'someone',
    created_at: 1,
    updated_at: 1,
    closed_at: null
  }));
}

/**
 * Mount a real view with the given issues.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'issues' | 'epics'} view
 * @param {string[]} ids
 */
async function mount(page, view, ids) {
  await page.goto(FIXTURE_PATH);
  await page.evaluate(
    ([v, data]) => window.mountView(v, data),
    /** @type {['issues' | 'epics', Array<Record<string, unknown>>]} */ ([
      view,
      issuesFrom(ids)
    ])
  );
  await page.waitForSelector('table.table td button.id-copy');
}

/**
 * Measure every ID cell as the browser lays it out.
 *
 * `scrollWidth > clientWidth` catches text the element itself clips, but an
 * unconstrained button can also spill past its cell while those stay equal,
 * so the geometry is compared against the cell's content box too.
 *
 * @param {import('@playwright/test').Page} page
 */
async function measureIds(page) {
  return page.$$eval('table.table td button.id-copy', (nodes) =>
    nodes.map((el) => {
      const cell = /** @type {HTMLElement} */ (el.closest('td'));
      const cs = getComputedStyle(cell);
      const pad_left = parseFloat(cs.paddingLeft);
      const pad_right = parseFloat(cs.paddingRight);
      const inner = cell.getBoundingClientRect().width - pad_left - pad_right;
      const box = el.getBoundingClientRect();
      return {
        id: el.textContent || '',
        text_clipped: el.scrollWidth > el.clientWidth,
        overflows_cell: box.width > inner + 0.5,
        bleeds_right:
          box.right > cell.getBoundingClientRect().right - pad_right + 0.5
      };
    })
  );
}

for (const view of /** @type {const} */ (['issues', 'epics'])) {
  test(`${view}: renders every real-world ID without clipping`, async ({
    page
  }) => {
    await mount(page, view, SAMPLE_IDS);

    const measured = await measureIds(page);
    const bad = measured.filter(
      (m) => m.text_clipped || m.overflows_cell || m.bleeds_right
    );

    expect(measured).toHaveLength(SAMPLE_IDS.length);
    expect(bad, `badly laid out: ${JSON.stringify(bad, null, 2)}`).toEqual([]);
  });

  test(`${view}: keeps the full ID as the copyable value`, async ({ page }) => {
    await mount(page, view, SAMPLE_IDS);

    // Read back from the rendered DOM, which the real ID renderer produced,
    // rather than comparing the input array against itself.
    const rendered = await page.$$eval(
      'table.table td button.id-copy',
      (nodes) => nodes.map((el) => el.textContent)
    );

    // The prefix disambiguates once several projects are open and the control
    // copies what it displays, so the text must never be shortened. The views
    // order rows themselves, so compare membership rather than sequence.
    expect([...rendered].sort()).toEqual([...SAMPLE_IDS].sort());
  });
}

test('an ID deeper than any observed falls back to an ellipsis', async ({
  page
}) => {
  await mount(page, 'issues', [OVERLONG_ID]);

  const measured = await measureIds(page);

  // The backstop's job is to keep the overflow inside the cell; the text
  // itself is expected to clip at this depth.
  expect(measured[0].text_clipped).toBe(true);
  expect(measured[0].overflows_cell).toBe(false);
  expect(measured[0].bleeds_right).toBe(false);

  const overflow = await page.$eval(
    'table.table td button.id-copy',
    (el) => getComputedStyle(el).textOverflow
  );
  expect(overflow).toBe('ellipsis');
});

test('detects a regression in the rendered row styling', async ({ page }) => {
  await mount(page, 'issues', SAMPLE_IDS);

  // Guards the measurement itself: if these assertions can be satisfied by
  // markup that is not what ships, a change to the real rows would not be
  // noticed. Restoring the pre-fix type size must make the suite's own
  // metric fail.
  await page.addStyleTag({
    content: '.table { font-size: 16px !important; }'
  });
  await page.waitForTimeout(50);

  const measured = await measureIds(page);

  expect(measured.some((m) => m.text_clipped)).toBe(true);
});
