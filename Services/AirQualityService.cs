using System.Net.Http.Json;
using AgronomyStudio.Models;
using Microsoft.Extensions.Configuration;

namespace AgronomyStudio.Services;

public sealed class AirQualityService
{
    private readonly HttpClient _http;
    private readonly string _apiKey;

    public AirQualityService(IHttpClientFactory factory, IConfiguration configuration)
    {
        _http = factory.CreateClient(ApiClients.AirQuality);
        _apiKey = configuration["GoogleMaps:ApiKey"] ?? "";
    }

    public async Task<AirQualityResult?> GetCurrentConditionsAsync(
        double lat, double lng, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_apiKey)) return null;

        try
        {
            var body = new
            {
                location = new { latitude = lat, longitude = lng },
                languageCode = "en",
            };

            var response = await _http.PostAsJsonAsync(
                $"v1/currentConditions:lookup?key={_apiKey}", body, ct);

            if (!response.IsSuccessStatusCode) return null;

            var raw = await response.Content.ReadFromJsonAsync<AirQualityResponse>(
                cancellationToken: ct);

            if (raw?.Indexes == null || raw.Indexes.Count == 0) return null;

            var index = raw.Indexes.FirstOrDefault(i => i.Code == "usa_epa")
                     ?? raw.Indexes.FirstOrDefault(i => i.Code == "uaqi")
                     ?? raw.Indexes[0];

            return new AirQualityResult
            {
                Aqi = index.Aqi,
                Category = index.Category,
                DominantPollutant = index.DominantPollutant.ToUpperInvariant(),
            };
        }
        catch
        {
            return null;
        }
    }
}
