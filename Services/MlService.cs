using System.Net.Http.Json;
using System.Text.Json;
using AgronomyStudio.Models;

namespace AgronomyStudio.Services;

/// <summary>
/// Client for the Python ML service (proxied via /ml-api).
/// Falls back gracefully when the service is unavailable.
/// </summary>
public sealed class MlService
{
    private readonly HttpClient _http;

    public MlService(IHttpClientFactory factory)
    {
        _http = factory.CreateClient(ApiClients.Ml);
    }

    // ------------------------------------------------------------------
    // Health
    // ------------------------------------------------------------------

    public Task<MlHealthStatus?> GetHealthAsync(CancellationToken ct = default) =>
        _http.GetFromJsonAsync<MlHealthStatus>("api/ml/health", ct);

    // ------------------------------------------------------------------
    // Yield prediction
    // ------------------------------------------------------------------

    public async Task<MlYieldPrediction?> PredictYieldAsync(
        string fieldId, string cropName, int cropYear,
        CancellationToken ct = default)
    {
        var req = new { field_id = fieldId, crop_name = cropName, crop_year = cropYear };
        using var resp = await _http.PostAsJsonAsync("api/ml/yield/predict", req, ct);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<MlYieldPrediction>(ct);
    }

    // ------------------------------------------------------------------
    // Input optimisation
    // ------------------------------------------------------------------

    public async Task<MlOptimizationResult?> OptimizeInputsAsync(
        string fieldId, string cropName, int cropYear,
        CancellationToken ct = default)
    {
        var req = new { field_id = fieldId, crop_name = cropName, crop_year = cropYear };
        using var resp = await _http.PostAsJsonAsync("api/ml/optimize/inputs", req, ct);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<MlOptimizationResult>(ct);
    }

    // ------------------------------------------------------------------
    // Risk / anomaly
    // ------------------------------------------------------------------

    public async Task<MlRiskAssessment?> AssessRiskAsync(
        string fieldId, string cropName, int cropYear,
        CancellationToken ct = default)
    {
        var req = new { field_id = fieldId, crop_name = cropName, crop_year = cropYear };
        using var resp = await _http.PostAsJsonAsync("api/ml/risk/assess", req, ct);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<MlRiskAssessment>(ct);
    }

    public Task<MlRiskSummary?> GetRiskSummaryAsync(
        string? orgId = null, int cropYear = 2026,
        CancellationToken ct = default)
    {
        var query = $"api/ml/risk/summary?crop_year={cropYear}";
        if (!string.IsNullOrEmpty(orgId)) query += $"&org_id={Uri.EscapeDataString(orgId)}";
        return _http.GetFromJsonAsync<MlRiskSummary>(query, ct);
    }

    // ------------------------------------------------------------------
    // Benchmarking
    // ------------------------------------------------------------------

    public async Task<MlBenchmarkResult?> BenchmarkAsync(
        string fieldId, string cropName, int cropYear, double? yieldKgHa = null,
        CancellationToken ct = default)
    {
        var req = new
        {
            field_id = fieldId,
            crop_name = cropName,
            crop_year = cropYear,
            yield_kg_ha = yieldKgHa,
        };
        using var resp = await _http.PostAsJsonAsync("api/ml/benchmark/compare", req, ct);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<MlBenchmarkResult>(ct);
    }

    public Task<MlClustersResponse?> GetClustersAsync(CancellationToken ct = default) =>
        _http.GetFromJsonAsync<MlClustersResponse>("api/ml/benchmark/clusters", ct);

    // ------------------------------------------------------------------
    // Training
    // ------------------------------------------------------------------

    public async Task<JsonElement?> TriggerTrainingAsync(
        string modelType = "all", CancellationToken ct = default)
    {
        using var resp = await _http.PostAsync($"api/ml/train/{modelType}", null, ct);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<JsonElement>(ct);
    }
}
