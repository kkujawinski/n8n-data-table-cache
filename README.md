# n8n-nodes-datatable-cache

A community node that turns the "store cache in a data table" pattern into a single,
reusable **Data Table Cache** node for n8n. It gives you a read-through / write-back cache
backed by an n8n [data table](https://docs.n8n.io/data/data-tables/), with hit/miss routing
and TTL expiry.

> **Status: experimental.** n8n data tables are a Beta feature and have **no public,
> supported API for nodes** yet (see [Data access](#data-access--the-fragile-part) below).
> This node talks to the internal REST endpoint, which can change between n8n versions.
> Pin your n8n version and re-test after upgrades.

## What it does

A read-through / write-back cache node with **two inputs** (`Input`, `Update`) and **two
outputs** (`Cache Hit`, `Cache Miss`), wired as a loop:

```
            ┌──────────── Data Table Cache ────────────┐
 Input  ─▶ │ lookup → Cache Hit (payload) / Cache Miss │──▶ Cache Hit  → use payload
 Update ─▶ │ store the item → Cache Hit                │──▶ Cache Miss → work ─┐
            └───────────────────────────────────────────┘                     │
                  ▲────────────────── Update ───────────────────────────────--┘
```

- **Input** (index 0) — items to look up. A fresh hit emits the parsed payload on **Cache
  Hit** (and bumps `last_access`). A miss, or a hit older than **Max Age**, emits the item on
  **Cache Miss** (expired hits also attach the stale row as `_staleRow` for debugging).
- **Update** (index 1) — processed items to write back. Each is upserted (payload +
  `last_modified` + `last_access`) and emitted on **Cache Hit** so the flow continues with the
  now-cached payload.

Wire it like a loop: **Cache Miss → your work → the Update input**; take **Cache Hit** onward.

### How the two inputs work (the mechanism)

A naive two-input node would wait for *all* inputs before running, deadlocking the
lookup→process→update cycle. This node sets **`requiredInputs: 1`** so it runs as soon as
*either* input has data. Under n8n's modern `executionOrder: 'v1'`, the engine also resolves
expressions against whichever input carries the items, so the **Cache Key** expression
evaluates correctly on both the Input pass and the Update pass. (Requires `executionOrder: v1`,
the default for workflows created on recent n8n.)

## Install

Community node (n8n **Settings → Community Nodes → Install**):

```
n8n-nodes-datatable-cache
```

Or build and link locally:

```bash
npm install
npm run build
# then link the built package into your n8n custom nodes dir, e.g.
#   ln -s "$(pwd)" ~/.n8n/custom/n8n-nodes-datatable-cache
```

## Prepare a data table

Create a data table (n8n **Data tables** tab) with these **string** columns (names are
configurable on the node — these are the defaults):

| Column          | Purpose                                   |
| --------------- | ----------------------------------------- |
| `cache_key`     | The cache key (lookup/upsert match column) |
| `payload`       | `JSON.stringify` of the cached item        |
| `last_modified` | ISO timestamp of the last write            |
| `last_access`   | ISO timestamp of the last cache hit        |

The auto columns `id`, `createdAt`, `updatedAt` are added by n8n and are not used by the node.

## Credentials — `n8n API`

The node talks to the **public** n8n Data Table API, so it uses the built-in **`n8n API`**
credential (the same one the core *n8n* node uses) — no custom credential to configure.

| Field        | Notes                                                                   |
| ------------ | ----------------------------------------------------------------------- |
| **API Key**  | Create one in n8n under **Settings → n8n API**                          |
| **Base URL** | The API URL of your instance, including `/api/v1`, e.g. `http://localhost:5678/api/v1` |

Authentication is by API key (sent as the `X-N8N-API-KEY` header); there is no project ID,
session cookie, or browser ID to supply. Make sure the API key's scopes include the data-table
row operations (`dataTableRow:read`, `dataTableRow:upsert`, `dataTableRow:update`).

> Requires an n8n version whose public API exposes `/api/v1/data-tables/...`. On older instances
> these endpoints return 404 — upgrade n8n if lookups fail with a not-found error.

## Node parameters

| Parameter            | Default         | Notes                                            |
| -------------------- | --------------- | ------------------------------------------------ |
| Data Table           | —               | Pick from list or enter the table ID             |
| Key Column           | `cache_key`     | Column matched against the cache key             |
| Cache Key            | —               | Expression-friendly; value to look up (Input) or store under (Update) |
| Payload Column       | `payload`       | Holds the stringified payload                    |
| Last Modified Column | `last_modified` | ISO datetime of last write                       |
| Last Access Column   | `last_access`   | ISO datetime of last hit                         |
| Max Age + Unit       | `3600` seconds  | TTL; a hit older than this becomes a miss        |
| Measure From         | `Last Modified` | Whether TTL counts from `last_modified` or `last_access` |

## Example flow

```
Trigger ─▶ [Input] Data Table Cache [Cache Hit] ─▶ use payload (cached or freshly stored) ─▶ …
                                    [Cache Miss] ─▶ expensive work ─▶ [Update] (same node)
```

Wire **Cache Miss** through your work and into the node's **Update** input; take **Cache Hit**
onward. A hit fires immediately; a miss fires Cache Hit again once the Update pass stores it.

## Notes & limitations

- **Requires `executionOrder: v1`** (default on recent n8n) for the two-input loop to schedule
  and for Cache Key expressions to resolve on the Update pass.
- **Concurrency:** last-write-wins. Acceptable for a cache; do not use as a transactional store.
- **Malformed payload:** a non-JSON / legacy payload degrades gracefully — a hit returns
  `{ _raw: <value> }` rather than throwing.
- **Expiry:** TTL only for now. Filter-condition ("reuse the IF builder") expiry is planned;
  it depends on a mutation-then-evaluate workaround that must be validated per n8n version.
- **Continue On Fail:** when enabled, an item that errors is emitted with an `error` field
  instead of failing the execution — a failed lookup on **Cache Miss**, a failed store on
  **Cache Hit**.

## Data access — the fragile part

All data-table I/O is isolated behind a small `CacheStore` interface
(`nodes/DataTableCache/stores/`). Today the only implementation is `HttpCacheStore`, which
calls the public `/api/v1/data-tables/...` API. The single line to revisit on every n8n upgrade
is the route / response-envelope construction in `stores/client.ts` (`dataTableRequest`).
Swapping to a future in-process DI service means adding one `CacheStore` implementation and
selecting it in `stores/makeStore.ts` — `execute` does not change.

## Development

```bash
npm install
npm run build   # tsc + copy icon/codex assets to dist/
npm run lint
npm run dev     # tsc --watch
```

## License

[MIT](LICENSE)
