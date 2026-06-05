# GIS Map Overlays

Design reference for the overlay system on the GIS Block Explorer.
Covers the overlay registry, provider-adapter seam, sensor ingestion contract,
VRA format matrix, and accuracy caveats for permanent vs row crops.

---

## Architecture

The overlay pipeline mirrors the established hybrid pattern used by `spatial-api` and `transfer-api`:
deterministic generators in TypeScript with Vitest coverage, wrapped by a Netlify function, called by
a C# service, rendered in Blazor with Google Maps JavaScript API interop.

```
netlify/lib/gis.ts          Pure deterministic generators (seeded hash, no I/O)
    ↓
netlify/functions/gis-api.ts  Route dispatcher → POST /api/gis/{vegetation,microclimate,gdd,soil-moisture,timeline,vra/export}
    ↓
Services/GisOverlayService.cs  Typed HttpClient calling gis-api (or mock server port 4322)
    ↓
Pages/Gis.razor             Overlay registry, season selector, VRA builder, block detail
    ↓
wwwroot/js/interop.js       render() / renderChoropleth() / renderMarkers() / renderHeatmap()
```

All numeric values originate in `gis.ts`. The AI layer may explain results but must never
compute them (same constraint as the rest of the spatial engine).

---

## Overlay Registry

Overlays are defined as a typed array in `Pages/Gis.razor` (`OverlayRegistry`):

| Key         | Label                          | Ramp name   | API endpoint                |
|-------------|--------------------------------|-------------|-----------------------------|
| `crop`      | Crop (default)                 | —           | (no API call)               |
| `elevation` | Elevation heatmap              | —           | (no API call)               |
| `ndvi`      | NDVI — Vegetation vigour       | vegetation  | POST /api/gis/vegetation    |
| `evi`       | EVI — Enhanced vegetation      | vegetation  | POST /api/gis/vegetation    |
| `gdd`       | GDD — Growing degree days      | gdd         | POST /api/gis/gdd           |
| `et`        | ET — Reference evapotranspiration | et       | POST /api/gis/microclimate  |
| `frost`     | Frost risk                     | frost       | POST /api/gis/microclimate  |
| `moisture`  | Soil moisture deficit          | moisture    | POST /api/gis/soil-moisture |

Adding a new overlay requires:
1. A generator function in `netlify/lib/gis.ts` with Vitest tests.
2. A route case in `netlify/functions/gis-api.ts`.
3. A mock route in `tools/mock-apis.mjs` (port 4322).
4. A C# method in `Services/GisOverlayService.cs`.
5. A new entry in the `OverlayRegistry` array and a `case` in `FetchOverlayData` + `GetOverlayValue`.

---

## Provider-Adapter Seam

Every generator in `gis.ts` is built for eventual replacement by a real provider without touching
the Razor page or C# service layer. The adapter contract is:

```typescript
// Today (mock)
export function vegetationIndex(b: BlockInput, indexType: VegetationIndexType): VegetationResult

// Future (real provider)
export async function vegetationIndex(b: BlockInput, indexType: VegetationIndexType): Promise<VegetationResult>
// ↑ wraps Sentinel-2 via Google Earth Engine API or Planet Labs API
//   returning the same VegetationResult shape.
```

The Netlify function (`gis-api.ts`) simply `await`s the generator result — switching from sync to async
is transparent to the caller. No C# or Razor changes needed when a real provider is wired.

### Sentinel-2 integration notes (future milestone)
- Product: Sentinel Hub Process API or Google Earth Engine (ee.ImageCollection 'COPERNICUS/S2_SR').
- Band math: NDVI = (NIR - Red) / (NIR + Red) where NIR = B8, Red = B4.
- EVI = 2.5 × (B8 - B4) / (B8 + 6×B4 - 7.5×B2 + 1).
- Cloud mask: use SCL band (Scene Classification Layer) to flag pixels, set `cloudFree = false`.
- Revisit: 5-day at equator, ~2–3 day with combined Sentinel-2A/B.

---

## IoT Soil Moisture Ingestion Contract (#35)

When wiring real sensor hardware, the ingestion layer must normalize vendor payloads to this schema
before passing to `soilMoistureProbe()` or storing in the warehouse:

```typescript
interface SensorIngestionRecord {
  // Required
  blockId: string;              // Must match GIS feature ID (block-1, block-2 …)
  readingTimestamp: string;     // ISO 8601 UTC
  depthIn: number;              // Sensing depth in inches (12 | 24 | 36)
  vwcPct: number;               // Volumetric water content, 0–100 %

  // Recommended
  sensorSerial?: string;        // Vendor serial / device ID
  batteryPct?: number;          // For stale-badge logic
  soilTempC?: number;           // Useful for refining AWC estimates

  // Derived by ingestion layer (not from sensor)
  lastReadingAgeHours: number;  // Computed at ingestion time
  stale: boolean;               // true if lastReadingAgeHours > 24
}
```

### Supported vendor formats (planned adapters)

| Vendor          | Format          | Adapter status |
|-----------------|-----------------|----------------|
| Sentek EnviroSCAN | Proprietary JSON | Planned        |
| Stevens HydraProbe | Modbus/JSON  | Planned        |
| Irrometer Watermark | SDI-12 / CSV | Planned       |
| Campbell Scientific | TOA5 / CR1000 | Planned     |
| Generic MQTT    | JSON over MQTT  | Planned        |

The Azure Durable Functions pipeline (see `docs/warehouse/04-azure-durable-functions-pipeline.md`)
is the recommended ingestion host for production deployments.

---

## VRA Prescription Format Matrix (#36)

The current export produces a **GeoJSON FeatureCollection + CSV sidecar**.

| Format       | Status        | Notes                                             |
|--------------|---------------|---------------------------------------------------|
| GeoJSON      | ✅ Implemented | Standard; importable in QGIS, ArcGIS, Trimble AG  |
| CSV          | ✅ Implemented | One row per zone; headers match GeoJSON properties |
| Shapefile    | 🔜 Planned     | Use `shapefile` npm package; same properties       |
| ISO-XML (ISOBUS TaskData XML) | 🔜 Planned | Required for John Deere Operations Center, CNH AFS |
| ADAPT (AgGateway) | 🔜 Planned | Vendor-neutral; maps to FieldOp / LoggedData |
| Trimble AgFormat | 🔜 Planned  | `.taskdata` / `.isoxmlTaskData` variant           |

### ISO-XML compatibility spike (preliminary findings)
ISO-XML (ISO 11783 part 6, ISOBUS TaskData) requires:
- `<TSK>` element with a `<TZN>` (treatment zone) per block.
- `<PDV>` elements carrying the rate values as integer codes.
- Coordinate geometry in WGS84 decimal degrees within `<PLN>` / `<LSG>` elements.

A proof-of-concept emitter is feasible using the `fast-xml-parser` or hand-rolled templates.
Estimated effort: 1–2 days once GeoJSON export is stable and acceptance tests are in place.

---

## GIS Accuracy Caveats: Permanent vs Row Crops

### Why this matters
Permanent crops (orchards, vineyards) and row crops behave differently in remote-sensing and GDD models.
Conflating them causes mis-scoring and bad prescriptions.

### NDVI / EVI
| Concern | Permanent (almond, pistachio, walnut) | Annual (tomato, corn, wheat) |
|---------|---------------------------------------|------------------------------|
| Canopy saturation | NDVI saturates above ~0.8; use EVI | NDVI works well in sparse canopy |
| Off-season signal | Orchards retain some green in winter | Row crops are bare soil / residue |
| Cloud mask frequency | Same | Same (~10 % synthetic) |
| Recommendation | Prefer EVI for dense orchards | Either index valid |

### GDD
Permanent crops have multi-year wood-temperature memory effects not captured by a single-season GDD
accumulation model. The current `gddAccumulation()` uses a simplified single-season model sufficient
for mock data and educational display. A production model for almonds, pistachios, and walnuts should
account for chill-hour accumulation (winter), bloom date, and hull-split GDD endpoint.

Product direction issue #38 will refine the crop-classification table (`CROP_CLASS`, `GDD_BASE_C`,
`GDD_THRESHOLD` in `netlify/lib/gis.ts`).

### Rotation semantics (timeline #37)
Row crops rotate annually; a block with tomatoes in 2023 may have wheat in 2024.
The current `seasonSnapshot()` uses the block's *current* crop type for all seasons.
A complete rotation log requires the transfer-hub ingestion contract (see `docs/warehouse/03-soil-operations-yield-facts.md`)
or a manual crop-history table seeded from a field management system.

### Soil moisture
Sandy soils (Tujunga loamy sand, AWC 0.09 in/in) vs clay loams (Merced clay loam, AWC 0.20 in/in)
exhibit ~2× difference in irrigation need for the same VWC reading. The mock uses NRCS-sourced AWC
values keyed by soil-type string; a production adapter should query the NRCS Soil Data Access API
(as done in `netlify/lib/soil.ts`) to get the actual map-unit AWC.

---

## Local development

```bash
node tools/mock-apis.mjs   # Starts gis-api mock on port 4322 (plus all other mock servers)
dotnet run                 # Blazor WASM dev server reads appsettings.Development.json
```

`appsettings.Development.json` (copy from `.example`):
```json
{
  "Api": {
    "GisApi": "http://localhost:4322"
  }
}
```

---

## Verification checklist

- [ ] `npm test` — all `netlify/lib/__tests__/gis.test.ts` tests green (28 tests)
- [ ] `npm run typecheck` — no TypeScript errors
- [ ] `dotnet build -c Release` — 0 errors, 0 warnings
- [ ] `node tools/mock-apis.mjs` — GIS overlay engine starts on port 4322
- [ ] Toggle each overlay in the UI; map re-renders with correct choropleth
- [ ] Season slider scrubs data (different values per season)
- [ ] Block detail panel shows GDD bar, frost chip, probe sparklines
- [ ] Frost alert banner appears when high-risk blocks are present
- [ ] VRA: enter zone-select mode, click blocks, set rates, export GeoJSON + CSV
- [ ] Downloaded files are valid GeoJSON / CSV
