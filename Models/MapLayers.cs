namespace AgronomyStudio.Models;

public enum FieldLayerType
{
    Boundary,
    Terrain,
    Soil,
    Weather,
    Crop,
    Operations,
    Yield
}

/// <summary>
/// Provider-neutral field layer. Geometry is carried as a GeoJSON string so the model
/// is not bound to any one map vendor or rendering library.
/// </summary>
public sealed record FieldLayer
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public FieldLayerType Type { get; init; }
    public string GeometryGeoJson { get; init; } = "";
    public Dictionary<string, string> Attributes { get; init; } = new();
    public string Source { get; init; } = "";
    public DateTimeOffset Timestamp { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// A simple regular elevation grid used by terrain calculations. Elevations are in
/// metres, row-major. <see cref="CellSizeMeters"/> is the spacing between samples.
/// </summary>
public sealed record TerrainGrid
{
    public int Rows { get; init; }
    public int Cols { get; init; }
    public double CellSizeMeters { get; init; } = 1;
    public double[][] Elevations { get; init; } = Array.Empty<double[]>();
}
