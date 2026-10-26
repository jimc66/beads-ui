/**
 * Browser entry point for the layout tests.
 *
 * Mounts the real list and epics views against an in-memory issue store, so
 * the tests measure the markup the app actually renders - lit-html rows,
 * badge selects, inline-edit controls, the views' own colgroups - rather
 * than a hand-written imitation that can drift away from it.
 */
import { createSubscriptionIssueStore } from '../../../app/data/subscription-issue-store.js';
import { createEpicsView } from '../../../app/views/epics.js';
import { createListView } from '../../../app/views/list.js';

/** Minimal stand-in for the subscription issue-store registry. */
function createIssueStores() {
  /** @type {Map<string, any>} */
  const stores = new Map();
  /** @type {Set<(client_id?: string) => void>} */
  const listeners = new Set();

  /**
   * @param {string} id
   * @returns {any}
   */
  function getStore(id) {
    let s = stores.get(id);
    if (!s) {
      s = createSubscriptionIssueStore(id);
      stores.set(id, s);
      s.subscribe(() => {
        for (const fn of Array.from(listeners)) {
          fn(id);
        }
      });
    }
    return s;
  }

  return {
    getStore,
    /** @param {string} client_id */
    snapshotFor: (client_id) => getStore(client_id).snapshot(),
    /**
     * @param {(client_id?: string) => void} fn
     * @returns {() => void}
     */
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    /**
     * @param {string | string[]} _client_ids
     * @param {(client_id: string) => void} fn
     * @returns {() => void}
     */
    subscribeFor: (_client_ids, fn) => {
      const wrapped = /** @type {(client_id?: string) => void} */ (fn);
      listeners.add(wrapped);
      return () => {
        listeners.delete(wrapped);
      };
    }
  };
}

/**
 * Mount one of the real views and render the supplied issues through it.
 *
 * @param {'issues' | 'epics'} view_name
 * @param {Array<Record<string, unknown>>} issues
 */
async function mountView(view_name, issues) {
  const mount = /** @type {HTMLElement} */ (document.getElementById('app'));
  mount.innerHTML = '';

  const client_id = view_name === 'issues' ? 'tab:issues' : 'tab:epics';
  const issue_stores = createIssueStores();

  // The epics view renders its issue table inside an expanded epic, built
  // from that epic's `dependents`, so the flat list is nested under one.
  const entities =
    view_name === 'issues'
      ? issues
      : [
          {
            id: 'atlas-epic',
            title: 'Epic under test',
            status: 'open',
            issue_type: 'epic',
            total_children: issues.length,
            closed_children: 0,
            dependents: issues,
            created_at: 1,
            updated_at: 1,
            closed_at: null
          }
        ];

  issue_stores.getStore(client_id).applyPush({
    type: 'snapshot',
    id: client_id,
    revision: 1,
    issues: entities
  });

  if (view_name === 'epics') {
    // The epics view reads children from the epic's detail subscription,
    // keyed `detail:<epic id>`, so seed that store as the server would.
    issue_stores.getStore('detail:atlas-epic').applyPush({
      type: 'snapshot',
      id: 'detail:atlas-epic',
      revision: 1,
      issues: entities
    });
  }

  const view =
    view_name === 'issues'
      ? createListView(
          mount,
          async () => [],
          () => {},
          undefined,
          undefined,
          issue_stores
        )
      : createEpicsView(
          mount,
          { updateIssue: async () => ({}) },
          () => {},
          undefined,
          issue_stores
        );

  await view.load();
}

// @ts-ignore - exposed for the Playwright specs to drive.
window.mountView = mountView;
