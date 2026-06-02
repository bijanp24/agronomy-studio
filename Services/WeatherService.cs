using System.Net.Http.Json;
using AgronomyStudio.Models;

namespace AgronomyStudio.Services;

public sealed class WeatherService
{
    private readonly HttpClient _http;

    public WeatherService(IHttpClientFactory factory)
    {
        _http = factory.CreateClient(ApiClients.Weather);
    }

    public Task<EntropyReading?> GetEntropyCurrentAsync(
        string postalCode = "93650",
        string countryCode = "US",
        CancellationToken ct = default) =>
        _http.GetFromJsonAsync<EntropyReading>(
            $"api/entropy/current?postalCode={Uri.EscapeDataString(postalCode)}&countryCode={Uri.EscapeDataString(countryCode)}",
            ct);

    public Task<EntropyHistory?> GetEntropyHistoryAsync(CancellationToken ct = default) =>
        _http.GetFromJsonAsync<EntropyHistory>("api/entropy/history", ct);
}
