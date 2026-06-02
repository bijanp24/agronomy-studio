using System.Globalization;
using System.Net.Http.Json;
using AgronomyStudio.Models;

namespace AgronomyStudio.Services;

public sealed class AgronomyService
{
    private readonly HttpClient _http;

    public AgronomyService(IHttpClientFactory factory)
    {
        _http = factory.CreateClient(ApiClients.Agronomy);
    }

    public Task<AgronomyLocationSummary?> GetLocationSummaryAsync(
        double latitude,
        double longitude,
        string? crop = null,
        CancellationToken ct = default)
    {
        var url = $"api/agronomy/location-summary?{LatLon(latitude, longitude)}{CropQuery(crop)}";
        return _http.GetFromJsonAsync<AgronomyLocationSummary>(url, ct);
    }

    public Task<IrrigationRecommendation?> GetIrrigationAsync(
        double latitude,
        double longitude,
        string? crop = null,
        double? efficiency = null,
        CancellationToken ct = default)
    {
        var url = $"api/agronomy/irrigation-recommendation?{LatLon(latitude, longitude)}{CropQuery(crop)}{EfficiencyQuery(efficiency)}";
        return _http.GetFromJsonAsync<IrrigationRecommendation>(url, ct);
    }

    public Task<SoilWaterBalance?> GetSoilWaterBalanceAsync(
        double latitude,
        double longitude,
        CancellationToken ct = default) =>
        _http.GetFromJsonAsync<SoilWaterBalance>($"api/agronomy/soil-water-balance?{LatLon(latitude, longitude)}", ct);

    public Task<RiskSummary?> GetRiskSummaryAsync(
        double latitude,
        double longitude,
        CancellationToken ct = default) =>
        _http.GetFromJsonAsync<RiskSummary>($"api/agronomy/risk-summary?{LatLon(latitude, longitude)}", ct);

    private static string LatLon(double latitude, double longitude) =>
        $"lat={latitude.ToString(CultureInfo.InvariantCulture)}&lon={longitude.ToString(CultureInfo.InvariantCulture)}";

    private static string CropQuery(string? crop) =>
        string.IsNullOrWhiteSpace(crop) ? string.Empty : $"&crop={Uri.EscapeDataString(crop)}";

    private static string EfficiencyQuery(double? efficiency) =>
        efficiency is null ? string.Empty : $"&efficiency={efficiency.Value.ToString(CultureInfo.InvariantCulture)}";
}
