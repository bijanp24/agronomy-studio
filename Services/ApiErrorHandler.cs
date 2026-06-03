using System.Diagnostics;
using System.Net.Http;

namespace AgronomyStudio.Services;

public sealed class ApiErrorHandler : DelegatingHandler
{
    private readonly NotificationService _notifications;
    private readonly LogService _log;

    public ApiErrorHandler(NotificationService notifications, LogService log)
    {
        _notifications = notifications;
        _log = log;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var service = ServiceLabel(request.RequestUri?.ToString() ?? string.Empty);
        // Correlation id is for our own client-side logs only. Do NOT add it as a
        // request header: a custom header turns cross-origin GETs (NASA, Open-Meteo,
        // and the dev mock servers) into CORS-preflighted requests those endpoints
        // do not satisfy, which would break them.
        var correlationId = Guid.NewGuid().ToString("N")[..12];

        var path = request.RequestUri?.PathAndQuery ?? string.Empty;
        _log.Info(service, $"{request.Method} {path}", correlationId);

        var stopwatch = Stopwatch.StartNew();
        HttpResponseMessage response;
        try
        {
            response = await base.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException)
        {
            stopwatch.Stop();
            _log.Error(service, "request failed — server unreachable", correlationId, stopwatch.ElapsedMilliseconds);
            _notifications.ShowError($"Cannot reach {service} — is the server running?");
            throw;
        }

        stopwatch.Stop();
        if (!response.IsSuccessStatusCode)
        {
            _log.Warn(service, $"{(int)response.StatusCode} {response.ReasonPhrase}", correlationId, stopwatch.ElapsedMilliseconds);
            _notifications.ShowError($"{service} returned {(int)response.StatusCode}");
        }
        else
        {
            _log.Info(service, $"{(int)response.StatusCode} OK", correlationId, stopwatch.ElapsedMilliseconds);
        }

        return response;
    }

    private static string ServiceLabel(string url)
    {
        if (url.Contains("field-api") || url.Contains(":4302")) return "field-intelligence (:4302)";
        if (url.Contains("weather-api") || url.Contains(":4300")) return "weather-intelligence (:4300)";
        if (url.Contains("query-api") || url.Contains(":4304")) return "query-intelligence (:4304)";
        if (url.Contains("fred-api") || url.Contains(":4306")) return "FRED economic data";
        if (url.Contains("datagov-api") || url.Contains(":4308")) return "Data.gov catalog";
        if (url.Contains("api.nasa.gov")) return "NASA open APIs";
        if (url.Contains("open-meteo.com")) return "Open-Meteo weather";
        if (url.Contains("agronomy-api") || url.Contains(":4310")) return "agronomy gateway (:4310)";
        if (url.Contains("ai-search-api") || url.Contains(":4312")) return "agronomy AI search (:4312)";
        return url;
    }
}
