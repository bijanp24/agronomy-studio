namespace AgronomyStudio.Services;

public sealed class NotificationService
{
    private readonly List<Notification> _messages = new();

    public IReadOnlyList<Notification> Messages => _messages;

    public event Action? Changed;

    public void ShowError(string text) => Add(new Notification(text, IsError: true));

    public void ShowInfo(string text) => Add(new Notification(text, IsError: false));

    public void Dismiss(Notification message)
    {
        if (_messages.Remove(message))
        {
            Changed?.Invoke();
        }
    }

    private void Add(Notification message)
    {
        _messages.Add(message);
        Changed?.Invoke();

        _ = AutoDismissAsync(message);
    }

    private async Task AutoDismissAsync(Notification message)
    {
        await Task.Delay(TimeSpan.FromSeconds(6));
        Dismiss(message);
    }
}

public sealed record Notification(string Text, bool IsError);
