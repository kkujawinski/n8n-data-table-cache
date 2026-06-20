import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import type { CacheRow } from './CacheStore';

/**
 * The built-in n8n public-API credential. Its `authenticate` block injects the
 * `X-N8N-API-KEY` header, so this node reuses it instead of defining its own.
 */
export const CREDENTIALS_NAME = 'n8nApi';

/** Either context that can make authenticated HTTP calls and read credentials. */
export type RequestContext = IExecuteFunctions | ILoadOptionsFunctions;

export type FilterCondition = 'eq' | 'neq' | 'like' | 'ilike' | 'gt' | 'gte' | 'lt' | 'lte';

export interface DataTableFilter {
	type: 'and' | 'or';
	filters: Array<{ columnName: string; condition: FilterCondition; value: unknown }>;
}

/** Build a `<keyCol> eq <key>` filter, the only matcher this node needs. */
export function keyFilter(keyCol: string, key: string): DataTableFilter {
	return { type: 'and', filters: [{ columnName: keyCol, condition: 'eq', value: key }] };
}

interface DataTableRequestOptions {
	method: IHttpRequestMethods;
	/** Path under `/data-tables` — leading slash optional; `''` targets the collection. */
	path: string;
	qs?: IDataObject;
	body?: IDataObject;
}

/**
 * Low-level call against the n8n **public** Data Table API
 * (`<baseUrl>/data-tables/...`, where `baseUrl` already ends in `/api/v1`),
 * authenticated by the built-in `n8nApi` credential (API key → `X-N8N-API-KEY`).
 *
 * This replaced the original internal `/rest/projects/{projectId}/...` + session-cookie
 * route once n8n shipped the public DataTable API. The filter syntax is unchanged; the
 * route, auth, and response envelope are the parts that moved — revisit here on upgrades.
 */
export async function dataTableRequest(
	ctx: RequestContext,
	{ method, path, qs, body }: DataTableRequestOptions,
): Promise<unknown> {
	const credentials = await ctx.getCredentials(CREDENTIALS_NAME);

	const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');
	if (!baseUrl) {
		throw new NodeOperationError(
			ctx.getNode(),
			'The n8n API credential is missing its Base URL (e.g. http://localhost:5678/api/v1).',
		);
	}

	const suffix = path && !path.startsWith('/') ? `/${path}` : path;
	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}/data-tables${suffix}`,
		headers: { Accept: 'application/json' },
		json: true,
		...(qs ? { qs } : {}),
		...(body ? { body } : {}),
	};

	return await ctx.helpers.httpRequestWithAuthentication.call(ctx, CREDENTIALS_NAME, options);
}

/**
 * The public API wraps list and row responses in a single `{ data: [...] }` envelope
 * (alongside an optional `nextCursor`). Peel that one layer and return the row array.
 */
export function unwrapRows(response: unknown): CacheRow[] {
	const payload = response as IDataObject | undefined;
	const rows = payload && typeof payload === 'object' ? payload.data : undefined;
	return Array.isArray(rows) ? (rows as CacheRow[]) : [];
}
