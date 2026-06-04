using AgronomyStudio.Models;

namespace AgronomyStudio.Services;

/// <summary>
/// A single local/mock demo field used by the spatial learning blocks. No network,
/// no map provider — just enough geometry to drive deterministic calculations.
/// </summary>
public sealed record DemoField
{
    public string Name { get; init; } = "";
    public string RegionCode { get; init; } = "";
    public List<GeoPoint> BoundaryRing { get; init; } = new();
    public FieldLayer BoundaryLayer { get; init; } = new();
    public TerrainGrid Terrain { get; init; } = new();
    public FieldLayer TerrainLayer { get; init; } = new();
}

public sealed class DemoFieldData
{
    private static readonly List<GeoPoint> Ring = new()
    {
        new GeoPoint { Longitude = -119.7800, Latitude = 36.7400 },
        new GeoPoint { Longitude = -119.7755, Latitude = 36.7400 },
        new GeoPoint { Longitude = -119.7755, Latitude = 36.7373 },
        new GeoPoint { Longitude = -119.7800, Latitude = 36.7373 },
        new GeoPoint { Longitude = -119.7800, Latitude = 36.7400 }
    };

    private const string BoundaryGeoJson =
        "{\"type\":\"Polygon\",\"coordinates\":[[" +
        "[-119.78,36.74],[-119.7755,36.74],[-119.7755,36.7373]," +
        "[-119.78,36.7373],[-119.78,36.74]]]}";

    // 5x5 elevation grid (metres), row 0 = north/high, row 4 = south/low.
    // The south-east corner is the lowest point and acts as a pooling zone.
    private static readonly double[][] Elevations =
    {
        new[] { 102.0, 101.5, 101.0, 100.5, 100.0 },
        new[] { 101.0, 100.5, 100.0,  99.5,  99.0 },
        new[] { 100.0,  99.5,  99.0,  98.5,  98.0 },
        new[] {  99.0,  98.5,  98.0,  97.5,  96.5 },
        new[] {  98.0,  97.5,  97.0,  96.0,  95.0 }
    };

    private readonly DemoField _field;

    public DemoFieldData()
    {
        var terrain = new TerrainGrid
        {
            Rows = 5,
            Cols = 5,
            CellSizeMeters = 100,
            Elevations = Elevations
        };

        _field = new DemoField
        {
            Name = "Sycamore Block 12",
            RegionCode = "San Joaquin Valley",
            BoundaryRing = Ring,
            BoundaryLayer = new FieldLayer
            {
                Id = "demo-boundary",
                Name = "Sycamore Block 12 boundary",
                Type = FieldLayerType.Boundary,
                GeometryGeoJson = BoundaryGeoJson,
                Source = "demo",
                Attributes = new Dictionary<string, string>
                {
                    ["crop"] = "almonds",
                    ["soil"] = "sandy loam"
                }
            },
            Terrain = terrain,
            TerrainLayer = new FieldLayer
            {
                Id = "demo-terrain",
                Name = "Sycamore Block 12 terrain",
                Type = FieldLayerType.Terrain,
                Source = "demo",
                Attributes = new Dictionary<string, string>
                {
                    ["units"] = "metres",
                    ["resolution"] = "100 m"
                }
            }
        };
    }

    public DemoField GetDemoField() => _field;
}
