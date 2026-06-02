using System.Text.Json;

namespace AgronomyStudio.Models;

public sealed record FieldSummary
{
    public string FieldId { get; init; } = "";
    public string FieldName { get; init; } = "";
    public string Crop { get; init; } = "";
    public int StressScore { get; init; }
    public string StressLabel { get; init; } = "";
    public double PredictedYieldKgPerHa { get; init; }
    public string Confidence { get; init; } = "";
    public string? TopLimitingFactor { get; init; }
}

public sealed record DashboardSummary
{
    public List<FieldSummary> Fields { get; init; } = new();
}

public sealed record Field
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public string RegionCode { get; init; } = "";
    public double AreaHectares { get; init; }
    public string BoundaryGeoJson { get; init; } = "";
    public string SoilType { get; init; } = "";
    public string Notes { get; init; } = "";
}

public sealed record FieldsResponse
{
    public List<Field> Fields { get; init; } = new();
}

public sealed record NutrientEntry
{
    public double Soil { get; init; }
    public double Applied { get; init; }
    public double Uptake { get; init; }
    public double Balance { get; init; }
}

public sealed record NutrientWarning
{
    public string Nutrient { get; init; } = "";
    public string Message { get; init; } = "";
}

public sealed record NutrientBalance
{
    public NutrientEntry N { get; init; } = new();
    public NutrientEntry P { get; init; } = new();
    public NutrientEntry K { get; init; } = new();
    public List<NutrientWarning> Warnings { get; init; } = new();
}

public sealed record YieldFactors
{
    public double Seed { get; init; }
    public double Planting { get; init; }
    public double Population { get; init; }
    public double Water { get; init; }
    public double Nutrient { get; init; }
    public double Heat { get; init; }
    public double Uv { get; init; }
}

public sealed record YieldPrediction
{
    public double PredictedYieldKgPerHa { get; init; }
    public double Baseline { get; init; }
    public YieldFactors Factors { get; init; } = new();
    public List<string> LimitingFactors { get; init; } = new();
    public string Confidence { get; init; } = "";
    public string Explanation { get; init; } = "";
}

public sealed record FieldOperation
{
    public string Id { get; init; } = "";
    public string FieldId { get; init; } = "";
    public string OperationType { get; init; } = "";
    public string Timestamp { get; init; } = "";
    public Dictionary<string, JsonElement>? Inputs { get; init; }
    public string Notes { get; init; } = "";
}

public sealed record OperationsResponse
{
    public List<FieldOperation> Operations { get; init; } = new();
}

public sealed record SoilTest
{
    public string Id { get; init; } = "";
    public string FieldId { get; init; } = "";
    public string SampleDate { get; init; } = "";
    public double SoilPh { get; init; }
    public double OrganicMatterPercent { get; init; }
    public double CationExchangeCapacity { get; init; }
    public double NitrateNppm { get; init; }
    public double PhosphorusPpm { get; init; }
    public double PotassiumPpm { get; init; }
    public double ElectricalConductivity { get; init; }
    public string LabName { get; init; } = "";
    public string Notes { get; init; } = "";
}

public sealed record SoilTestsResponse
{
    public List<SoilTest> SoilTests { get; init; } = new();
}

public sealed record BlockProperties
{
    public string BlockId { get; init; } = "";
    public string SoilType { get; init; } = "";
    public double ElevationM { get; init; }
    public string IrrigationZone { get; init; } = "";
    public string CropType { get; init; } = "";
    public double CenterLat { get; init; }
    public double CenterLon { get; init; }
}

public sealed record GeoJsonGeometry
{
    public string Type { get; init; } = "";
    public List<List<List<double>>> Coordinates { get; init; } = new();
}

public sealed record GeoJsonFeature
{
    public string Type { get; init; } = "";
    public string Id { get; init; } = "";
    public GeoJsonGeometry Geometry { get; init; } = new();
    public BlockProperties Properties { get; init; } = new();
}

public sealed record GeoJsonFeatureCollection
{
    public string Type { get; init; } = "";
    public List<GeoJsonFeature> Features { get; init; } = new();
}
