using System.Text.Json;

namespace AgronomyStudio.Models;

// ---------------------------------------------------------------------------
// Data Transfer Hub — canonical domain model.
// External data (CSV, Excel, GeoJSON, Shapefile, ISOXML, etc.) is normalised
// into this model via adapter functions. Raw source data is always preserved
// alongside the normalised record (sourceSystem + rawSourceId).
// See issue #47 and docs/learning-blocks.md for architecture context.
// ---------------------------------------------------------------------------

public sealed record Organization
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";

    /// <summary>customer | grower | retailer | advisor | cooperative | research</summary>
    public string Type { get; init; } = "grower";
}

public sealed record Farm
{
    public string Id { get; init; } = "";
    public string OrganizationId { get; init; } = "";
    public string Name { get; init; } = "";
    public string? Region { get; init; }
}

public sealed record TransferField
{
    public string Id { get; init; } = "";
    public string FarmId { get; init; } = "";
    public string Name { get; init; } = "";
    public string? BoundaryGeoJson { get; init; }
    public AreaMeasurement? Area { get; init; }

    /// <summary>Human-readable name of the originating system (e.g. "John Deere Operations Center").</summary>
    public string? SourceSystem { get; init; }

    /// <summary>Original row/record identifier from the source system.</summary>
    public string? RawSourceId { get; init; }
}

public sealed record AreaMeasurement
{
    public double Value { get; init; }

    /// <summary>acre | hectare</summary>
    public string Unit { get; init; } = "acre";
}

public sealed record CropSeason
{
    public string Id { get; init; } = "";
    public string FieldId { get; init; } = "";
    public int CropYear { get; init; }
    public string CropName { get; init; } = "";
    public string? Variety { get; init; }
}

public sealed record Measurement
{
    public string Name { get; init; } = "";
    public double Value { get; init; }
    public string Unit { get; init; } = "";
}

public sealed record TransferFieldOperation
{
    public string Id { get; init; } = "";
    public string FieldId { get; init; } = "";
    public string? SeasonId { get; init; }

    /// <summary>
    /// planting | harvest | irrigation | fertilizer | chemical | tillage |
    /// scouting | soil_sample | recommendation | other
    /// </summary>
    public string OperationType { get; init; } = "";

    public string Date { get; init; } = "";

    /// <summary>Human-readable name of the originating system (e.g. "John Deere Operations Center").</summary>
    public string? SourceSystem { get; init; }

    /// <summary>Original row/record identifier from the source system.</summary>
    public string? RawSourceId { get; init; }

    public List<Measurement> Measurements { get; init; } = new();
    public string? Notes { get; init; }
}

// ---------------------------------------------------------------------------
// Import session
// ---------------------------------------------------------------------------

public sealed record ColumnMapping
{
    public string SourceColumn { get; init; } = "";
    public string CanonicalField { get; init; } = "";
}

public sealed record UnitConversion
{
    public string FieldName { get; init; } = "";
    public string DetectedUnit { get; init; } = "";
    public string TargetUnit { get; init; } = "";
    public double ConversionFactor { get; init; } = 1.0;
}

public sealed record ImportValidationError
{
    public string Row { get; init; } = "";
    public string Field { get; init; } = "";
    public string Message { get; init; } = "";
}

public sealed record ImportPreview
{
    public string ImportId { get; init; } = "";
    public int DetectedOrganizations { get; init; }
    public int DetectedFarms { get; init; }
    public int DetectedFields { get; init; }
    public int DetectedOperations { get; init; }
    public List<string> DetectedColumns { get; init; } = new();
    public List<ColumnMapping> SuggestedMappings { get; init; } = new();
    public List<UnitConversion> SuggestedUnitConversions { get; init; } = new();
    public List<ImportValidationError> Warnings { get; init; } = new();
    public List<List<string>> SampleRows { get; init; } = new();
}

public sealed record ImportRequest
{
    public string ImportId { get; init; } = "";
    public string SourceSystem { get; init; } = "";
    public List<ColumnMapping> ColumnMappings { get; init; } = new();
    public List<UnitConversion> UnitConversions { get; init; } = new();
    public List<Dictionary<string, JsonElement>> Rows { get; init; } = new();
}

public sealed record MigrationReport
{
    public string ImportId { get; init; } = "";
    public string CompletedAt { get; init; } = "";
    public int Created { get; init; }
    public int Updated { get; init; }
    public int Skipped { get; init; }
    public int Conflicted { get; init; }
    public List<ImportValidationError> Errors { get; init; } = new();
    public List<Organization> Organizations { get; init; } = new();
    public List<Farm> Farms { get; init; } = new();
    public List<TransferField> Fields { get; init; } = new();
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

public sealed record ExportRequest
{
    public string Format { get; init; } = "csv";
    public List<string> FieldIds { get; init; } = new();
    public bool IncludeOperations { get; init; } = true;
    public bool IncludeBoundaries { get; init; } = true;
}

public sealed record ExportResult
{
    public string ExportId { get; init; } = "";
    public string Format { get; init; } = "csv";
    public int Records { get; init; }
    public string? DownloadUrl { get; init; }
    public string? CsvContent { get; init; }
}
