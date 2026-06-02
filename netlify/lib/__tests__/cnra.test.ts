import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchPackages, datastoreSearch } from '../cnra';

function jsonOk(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

const packageSearch = {
  success: true,
  result: {
    count: 1,
    results: [
      {
        id: 'abc-123',
        name: 'agricultural-water-use',
        title: 'Agricultural Water Use',
        notes: 'Statewide agricultural water use estimates.',
        organization: { title: 'Department of Water Resources', name: 'dwr' },
        num_resources: 3,
        tags: [{ name: 'water' }, { display_name: 'Agriculture' }],
        metadata_modified: '2026-04-01T00:00:00',
      },
    ],
  },
};

describe('cnra package search', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('normalizes CKAN packages to OpenDataDataset', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonOk(packageSearch)));
    const datasets = await searchPackages('water');
    expect(datasets).toHaveLength(1);
    const d = datasets[0];
    expect(d.id).toBe('agricultural-water-use');
    expect(d.title).toBe('Agricultural Water Use');
    expect(d.organization).toBe('Department of Water Resources');
    expect(d.url).toBe('https://data.cnra.ca.gov/dataset/agricultural-water-use');
    expect(d.resourceCount).toBe(3);
    expect(d.tags).toEqual(['water', 'Agriculture']);
    expect(d.source).toBe('CNRA');
  });

  it('throws when CKAN reports failure', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonOk({ success: false, error: { message: 'bad query' } })));
    await expect(searchPackages('x')).rejects.toThrow(/bad query/);
  });

  it('queries a datastore resource', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonOk({ success: true, result: { total: 2, records: [{ a: 1 }, { a: 2 }] } })));
    const result = await datastoreSearch('resource-1', { limit: 10 });
    expect(result.total).toBe(2);
    expect(result.records).toHaveLength(2);
  });
});
