namespace AgronomyStudio.Services;

public enum AppLogLevel
{
    Debug,
    Info,
    Warn,
    Error,
}

public sealed record LogEntry(
    DateTimeOffset Timestamp,
    AppLogLevel Level,
    string Source,
    string Message,
    string? CorrelationId,
    long? DurationMs);

/// <summary>
/// In-memory leveled logger with a bounded ring buffer. Entries are also written
/// to the browser console. The <see cref="Logs"/> debug page subscribes to
/// <see cref="Changed"/> to render and export recent activity.
/// </summary>
public sealed class LogService
{
    private const int Capacity = 300;
    private readonly LinkedList<LogEntry> _entries = new();
    private readonly object _gate = new();

    public event Action? Changed;

    public IReadOnlyList<LogEntry> Snapshot()
    {
        lock (_gate)
        {
            return _entries.ToArray();
        }
    }

    public void Log(AppLogLevel level, string source, string message, string? correlationId = null, long? durationMs = null)
    {
        var entry = new LogEntry(DateTimeOffset.Now, level, source, message, correlationId, durationMs);

        lock (_gate)
        {
            _entries.AddFirst(entry);
            while (_entries.Count > Capacity)
            {
                _entries.RemoveLast();
            }
        }

        var line = $"[{level.ToString().ToLowerInvariant()}] {source}: {message}" +
                   (durationMs is { } ms ? $" ({ms}ms)" : string.Empty) +
                   (correlationId is { } id ? $" #{id}" : string.Empty);
        switch (level)
        {
            case AppLogLevel.Error:
                Console.Error.WriteLine(line);
                break;
            default:
                Console.WriteLine(line);
                break;
        }

        Changed?.Invoke();
    }

    public void Debug(string source, string message, string? correlationId = null) =>
        Log(AppLogLevel.Debug, source, message, correlationId);

    public void Info(string source, string message, string? correlationId = null, long? durationMs = null) =>
        Log(AppLogLevel.Info, source, message, correlationId, durationMs);

    public void Warn(string source, string message, string? correlationId = null, long? durationMs = null) =>
        Log(AppLogLevel.Warn, source, message, correlationId, durationMs);

    public void Error(string source, string message, string? correlationId = null, long? durationMs = null) =>
        Log(AppLogLevel.Error, source, message, correlationId, durationMs);

    public void Clear()
    {
        lock (_gate)
        {
            _entries.Clear();
        }

        Changed?.Invoke();
    }

    public string ExportJson()
    {
        var entries = Snapshot().Select(e => new
        {
            ts = e.Timestamp.ToString("o"),
            level = e.Level.ToString().ToLowerInvariant(),
            source = e.Source,
            message = e.Message,
            correlationId = e.CorrelationId,
            durationMs = e.DurationMs,
        });
        return System.Text.Json.JsonSerializer.Serialize(entries, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
    }
}
