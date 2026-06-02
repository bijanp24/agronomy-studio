const fields = [
  {
    id: 'field-001',
    name: 'Fresno North 12',
    regionCode: 'CA-SJV',
    areaHectares: 48.6,
    boundaryGeoJson: '',
    soilType: 'Hanford sandy loam',
    notes: 'Early-season almond block with moderate water stress.',
    crop: 'almond',
    stressScore: 72,
    stressLabel: 'high',
    predictedYieldKgPerHa: 4120,
    confidence: 'high',
    topLimitingFactor: 'water',
  },
  {
    id: 'field-002',
    name: 'Madera West 7',
    regionCode: 'CA-SJV',
    areaHectares: 36.2,
    boundaryGeoJson: '',
    soilType: 'San Joaquin loam',
    notes: 'Processing tomato field with strong nutrient profile.',
    crop: 'tomato',
    stressScore: 38,
    stressLabel: 'moderate',
    predictedYieldKgPerHa: 86500,
    confidence: 'medium',
    topLimitingFactor: 'heat',
  },
  {
    id: 'field-003',
    name: 'Kings East 4',
    regionCode: 'CA-SJV',
    areaHectares: 61.8,
    boundaryGeoJson: '',
    soilType: 'Tujunga loamy sand',
    notes: 'Pistachio block trending stable after irrigation adjustment.',
    crop: 'pistachio',
    stressScore: 21,
    stressLabel: 'low',
    predictedYieldKgPerHa: 2980,
    confidence: 'high',
    topLimitingFactor: 'nutrient',
  },
];

function sendJson(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    },
    body: JSON.stringify(body),
  };
}

function functionPath(event) {
  const path = event.path ?? '/';
  // Strip whichever prefix is present: the direct function URL
  // (/.netlify/functions/field-api/...) or the public redirect path (/field-api/...).
  const markers = ['/.netlify/functions/field-api', '/field-api'];
  for (const marker of markers) {
    const index = path.indexOf(marker);
    if (index >= 0) {
      return path.slice(index + marker.length) || '/';
    }
  }
  return path;
}

function fieldById(fieldId) {
  return fields.find(field => field.id === fieldId) ?? fields[0];
}

export async function handler(event) {
  const pathname = functionPath(event);
  const parts = pathname.split('/').filter(Boolean);

  if (pathname === '/api/dashboard/summary') {
    return sendJson(200, {
      fields: fields.map(field => ({
        fieldId: field.id,
        fieldName: field.name,
        crop: field.crop,
        stressScore: field.stressScore,
        stressLabel: field.stressLabel,
        predictedYieldKgPerHa: field.predictedYieldKgPerHa,
        confidence: field.confidence,
        topLimitingFactor: field.topLimitingFactor,
      })),
    });
  }

  if (pathname === '/api/fields') {
    return sendJson(200, {
      fields: fields.map(
        ({
          crop,
          stressScore,
          stressLabel,
          predictedYieldKgPerHa,
          confidence,
          topLimitingFactor,
          ...field
        }) => field,
      ),
    });
  }

  if (parts[0] === 'api' && parts[1] === 'fields' && parts[2]) {
    const field = fieldById(parts[2]);

    if (parts.length === 3) {
      const {
        crop,
        stressScore,
        stressLabel,
        predictedYieldKgPerHa,
        confidence,
        topLimitingFactor,
        ...fieldDetails
      } = field;
      return sendJson(200, { field: fieldDetails });
    }

    if (parts[3] === 'nutrient-balance') {
      return sendJson(200, {
        n: { soil: 38, applied: 112, uptake: 121, balance: 29 },
        p: { soil: 22, applied: 36, uptake: 41, balance: 17 },
        k: { soil: 185, applied: 74, uptake: 92, balance: 167 },
        warnings: [{ nutrient: 'N', message: `${field.name} is close to the lower nitrogen buffer.` }],
      });
    }

    if (parts[3] === 'yield-prediction') {
      return sendJson(200, {
        predictedYieldKgPerHa: field.predictedYieldKgPerHa,
        baseline: Math.round(field.predictedYieldKgPerHa * 0.93),
        factors: {
          seed: 0.89,
          planting: 0.94,
          population: 0.91,
          water: field.topLimitingFactor === 'water' ? 0.62 : 0.84,
          nutrient: field.topLimitingFactor === 'nutrient' ? 0.68 : 0.88,
          heat: field.topLimitingFactor === 'heat' ? 0.66 : 0.81,
          uv: 0.77,
        },
        limitingFactors: [field.topLimitingFactor ?? 'water'],
        confidence: field.confidence,
        explanation: `${field.name} is modeled against current soil, operation, heat, and water signals.`,
      });
    }

    if (parts[3] === 'operations') {
      return sendJson(200, {
        operations: [
          {
            id: `${field.id}-op-001`,
            fieldId: field.id,
            operationType: 'Irrigation',
            timestamp: '2026-05-25T15:00:00.000Z',
            inputs: { hours: 8, method: 'drip' },
            notes: 'Adjusted set length after pressure check.',
          },
          {
            id: `${field.id}-op-002`,
            fieldId: field.id,
            operationType: 'Fertigation',
            timestamp: '2026-05-20T14:00:00.000Z',
            inputs: { nKgHa: 18 },
            notes: 'Low-rate nitrogen maintenance pass.',
          },
        ],
      });
    }

    if (parts[3] === 'soil-tests') {
      return sendJson(200, {
        soilTests: [
          {
            id: `${field.id}-soil-001`,
            fieldId: field.id,
            sampleDate: '2026-05-11',
            soilPh: 6.8,
            organicMatterPercent: 1.9,
            cationExchangeCapacity: 12.4,
            nitrateNppm: 18,
            phosphorusPpm: 24,
            potassiumPpm: 186,
            electricalConductivity: 0.8,
            labName: 'Central Valley Agronomy Lab',
            notes: 'Representative composite sample.',
          },
        ],
      });
    }
  }

  if (pathname === '/api/gis/blocks') {
    return sendJson(200, {
      type: 'FeatureCollection',
      features: fields.map((field, index) => {
        const centerLat = 36.64 + index * 0.09;
        const centerLon = -119.88 + index * 0.11;
        const offset = 0.025;
        return {
          type: 'Feature',
          id: `block-${index + 1}`,
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [centerLon - offset, centerLat - offset],
                [centerLon + offset, centerLat - offset],
                [centerLon + offset, centerLat + offset],
                [centerLon - offset, centerLat + offset],
                [centerLon - offset, centerLat - offset],
              ],
            ],
          },
          properties: {
            blockId: `SJV-${index + 1}`,
            soilType: field.soilType,
            elevationM: 85 + index * 18,
            irrigationZone: index % 2 === 0 ? 'North Canal' : 'West Lift',
            cropType: field.crop,
            centerLat,
            centerLon,
          },
        };
      }),
    });
  }

  return sendJson(404, { error: `No mock route for ${pathname}` });
}
