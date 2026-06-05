// ---------------------------------------------------------------------------
// GIS overlay engine — deterministic, unit-tested, provider-neutral.
// All overlay values (NDVI, EVI, GDD, ET, frost risk, soil moisture, VRA)
// are generated from a stable seeded hash so the same blockId + season
// always produces the same result. Real external providers (Sentinel, CIMIS,
// IoT MQTT, etc.) are wired via adapter functions in future milestones.
// See docs/gis-overlays.md for architecture and ingestion contracts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Deterministic integer hash of a string (djb2 variant). */
function h(s: string): number {
  let v = 5381;
  for (let i = 0; i < s.length; i++) {
    v = ((v * 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return v;
}

/** Seed combining multiple string keys for independent variation. */
function seed(...parts: string[]): number {
  return h(parts.join('|'));
}

/** Map a hash integer to [0, 1], clamped. */
function norm01(s: number): number {
  return (s % 10_000) / 10_000;
}

// ---------------------------------------------------------------------------
// Crop tables (permanent vs annual, GDD bases, yield baselines)
// Permanent / annual distinction shapes NDVI saturation, GDD base, rotation.
// Refined later via product direction issue #38.
// ---------------------------------------------------------------------------

export type CropClass = 'permanent' | 'annual';

const CROP_CLASS: Record<string, CropClass> = {
  almond: 'permanent', pistachio: 'permanent', walnut: 'permanent',
  citrus: 'permanent', grape: 'permanent', olive: 'permanent',
  tomato: 'annual', corn: 'annual', cotton: 'annual',
  wheat: 'annual', alfalfa: 'annual',
};

const GDD_BASE_C: Record<string, number> = {
  almond: 10, pistachio: 10, walnut: 10, citrus: 13, grape: 10,
  tomato: 10, corn: 10, cotton: 15.6, wheat: 0, alfalfa: 5,
};

/** Approximate season GDD endpoint (hull / harvest). */
const GDD_THRESHOLD: Record<string, number> = {
  almond: 1400, pistachio: 1600, walnut: 1800, citrus: 2000, grape: 1500,
  tomato: 1100, corn: 2700, cotton: 2200, wheat: 1200, alfalfa: 800,
};

/** Available water capacity in in/in by soil type. */
const SOIL_AWC: Record<string, number> = {
  'hanford sandy loam': 0.11,
  'san joaquin loam': 0.16,
  'tujunga loamy sand': 0.09,
  'yolo silt loam': 0.18,
  'merced clay loam': 0.20,
};

/** Season yield baseline kg/ha (SJV typical). */
const YIELD_BASELINE: Record<string, number> = {
  almond: 4100, pistachio: 2950, walnut: 3800, citrus: 32000, grape: 14000,
  tomato: 85000, corn: 12000, cotton: 1200, wheat: 5500, alfalfa: 18000,
};

function cropClass(c: string): CropClass { return CROP_CLASS[c.toLowerCase()] ?? 'annual'; }
function gddBase(c: string): number { return GDD_BASE_C[c.toLowerCase()] ?? 10; }
function gddThreshold(c: string): number { return GDD_THRESHOLD[c.toLowerCase()] ?? 1200; }
function soilAwc(s: string): number { return SOIL_AWC[s.toLowerCase()] ?? 0.14; }
function yieldBaseline(c: string): number { return YIELD_BASELINE[c.toLowerCase()] ?? 4000; }

// ---------------------------------------------------------------------------
// Shared block descriptor
// ---------------------------------------------------------------------------

export interface BlockInput {
  blockId: string;
  cropType: string;
  soilType: string;
  elevationM: number;
  season: string;
  irrigationZone?: string;
}

// ---------------------------------------------------------------------------
// Phase 1 — Vegetation indices (NDVI / EVI)    issue #33
// ---------------------------------------------------------------------------

export type VegetationIndexType = 'ndvi' | 'evi';

export interface VegetationResult {
  blockId: string;
  indexType: VegetationIndexType;
  /** Vegetation index value [0, 1]. 0 if cloud-masked. */
  value: number;
  cloudFree: boolean;
  stressLevel: 'low' | 'moderate' | 'high';
  source: 'mock';
}

/**
 * Deterministic vegetation index for a block + season.
 *
 * Agronomy notes:
 * - Permanent orchards (almond, pistachio, walnut) peak NDVI 0.65–0.85.
 * - EVI reduces canopy-saturation effect in dense orchards → slightly lower.
 * - Wheat shows suppressed values during winter dormancy.
 * - ~10 % of block/season combos receive a synthetic cloud-cover mask.
 */
export function vegetationIndex(b: BlockInput, indexType: VegetationIndexType): VegetationResult {
  const cloudSeed = seed(b.blockId, b.season, 'cloud');
  const cloudFree = (cloudSeed % 10) !== 0;   // ~10 % masked

  const cls = cropClass(b.cropType);
  const valueSeed = seed(b.blockId, b.season, indexType);

  let base = cls === 'permanent' ? 0.62 : 0.45;
  let range = cls === 'permanent' ? 0.23 : 0.35;

  if (b.cropType.toLowerCase() === 'wheat') { base = 0.18; range = 0.30; }
  if (indexType === 'evi' && cls === 'permanent') { base -= 0.07; range *= 0.85; }

  const raw = cloudFree ? base + norm01(valueSeed) * range : 0;
  const value = parseFloat(Math.min(1, Math.max(0, raw)).toFixed(3));

  const stressLevel: VegetationResult['stressLevel'] =
    value > 0.65 ? 'low' : value > 0.45 ? 'moderate' : 'high';

  return { blockId: b.blockId, indexType, value, cloudFree, stressLevel, source: 'mock' };
}

// ---------------------------------------------------------------------------
// Phase 2 — GDD accumulation + microclimate    issue #34
// ---------------------------------------------------------------------------

export interface GddResult {
  blockId: string;
  gddAccumulated: number;
  gddBase: number;
  cropThreshold: number;
  percentComplete: number;  // 0–100
  daysInSeason: number;
  source: 'mock';
}

export interface MicroclimateSummary {
  blockId: string;
  referenceEtMmDay: number;
  frostRiskScore: number;
  frostRiskLevel: 'none' | 'low' | 'moderate' | 'high';
  windSpeedMph: number;
  windDirectionDeg: number;
  source: 'mock';
}

/**
 * Deterministic GDD for a block + season.
 * SJV mean season temp 22–28 °C; elevation discounts 0.6 °C / 100 m.
 */
export function gddAccumulation(b: BlockInput): GddResult {
  const s = seed(b.blockId, b.season, 'gdd');
  const base = gddBase(b.cropType);
  const threshold = gddThreshold(b.cropType);
  const meanTempC = 22 + norm01(s) * 6 - b.elevationM * 0.006;
  const effectiveDegDay = Math.max(0, meanTempC - base);
  const daysSeed = seed(b.blockId, b.season, 'days');
  const daysInSeason = 160 + Math.round(norm01(daysSeed) * 30);
  const gddAccumulated = parseFloat((effectiveDegDay * daysInSeason).toFixed(0));
  const percentComplete = parseFloat(Math.min(100, (gddAccumulated / threshold) * 100).toFixed(1));
  return { blockId: b.blockId, gddAccumulated, gddBase: base, cropThreshold: threshold, percentComplete, daysInSeason, source: 'mock' };
}

/**
 * Microclimate: reference ET, frost risk, wind.
 * Frost risk increases with elevation and seed variability.
 */
export function microclimateSummary(b: BlockInput): MicroclimateSummary {
  const s = seed(b.blockId, b.season, 'mc');
  const etS = seed(b.blockId, b.season, 'et');
  const windS = seed(b.blockId, b.season, 'wind');

  const referenceEtMmDay = parseFloat((3 + norm01(etS) * 5).toFixed(2));

  const elevFactor = Math.min(1, b.elevationM / 300);
  const frostRiskScore = parseFloat(Math.min(1, norm01(s) * 0.4 + elevFactor * 0.6).toFixed(3));
  const frostRiskLevel: MicroclimateSummary['frostRiskLevel'] =
    frostRiskScore > 0.7 ? 'high'
    : frostRiskScore > 0.4 ? 'moderate'
    : frostRiskScore > 0.15 ? 'low'
    : 'none';

  const windSpeedMph = parseFloat((2 + norm01(windS) * 18).toFixed(1));
  const windDirectionDeg = Math.round(norm01(seed(b.blockId, b.season, 'wdir')) * 360);

  return { blockId: b.blockId, referenceEtMmDay, frostRiskScore, frostRiskLevel, windSpeedMph, windDirectionDeg, source: 'mock' };
}

// ---------------------------------------------------------------------------
// Phase 3 — IoT soil moisture probes    issue #35
// ---------------------------------------------------------------------------

export interface ProbeReading {
  depthIn: number;
  vwcPct: number;
}

export interface SoilMoistureResult {
  blockId: string;
  probeId: string;
  readings: ProbeReading[];
  deficitPct: number;
  irrigationNeedIn: number;
  lastReadingAgeHours: number;
  stale: boolean;
  source: 'mock';
}

/**
 * Synthetic probe readings at 12 / 24 / 36 inch depths.
 * Sandy soils dry faster → lower VWC at surface; clay loams hold water better.
 */
export function soilMoistureProbe(b: BlockInput): SoilMoistureResult {
  const awc = soilAwc(b.soilType);
  const fcPct = (awc + 0.05) * 100;  // approximate field capacity %

  const v12 = parseFloat((fcPct * 0.4 + norm01(seed(b.blockId, b.season, 'vwc12')) * fcPct * 0.4).toFixed(1));
  const v24 = parseFloat((fcPct * 0.5 + norm01(seed(b.blockId, b.season, 'vwc24')) * fcPct * 0.3).toFixed(1));
  const v36 = parseFloat((fcPct * 0.6 + norm01(seed(b.blockId, b.season, 'vwc36')) * fcPct * 0.3).toFixed(1));

  const avgVwc = (v12 + v24 + v36) / 3;
  const deficitPct = parseFloat(Math.max(0, 100 - (avgVwc / fcPct) * 100).toFixed(1));
  const irrigationNeedIn = parseFloat((deficitPct * awc * 24 / 100).toFixed(2));

  const ageSeed = seed(b.blockId, b.season, 'age');
  const lastReadingAgeHours = 2 + (ageSeed % 47);
  const stale = lastReadingAgeHours > 24;

  return {
    blockId: b.blockId,
    probeId: `probe-${b.blockId}`,
    readings: [
      { depthIn: 12, vwcPct: v12 },
      { depthIn: 24, vwcPct: v24 },
      { depthIn: 36, vwcPct: v36 },
    ],
    deficitPct,
    irrigationNeedIn,
    lastReadingAgeHours,
    stale,
    source: 'mock',
  };
}

// ---------------------------------------------------------------------------
// Phase 4 — Season timeline snapshot    issue #37
// ---------------------------------------------------------------------------

export interface SeasonSnapshot {
  blockId: string;
  season: string;
  cropType: string;
  irrigationZone: string;
  ndvi: number;
  gddAccumulated: number;
  referenceEtMmDay: number;
  yieldEstimateKgHa: number;
  note: string;
  source: 'mock';
}

const SEASON_NOTES: Record<string, string> = {
  '2021': 'Drought year — reduced irrigation allocation across SJV.',
  '2022': 'Moderate year — above-average spring rain offset ET demand.',
  '2023': 'Wet year — atmospheric river events; delayed planting for annuals.',
  '2024': 'Near-normal year — good early-season moisture.',
  '2025': 'Current season — data through end of growing season.',
};

/**
 * Historical season snapshot for timeline scrubbing.
 * Year modifier simulates drought/wet cycles (even year = +5 %, odd = −3 %).
 */
export function seasonSnapshot(b: BlockInput): SeasonSnapshot {
  const year = parseInt(b.season, 10);
  const yearMod = (year % 2 === 0) ? 1.05 : 0.97;
  const ys = seed(b.blockId, b.season, 'yield');
  const yieldEstimateKgHa = Math.round(yieldBaseline(b.cropType) * yearMod * (0.88 + norm01(ys) * 0.24));

  const veg = vegetationIndex(b, 'ndvi');
  const gdd = gddAccumulation(b);
  const mc = microclimateSummary(b);

  return {
    blockId: b.blockId,
    season: b.season,
    cropType: b.cropType,
    irrigationZone: b.irrigationZone ?? '',
    ndvi: veg.value,
    gddAccumulated: gdd.gddAccumulated,
    referenceEtMmDay: mc.referenceEtMmDay,
    yieldEstimateKgHa,
    note: SEASON_NOTES[b.season] ?? `Season ${b.season}`,
    source: 'mock',
  };
}

// ---------------------------------------------------------------------------
// Phase 5 — VRA prescription export    issue #36
// ---------------------------------------------------------------------------

export interface NutrientRates {
  nitrogenLbAc?: number;
  phosphorusLbAc?: number;
  potassiumLbAc?: number;
  seedLbAc?: number;
}

export interface VraBlockZone {
  blockId: string;
  cropType: string;
  coordinates: number[][];   // GeoJSON polygon ring [[lon, lat], ...]
  rates: NutrientRates;
}

export interface VraExport {
  exportId: string;
  format: 'geojson+csv';
  blockCount: number;
  geojson: object;
  csv: string;
  isoXmlNote: string;
  generatedAt: string;
}

/**
 * Build a VRA prescription (GeoJSON FeatureCollection + CSV) from selected zones.
 * ISO-XML (ISOBUS TaskData) is spiked as future work; see docs/gis-overlays.md.
 */
export function buildVraPrescription(zones: VraBlockZone[]): VraExport {
  const features = zones.map(z => ({
    type: 'Feature',
    id: z.blockId,
    properties: {
      blockId: z.blockId,
      cropType: z.cropType,
      nitrogen_lb_ac: z.rates.nitrogenLbAc ?? 0,
      phosphorus_lb_ac: z.rates.phosphorusLbAc ?? 0,
      potassium_lb_ac: z.rates.potassiumLbAc ?? 0,
      seed_lb_ac: z.rates.seedLbAc ?? 0,
      prescription_source: 'agronomy-studio-mock',
    },
    geometry: { type: 'Polygon', coordinates: [z.coordinates] },
  }));

  const header = 'blockId,cropType,nitrogen_lb_ac,phosphorus_lb_ac,potassium_lb_ac,seed_lb_ac';
  const rows = zones.map(z =>
    [z.blockId, z.cropType, z.rates.nitrogenLbAc ?? 0, z.rates.phosphorusLbAc ?? 0, z.rates.potassiumLbAc ?? 0, z.rates.seedLbAc ?? 0].join(',')
  );

  return {
    exportId: `vra-${Date.now()}`,
    format: 'geojson+csv',
    blockCount: zones.length,
    geojson: { type: 'FeatureCollection', features },
    csv: [header, ...rows].join('\n'),
    isoXmlNote: 'ISO-XML (ISOBUS TaskData) export is planned. See docs/gis-overlays.md for the format compatibility matrix.',
    generatedAt: new Date().toISOString(),
  };
}
