namespace AgronomyStudio.Models;

public sealed record GeoPoint
{
    public double Latitude { get; init; }
    public double Longitude { get; init; }
}

public sealed record EvapotranspirationReading
{
    public string Date { get; init; } = "";
    public string? StationId { get; init; }
    public string? StationName { get; init; }
    public GeoPoint? Location { get; init; }
    public double Eto { get; init; }
    public double? AirTempF { get; init; }
    public double? SolarRadiation { get; init; }
    public double? Precipitation { get; init; }
    public string Source { get; init; } = "";
}

public sealed record ForecastEtReading
{
    public string Date { get; init; } = "";
    public double Eto { get; init; }
    public double? Precipitation { get; init; }
    public double? MaxTempF { get; init; }
    public double? MinTempF { get; init; }
    public string Source { get; init; } = "";
}

public sealed record SoilProfile
{
    public GeoPoint? Location { get; init; }
    public string? MapUnitKey { get; init; }
    public string? MapUnitName { get; init; }
    public string? ComponentName { get; init; }
    public string? Texture { get; init; }
    public string? DrainageClass { get; init; }
    public string? HydrologicGroup { get; init; }
    public double AvailableWaterCapacity { get; init; }
    public double RootZoneDepthIn { get; init; }
    public string Source { get; init; } = "";
}

public sealed record OpenDataDataset
{
    public string Id { get; init; } = "";
    public string Title { get; init; } = "";
    public string? Description { get; init; }
    public string? Organization { get; init; }
    public string? Url { get; init; }
    public int? ResourceCount { get; init; }
    public IReadOnlyList<string>? Tags { get; init; }
    public string? Updated { get; init; }
    public string Source { get; init; } = "";
}

public sealed record WaterQualityRecord
{
    public string? WellId { get; init; }
    public GeoPoint? Location { get; init; }
    public string? County { get; init; }
    public double? NitrateMgL { get; init; }
    public double? SalinityMgL { get; init; }
    public string? SampleDate { get; init; }
    public double? DistanceMiles { get; init; }
    public string Source { get; init; } = "";
}

public sealed record IrrigationRecommendation
{
    public string CropName { get; init; } = "";
    public double Eto { get; init; }
    public double Kc { get; init; }
    public double CropEt { get; init; }
    public double NetIrrigationIn { get; init; }
    public double GrossIrrigationIn { get; init; }
    public int IntervalDays { get; init; }
    public double ReadilyAvailableWaterIn { get; init; }
    public double ForecastRainIn { get; init; }
    public double SystemEfficiency { get; init; }
    public bool HeatRisk { get; init; }
    public string Confidence { get; init; } = "";
    public IReadOnlyList<string> Notes { get; init; } = Array.Empty<string>();
}

public sealed record SoilWaterBalance
{
    public GeoPoint? Location { get; init; }
    public double AvailableWaterCapacity { get; init; }
    public double RootZoneDepthIn { get; init; }
    public double TotalAvailableWaterIn { get; init; }
    public double ReadilyAvailableWaterIn { get; init; }
    public double RecentEtIn { get; init; }
    public double ForecastEtIn { get; init; }
    public double ForecastRainIn { get; init; }
    public double ProjectedDeficitIn { get; init; }
}

public sealed record RiskSummary
{
    public GeoPoint? Location { get; init; }
    public bool HeatRisk { get; init; }
    public bool DroughtStress { get; init; }
    public bool WaterQualityConcern { get; init; }
    public IReadOnlyList<string> Notes { get; init; } = Array.Empty<string>();
}

public sealed record AgronomyLocationSummary
{
    public GeoPoint? Location { get; init; }
    public string? County { get; init; }
    public string ResolvedAt { get; init; } = "";
    public EvapotranspirationReading? Evapotranspiration { get; init; }
    public IReadOnlyList<ForecastEtReading>? Forecast { get; init; }
    public SoilProfile? Soil { get; init; }
    public IReadOnlyList<WaterQualityRecord>? WaterQuality { get; init; }
    public IReadOnlyList<OpenDataDataset>? Datasets { get; init; }
    public IrrigationRecommendation? Irrigation { get; init; }
    public IReadOnlyDictionary<string, string>? Warnings { get; init; }
}

public sealed record AgronomySearchResult
{
    public string Query { get; init; } = "";
    public string Intent { get; init; } = "";
    public AgronomySearchParams? Params { get; init; }
    public string Summary { get; init; } = "";
    public IReadOnlyList<string> Sources { get; init; } = Array.Empty<string>();
    public double Confidence { get; init; }
}

public sealed record AgronomySearchParams
{
    public double? Latitude { get; init; }
    public double? Longitude { get; init; }
    public string? Crop { get; init; }
    public string? County { get; init; }
    public string? Basin { get; init; }
    public string? StartDate { get; init; }
    public string? EndDate { get; init; }
}
