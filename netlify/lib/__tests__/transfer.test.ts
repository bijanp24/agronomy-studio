import { describe, it, expect } from 'vitest';
import {
  parseCsvText,
  suggestColumnMappings,
  normalizeFieldRow,
  normalizeOperationRow,
  normalizeGeoJsonBoundaries,
  validateField,
  validateOperation,
  convertArea,
  detectAreaUnit,
  exportFieldsToCsv,
  type ParsedCsvRow,
  type ColumnMapping,
  type GeoJsonFeatureCollection,
} from '../transfer';

// ---------------------------------------------------------------------------
// parseCsvText
// ---------------------------------------------------------------------------

describe('parseCsvText', () => {
  it('parses simple CSV with headers', () => {
    const csv = 'name,farm,acres\nBlock A,Sunrise Ranch,42.3\nBlock B,Sunrise Ranch,36.1';
    const { headers, rows } = parseCsvText(csv);
    expect(headers).toEqual(['name', 'farm', 'acres']);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Block A');
    expect(rows[0].acres).toBe('42.3');
  });

  it('handles quoted fields containing commas', () => {
    const csv = 'name,notes\n"Smith, Jr. Ranch","Great field, very flat"';
    const { rows } = parseCsvText(csv);
    expect(rows[0].name).toBe('Smith, Jr. Ranch');
    expect(rows[0].notes).toBe('Great field, very flat');
  });

  it('returns empty results for an empty string', () => {
    const { headers, rows } = parseCsvText('');
    expect(headers).toHaveLength(0);
    expect(rows).toHaveLength(0);
  });

  it('handles CRLF line endings', () => {
    const csv = 'name,acres\r\nBlock A,42\r\nBlock B,36';
    const { rows } = parseCsvText(csv);
    expect(rows).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// suggestColumnMappings
// ---------------------------------------------------------------------------

describe('suggestColumnMappings', () => {
  it('maps known aliases to canonical fields', () => {
    const mappings = suggestColumnMappings(['field_name', 'farm', 'acres', 'crop', 'year', 'unknown_column']);
    const map = Object.fromEntries(mappings.map((m) => [m.sourceColumn, m.canonicalField]));
    expect(map['field_name']).toBe('name');
    expect(map['farm']).toBe('farmName');
    expect(map['acres']).toBe('areaValue');
    expect(map['crop']).toBe('cropName');
    expect(map['year']).toBe('cropYear');
    expect(map['unknown_column']).toBe('unknown_column');
  });
});

// ---------------------------------------------------------------------------
// convertArea
// ---------------------------------------------------------------------------

describe('convertArea', () => {
  it('converts acres to hectares', () => {
    expect(convertArea(100, 'acres', 'hectare')).toBeCloseTo(40.47, 1);
  });

  it('converts hectares to acres', () => {
    expect(convertArea(10, 'ha', 'acre')).toBeCloseTo(24.71, 1);
  });

  it('returns value unchanged when units match', () => {
    expect(convertArea(50, 'acre', 'acre')).toBe(50);
  });

  it('returns value unchanged for unknown units', () => {
    expect(convertArea(50, 'sq-miles', 'acre')).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// detectAreaUnit
// ---------------------------------------------------------------------------

describe('detectAreaUnit', () => {
  it('detects "acres" as acre', () => expect(detectAreaUnit('acres')).toBe('acre'));
  it('detects "ha" as hectare', () => expect(detectAreaUnit('ha')).toBe('hectare'));
  it('returns null for unknown units', () => expect(detectAreaUnit('square_feet')).toBeNull());
});

// ---------------------------------------------------------------------------
// validateField
// ---------------------------------------------------------------------------

describe('validateField', () => {
  it('passes a valid field', () => {
    const errors: import('../transfer').ValidationError[] = [];
    const valid = validateField(1, { id: 'f1', farmId: 'farm1', name: 'Block A', area: { value: 42, unit: 'acre' } }, errors);
    expect(valid).toBe(true);
    expect(errors.length).toBe(0);
  });

  it('reports missing name', () => {
    const errors: import('../transfer').ValidationError[] = [];
    validateField(1, { farmId: 'farm1', name: '' }, errors);
    expect(errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('reports missing farmId', () => {
    const errors: import('../transfer').ValidationError[] = [];
    validateField(1, { name: 'Block A', farmId: '' }, errors);
    expect(errors.some((e) => e.field === 'farmId')).toBe(true);
  });

  it('reports non-positive area', () => {
    const errors: import('../transfer').ValidationError[] = [];
    validateField(1, { name: 'Block A', farmId: 'f', area: { value: -1, unit: 'acre' } }, errors);
    expect(errors.some((e) => e.field === 'area.value')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateOperation
// ---------------------------------------------------------------------------

describe('validateOperation', () => {
  it('passes a valid operation', () => {
    const errors: import('../transfer').ValidationError[] = [];
    const valid = validateOperation(1, { fieldId: 'f1', date: '2025-04-10', operationType: 'irrigation' }, errors);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('reports missing fieldId', () => {
    const errors: import('../transfer').ValidationError[] = [];
    validateOperation(1, { fieldId: '', date: '2025-04-10' }, errors);
    expect(errors.some((e) => e.field === 'fieldId')).toBe(true);
  });

  it('reports missing date', () => {
    const errors: import('../transfer').ValidationError[] = [];
    validateOperation(1, { fieldId: 'f1', date: '' }, errors);
    expect(errors.some((e) => e.field === 'date')).toBe(true);
  });

  it('reports malformed date', () => {
    const errors: import('../transfer').ValidationError[] = [];
    validateOperation(1, { fieldId: 'f1', date: '04-10-2025' }, errors);
    expect(errors.some((e) => e.field === 'date')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeFieldRow
// ---------------------------------------------------------------------------

describe('normalizeFieldRow', () => {
  const mappings: ColumnMapping[] = [
    { sourceColumn: 'field_name', canonicalField: 'name' },
    { sourceColumn: 'acres', canonicalField: 'areaValue' },
    { sourceColumn: 'unit', canonicalField: 'areaUnit' },
    { sourceColumn: 'crop', canonicalField: 'cropName' },
    { sourceColumn: 'year', canonicalField: 'cropYear' },
  ];

  const row: ParsedCsvRow = {
    field_name: 'Block A',
    acres: '42.3',
    unit: 'acre',
    crop: 'Almond',
    year: '2025',
  };

  it('normalises a valid CSV row into a TransferField', () => {
    const result = normalizeFieldRow(0, row, mappings, [], 'CSV Import', 'farm-001');
    expect(result.field.name).toBe('Block A');
    expect(result.field.area?.value).toBeCloseTo(42.3, 1);
    expect(result.field.area?.unit).toBe('acre');
    expect(result.errors).toHaveLength(0);
  });

  it('attaches a crop season when crop name is present', () => {
    const result = normalizeFieldRow(0, row, mappings, [], 'CSV Import', 'farm-001');
    expect(result.cropSeason?.cropName).toBe('Almond');
    expect(result.cropSeason?.cropYear).toBe(2025);
  });

  it('applies a unit conversion factor', () => {
    const result = normalizeFieldRow(
      0,
      { ...row, unit: 'ha', acres: '10' },
      mappings,
      [{ fieldName: 'areaValue', detectedUnit: 'ha', targetUnit: 'acre', conversionFactor: 2.47105 }],
      'CSV Import',
      'farm-001',
    );
    expect(result.field.area?.value).toBeCloseTo(24.71, 0);
  });
});

// ---------------------------------------------------------------------------
// normalizeOperationRow
// ---------------------------------------------------------------------------

describe('normalizeOperationRow', () => {
  const mappings: ColumnMapping[] = [
    { sourceColumn: 'date', canonicalField: 'date' },
    { sourceColumn: 'op_type', canonicalField: 'operationType' },
  ];

  it('normalises an irrigation operation', () => {
    const result = normalizeOperationRow(
      0,
      { date: '2025-04-10', op_type: 'irrigation' },
      mappings,
      'field-001',
      'CSV Import',
    );
    expect(result.operation.operationType).toBe('irrigation');
    expect(result.operation.date).toBe('2025-04-10');
    expect(result.errors).toHaveLength(0);
  });

  it('maps a planting alias to the planting type', () => {
    const result = normalizeOperationRow(0, { date: '2025-03-01', op_type: 'Seeding' }, mappings, 'f1', 'CSV Import');
    expect(result.operation.operationType).toBe('planting');
  });

  it('defaults unknown op types to other', () => {
    const result = normalizeOperationRow(0, { date: '2025-03-01', op_type: 'unknown-event' }, mappings, 'f1', 'CSV Import');
    expect(result.operation.operationType).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// normalizeGeoJsonBoundaries
// ---------------------------------------------------------------------------

describe('normalizeGeoJsonBoundaries', () => {
  const geojson: GeoJsonFeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'block-001',
        properties: { name: 'Block A', acres: 42.3 },
        geometry: { type: 'Polygon', coordinates: [[[-119.92, 36.74], [-119.91, 36.74], [-119.91, 36.73], [-119.92, 36.73], [-119.92, 36.74]]] },
      },
      {
        type: 'Feature',
        properties: { Name: 'Block B' },
        geometry: { type: 'Polygon', coordinates: [[[-119.9, 36.74], [-119.89, 36.74], [-119.89, 36.73], [-119.9, 36.73], [-119.9, 36.74]]] },
      },
    ],
  };

  it('converts features to TransferFields', () => {
    const result = normalizeGeoJsonBoundaries(geojson, 'GeoJSON Import', 'farm-001');
    expect(result.fields).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('picks up the name from feature properties', () => {
    const result = normalizeGeoJsonBoundaries(geojson, 'GeoJSON Import', 'farm-001');
    expect(result.fields[0].name).toBe('Block A');
    expect(result.fields[1].name).toBe('Block B');
  });

  it('attaches the boundary geometry', () => {
    const result = normalizeGeoJsonBoundaries(geojson, 'GeoJSON Import', 'farm-001');
    expect(result.fields[0].boundary?.type).toBe('Polygon');
  });

  it('reports an error for features with missing geometry', () => {
    const bad: GeoJsonFeatureCollection = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: '', coordinates: null } }],
    };
    const result = normalizeGeoJsonBoundaries(bad, 'GeoJSON Import', 'farm-001');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('reports an error when the root is not a FeatureCollection', () => {
    const notCollection = { type: 'Feature', features: [] } as unknown as GeoJsonFeatureCollection;
    const result = normalizeGeoJsonBoundaries(notCollection, 'GeoJSON Import', 'farm-001');
    expect(result.errors.some((e) => e.field === 'type')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// exportFieldsToCsv
// ---------------------------------------------------------------------------

describe('exportFieldsToCsv', () => {
  it('produces a CSV with expected headers and one data row', () => {
    const fields = [{ id: 'f1', name: 'Block A', farmId: 'farm1', area: { value: 42.3, unit: 'acre' as const }, sourceSystem: 'CSV Import' }];
    const farms = [{ id: 'farm1', organizationId: 'org1', name: 'Sunrise Ranch' }];
    const orgs = [{ id: 'org1', name: 'Acme Farming Co.', type: 'grower' as const }];
    const csv = exportFieldsToCsv(fields, farms, orgs);
    expect(csv).toContain('fieldId');
    expect(csv).toContain('Block A');
    expect(csv).toContain('Sunrise Ranch');
    expect(csv).toContain('Acme Farming Co.');
  });

  it('quotes values containing commas', () => {
    const fields = [{ id: 'f1', name: 'Block A, West', farmId: 'farm1', area: { value: 42, unit: 'acre' as const }, sourceSystem: '' }];
    const csv = exportFieldsToCsv(fields, [{ id: 'farm1', organizationId: 'o1', name: 'Ranch' }], [{ id: 'o1', name: 'Org', type: 'grower' as const }]);
    expect(csv).toContain('"Block A, West"');
  });
});
