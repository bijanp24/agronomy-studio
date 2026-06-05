// ---------------------------------------------------------------------------
// Data Transfer Hub — canonical model, adapters, normalization, validation.
//
// Architecture: Canonical Agronomy Studio Model + adapter layer.
//
//   Competitor CSV / GeoJSON / Shapefile / ISOXML / manual entry
//         ↓
//   Import Adapter Layer  (this file, parseXxx functions)
//         ↓
//   Normalization Engine  (normalizeRow, normalizeGeoJson)
//         ↓
//   Validation Engine     (validateField, validateOperation)
//         ↓
//   Canonical Transfer Model  (Organization / Farm / Field / CropSeason / FieldOperation)
//         ↓
//   Analytics, maps, learning blocks
//
// See issue #47 for acceptance criteria.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Canonical model types
// ---------------------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  type: 'customer' | 'grower' | 'retailer' | 'advisor' | 'cooperative' | 'research';
}

export interface Farm {
  id: string;
  organizationId: string;
  name: string;
  region?: string;
}

export interface AreaValue {
  value: number;
  unit: 'acre' | 'hectare';
}

export interface TransferField {
  id: string;
  farmId: string;
  name: string;
  boundary?: GeoJsonGeometry;
  area?: AreaValue;
  /** Original raw record preserved alongside the normalised record. */
  rawSourceId?: string;
  sourceSystem?: string;
}

export interface GeoJsonGeometry {
  type: string;
  coordinates: unknown;
}

export interface CropSeason {
  id: string;
  fieldId: string;
  cropYear: number;
  cropName: string;
  variety?: string;
}

export interface TransferMeasurement {
  name: string;
  value: number;
  unit: string;
}

export type OperationType =
  | 'planting'
  | 'harvest'
  | 'irrigation'
  | 'fertilizer'
  | 'chemical'
  | 'tillage'
  | 'scouting'
  | 'soil_sample'
  | 'recommendation'
  | 'other';

export interface FieldOperation {
  id: string;
  fieldId: string;
  seasonId?: string;
  operationType: OperationType;
  date: string;
  sourceSystem?: string;
  rawSourceId?: string;
  measurements: TransferMeasurement[];
  notes?: string;
}

// ---------------------------------------------------------------------------
// Column mapping and unit conversion
// ---------------------------------------------------------------------------

export interface ColumnMapping {
  sourceColumn: string;
  canonicalField: string;
}

export interface UnitConversion {
  fieldName: string;
  detectedUnit: string;
  targetUnit: string;
  conversionFactor: number;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationError {
  row: string | number;
  field: string;
  message: string;
}

const ACRE_TO_HECTARE = 0.404686;
const HECTARE_TO_ACRE = 2.47105;

const KNOWN_AREA_UNITS: Record<string, 'acre' | 'hectare'> = {
  acre: 'acre',
  acres: 'acre',
  ac: 'acre',
  hectare: 'hectare',
  hectares: 'hectare',
  ha: 'hectare',
};

const KNOWN_OP_TYPES: Record<string, OperationType> = {
  plant: 'planting',
  planting: 'planting',
  seeding: 'planting',
  harvest: 'harvest',
  harvesting: 'harvest',
  irrigat: 'irrigation',
  irrigation: 'irrigation',
  fertil: 'fertilizer',
  fertilizer: 'fertilizer',
  chemical: 'chemical',
  spray: 'chemical',
  till: 'tillage',
  tillage: 'tillage',
  scout: 'scouting',
  scouting: 'scouting',
  soil: 'soil_sample',
  'soil sample': 'soil_sample',
  soil_sample: 'soil_sample',
  recommendation: 'recommendation',
};

function normaliseOpType(raw: string): OperationType {
  const lower = raw.toLowerCase().trim();
  for (const [key, val] of Object.entries(KNOWN_OP_TYPES)) {
    if (lower.startsWith(key)) return val;
  }
  return 'other';
}

export function convertArea(value: number, fromUnit: string, toUnit: 'acre' | 'hectare'): number {
  const from = KNOWN_AREA_UNITS[fromUnit.toLowerCase().trim()];
  if (!from) return value;
  if (from === toUnit) return value;
  return toUnit === 'hectare' ? value * ACRE_TO_HECTARE : value * HECTARE_TO_ACRE;
}

/** Detect the canonical area unit from a raw unit string. Returns null if unknown. */
export function detectAreaUnit(raw: string): 'acre' | 'hectare' | null {
  return KNOWN_AREA_UNITS[raw.toLowerCase().trim()] ?? null;
}

export function validateField(
  row: number | string,
  field: Partial<TransferField>,
  errors: ValidationError[],
): boolean {
  let valid = true;
  if (!field.name?.trim()) {
    errors.push({ row, field: 'name', message: 'Field name is required' });
    valid = false;
  }
  if (!field.farmId?.trim()) {
    errors.push({ row, field: 'farmId', message: 'Farm reference (farmId) is required' });
    valid = false;
  }
  if (field.area) {
    if (field.area.value <= 0) {
      errors.push({ row, field: 'area.value', message: `Area value must be positive (got ${field.area.value})` });
      valid = false;
    }
    if (field.area.value > 100_000) {
      errors.push({ row, field: 'area.value', message: `Area value ${field.area.value} is implausibly large` });
      valid = false;
    }
  }
  if (field.boundary) {
    const coords = (field.boundary as GeoJsonGeometry).coordinates;
    if (!coords) {
      errors.push({ row, field: 'boundary.coordinates', message: 'Boundary is missing coordinates' });
      valid = false;
    }
  }
  return valid;
}

export function validateOperation(
  row: number | string,
  op: Partial<FieldOperation>,
  errors: ValidationError[],
): boolean {
  let valid = true;
  if (!op.fieldId?.trim()) {
    errors.push({ row, field: 'fieldId', message: 'fieldId is required' });
    valid = false;
  }
  if (!op.date?.trim()) {
    errors.push({ row, field: 'date', message: 'date is required' });
    valid = false;
  } else if (!/^\d{4}-\d{2}-\d{2}/.test(op.date)) {
    errors.push({ row, field: 'date', message: `date must start with ISO format YYYY-MM-DD (got "${op.date}")` });
    valid = false;
  } else {
    const d = new Date(op.date);
    if (isNaN(d.getTime())) {
      errors.push({ row, field: 'date', message: `date "${op.date}" is not a valid date` });
      valid = false;
    }
    if (d.getFullYear() < 1900 || d.getFullYear() > new Date().getFullYear() + 2) {
      errors.push({ row, field: 'date', message: `date "${op.date}" is outside plausible range` });
      valid = false;
    }
  }
  return valid;
}

// ---------------------------------------------------------------------------
// CSV parsing — minimal, no external dependency
// ---------------------------------------------------------------------------

export interface ParsedCsvRow {
  [column: string]: string;
}

/** Parse a simple CSV string into an array of row objects. */
export function parseCsvText(csv: string): { headers: string[]; rows: ParsedCsvRow[] } {
  const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows: ParsedCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: ParsedCsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ---------------------------------------------------------------------------
// Column mapping — suggest canonical mappings from common source column names
// ---------------------------------------------------------------------------

const COLUMN_ALIASES: Record<string, string> = {
  // Field name aliases
  field_name: 'name',
  fieldname: 'name',
  field: 'name',
  block: 'name',
  'field name': 'name',
  'block name': 'name',

  // Farm aliases
  farm_name: 'farmName',
  farm: 'farmName',
  ranch: 'farmName',
  'farm name': 'farmName',
  operation: 'farmName',

  // Grower / org aliases
  grower: 'growerName',
  grower_name: 'growerName',
  producer: 'growerName',
  customer: 'growerName',
  org: 'growerName',

  // Area aliases
  area: 'areaValue',
  acres: 'areaValue',
  hectares: 'areaValue',
  size: 'areaValue',
  field_size: 'areaValue',

  // Area unit aliases
  area_unit: 'areaUnit',
  unit: 'areaUnit',
  units: 'areaUnit',

  // Crop aliases
  crop: 'cropName',
  crop_name: 'cropName',
  commodity: 'cropName',

  // Variety aliases
  variety: 'variety',
  hybrid: 'variety',
  cultivar: 'variety',

  // Crop year aliases
  year: 'cropYear',
  crop_year: 'cropYear',
  season: 'cropYear',

  // Operation aliases
  operation_type: 'operationType',
  op_type: 'operationType',
  activity: 'operationType',
  activity_type: 'operationType',

  // Date aliases
  date: 'date',
  op_date: 'date',
  activity_date: 'date',
  operation_date: 'date',
  applied_date: 'date',
};

export function suggestColumnMappings(headers: string[]): ColumnMapping[] {
  return headers.map((h) => ({
    sourceColumn: h,
    canonicalField: COLUMN_ALIASES[h.toLowerCase().trim()] ?? h,
  }));
}

// ---------------------------------------------------------------------------
// Normalisation — CSV row → canonical TransferField / FieldOperation
// ---------------------------------------------------------------------------

export interface NormalisedFieldRow {
  field: Partial<TransferField>;
  cropSeason?: Partial<CropSeason>;
  errors: ValidationError[];
}

export function normalizeFieldRow(
  rowIndex: number,
  row: ParsedCsvRow,
  mappings: ColumnMapping[],
  unitConversions: UnitConversion[],
  sourceSystem: string,
  defaultFarmId: string,
): NormalisedFieldRow {
  const mapped: Record<string, string> = {};
  for (const m of mappings) {
    const val = row[m.sourceColumn] ?? '';
    mapped[m.canonicalField] = val;
  }

  const areaRaw = parseFloat(mapped['areaValue'] ?? '');
  const areaUnitRaw = mapped['areaUnit'] ?? 'acre';
  const targetAreaUnit = detectAreaUnit(areaUnitRaw) ?? 'acre';
  const uc = unitConversions.find((u) => u.fieldName === 'areaValue');
  const areaValue = isNaN(areaRaw) ? undefined : areaRaw * (uc?.conversionFactor ?? 1);

  const field: Partial<TransferField> = {
    id: `field-${rowIndex}-${Date.now()}`,
    farmId: mapped['farmId'] ?? defaultFarmId,
    name: mapped['name'] ?? mapped['fieldName'] ?? `Field ${rowIndex + 1}`,
    area: areaValue !== undefined ? { value: areaValue, unit: targetAreaUnit } : undefined,
    rawSourceId: String(rowIndex + 1),
    sourceSystem,
  };

  const cropYearRaw = parseInt(mapped['cropYear'] ?? '');
  const cropSeason: Partial<CropSeason> | undefined =
    mapped['cropName']
      ? {
          id: `season-${rowIndex}-${Date.now()}`,
          fieldId: field.id!,
          cropYear: isNaN(cropYearRaw) ? new Date().getFullYear() : cropYearRaw,
          cropName: mapped['cropName'],
          variety: mapped['variety'] || undefined,
        }
      : undefined;

  const errors: ValidationError[] = [];
  validateField(rowIndex + 1, field, errors);

  return { field, cropSeason, errors };
}

export interface NormalisedOperationRow {
  operation: Partial<FieldOperation>;
  errors: ValidationError[];
}

export function normalizeOperationRow(
  rowIndex: number,
  row: ParsedCsvRow,
  mappings: ColumnMapping[],
  fieldId: string,
  sourceSystem: string,
): NormalisedOperationRow {
  const mapped: Record<string, string> = {};
  for (const m of mappings) {
    const val = row[m.sourceColumn] ?? '';
    mapped[m.canonicalField] = val;
  }

  const operation: Partial<FieldOperation> = {
    id: `op-${rowIndex}-${Date.now()}`,
    fieldId: mapped['fieldId'] ?? fieldId,
    operationType: normaliseOpType(mapped['operationType'] ?? ''),
    date: mapped['date'] ?? '',
    sourceSystem,
    rawSourceId: String(rowIndex + 1),
    measurements: [],
    notes: mapped['notes'] || undefined,
  };

  const errors: ValidationError[] = [];
  validateOperation(rowIndex + 1, operation, errors);

  return { operation, errors };
}

// ---------------------------------------------------------------------------
// GeoJSON boundary importer
// ---------------------------------------------------------------------------

export interface GeoJsonFeatureCollection {
  type: string;
  features: GeoJsonFeature[];
}

export interface GeoJsonFeature {
  type: string;
  id?: string;
  properties?: Record<string, unknown>;
  geometry: GeoJsonGeometry;
}

export interface NormalisedBoundaryResult {
  fields: Partial<TransferField>[];
  errors: ValidationError[];
}

export function normalizeGeoJsonBoundaries(
  geojson: GeoJsonFeatureCollection,
  sourceSystem: string,
  defaultFarmId: string,
): NormalisedBoundaryResult {
  const fields: Partial<TransferField>[] = [];
  const errors: ValidationError[] = [];

  if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    errors.push({ row: 'root', field: 'type', message: 'Expected a GeoJSON FeatureCollection' });
    return { fields, errors };
  }

  for (let i = 0; i < geojson.features.length; i++) {
    const feature = geojson.features[i];
    const props = feature.properties ?? {};
    const name =
      (props['name'] as string) ??
      (props['field_name'] as string) ??
      (props['Name'] as string) ??
      (feature.id ? String(feature.id) : `Field ${i + 1}`);

    if (!feature.geometry?.type || !feature.geometry?.coordinates) {
      errors.push({ row: i + 1, field: 'geometry', message: `Feature ${i + 1} is missing a valid geometry` });
      continue;
    }

    const field: Partial<TransferField> = {
      id: `field-geo-${i}-${Date.now()}`,
      farmId: defaultFarmId,
      name,
      boundary: feature.geometry,
      sourceSystem,
      rawSourceId: feature.id ? String(feature.id) : String(i + 1),
    };
    fields.push(field);
  }

  return { fields, errors };
}

// ---------------------------------------------------------------------------
// Migration report builder
// ---------------------------------------------------------------------------

export interface ImportSession {
  importId: string;
  sourceSystem: string;
  status: 'pending' | 'validated' | 'committed' | 'failed';
  created: number;
  updated: number;
  skipped: number;
  conflicted: number;
  errors: ValidationError[];
  organizations: Organization[];
  farms: Farm[];
  fields: Partial<TransferField>[];
  operations: Partial<FieldOperation>[];
}

export function buildMigrationReport(session: ImportSession): {
  importId: string;
  completedAt: string;
  created: number;
  updated: number;
  skipped: number;
  conflicted: number;
  errors: ValidationError[];
  organizations: Organization[];
  farms: Farm[];
  fields: Partial<TransferField>[];
} {
  return {
    importId: session.importId,
    completedAt: new Date().toISOString(),
    created: session.created,
    updated: session.updated,
    skipped: session.skipped,
    conflicted: session.conflicted,
    errors: session.errors,
    organizations: session.organizations,
    farms: session.farms,
    fields: session.fields,
  };
}

// ---------------------------------------------------------------------------
// Export — CSV serialisation
// ---------------------------------------------------------------------------

export function exportFieldsToCsv(
  fields: Partial<TransferField>[],
  farms: Farm[],
  organisations: Organization[],
): string {
  const farmMap = new Map(farms.map((f) => [f.id, f]));
  const orgMap = new Map(organisations.map((o) => [o.id, o]));

  const headers = ['fieldId', 'fieldName', 'farmId', 'farmName', 'organizationId', 'organizationName', 'areaValue', 'areaUnit', 'sourceSystem'];
  const rows = fields.map((f) => {
    const farm = farmMap.get(f.farmId ?? '');
    const org = farm ? orgMap.get(farm.organizationId) : undefined;
    return [
      f.id ?? '',
      f.name ?? '',
      f.farmId ?? '',
      farm?.name ?? '',
      farm?.organizationId ?? '',
      org?.name ?? '',
      f.area?.value?.toString() ?? '',
      f.area?.unit ?? '',
      f.sourceSystem ?? '',
    ];
  });

  const escape = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [headers.join(','), ...rows.map((r) => r.map(escape).join(','))];
  return lines.join('\n');
}
