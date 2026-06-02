using Microsoft.JSInterop;

namespace AgronomyStudio.Services;

public sealed class BrowserStorage
{
    private readonly IJSRuntime _js;

    public BrowserStorage(IJSRuntime js)
    {
        _js = js;
    }

    public ValueTask<string?> GetItemAsync(string key) =>
        _js.InvokeAsync<string?>("localStorage.getItem", key);

    public ValueTask SetItemAsync(string key, string value) =>
        _js.InvokeVoidAsync("localStorage.setItem", key, value);

    public ValueTask RemoveItemAsync(string key) =>
        _js.InvokeVoidAsync("localStorage.removeItem", key);
}
