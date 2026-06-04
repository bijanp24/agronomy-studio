using AgronomyStudio.Models;

namespace AgronomyStudio.Services;

public enum FlowDirection
{
    None,
    North,
    NorthEast,
    East,
    SouthEast,
    South,
    SouthWest,
    West,
    NorthWest
}

public sealed record SlopeResult
{
    public double[][] SlopePercent { get; init; } = Array.Empty<double[]>();
    public double MaxSlopePercent { get; init; }
    public double MeanSlopePercent { get; init; }
}

public sealed record FlowResult
{
    public FlowDirection[][] Directions { get; init; } = Array.Empty<FlowDirection[]>();
    public int LowestRow { get; init; }
    public int LowestCol { get; init; }
}

/// <summary>
/// Deterministic spatial math for the learning blocks. Pure functions over plain
/// inputs — no network, no map provider, no AI.
/// </summary>
public static class SpatialCalculations
{
    private const double MetersPerDegreeLat = 111_320.0;
    private const double SquareMetersPerHectare = 10_000.0;
    private const double AcresPerHectare = 2.47105;

    /// <summary>Perimeter of a closed lon/lat ring in metres (equirectangular).</summary>
    public static double CalculatePerimeterMeters(IReadOnlyList<GeoPoint> ring)
    {
        var pts = ToLocalMeters(ring);
        double total = 0;
        for (var i = 0; i < pts.Count - 1; i++)
        {
            var dx = pts[i + 1].x - pts[i].x;
            var dy = pts[i + 1].y - pts[i].y;
            total += Math.Sqrt((dx * dx) + (dy * dy));
        }

        return total;
    }

    /// <summary>Area of a closed lon/lat ring in square metres (shoelace).</summary>
    public static double CalculateAreaSquareMeters(IReadOnlyList<GeoPoint> ring)
    {
        var pts = ToLocalMeters(ring);
        double sum = 0;
        for (var i = 0; i < pts.Count - 1; i++)
        {
            sum += (pts[i].x * pts[i + 1].y) - (pts[i + 1].x * pts[i].y);
        }

        return Math.Abs(sum) / 2.0;
    }

    public static double CalculateAreaHectares(IReadOnlyList<GeoPoint> ring) =>
        CalculateAreaSquareMeters(ring) / SquareMetersPerHectare;

    public static double HectaresToAcres(double hectares) => hectares * AcresPerHectare;

    /// <summary>Per-cell slope (percent) over an elevation grid.</summary>
    public static SlopeResult CalculateSlope(TerrainGrid grid)
    {
        var e = grid.Elevations;
        var rows = grid.Rows;
        var cols = grid.Cols;
        var cell = grid.CellSizeMeters <= 0 ? 1 : grid.CellSizeMeters;

        var slope = new double[rows][];
        double max = 0;
        double sum = 0;

        for (var r = 0; r < rows; r++)
        {
            slope[r] = new double[cols];
            for (var c = 0; c < cols; c++)
            {
                var east = e[r][Math.Min(c + 1, cols - 1)];
                var west = e[r][Math.Max(c - 1, 0)];
                var south = e[Math.Min(r + 1, rows - 1)][c];
                var north = e[Math.Max(r - 1, 0)][c];

                var spanX = (Math.Min(c + 1, cols - 1) - Math.Max(c - 1, 0)) * cell;
                var spanY = (Math.Min(r + 1, rows - 1) - Math.Max(r - 1, 0)) * cell;

                var gx = spanX == 0 ? 0 : (east - west) / spanX;
                var gy = spanY == 0 ? 0 : (south - north) / spanY;

                var pct = Math.Sqrt((gx * gx) + (gy * gy)) * 100.0;
                slope[r][c] = pct;
                sum += pct;
                if (pct > max)
                {
                    max = pct;
                }
            }
        }

        return new SlopeResult
        {
            SlopePercent = slope,
            MaxSlopePercent = max,
            MeanSlopePercent = rows * cols == 0 ? 0 : sum / (rows * cols)
        };
    }

    /// <summary>
    /// D8 steepest-descent flow direction per cell, plus the lowest (pooling) cell.
    /// </summary>
    public static FlowResult EstimateFlowDirection(TerrainGrid grid)
    {
        var e = grid.Elevations;
        var rows = grid.Rows;
        var cols = grid.Cols;

        var dirs = new FlowDirection[rows][];
        var lowestRow = 0;
        var lowestCol = 0;
        var lowestValue = double.MaxValue;

        for (var r = 0; r < rows; r++)
        {
            dirs[r] = new FlowDirection[cols];
            for (var c = 0; c < cols; c++)
            {
                if (e[r][c] < lowestValue)
                {
                    lowestValue = e[r][c];
                    lowestRow = r;
                    lowestCol = c;
                }

                var bestDrop = 0.0;
                var best = FlowDirection.None;

                for (var dr = -1; dr <= 1; dr++)
                {
                    for (var dc = -1; dc <= 1; dc++)
                    {
                        if (dr == 0 && dc == 0)
                        {
                            continue;
                        }

                        var nr = r + dr;
                        var nc = c + dc;
                        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols)
                        {
                            continue;
                        }

                        var drop = e[r][c] - e[nr][nc];
                        if (drop > bestDrop)
                        {
                            bestDrop = drop;
                            best = ToCompass(dr, dc);
                        }
                    }
                }

                dirs[r][c] = best;
            }
        }

        return new FlowResult
        {
            Directions = dirs,
            LowestRow = lowestRow,
            LowestCol = lowestCol
        };
    }

    private static FlowDirection ToCompass(int dr, int dc) => (dr, dc) switch
    {
        (-1, 0) => FlowDirection.North,
        (-1, 1) => FlowDirection.NorthEast,
        (0, 1) => FlowDirection.East,
        (1, 1) => FlowDirection.SouthEast,
        (1, 0) => FlowDirection.South,
        (1, -1) => FlowDirection.SouthWest,
        (0, -1) => FlowDirection.West,
        (-1, -1) => FlowDirection.NorthWest,
        _ => FlowDirection.None
    };

    private static List<(double x, double y)> ToLocalMeters(IReadOnlyList<GeoPoint> ring)
    {
        if (ring.Count == 0)
        {
            return new List<(double x, double y)>();
        }

        var lat0 = ring[0].Latitude;
        var lon0 = ring[0].Longitude;
        var metersPerDegreeLon = MetersPerDegreeLat * Math.Cos(lat0 * Math.PI / 180.0);

        var result = new List<(double x, double y)>(ring.Count);
        foreach (var p in ring)
        {
            var x = (p.Longitude - lon0) * metersPerDegreeLon;
            var y = (p.Latitude - lat0) * MetersPerDegreeLat;
            result.Add((x, y));
        }

        return result;
    }
}
