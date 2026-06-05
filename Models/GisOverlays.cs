namespace AgronomyStudio.Models;

// ---------------------------------------------------------------------------
// GIS overlay domain models — provider-neutral.
// Real providers (Sentinel-2, CIMIS, IoT MQTT) are adapted into these types.
// See docs/gis-overlays.md for architecture and ingestion contracts.
// ---------------------------------------------------------------------------

/// <summary>Block descriptor sent to the overlay API.</summary>
public sealed record BlockOverlayInput
{
    public string BlockId { get; init; } = "";
    public string CropType { get; init; } = "";
    public string SoilType { get; init; } = "";
    public double ElevationM { get; init; }
    public string Season { get; init; } = "2025";
    public string? IrrigationZone { get; init; }
}

// ---------------------------------------------------------------------------
// Vegetation indices (NDVI / EVI)    issue #33
// ---------------------------------------------------------------------------

public sealed record VegetationResult
{
    public string BlockId { get; init; } = "";
    public string IndexType { get; init; } = "ndvi";

    /// <summary>Index value [0, 1]. 0 if cloud-masked.</summary>
    public double Value { get; init; }

    public bool CloudFree { get; init; }

    /// <summary>low | moderate | high</summary>
    public string StressLevel { get; init; } = "";
    public string Source { get; init; } = "mock";
}

public sealed record VegetationOverlayResponse
{
    public string IndexType { get; init; } = "ndvi";
    public List<VegetationResult> Results { get; init; } = new();
}

// ---------------------------------------------------------------------------
// GDD accumulation    issue #34
// ---------------------------------------------------------------------------

public sealed record GddResult
{
    public string BlockId { get; init; } = "";
    public double GddAccumulated { get; init; }
    public double GddBase { get; init; }
    public double CropThreshold { get; init; }
    public double PercentComplete { get; init; }
    public int DaysInSeason { get; init; }
    public string Source { get; init; } = "mock";
}

public sealed record GddOverlayResponse
{
    public List<GddResult> Results { get; init; } = new();
}

// ---------------------------------------------------------------------------
// Microclimate summary    issue #34
// ---------------------------------------------------------------------------

public sealed record MicroclimateSummary
{
    public string BlockId { get; init; } = "";
    public double ReferenceEtMmDay { get; init; }
    public double FrostRiskScore { get; init; }

    /// <summary>none | low | moderate | high</summary>
    public string FrostRiskLevel { get; init; } = "none";
    public double WindSpeedMph { get; init; }
    public int WindDirectionDeg { get; init; }
    public string Source { get; init; } = "mock";
}

public sealed record MicroclimateOverlayResponse
{
    public List<MicroclimateSummary> Results { get; init; } = new();
}

// ---------------------------------------------------------------------------
// Soil moisture probes    issue #35
// ---------------------------------------------------------------------------

public sealed record ProbeReading
{
    public int DepthIn { get; init; }
    public double VwcPct { get; init; }
}

public sealed record SoilMoistureResult
{
    public string BlockId { get; init; } = "";
    public string ProbeId { get; init; } = "";
    public List<ProbeReading> Readings { get; init; } = new();
    public double DeficitPct { get; init; }
    public double IrrigationNeedIn { get; init; }
    public int LastReadingAgeHours { get; init; }
    public bool Stale { get; init; }
    public string Source { get; init; } = "mock";
}

public sealed record SoilMoistureOverlayResponse
{
    public List<SoilMoistureResult> Results { get; init; } = new();
}

// ---------------------------------------------------------------------------
// Season timeline    issue #37
// ---------------------------------------------------------------------------

public sealed record SeasonSnapshot
{
    public string BlockId { get; init; } = "";
    public string Season { get; init; } = "";
    public string CropType { get; init; } = "";
    public string IrrigationZone { get; init; } = "";
    public double Ndvi { get; init; }
    public double GddAccumulated { get; init; }
    public double ReferenceEtMmDay { get; init; }
    public double YieldEstimateKgHa { get; init; }
    public string Note { get; init; } = "";
    public string Source { get; init; } = "mock";
}

public sealed record TimelineOverlayResponse
{
    public List<string> Seasons { get; init; } = new();
    public List<SeasonSnapshot> Snapshots { get; init; } = new();
}

// ---------------------------------------------------------------------------
// VRA prescription export    issue #36
// ---------------------------------------------------------------------------

public sealed record NutrientRates
{
    public double? NitrogenLbAc { get; init; }
    public double? PhosphorusLbAc { get; init; }
    public double? PotassiumLbAc { get; init; }
    public double? SeedLbAc { get; init; }
}

public sealed record VraBlockZone
{
    public string BlockId { get; init; } = "";
    public string CropType { get; init; } = "";

    /// <summary>GeoJSON polygon ring [[lon, lat], ...]</summary>
    public List<List<double>> Coordinates { get; init; } = new();
    public NutrientRates Rates { get; init; } = new();
}

public sealed record VraExportRequest
{
    public List<VraBlockZone> Zones { get; init; } = new();
}

public sealed record VraExportResult
{
    public string ExportId { get; init; } = "";
    public string Format { get; init; } = "geojson+csv";
    public int BlockCount { get; init; }
    public object? Geojson { get; init; }
    public string Csv { get; init; } = "";
    public string IsoXmlNote { get; init; } = "";
    public string GeneratedAt { get; init; } = "";
}
