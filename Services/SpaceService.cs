using System.Net.Http.Json;
using AgronomyStudio.Models;
using Microsoft.Extensions.Configuration;

namespace AgronomyStudio.Services;

public sealed class SpaceService
{
    private readonly HttpClient _http;
    private readonly string _apiKey;

    public SpaceService(IHttpClientFactory factory, IConfiguration configuration)
    {
        _http = factory.CreateClient(ApiClients.Space);
        _apiKey = configuration["Api:NasaKey"] ?? "DEMO_KEY";
    }

    public Task<AstronomyPicture?> GetAstronomyPictureAsync(CancellationToken ct = default) =>
        _http.GetFromJsonAsync<AstronomyPicture>($"planetary/apod?api_key={_apiKey}", ct);

    public Task<MarsPhotosResponse?> GetMarsPhotosAsync(
        string rover = "curiosity",
        CancellationToken ct = default) =>
        _http.GetFromJsonAsync<MarsPhotosResponse>(
            $"mars-photos/api/v1/rovers/{rover}/latest_photos?api_key={_apiKey}",
            ct);

    public Task<NeoFeed?> GetNearEarthObjectsAsync(CancellationToken ct = default) =>
        _http.GetFromJsonAsync<NeoFeed>($"neo/rest/v1/feed?api_key={_apiKey}", ct);
}
