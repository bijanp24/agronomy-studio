using System.Text.Json.Serialization;

namespace AgronomyStudio.Models;

public sealed record AstronomyPicture
{
    public string Title { get; init; } = "";
    public string Date { get; init; } = "";
    public string Explanation { get; init; } = "";
    public string Url { get; init; } = "";
    public string? HdUrl { get; init; }

    [JsonPropertyName("media_type")]
    public string MediaType { get; init; } = "image";

    public string? Copyright { get; init; }
}

public sealed record MarsPhoto
{
    public long Id { get; init; }

    [JsonPropertyName("img_src")]
    public string ImgSrc { get; init; } = "";

    [JsonPropertyName("earth_date")]
    public string EarthDate { get; init; } = "";

    public MarsCamera? Camera { get; init; }
    public MarsRover? Rover { get; init; }
}

public sealed record MarsCamera
{
    public string Name { get; init; } = "";

    [JsonPropertyName("full_name")]
    public string FullName { get; init; } = "";
}

public sealed record MarsRover
{
    public string Name { get; init; } = "";
    public string? Status { get; init; }
}

public sealed record MarsPhotosResponse
{
    [JsonPropertyName("latest_photos")]
    public List<MarsPhoto> LatestPhotos { get; init; } = new();
}

public sealed record NeoFeed
{
    [JsonPropertyName("element_count")]
    public int ElementCount { get; init; }

    [JsonPropertyName("near_earth_objects")]
    public Dictionary<string, List<NeoObject>> NearEarthObjects { get; init; } = new();
}

public sealed record NeoObject
{
    public string Name { get; init; } = "";

    [JsonPropertyName("nasa_jpl_url")]
    public string NasaJplUrl { get; init; } = "";

    [JsonPropertyName("is_potentially_hazardous_asteroid")]
    public bool IsPotentiallyHazardous { get; init; }

    [JsonPropertyName("close_approach_data")]
    public List<NeoApproach> CloseApproachData { get; init; } = new();
}

public sealed record NeoApproach
{
    [JsonPropertyName("close_approach_date")]
    public string CloseApproachDate { get; init; } = "";

    [JsonPropertyName("miss_distance")]
    public NeoMissDistance? MissDistance { get; init; }

    [JsonPropertyName("relative_velocity")]
    public NeoVelocity? RelativeVelocity { get; init; }
}

public sealed record NeoMissDistance
{
    public string Kilometers { get; init; } = "";
}

public sealed record NeoVelocity
{
    [JsonPropertyName("kilometers_per_hour")]
    public string KilometersPerHour { get; init; } = "";
}
