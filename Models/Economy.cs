namespace AgronomyStudio.Models;

public sealed record FredObservation
{
    public string Date { get; init; } = "";
    public double Value { get; init; }
}

public sealed record FredIndicator
{
    public string Id { get; init; } = "";
    public string Title { get; init; } = "";
    public string Units { get; init; } = "";
    public string Frequency { get; init; } = "";
    public FredObservation? Latest { get; init; }
    public FredObservation? Previous { get; init; }
    public double? Change { get; init; }
    public List<FredObservation> Observations { get; init; } = new();
}

public sealed record FredIndicatorsResponse
{
    public List<FredIndicator> Indicators { get; init; } = new();
}
