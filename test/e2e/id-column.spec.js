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
 * `scrollWidth > clientWidth` catches text the element itself clips, and the
 * element's box is compared against the cell's content box because an
 * unconstrained button can spill past its cell while those stay equal.
 *
 * Both of those measure the element, though, and text can escape an
 * element whose box is correctly sized - `overflow: visible` paints the
 * glyphs outside it. So where the text actually renders is measured too,
 * with a Range over the node's contents.
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
      const cell_box = cell.getBoundingClientRect();
      const inner = cell_box.width - pad_left - pad_right;
      const box = el.getBoundingClientRect();
      const content_right = cell_box.right - pad_right;

      // A Range reports the text's laid-out extent, which ignores any clip
      // the element applies - so on its own it cannot tell ellipsised text
      // from text painting outside the cell. Pair it with the element's
      // effective clipping: text only truly escapes when it extends past the
      // cell AND nothing is clipping it.
      const range = document.createRange();
      range.selectNodeContents(el);
      const text_box = range.getBoundingClientRect();
      const clips = getComputedStyle(el).overflowX !== 'visible';

      return {
        id: el.textContent || '',
        text_clipped: el.scrollWidth > el.clientWidth,
        overflows_cell: box.width > inner + 0.5,
        bleeds_right: box.right > content_right + 0.5,
        text_escapes_cell: !clips && text_box.right > content_right + 0.5
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
      (m) =>
        m.text_clipped ||
        m.overflows_cell ||
        m.bleeds_right ||
        m.text_escapes_cell
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
  expect(measured[0].text_escapes_cell).toBe(false);

  // `text-overflow` is a declaration that reads back as "ellipsis" whether or
  // not it does anything: it only renders an ellipsis when the overflow is
  // actually clipped. Assert the clipping that makes it real.
  const style = await page.$eval('table.table td button.id-copy', (el) => {
    const cs = getComputedStyle(el);
    return { text_overflow: cs.textOverflow, overflow_x: cs.overflowX };
  });
  expect(style.text_overflow).toBe('ellipsis');
  expect(style.overflow_x).not.toBe('visible');
});

for (const view of /** @type {const} */ (['issues', 'epics'])) {
  test(`${view}: notices a regression on the production row classes`, async ({
    page
  }) => {
    await mount(page, view, SAMPLE_IDS);

    // Guards the measurement itself. `.issue-row` and `.epic-row` are applied
    // by the real row renderer and were absent from the hand-built table this
    // harness replaced, so a mutation scoped to them is exactly what the
    // earlier fixture could not see. It has to fail here.
    await page.addStyleTag({
      content: '.issue-row, .epic-row { font-size: 16px !important; }'
    });
    await page.waitForTimeout(50);

    const measured = await measureIds(page);

    expect(measured.some((m) => m.text_clipped || m.text_escapes_cell)).toBe(
      true
    );
  });
}

test('notices text escaping its cell when clipping is lost', async ({
  page
}) => {
  await mount(page, 'issues', [OVERLONG_ID]);

  // The element's own box stays correctly sized under `overflow: visible`,
  // so box-based checks alone report a clean layout while the glyphs paint
  // outside the cell. The text-geometry check is what catches it.
  await page.addStyleTag({
    content: 'table.table td button.id-copy { overflow: visible !important; }'
  });
  await page.waitForTimeout(50);

  const measured = await measureIds(page);

  expect(measured[0].text_escapes_cell).toBe(true);
});
