import { fetchJson, type Logger } from './http';
import type { GeoPoint, SoilProfile } from './models';
import { cmToInches, clamp, round } from './units';

const SDA_ENDPOINT = 'https://sdmdataaccess.sc.egov.usda.gov/tabular/post.rest';
const DEFAULT_ROOT_ZONE_CM = 150;

interface SdaTableResponse {
  Table?: Array<Array<string | null>>;
}

/**
 * Run a Soil Data Access SQL query against the SSURGO database. SDA returns a
 * `Table` array whose first row is the column names (JSON+COLUMNNAME format);
 * this reshapes the remaining rows into keyed objects.
 */
export async function querySda(sql: string, logger?: Logger): Promise<Array<Record<string, string | null>>> {
  const json = await fetchJson<SdaTableResponse>(SDA_ENDPOINT, {
    label: 'NRCS SDA',
    logger,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: sql, format: 'JSON+COLUMNNAME' }),
  });

  const table = json.Table;
  if (!Array.isArray(table) || table.length < 2) return [];
  const [columns, ...rows] = table;
  return rows.map((row) => {
    const record: Record<string, string | null> = {};
    columns.forEach((col, index) => {
      record[String(col)] = row[index] ?? null;
    });
    return record;
  });
}

function pointWkt(point: GeoPoint): string {
  return `point(${point.longitude} ${point.latitude})`;
}

function numberOrUndefined(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

const MUAGGATT_SQL = (wkt: string) => `
SELECT TOP 1 m.mukey, m.muname, mu.aws0150wta, mu.drclassdcd, mu.hydgrpdcd, mu.brockdepmin
FROM mapunit AS m
INNER JOIN muaggatt AS mu ON mu.mukey = m.mukey
WHERE m.mukey IN (SELECT mukey FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('${wkt}'))
ORDER BY mu.aws0150wta DESC`;

const TEXTURE_SQL = (wkt: string) => `
SELECT TOP 1 c.compname, c.comppct_r, t.texdesc
FROM legend AS l
INNER JOIN mapunit AS m ON m.lkey = l.lkey
INNER JOIN component AS c ON c.mukey = m.mukey
INNER JOIN chorizon AS ch ON ch.cokey = c.cokey
INNER JOIN chtexturegrp AS t ON t.chkey = ch.chkey
WHERE m.mukey IN (SELECT mukey FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('${wkt}'))
  AND t.rvindicator = 'Yes'
ORDER BY c.comppct_r DESC, ch.hzdept_r ASC`;

export interface SoilQueryOptions {
  logger?: Logger;
}

/** Resolve a normalized soil profile for a WGS84 point via SSURGO. */
export async function getSoilProfile(point: GeoPoint, options: SoilQueryOptions = {}): Promise<SoilProfile | null> {
  const wkt = pointWkt(point);
  const rows = await querySda(MUAGGATT_SQL(wkt), options.logger);
  const row = rows[0];
  if (!row) return null;

  const awsCm = numberOrUndefined(row['aws0150wta']); // cm of water in the top 150 cm
  const availableWaterCapacity = awsCm !== undefined ? clamp(awsCm / DEFAULT_ROOT_ZONE_CM, 0.02, 0.4) : 0.15;

  const bedrockCm = numberOrUndefined(row['brockdepmin']);
  const rootZoneCm = bedrockCm !== undefined ? Math.min(bedrockCm, DEFAULT_ROOT_ZONE_CM) : DEFAULT_ROOT_ZONE_CM;

  let componentName: string | undefined;
  let texture: string | undefined;
  try {
    const texRows = await querySda(TEXTURE_SQL(wkt), options.logger);
    if (texRows[0]) {
      componentName = texRows[0]['compname'] ?? undefined;
      texture = texRows[0]['texdesc'] ?? undefined;
    }
  } catch (err) {
    options.logger?.warn('soil texture lookup failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    location: point,
    mapUnitKey: row['mukey'] ?? undefined,
    mapUnitName: row['muname'] ?? undefined,
    componentName,
    texture,
    drainageClass: row['drclassdcd'] ?? undefined,
    hydrologicGroup: row['hydgrpdcd'] ?? undefined,
    availableWaterCapacity: round(availableWaterCapacity, 3),
    rootZoneDepthIn: round(cmToInches(rootZoneCm), 1),
    source: 'NRCS SSURGO',
  };
}
