using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using AgronomyStudio.Models;

namespace AgronomyStudio.Services;

/// <summary>
/// Calls the spatial-api Netlify function for deterministic field calculations.
/// All numeric results originate here — the AI layer only explains them.
/// </summary>
public sealed class LearningService
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public LearningService(IHttpClientFactory factory)
    {
        _http = factory.CreateClient(ApiClients.Spatial);
    }

    public Task<LearningBlockResult?> GetBoundaryAreaAsync(
        IEnumerable<double[]> ring,
        string unit = "acre",
        CancellationToken ct = default)
    {
        var body = new
        {
            ring = ring.Select(p => new { lat = p[1], lon = p[0] }).ToArray(),
            unit,
        };
        return PostAsync<LearningBlockResult>("api/spatial/boundary-area", body, ct);
    }

    public Task<LearningBlockResult?> GetTerrainFlowAsync(
        double[][] elevationGrid,
        double cellSizeMeters,
        double originLat,
        double originLon,
        CancellationToken ct = default)
    {
        var body = new
        {
            values = elevationGrid,
            cellSizeMeters,
            originLat,
            originLon,
        };
        return PostAsync<LearningBlockResult>("api/spatial/terrain-flow", body, ct);
    }

    public Task<LearningBlockResult?> GetCarryingCapacityLogisticAsync(
        double initialPopulation,
        double carryingCapacity,
        double growthRate,
        int steps,
        CancellationToken ct = default)
    {
        var body = new
        {
            mode = "logistic",
            logistic = new { initialPopulation, carryingCapacity, growthRate, steps },
        };
        return PostAsync<LearningBlockResult>("api/spatial/carrying-capacity", body, ct);
    }

    public Task<LearningBlockResult?> GetCarryingCapacityPredatorPreyAsync(
        double preyPopulation,
        double predatorPopulation,
        double alpha,
        double beta,
        double delta,
        double gamma,
        int steps,
        double stepSize = 0.1,
        CancellationToken ct = default)
    {
        var body = new
        {
            mode = "predator-prey",
            lotkaVolterra = new { preyPopulation, predatorPopulation, alpha, beta, delta, gamma, steps, stepSize },
        };
        return PostAsync<LearningBlockResult>("api/spatial/carrying-capacity", body, ct);
    }

    public Task<JsonElement> GetDemoFieldAsync(CancellationToken ct = default) =>
        _http.GetFromJsonAsync<JsonElement>("api/spatial/demo", ct);

    private async Task<T?> PostAsync<T>(string path, object body, CancellationToken ct)
    {
        var content = new StringContent(
            JsonSerializer.Serialize(body, JsonOpts),
            Encoding.UTF8,
            "application/json");
        var response = await _http.PostAsync(path, content, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>(JsonOpts, ct);
    }
}
