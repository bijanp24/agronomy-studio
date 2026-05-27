# Agronomy Studio - Codex Instructions

## Project

Agronomy Studio is an Angular 21 standalone-component SPA for California field intelligence.

Local development proxies two backend services:

- `/field-api` -> `http://localhost:4302` (`field-intelligence-app`)
- `/weather-api` -> `http://localhost:4300` (`weather-intelligence-app`)

## Reference Instructions

- Follow [Angular.md](./Angular.md) for Angular, TypeScript, and accessibility standards.
- Keep this file aligned with [CLAUDE.md](./CLAUDE.md) when repository workflow guidance changes.

## Development Commands

- `npm start` runs the Angular dev server.
- `npm run build` builds the app.
- `npm test` runs tests.

## TypeScript Standards

- Use strict type checking.
- Prefer type inference when the type is obvious.
- Avoid `any`; use `unknown` when the type is uncertain.

## Angular Standards

- Use standalone components. Do not add `standalone: true`; it is the default in Angular v20+.
- Use signals for local component state and `computed()` for derived state.
- Use `set` or `update` for signal changes; do not use `mutate`.
- Implement lazy loading for feature routes.
- Use `inject()` instead of constructor injection.
- Use `providedIn: 'root'` for singleton services.
- Use `NgOptimizedImage` for static images, except inline base64 images.
- Put host bindings/listeners in the `host` object instead of using `@HostBinding` or `@HostListener`.

## Components And Templates

- Keep components small and focused on a single responsibility.
- Set `changeDetection: ChangeDetectionStrategy.OnPush`.
- Use `input()` and `output()` instead of decorator-based inputs and outputs.
- Prefer inline templates for small components.
- Prefer Reactive Forms over Template-driven Forms.
- Use native control flow (`@if`, `@for`, `@switch`) instead of structural directives.
- Use the async pipe for observables.
- Keep templates simple and avoid complex logic.
- Do not assume globals such as `new Date()` are available in templates.
- Do not use `ngClass`; use class bindings.
- Do not use `ngStyle`; use style bindings.
- When using external templates or styles, use paths relative to the component TypeScript file.

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
