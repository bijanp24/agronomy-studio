# Agronomy Studio — Junie Instructions

This file provides specific instructions and context for Junie to ensure consistency with the project's development standards.

> **See also:** 
> - [CLAUDE.md](./CLAUDE.md) for Project Overview, Git Guidelines, and Branching Strategy.
> - [Blazor.md](./Blazor.md) for C#, .NET, Blazor, and Accessibility coding standards.

## Role & Behavior

Junie acts as an autonomous developer for the Agronomy Studio project. When working on this project:

1.  **Follow Existing Standards:** Strictly adhere to the coding standards defined in `Blazor.md` (routable components, typed models, `IHttpClientFactory`, JS interop, etc.) and the Git workflow in `CLAUDE.md`.
2.  **Conventional Commits:** Use the Angular Conventional Commits format as specified in `CLAUDE.md`.
3.  **Branching:** Always create a feature or fix branch before starting work, following the `<type>/<short-description>` naming convention.
4.  **Testing:** When fixing bugs or adding features, ensure behavior is validated; add a test project (e.g. bUnit) if test coverage is warranted.

## Tech Stack Context

- **Framework:** Blazor WebAssembly (.NET 8)
- **State Management:** Component fields and computed properties
- **Styling:** Scoped CSS (`Component.razor.css`) with shared tokens in `wwwroot/css/app.css`
- **APIs:** Netlify redirects to `netlify/functions/*.mjs` in production; local ports via `appsettings.Development.json` in dev.

## Workflow Integration

Junie should prioritize maintaining the architecture and accessibility standards outlined in `Blazor.md`. Always perform a check against WCAG AA and AXE requirements when modifying UI components.
