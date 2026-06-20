import type { CacheStore } from './CacheStore';
import type { RequestContext } from './client';
import { HttpCacheStore } from './HttpCacheStore';

/**
 * Factory for the active CacheStore implementation.
 *
 * Today this always returns the HTTP store, which talks to the public n8n Data Table
 * API. It is the single place to switch strategies: a future DI-based store (Option 2)
 * would be selected here, e.g. from a node parameter, without touching `execute`.
 */
export function makeStore(ctx: RequestContext): CacheStore {
	return new HttpCacheStore(ctx);
}
