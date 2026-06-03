using System.Text.Json.Serialization;

namespace AgronomyStudio.Models;

public sealed class AirQualityResponse
{
    public List<AirQualityIndex> Indexes { get; set; } = new();
}

public sealed class AirQualityIndex
{
    public string Code { get; set; } = "";
    public int Aqi { get; set; }
    public string Category { get; set; } = "";
    [JsonPropertyName("dominantPollutant")]
    public string DominantPollutant { get; set; } = "";
}

public sealed class AirQualityResult
{
    public int Aqi { get; set; }
    public string Category { get; set; } = "";
    public string DominantPollutant { get; set; } = "";

    public string BannerColor => Aqi switch
    {
        <= 50 => "#16a34a",
        <= 100 => "#ca8a04",
        <= 150 => "#ea580c",
        <= 200 => "#dc2626",
        <= 300 => "#7c3aed",
        _ => "#7f1d1d",
    };
}
