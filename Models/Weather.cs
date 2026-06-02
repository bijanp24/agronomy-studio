namespace AgronomyStudio.Models;

public sealed record AtmosphericSnapshot
{
    public double Precip1Hour { get; init; }
    public double PrecipRate { get; init; }
    public double PressureAltimeter { get; init; }
    public double RelativeHumidity { get; init; }
    public double WindSpeed { get; init; }
    public double Temperature { get; init; }
    public double UvIndex { get; init; }
    public string CloudCoverPhrase { get; init; } = "";
}

public sealed record EntropyReading
{
    public AtmosphericSnapshot Atmospheric { get; init; } = new();
    public double Entropy { get; init; }
    public List<double> Vector { get; init; } = new();
    public string Timestamp { get; init; } = "";
    public string Location { get; init; } = "";
}

public sealed record EntropyStats
{
    public int Count { get; init; }
    public double MeanEntropy { get; init; }
    public double VarianceEntropy { get; init; }
}

public sealed record EntropyHistory
{
    public List<EntropyReading> Records { get; init; } = new();
    public EntropyStats Stats { get; init; } = new();
}
