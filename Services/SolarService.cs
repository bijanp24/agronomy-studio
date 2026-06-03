using System.Net.Http.Json;
using AgronomyStudio.Models;
using Microsoft.Extensions.Configuration;

namespace AgronomyStudio.Services;

public sealed class SolarService
{
    private readonly HttpClient _http;
    private readonly string _apiKey;

    public SolarService(IHttpClientFactory factory, IConfiguration configuration)
    {
        _http = factory.CreateClient(ApiClients.Solar);
        _apiKey = configuration["GoogleMaps:ApiKey"] ?? "";
    }

    public async Task<SolarData?> GetSolarDataAsync(
        double lat, double lng, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_apiKey)) return null;

        try
        {
            var url = $"v1/buildingInsights:findClosest" +
                      $"?location.latitude={lat.ToString(System.Globalization.CultureInfo.InvariantCulture)}" +
                      $"&location.longitude={lng.ToString(System.Globalization.CultureInfo.InvariantCulture)}" +
                      $"&requiredQuality=LOW&key={_apiKey}";

            return await _http.GetFromJsonAsync<SolarData>(url, ct);
        }
        catch
        {
            return null;
        }
    }
}
