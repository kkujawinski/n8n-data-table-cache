import type { IDataObject } from 'n8n-workflow';

import type { CacheRow, CacheStore } from './CacheStore';
import { dataTableRequest, keyFilter, unwrapRows, type RequestContext } from './client';

/**
 * CacheStore backed by the n8n public Data Table API.
 *
 * Maps the three cache primitives onto the data-table row operations:
 *   - get    -> GET   /{tableId}/rows?filter=...   (eq on the key column, limit 1)
 *   - upsert -> POST  /{tableId}/rows/upsert       (filter + data)
 *   - touch  -> PATCH /{tableId}/rows/update       (filter + partial data)
 */
export class HttpCacheStore implements CacheStore {
	constructor(private readonly ctx: RequestContext) {}

	async get(tableId: string, keyCol: string, key: string): Promise<CacheRow | null> {
		const response = await dataTableRequest(this.ctx, {
			method: 'GET',
			path: `/${tableId}/rows`,
			qs: {
				filter: JSON.stringify(keyFilter(keyCol, key)),
				limit: 1,
			},
		});

		const rows = unwrapRows(response);
		return rows.length > 0 ? rows[0] : null;
	}

	async upsert(tableId: string, keyCol: string, key: string, fields: CacheRow): Promise<void> {
		await dataTableRequest(this.ctx, {
			method: 'POST',
			path: `/${tableId}/rows/upsert`,
			body: {
				filter: keyFilter(keyCol, key),
				data: { [keyCol]: key, ...fields } as IDataObject,
				returnData: false,
			},
		});
	}

	async touch(tableId: string, keyCol: string, key: string, fields: CacheRow): Promise<void> {
		await dataTableRequest(this.ctx, {
			method: 'PATCH',
			path: `/${tableId}/rows/update`,
			body: {
				filter: keyFilter(keyCol, key),
				data: fields as IDataObject,
				returnData: false,
			},
		});
	}
}
