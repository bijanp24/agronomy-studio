export interface FieldSummary {
  fieldId: string;
  fieldName: string;
  crop: string;
  stressScore: number;
  stressLabel: 'low' | 'moderate' | 'high' | 'critical';
  predictedYieldKgPerHa: number;
  confidence: 'low' | 'medium' | 'high';
  topLimitingFactor?: string;
}

export interface DashboardSummary {
  fields: FieldSummary[];
}

export interface Field {
  id: string;
  name: string;
  regionCode: string;
  areaHectares: number;
  boundaryGeoJson: string;
  soilType: string;
  notes: string;
}

export interface FieldsResponse {
  fields: Field[];
}

export interface NutrientEntry {
  soil: number;
  applied: number;
  uptake: number;
  balance: number;
}

export interface NutrientWarning {
  nutrient: string;
  message: string;
}

export interface NutrientBalance {
  n: NutrientEntry;
  p: NutrientEntry;
  k: NutrientEntry;
  warnings: NutrientWarning[];
}

export interface YieldPrediction {
  predictedYieldKgPerHa: number;
  baseline: number;
  factors: {
    seed: number;
    planting: number;
    population: number;
    water: number;
    nutrient: number;
    heat: number;
    uv: number;
  };
  limitingFactors: string[];
  confidence: 'low' | 'medium' | 'high';
  explanation: string;
}

export interface FieldOperation {
  id: string;
  fieldId: string;
  operationType: string;
  timestamp: string;
  inputs: Record<string, unknown>;
  notes: string;
}

export interface OperationsResponse {
  operations: FieldOperation[];
}

export interface SoilTest {
  id: string;
  fieldId: string;
  sampleDate: string;
  soilPh: number;
  organicMatterPercent: number;
  cationExchangeCapacity: number;
  nitrateNppm: number;
  phosphorusPpm: number;
  potassiumPpm: number;
  electricalConductivity: number;
  labName: string;
  notes: string;
}

export interface SoilTestsResponse {
  soilTests: SoilTest[];
}

export interface GeoJsonFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    blockId: string;
    soilType: string;
    elevationM: number;
    irrigationZone: string;
    cropType: string;
    centerLat: number;
    centerLon: number;
  };
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}
