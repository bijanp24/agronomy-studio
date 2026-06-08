export const defaultLocation = {
  latitude: 36.7378,
  longitude: -119.7871
};

export function parseLocation(query) {
  return {
    latitude: Number(query.lat ?? query.latitude ?? defaultLocation.latitude),
    longitude: Number(query.lon ?? query.longitude ?? defaultLocation.longitude)
  };
}

export function buildLocationSummary(query = {}) {
  const location = parseLocation(query);
  const crop = String(query.crop ?? 'almond').trim() || 'almond';
  const today = new Date().toISOString();

  return {
    location,
    county: 'Fresno County',
    resolvedAt: today,
    evapotranspiration: {
      date: today.slice(0, 10),
      stationId: '80',
      stationName: 'Fresno State',
      location,
      eto: 0.28,
      airTempF: 91,
      solarRadiation: 672,
      precipitation: 0,
      source: 'CIMIS mock'
    },
    forecast: [
      { date: today.slice(0, 10), eto: 0.27, precipitation: 0, maxTempF: 93, minTempF: 65, source: 'Open-Meteo mock' },
      { date: addDays(1), eto: 0.29, precipitation: 0, maxTempF: 96, minTempF: 67, source: 'Open-Meteo mock' },
      { date: addDays(2), eto: 0.31, precipitation: 0.02, maxTempF: 98, minTempF: 69, source: 'Open-Meteo mock' }
    ],
    soil: {
      location,
      mapUnitKey: 'CA653-143',
      mapUnitName: 'Hanford sandy loam',
      componentName: 'Hanford',
      texture: 'sandy loam',
      drainageClass: 'well drained',
      hydrologicGroup: 'A',
      availableWaterCapacity: 0.14,
      rootZoneDepthIn: 48,
      source: 'NRCS SSURGO mock'
    },
    waterQuality: [
      {
        wellId: 'GAMA-FRE-042',
        location,
        county: 'Fresno',
        nitrateMgL: 7.8,
        salinityMgL: 510,
        sampleDate: addDays(-21),
        distanceMiles: 3.4,
        source: 'GAMA mock'
      }
    ],
    datasets: [
      {
        id: 'cimis-daily-et',
        title: 'CIMIS daily evapotranspiration',
        organization: 'California Department of Water Resources',
        resourceCount: 4,
        tags: ['water', 'et', 'weather'],
        updated: addDays(-7),
        source: 'CNRA mock'
      }
    ],
    irrigation: buildIrrigationRecommendation(crop),
    warnings: {}
  };
}

export function buildIrrigationRecommendation(cropName = 'almond') {
  const normalizedCrop = cropName.trim() || 'almond';

  return {
    cropName: normalizedCrop,
    eto: 0.28,
    kc: normalizedCrop.toLowerCase().includes('tomato') ? 0.95 : 1.05,
    cropEt: normalizedCrop.toLowerCase().includes('tomato') ? 0.27 : 0.29,
    netIrrigationIn: 1.15,
    grossIrrigationIn: 1.53,
    intervalDays: 4,
    readilyAvailableWaterIn: 3.36,
    forecastRainIn: 0.02,
    systemEfficiency: 0.75,
    heatRisk: true,
    confidence: 'medium',
    notes: [
      'Mock recommendation uses Fresno County summer ET assumptions.',
      'Validate against live CIMIS and soil data before production decisions.'
    ]
  };
}

export function buildSoilWaterBalance(query = {}) {
  const location = parseLocation(query);

  return {
    location,
    availableWaterCapacity: 0.14,
    rootZoneDepthIn: 48,
    totalAvailableWaterIn: 6.72,
    readilyAvailableWaterIn: 3.36,
    recentEtIn: 1.42,
    forecastEtIn: 1.98,
    forecastRainIn: 0.02,
    projectedDeficitIn: 3.38
  };
}

export function buildRiskSummary(query = {}) {
  return {
    location: parseLocation(query),
    heatRisk: true,
    droughtStress: false,
    waterQualityConcern: false,
    notes: [
      'Heat watch is active because max forecast temperature exceeds 95 F.',
      'No water quality threshold was exceeded in the mock record.'
    ]
  };
}

export function buildSearchResult(body = {}) {
  const query = String(body.query ?? 'irrigation recommendation');
  const cropName = String(body.cropName ?? body.crop ?? 'almond');
  const lower = query.toLowerCase();
  const intent = lower.includes('soil')
    ? 'soil_profile'
    : lower.includes('water quality')
      ? 'water_quality'
      : lower.includes('dataset')
        ? 'dataset_discovery'
        : 'irrigation_recommendation';

  return {
    query,
    intent,
    params: {
      latitude: Number(body.latitude ?? defaultLocation.latitude),
      longitude: Number(body.longitude ?? defaultLocation.longitude),
      crop: cropName
    },
    summary: `For ${cropName}, apply about ${buildIrrigationRecommendation(cropName).grossIrrigationIn.toFixed(2)} inches gross irrigation on a 4 day interval while heat risk remains elevated.`,
    data: buildIrrigationRecommendation(cropName),
    sources: ['CIMIS mock', 'Open-Meteo mock', 'NRCS SSURGO mock', 'WUCOLS mock'],
    confidence: 0.84
  };
}

function addDays(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
