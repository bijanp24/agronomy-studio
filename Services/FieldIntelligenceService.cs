using System.Net.Http.Json;
using AgronomyStudio.Models;

namespace AgronomyStudio.Services;

public sealed class FieldIntelligenceService
{
    private readonly HttpClient _http;

    public FieldIntelligenceService(IHttpClientFactory factory)
    {
        _http = factory.CreateClient(ApiClients.Field);
    }

    public Task<DashboardSummary?> GetDashboardSummaryAsync(CancellationToken ct = default) =>
        _http.GetFromJsonAsync<DashboardSummary>("api/dashboard/summary", ct);

    public Task<FieldsResponse?> GetFieldsAsync(CancellationToken ct = default) =>
        _http.GetFromJsonAsync<FieldsResponse>("api/fields", ct);

    public Task<NutrientBalance?> GetNutrientBalanceAsync(string fieldId, CancellationToken ct = default) =>
        _http.GetFromJsonAsync<NutrientBalance>($"api/fields/{fieldId}/nutrient-balance", ct);

    public Task<YieldPrediction?> GetYieldPredictionAsync(string fieldId, CancellationToken ct = default) =>
        _http.GetFromJsonAsync<YieldPrediction>($"api/fields/{fieldId}/yield-prediction", ct);

    public Task<OperationsResponse?> GetOperationsAsync(string fieldId, CancellationToken ct = default) =>
        _http.GetFromJsonAsync<OperationsResponse>($"api/fields/{fieldId}/operations", ct);

    public Task<SoilTestsResponse?> GetSoilTestsAsync(string fieldId, CancellationToken ct = default) =>
        _http.GetFromJsonAsync<SoilTestsResponse>($"api/fields/{fieldId}/soil-tests", ct);

    public Task<GeoJsonFeatureCollection?> GetGisBlocksAsync(CancellationToken ct = default) =>
        _http.GetFromJsonAsync<GeoJsonFeatureCollection>("api/gis/blocks", ct);
}
