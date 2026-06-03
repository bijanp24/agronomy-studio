\# California Agronomy Microservices Platform

\#\# Purpose

This project is a California-focused agronomy software platform that connects to public government, academic, and open-data APIs. The goal is to build microservices and gateways that can answer practical crop-management questions about irrigation, evapotranspiration, soil conditions, crop coefficients, land use, water quality, and regulatory risk.

The platform should also include an AI-powered search box using OpenAI and Gemini. A user should be able to ask natural-language questions like:

\`\`\`text  
How much should I irrigate almonds near Fresno this week?  
\`\`\`

\`\`\`text  
What is the soil water capacity for this field?  
\`\`\`

\`\`\`text  
Show nitrate risk near this location.  
\`\`\`

\`\`\`text  
Find California datasets about crop water efficiency.  
\`\`\`

The frontend should not call each external API directly. Instead, the frontend should call an internal agronomy gateway. The gateway will call the correct microservices, normalize the data, and return useful agronomy summaries.

\---

\# Architecture Overview

The platform should be organized around small services. Each service wraps one major external data source or one major data domain.

\`\`\`text  
Frontend / Web Client  
        |  
        v  
Agronomy Gateway Service  
        |  
        |-- irrigation-cimis-service  
        |-- forecast-et-service  
        |-- soil-data-service  
        |-- crop-water-coefficient-service  
        |-- cnra-open-data-service  
        |-- water-quality-compliance-service  
        |-- ai-agronomy-search-service  
\`\`\`

The main pattern is:

1\. The user asks a question in the app.  
2\. The AI search service classifies the question.  
3\. The gateway calls the correct internal services.  
4\. Each service calls one or more public APIs or local datasets.  
5\. The gateway returns a normalized answer.  
6\. The AI search box summarizes the result in plain English with source metadata.

\---

\# Service 1: \`irrigation-cimis-service\`

\#\# External Data Source

\*\*CIMIS Web API\*\*    
Provider: California Department of Water Resources

CIMIS is the foundational California irrigation data source. It provides reference evapotranspiration, weather station data, air temperature, solar radiation, wind speed, humidity, and other weather values. CIMIS also includes Spatial CIMIS, which provides gridded evapotranspiration and solar radiation data across California.

\#\# Why This Matters

Reference evapotranspiration, usually written as \`ETo\`, is the base number used to estimate how much water a crop is losing to the atmosphere. To estimate crop water use, the system multiplies reference evapotranspiration by a crop coefficient.

\`\`\`text  
Crop ET \= Reference ETo × Crop Coefficient  
\`\`\`

This makes CIMIS one of the most important services in the whole platform.

\#\# Internal Endpoints

\`\`\`http  
GET /api/cimis/stations  
GET /api/cimis/eto/current?lat={lat}\&lon={lon}  
GET /api/cimis/eto/history?lat={lat}\&lon={lon}\&start={date}\&end={date}  
GET /api/cimis/weather?stationId={stationId}\&start={date}\&end={date}  
GET /api/cimis/spatial?lat={lat}\&lon={lon}\&date={date}  
\`\`\`

\#\# Shared Model

\`\`\`ts  
type EvapotranspirationReading \= {  
  source: "CIMIS";  
  date: string;  
  lat?: number;  
  lon?: number;  
  stationId?: string;  
  eto: number;  
  solarRadiation?: number;  
  airTemperature?: number;  
  windSpeed?: number;  
  humidity?: number;  
  soilTemperature?: number;  
};  
\`\`\`

\#\# Cursor Agent Task

Create a microservice that wraps the CIMIS API. Normalize station-based and spatial CIMIS results into a single \`EvapotranspirationReading\` model. This service should be the first real implementation milestone because CIMIS is central to irrigation scheduling.

\---

\# Service 2: \`forecast-et-service\`

\#\# External Data Source

\*\*National Weather Service / NDFD Forecast Reference Evapotranspiration\*\*

The forecast evapotranspiration service should provide predictive irrigation data. The idea is to estimate crop water demand over the next 1 to 7 days using forecast reference evapotranspiration.

\#\# Important Implementation Note

The NWS FRET data source should be verified during implementation. Some FRET documentation is old, scattered, or region-specific. Do not hard-code the system too tightly to one endpoint until the endpoint is tested.

Design this service as a replaceable adapter. If NWS FRET is difficult to use directly, this service can later swap in another forecast ET provider such as NOAA, Climate Engine, Open-Meteo, or another weather forecast API.

\#\# Internal Endpoints

\`\`\`http  
GET /api/fret/forecast?lat={lat}\&lon={lon}  
GET /api/fret/forecast/daily?lat={lat}\&lon={lon}\&days=7  
GET /api/fret/forecast/weekly?lat={lat}\&lon={lon}  
\`\`\`

\#\# Shared Model

\`\`\`ts  
type ForecastEtReading \= {  
  source: "NWS\_FRET";  
  date: string;  
  lat: number;  
  lon: number;  
  forecastEto: number;  
  forecastWindowDays: number;  
  confidence?: number;  
};  
\`\`\`

\#\# Cursor Agent Task

Create a forecast evapotranspiration adapter. Verify the NWS FRET endpoint before finalizing the implementation. Keep the adapter swappable so another forecast ET source can replace it later.

\---

\# Service 3: \`soil-data-service\`

\#\# External Data Source

\*\*USDA NRCS Soil Data Access / SSURGO\*\*

SSURGO is the major U.S. soil survey database. It contains soil map units and soil properties such as texture, organic matter, drainage class, available water capacity, hydrologic group, and other field-relevant values.

\#\# Why This Matters

Soil controls how much water can be stored in the root zone. Irrigation recommendations should not only ask, “How much water did the crop use?” They should also ask, “How much water can this soil safely hold?”

For example, sandy soil drains quickly and holds less water. Clay soil may hold more water but can create drainage and infiltration problems. Soil available water capacity helps limit the maximum irrigation depth.

\#\# Internal Endpoints

\`\`\`http  
GET /api/soil/lookup?lat={lat}\&lon={lon}  
POST /api/soil/lookup/polygon  
GET /api/soil/water-capacity?lat={lat}\&lon={lon}  
GET /api/soil/drainage?lat={lat}\&lon={lon}  
GET /api/soil/texture?lat={lat}\&lon={lon}  
\`\`\`

\#\# Shared Model

\`\`\`ts  
type SoilProfile \= {  
  source: "USDA\_NRCS\_SSURGO";  
  lat: number;  
  lon: number;  
  mapUnitKey?: string;  
  mapUnitName?: string;  
  texture?: string;  
  drainageClass?: string;  
  availableWaterCapacity?: number;  
  organicMatter?: number;  
  hydrologicGroup?: string;  
  rootZoneDepth?: number;  
};  
\`\`\`

\#\# Cursor Agent Task

Create a soil lookup service that queries NRCS Soil Data Access. Given a coordinate or polygon, return irrigation-relevant soil properties. Prioritize available water capacity, texture, drainage class, hydrologic group, and root-zone depth.

\---

\# Service 4: \`crop-water-coefficient-service\`

\#\# External Data Source

\*\*UC Davis / WUCOLS crop and landscape water-use data\*\*

This service should provide crop coefficients, plant factors, water-use classes, and regional California crop or landscape water-use guidance.

\#\# Important Implementation Note

This may not be a clean REST API. Treat this service as an ingestion service first. The data may exist as PDFs, spreadsheets, static tables, CSV files, or downloadable databases.

If there is no official REST API, build a local ingestion pipeline and store the crop coefficients in the application database.

\#\# Internal Endpoints

\`\`\`http  
GET /api/crops/search?q={cropName}  
GET /api/crops/{cropId}/water-coefficients  
GET /api/crops/{cropId}/regions/{regionId}/kc  
GET /api/crops/recommend?lat={lat}\&lon={lon}\&crop={cropName}  
\`\`\`

\#\# Shared Model

\`\`\`ts  
type CropWaterCoefficient \= {  
  source: "UC\_DAVIS\_WUCOLS";  
  cropName: string;  
  region?: string;  
  cropCoefficient?: number;  
  plantFactor?: number;  
  waterUseClass?: "very\_low" | "low" | "moderate" | "high";  
  notes?: string;  
};  
\`\`\`

\#\# Cursor Agent Task

Build a crop coefficient service. First verify whether WUCOLS or UC Davis has machine-readable data. If no public API exists, create an ingestion pipeline that imports crop water-use tables into the local database.

\---

\# Service 5: \`cnra-open-data-service\`

\#\# External Data Source

\*\*California Natural Resources Agency Open Data API\*\*

The CNRA Open Data platform is CKAN-backed. CKAN APIs can expose dataset metadata, resource links, tags, organizations, and sometimes queryable datastore records.

\#\# Why This Matters

CNRA datasets can help the platform discover statewide data about irrigation systems, groundwater, agricultural land use, water efficiency, basin-level data, hydrology, and natural-resource planning.

\#\# Internal Endpoints

\`\`\`http  
GET /api/cnra/datasets/search?q={query}  
GET /api/cnra/datasets/{datasetId}  
GET /api/cnra/agriculture/land-use?county={county}  
GET /api/cnra/groundwater/search?basin={basin}  
GET /api/cnra/water-efficiency/search?q={query}  
\`\`\`

\#\# Shared Model

\`\`\`ts  
type OpenDataDataset \= {  
  source: "CNRA\_CKAN";  
  datasetId: string;  
  title: string;  
  description?: string;  
  tags: string\[\];  
  organization?: string;  
  resources: {  
    name: string;  
    format: string;  
    url: string;  
  }\[\];  
};  
\`\`\`

\#\# Cursor Agent Task

Create a CKAN client for CNRA Open Data. Add dataset search, dataset metadata retrieval, and resource discovery. Prioritize datasets related to irrigation, groundwater, land use, crop water use, hydrology, and agricultural efficiency.

\---

\# Service 6: \`water-quality-compliance-service\`

\#\# External Data Sources

\*\*California State Water Resources Control Board / GeoTracker / Irrigated Lands Regulatory Program-related data\*\*

This service should handle water quality, salinity, nitrate tracking, groundwater monitoring, agricultural runoff, and compliance-related records.

\#\# Important Implementation Note

This may not be one clean API. The data may be split across Water Boards pages, GeoTracker spatial services, downloadable files, regulatory datasets, and program-specific portals.

Treat this as a regulatory-data adapter rather than one simple REST client.

\#\# Internal Endpoints

\`\`\`http  
GET /api/water-quality/sites?lat={lat}\&lon={lon}\&radiusMiles={radius}  
GET /api/water-quality/nitrates?lat={lat}\&lon={lon}  
GET /api/water-quality/salinity?lat={lat}\&lon={lon}  
GET /api/water-quality/compliance/ilrp?county={county}  
GET /api/water-quality/alerts?lat={lat}\&lon={lon}  
\`\`\`

\#\# Shared Model

\`\`\`ts  
type WaterQualityRecord \= {  
  source: "CA\_WATER\_BOARDS";  
  locationName?: string;  
  lat?: number;  
  lon?: number;  
  parameter: string;  
  value?: number;  
  unit?: string;  
  sampleDate?: string;  
  regulatoryProgram?: string;  
  complianceStatus?: string;  
};  
\`\`\`

\#\# Cursor Agent Task

Create a Water Boards / GeoTracker adapter. Start with search and metadata discovery. Then add nitrate, salinity, groundwater monitoring, agricultural runoff, and ILRP-related data where available.

\---

\# Service 7: \`agronomy-gateway-service\`

\#\# Purpose

This is the main internal API for the frontend. The frontend should call this gateway instead of calling each microservice directly.

The gateway combines data from CIMIS, forecast ET, soil lookup, crop coefficient lookup, CNRA datasets, and water-quality records.

\#\# Internal Endpoints

\`\`\`http  
GET /api/agronomy/location-summary?lat={lat}\&lon={lon}\&crop={cropName}  
GET /api/agronomy/irrigation-recommendation?lat={lat}\&lon={lon}\&crop={cropName}  
GET /api/agronomy/soil-water-balance?lat={lat}\&lon={lon}\&crop={cropName}  
GET /api/agronomy/risk-summary?lat={lat}\&lon={lon}  
POST /api/agronomy/search  
\`\`\`

\#\# Shared Model

\`\`\`ts  
type AgronomyLocationSummary \= {  
  location: {  
    lat: number;  
    lon: number;  
    county?: string;  
    basin?: string;  
  };  
  crop?: CropWaterCoefficient;  
  eto?: EvapotranspirationReading;  
  forecastEt?: ForecastEtReading\[\];  
  soil?: SoilProfile;  
  waterQuality?: WaterQualityRecord\[\];  
  datasets?: OpenDataDataset\[\];  
  irrigationRecommendation?: IrrigationRecommendation;  
};  
\`\`\`

\#\# Cursor Agent Task

Create a gateway that calls the lower-level services and returns one unified agronomy summary for a coordinate, crop, and date range.

\---

\# Service 8: \`ai-agronomy-search-service\`

\#\# Purpose

This service powers the AI search box using OpenAI and Gemini.

The AI search box should understand natural-language agronomy questions, classify the user’s intent, extract structured parameters, call the correct gateway endpoint, and summarize the result.

\#\# Example User Questions

\`\`\`text  
How much should I irrigate almonds near Fresno this week?  
\`\`\`

\`\`\`text  
What is the soil water capacity for this field?  
\`\`\`

\`\`\`text  
Show nitrate risk near this location.  
\`\`\`

\`\`\`text  
Find California datasets about crop water efficiency.  
\`\`\`

\`\`\`text  
Compare current ETo with the 7-day forecast.  
\`\`\`

\#\# Search Intent Model

\`\`\`ts  
type AgronomySearchIntent \=  
  | "current\_eto"  
  | "forecast\_eto"  
  | "soil\_lookup"  
  | "crop\_coefficient"  
  | "irrigation\_schedule"  
  | "water\_quality"  
  | "open\_data\_search"  
  | "regulatory\_compliance"  
  | "general\_agronomy\_question";  
\`\`\`

\#\# Routing Table

\`\`\`ts  
const routingTable \= {  
  current\_eto: \["irrigation-cimis-service"\],  
  forecast\_eto: \["forecast-et-service"\],  
  soil\_lookup: \["soil-data-service"\],  
  crop\_coefficient: \["crop-water-coefficient-service"\],  
  irrigation\_schedule: \[  
    "irrigation-cimis-service",  
    "forecast-et-service",  
    "soil-data-service",  
    "crop-water-coefficient-service"  
  \],  
  water\_quality: \["water-quality-compliance-service"\],  
  open\_data\_search: \["cnra-open-data-service"\],  
  regulatory\_compliance: \[  
    "water-quality-compliance-service",  
    "cnra-open-data-service"  
  \]  
};  
\`\`\`

\#\# Cursor Agent Task

Build an AI query router. Use OpenAI and Gemini to classify the user question, extract parameters such as latitude, longitude, crop name, county, basin, and date range, call the correct gateway endpoint, and return a plain-English answer with source metadata.

\---

\# Shared Model: \`IrrigationRecommendation\`

\`\`\`ts  
type IrrigationRecommendation \= {  
  cropName: string;  
  date: string;  
  lat: number;  
  lon: number;

  eto: number;  
  cropCoefficient: number;  
  cropEt: number;

  soilAvailableWaterCapacity?: number;  
  rootZoneDepth?: number;  
  allowableDepletion?: number;

  recommendedIrrigationDepthInches: number;  
  recommendedIrrigationGallonsPerAcre?: number;

  forecastAdjustment?: {  
    next7DayForecastEt?: number;  
    heatRisk?: "low" | "medium" | "high";  
    rainAdjustment?: number;  
  };

  explanation: string;

  sources: string\[\];  
};  
\`\`\`

\#\# Basic Irrigation Calculation

The basic crop water-use calculation is:

\`\`\`text  
Crop ET \= Reference ETo × Crop Coefficient  
\`\`\`

Then the platform should adjust the irrigation recommendation using:

\`\`\`text  
soil available water capacity  
root zone depth  
allowable depletion  
irrigation system efficiency  
forecast ET  
rain forecast  
crop growth stage  
regulatory constraints  
\`\`\`

\---

\# Suggested Repository Structure

\`\`\`text  
/agronomy-platform  
  /apps  
    /web-client  
    /api-gateway  
  /services  
    /irrigation-cimis-service  
    /forecast-et-service  
    /soil-data-service  
    /crop-water-coefficient-service  
    /cnra-open-data-service  
    /water-quality-compliance-service  
    /ai-agronomy-search-service  
  /packages  
    /shared-types  
    /api-clients  
    /geo-utils  
    /unit-conversions  
    /llm-router  
  /docs  
    api-source-inventory.md  
    irrigation-model.md  
    soil-water-balance.md  
    ai-search-routing.md  
\`\`\`

\---

\# Development Milestones

\#\# Milestone 1: Shared Types and Gateway Skeleton

Create the project structure, shared TypeScript models, and the first gateway endpoints.

Build:

\`\`\`text  
/packages/shared-types  
/apps/api-gateway  
\`\`\`

Add placeholder endpoints:

\`\`\`http  
GET /api/agronomy/location-summary  
GET /api/agronomy/irrigation-recommendation  
POST /api/agronomy/search  
\`\`\`

\#\# Milestone 2: CIMIS Service

Build the first real data microservice.

\`\`\`text  
/services/irrigation-cimis-service  
\`\`\`

Support:

\`\`\`http  
GET /api/cimis/stations  
GET /api/cimis/eto/current  
GET /api/cimis/eto/history  
GET /api/cimis/weather  
GET /api/cimis/spatial  
\`\`\`

\#\# Milestone 3: NRCS Soil Lookup

Add soil lookup from USDA NRCS Soil Data Access.

\`\`\`text  
/services/soil-data-service  
\`\`\`

Support:

\`\`\`http  
GET /api/soil/lookup  
GET /api/soil/water-capacity  
GET /api/soil/drainage  
GET /api/soil/texture  
\`\`\`

\#\# Milestone 4: Crop Coefficients

Add WUCOLS or UC Davis crop water-use data.

\`\`\`text  
/services/crop-water-coefficient-service  
\`\`\`

If no API exists, create a local ingestion pipeline.

\#\# Milestone 5: Forecast ET

Add forecast evapotranspiration.

\`\`\`text  
/services/forecast-et-service  
\`\`\`

Keep this adapter swappable.

\#\# Milestone 6: CNRA Open Data Search

Add CKAN dataset search for California natural-resource data.

\`\`\`text  
/services/cnra-open-data-service  
\`\`\`

Support dataset search, metadata lookup, and resource discovery.

\#\# Milestone 7: Water Quality and Compliance

Add California Water Boards / GeoTracker / ILRP data adapters.

\`\`\`text  
/services/water-quality-compliance-service  
\`\`\`

Start with metadata search and then add nitrate, salinity, groundwater, and compliance records.

\#\# Milestone 8: AI Agronomy Search Box

Add the AI query router.

\`\`\`text  
/services/ai-agronomy-search-service  
/packages/llm-router  
\`\`\`

Use OpenAI and Gemini to:

\`\`\`text  
classify intent  
extract parameters  
route to gateway endpoints  
summarize results  
include source metadata  
\`\`\`

\---

\# Cursor Agent Master Prompt

Paste this into Cursor:

\`\`\`text  
You are building a California agronomy microservices platform.

Goal:  
Create backend services that wrap public government and academic APIs for irrigation scheduling, evapotranspiration, soil data, crop coefficients, water quality, land use, and regulatory datasets.

Architecture:  
\- Each external data source gets its own microservice.  
\- The frontend calls only the agronomy gateway.  
\- The AI search box calls the AI agronomy search service.  
\- The AI search service classifies user intent, extracts lat/lon/crop/date parameters, calls the correct gateway endpoints, and summarizes results.

Services to create:

1\. irrigation-cimis-service  
   \- Wrap California CIMIS Web API.  
   \- Return current and historical ETo, weather, solar radiation, wind, temperature, and station/spatial data.

2\. forecast-et-service  
   \- Wrap NWS/NDFD FRET or equivalent forecast ET data.  
   \- Return 1–7 day forecast evapotranspiration.  
   \- Make this adapter swappable because FRET endpoint availability may vary.

3\. soil-data-service  
   \- Wrap USDA NRCS Soil Data Access / SSURGO.  
   \- Given lat/lon or polygon, return soil texture, available water capacity, drainage class, hydrologic group, and root-zone depth.

4\. crop-water-coefficient-service  
   \- Ingest UC Davis / WUCOLS crop water-use data.  
   \- Return crop coefficients, plant factors, and regional water-use classes.  
   \- If no REST API exists, create a local database ingestion pipeline.

5\. cnra-open-data-service  
   \- Wrap California Natural Resources Agency CKAN API.  
   \- Search datasets related to irrigation, groundwater, land use, water efficiency, and agriculture.

6\. water-quality-compliance-service  
   \- Wrap California Water Boards / GeoTracker / ILRP-related data.  
   \- Return nitrate, salinity, groundwater monitoring, and compliance-related records where available.

7\. agronomy-gateway-service  
   \- Combine all service outputs.  
   \- Main endpoint: /api/agronomy/location-summary?lat={lat}\&lon={lon}\&crop={cropName}  
   \- Main endpoint: /api/agronomy/irrigation-recommendation?lat={lat}\&lon={lon}\&crop={cropName}

8\. ai-agronomy-search-service  
   \- Use OpenAI and Gemini.  
   \- Classify natural-language agronomy questions.  
   \- Extract parameters.  
   \- Route to the correct gateway endpoint.  
   \- Return a plain-English answer with source metadata.

Important:  
Use shared TypeScript models for:  
\- EvapotranspirationReading  
\- ForecastEtReading  
\- SoilProfile  
\- CropWaterCoefficient  
\- WaterQualityRecord  
\- OpenDataDataset  
\- IrrigationRecommendation  
\- AgronomyLocationSummary

First implementation milestone:  
Build the gateway, shared types, and CIMIS service first.  
Then add NRCS soil lookup.  
Then add crop coefficients.  
Then add forecast ET.  
Then add CNRA and Water Boards search.  
Then add the AI search box.  
\`\`\`

\---

\# Implementation Warning

CIMIS and CNRA are the cleanest starting points because they have clear public API patterns.

WUCOLS and Water Boards / GeoTracker may require ingestion or adapter work. Do not assume they are simple REST APIs.

NWS FRET should be verified before hard-coding because the public documentation around forecast reference evapotranspiration is scattered across older NWS and NDFD pages.

The safest build order is:

\`\`\`text  
1\. Shared types  
2\. Gateway skeleton  
3\. CIMIS service  
4\. NRCS soil lookup  
5\. Crop coefficient ingestion  
6\. Forecast ET adapter  
7\. CNRA open-data search  
8\. Water-quality/compliance adapter  
9\. AI search service  
\`\`\`

\---

\# Final Product Vision

The final product should feel like an environmental intelligence dashboard for California agriculture.

A farmer, agronomist, researcher, or policy analyst should be able to enter a location and crop, then receive:

\`\`\`text  
current evapotranspiration  
forecast evapotranspiration  
soil water-holding capacity  
crop coefficient estimate  
irrigation recommendation  
nearby water-quality risks  
relevant California datasets  
plain-English AI summary  
source metadata  
\`\`\`

The platform should start in California but be designed so new regions can be added later, including other U.S. states and international agricultural regions.  
