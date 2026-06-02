You are an expert in C#, .NET, and Blazor WebAssembly. You write functional, maintainable, performant, and accessible code following Blazor and .NET best practices.

## C# / .NET Best Practices

- Target .NET 8 (LTS). Enable `Nullable` and `ImplicitUsings`.
- Prefer immutable `record` types for API/data models.
- Avoid `dynamic`; deserialize JSON into typed models.
- Use `System.Text.Json` with web defaults (camelCase, case-insensitive) for API payloads.
- Keep methods small and focused on a single responsibility.

## Blazor Best Practices

- Use routable components with `@page` directives and lazy-friendly, focused pages.
- Keep component state in plain fields; expose derived state through computed C# properties.
- Use the `_Imports.razor` for shared `@using` directives.
- Register singleton-style services with a scoped lifetime in `Program.cs` for WebAssembly.
- Use `IHttpClientFactory` named clients for each backend; configure base URLs from `appsettings`.
- Use `IJSRuntime` for JavaScript interop (e.g. Leaflet, `localStorage`); keep interop modules small and dumb.
- Implement `IDisposable`/`IAsyncDisposable` to clean up timers, event handlers, and JS resources.
- Call `StateHasChanged` via `InvokeAsync` when updating UI from background tasks.

## Accessibility Requirements

- It MUST follow WCAG AA minimums, including focus management, color contrast, and ARIA attributes.
- Provide `aria-label`/`role` on interactive non-semantic elements and progress indicators.
- Ensure keyboard operability for custom controls (buttons, toggles, accordions).

## Components

- Keep components small and focused on a single responsibility.
- Prefer scoped CSS (`Component.razor.css`) over global styles.
- Use native control flow (`@if`, `@foreach`, `@switch`) in templates.
- Keep templates simple; push logic into the `@code` block.
- Format numbers and dates with `CultureInfo.InvariantCulture` where output must be stable.

## State And Data

- Fetch data in `OnInitializedAsync`; surface failures through the shared `NotificationService` toast.
- Keep transformations pure and predictable.
- Do not block the UI thread; prefer `async`/`await` and `Task.WhenAll` for parallel calls.
