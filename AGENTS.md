# Agronomy Studio - Codex Instructions

## Project

Agronomy Studio is a Blazor WebAssembly (.NET 8) SPA for California field intelligence.

Three backend services. In production, Netlify redirects proxy them to `netlify/functions/*.mjs`. For local development the app points directly at the mock servers in `tools/mock-apis.mjs`:

- `/field-api` -> `http://localhost:4302` (`field-intelligence-app`)
- `/weather-api` -> `http://localhost:4300` (`weather-intelligence-app`)
- `/query-api` -> `http://localhost:4304` (`query-intelligence-app`)

API base URLs are configured in `wwwroot/appsettings.json` (production) and `wwwroot/appsettings.Development.json` (local ports).

## Reference Instructions

- Follow [Blazor.md](./Blazor.md) for C#, .NET, Blazor, and accessibility standards.
- Keep this file aligned with [CLAUDE.md](./CLAUDE.md) when repository workflow guidance changes.

## Development Commands

- `dotnet run` runs the Blazor dev server.
- `node tools/mock-apis.mjs` runs the local mock backends (ports 4300–4312).
- `netlify dev` runs the real TypeScript functions and proxies the app (needs `.env`).
- `dotnet publish -c Release -o release` produces the deployable `release/wwwroot`.
- `npm install` installs the function toolchain; `npm test` / `npm run typecheck` run function tests and type-check.

## California Agronomy Microservices Platform

TypeScript Netlify functions implement a microservices + gateway platform.
Domain modules live in `netlify/lib/` (`cimis`, `fret`, `soil`, `crop`, `cnra`,
`waterquality`, `gateway`, `ai-search`) with thin HTTP wrappers in
`netlify/functions/`. The frontend calls only the gateway (`/agronomy-api/*`) and
the mock AI search (`/ai-search-api`). Shared helpers (`http.ts` structured
logging, `models.ts`, `units.ts`, `geo.ts`, `irrigation.ts`) are reused across
services. The AI search is a deterministic mock (LLM calls stubbed). Required env
vars are in `.env.example`; see `docs/api-source-inventory.md` and related docs.

## C# / .NET Standards

- Target .NET 8 with `Nullable` and `ImplicitUsings` enabled.
- Prefer immutable `record` types for data models.
- Avoid `dynamic`; deserialize JSON into typed models with `System.Text.Json` web defaults.

## Blazor Standards

- Use routable components with `@page` directives.
- Keep component state in fields and derive values with computed C# properties.
- Use `IHttpClientFactory` named clients per backend; read base URLs from `appsettings`.
- Use `inject()`-style `@inject` and register singleton-style services as scoped in `Program.cs`.
- Use `IJSRuntime` for JS interop (Leaflet, `localStorage`); keep interop modules small.
- Implement `IDisposable`/`IAsyncDisposable` to clean up timers, handlers, and JS resources.

## Components And Templates

- Keep components small and focused on a single responsibility.
- Prefer scoped CSS (`Component.razor.css`) over global styles.
- Use native control flow (`@if`, `@foreach`, `@switch`).
- Keep templates simple and push logic into the `@code` block.
- Call `StateHasChanged` via `InvokeAsync` when updating UI from background tasks.
- Format numbers and dates with `CultureInfo.InvariantCulture` where output must be stable.

## Accessibility

- Changes must pass AXE checks.
- Meet WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

## Git Workflow

- Use short-lived feature branches and PRs into `master`.
- Never push directly to `master`.
- Branch names should follow `<type>/<short-description>`, for example `fix/gis-filter-reactivity`.
- Keep changes atomic. Do not batch unrelated work into one commit.
- If a change is becoming too large, pause and ask whether to commit current progress before continuing.

## Commit Messages

Use Angular Conventional Commits:

```text
<type>(<scope>): <subject>
```

Allowed types:

- `feat`
- `fix`
- `docs`
- `style`
- `refactor`
- `perf`
- `test`
- `build`
- `ci`
- `chore`

Commit subjects must:

- Use imperative, present tense.
- Start lowercase.
- Have no trailing period.
- Stay under 50 characters.

When a logical chunk of work is complete and the user has asked for commits, stage only relevant files and commit with the proper message.

## Code Editing

- Prefer existing project patterns over introducing new abstractions.
- Keep edits scoped to the requested change.
- Do not revert unrelated user changes.
- Add focused tests when behavior changes or risk warrants it.
