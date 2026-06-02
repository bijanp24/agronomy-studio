namespace AgronomyStudio.Models;

public sealed record CatalogDataset
{
    public string Title { get; init; } = "";
    public string Description { get; init; } = "";
    public string Publisher { get; init; } = "";
    public string Organization { get; init; } = "";
    public List<string> Keywords { get; init; } = new();
    public string LastHarvested { get; init; } = "";
    public string LandingPage { get; init; } = "";
    public string Identifier { get; init; } = "";
    public List<string> DistributionTitles { get; init; } = new();
}

public sealed record CatalogSearchResponse
{
    public string Query { get; init; } = "";
    public List<CatalogDataset> Results { get; init; } = new();
    public string? After { get; init; }
}
