using System.Net.Http;

namespace AgronomyStudio.Services;

public sealed class ApiErrorHandler : DelegatingHandler
{
    private readonly NotificationService _notifications;

    public ApiErrorHandler(NotificationService notifications)
    {
        _notifications = notifications;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var service = ServiceLabel(request.RequestUri?.ToString() ?? string.Empty);

        HttpResponseMessage response;
        try
        {
            response = await base.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException)
        {
            _notifications.ShowError($"Cannot reach {service} — is the server running?");
            throw;
        }

        if (!response.IsSuccessStatusCode)
        {
            _notifications.ShowError($"{service} returned {(int)response.StatusCode}");
        }

        return response;
    }

    private static string ServiceLabel(string url)
    {
        if (url.Contains("field-api") || url.Contains(":4302")) return "field-intelligence (:4302)";
        if (url.Contains("weather-api") || url.Contains(":4300")) return "weather-intelligence (:4300)";
        if (url.Contains("query-api") || url.Contains(":4304")) return "query-intelligence (:4304)";
        return url;
    }
}
