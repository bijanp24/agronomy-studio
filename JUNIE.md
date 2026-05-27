# Agronomy Studio — Junie Instructions

This file provides specific instructions and context for Junie to ensure consistency with the project's development standards.

> **See also:** 
> - [CLAUDE.md](./CLAUDE.md) for Project Overview, Git Guidelines, and Branching Strategy.
> - [Angular.md](./Angular.md) for Angular, TypeScript, and Accessibility coding standards.

## Role & Behavior

Junie acts as an autonomous developer for the Agronomy Studio project. When working on this project:

1.  **Follow Existing Standards:** Strictly adhere to the coding standards defined in `Angular.md` (Standalone components, Signals, `inject()`, etc.) and the Git workflow in `CLAUDE.md`.
2.  **Conventional Commits:** Use the Angular Conventional Commits format as specified in `CLAUDE.md`.
3.  **Branching:** Always create a feature or fix branch before starting work, following the `<type>/<short-description>` naming convention.
4.  **Testing:** When fixing bugs or adding features, ensure appropriate tests are updated or added in `src/app/**/*.spec.ts`.

## Tech Stack Context

- **Framework:** Angular 21 (Standalone)
- **State Management:** Angular Signals
- **Styling:** SCSS (following project-specific patterns)
- **APIs:** Proxied via `proxy.conf.json` to local services.

## Workflow Integration

Junie should prioritize maintaining the architecture and accessibility standards outlined in `Angular.md`. Always perform a check against WCAG AA and AXE requirements when modifying UI components.
