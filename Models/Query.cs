using System.Text.Json;

namespace AgronomyStudio.Models;

public sealed record QueryRequest
{
    public string Question { get; init; } = "";
    public string Provider { get; init; } = "mock";
}

public sealed record QueryColumn
{
    public string Name { get; init; } = "";
    public string Type { get; init; } = "";
}

public sealed record QueryResponse
{
    public string Question { get; init; } = "";
    public string Sql { get; init; } = "";
    public string Summary { get; init; } = "";
    public List<QueryColumn> Columns { get; init; } = new();
    public List<Dictionary<string, JsonElement>> Rows { get; init; } = new();
    public int RowCount { get; init; }
    public double ExecutionMs { get; init; }
    public bool Cached { get; init; }
}

public sealed record QueryErrorResponse
{
    public string? Error { get; init; }
}

public sealed record QueryHistoryEntry
{
    public string Question { get; init; } = "";
    public string Timestamp { get; init; } = "";
    public int RowCount { get; init; }
}
