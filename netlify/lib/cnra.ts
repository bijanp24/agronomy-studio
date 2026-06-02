import { fetchJson, type Logger } from './http';
import type { OpenDataDataset } from './models';

const CNRA_BASE = 'https://data.cnra.ca.gov/api/3/action';
const DATASET_LANDING = 'https://data.cnra.ca.gov/dataset/';

interface CkanTag {
  name?: string;
  display_name?: string;
}

interface CkanPackage {
  id: string;
  name?: string;
  title?: string;
  notes?: string;
  organization?: { title?: string; name?: string } | null;
  num_resources?: number;
  tags?: CkanTag[];
  metadata_modified?: string;
}

interface CkanSearchResult {
  success?: boolean;
  result?: { count?: number; results?: CkanPackage[] };
  error?: { message?: string };
}

interface CkanDatastoreResult {
  success?: boolean;
  result?: { records?: Array<Record<string, unknown>>; total?: number; fields?: Array<{ id: string; type: string }> };
}

function toDataset(pkg: CkanPackage): OpenDataDataset {
  return {
    id: pkg.name ?? pkg.id,
    title: pkg.title ?? pkg.name ?? pkg.id,
    description: pkg.notes || undefined,
    organization: pkg.organization?.title ?? pkg.organization?.name ?? undefined,
    url: pkg.name ? `${DATASET_LANDING}${pkg.name}` : undefined,
    resourceCount: pkg.num_resources,
    tags: (pkg.tags ?? []).map((t) => t.display_name ?? t.name ?? '').filter(Boolean),
    updated: pkg.metadata_modified,
    source: 'CNRA',
  };
}

export interface CnraSearchOptions {
  rows?: number;
  logger?: Logger;
}

/** Search the CNRA CKAN catalog (package_search) and normalize to OpenDataDataset. */
export async function searchPackages(query: string, options: CnraSearchOptions = {}): Promise<OpenDataDataset[]> {
  const rows = Math.min(Math.max(options.rows ?? 10, 1), 50);
  const params = new URLSearchParams({ q: query || 'agriculture', rows: String(rows) });
  const url = `${CNRA_BASE}/package_search?${params.toString()}`;
  const json = await fetchJson<CkanSearchResult>(url, { label: 'CNRA package_search', logger: options.logger });
  if (json.success === false) {
    throw new Error(json.error?.message ?? 'CNRA package_search failed');
  }
  return (json.result?.results ?? []).map(toDataset);
}

export interface DatastoreSearchOptions {
  q?: string;
  limit?: number;
  logger?: Logger;
}

/** Query records from a specific CKAN datastore resource (datastore_search). */
export async function datastoreSearch(
  resourceId: string,
  options: DatastoreSearchOptions = {},
): Promise<{ total: number; records: Array<Record<string, unknown>> }> {
  const params = new URLSearchParams({
    resource_id: resourceId,
    limit: String(Math.min(Math.max(options.limit ?? 50, 1), 500)),
  });
  if (options.q) params.set('q', options.q);
  const url = `${CNRA_BASE}/datastore_search?${params.toString()}`;
  const json = await fetchJson<CkanDatastoreResult>(url, { label: 'CNRA datastore_search', logger: options.logger });
  return {
    total: json.result?.total ?? 0,
    records: json.result?.records ?? [],
  };
}
