# Agronomy Studio — Claude Instructions

## Project

Angular 21 standalone-component SPA for California field intelligence.
Two backend services proxied locally:

- `/field-api` → `http://localhost:4302` (field-intelligence-app)
- `/weather-api` → `http://localhost:4300` (weather-intelligence-app)

## Git Commit Guidelines

### 1. Atomic Commits

Never batch unrelated changes into a single commit.

- Break work into logical, isolated milestones.
- If a new UI component is generated, commit it. If a new API service is built, commit it separately.
- If a commit is growing too large, pause and ask the user whether to commit current progress before continuing.

### 2. Conventional Commits Standard

All commit messages must follow the Angular Conventional Commits format:

```
<type>(<scope>): <subject>
```

**Allowed types:** `feat` · `fix` · `docs` · `style` · `refactor` · `perf` · `test` · `build` · `ci` · `chore`

**Scope:** name of the npm package, module, or component affected (e.g. `gis`, `fields`, `entropy`, `dashboard`).

### 3. Subject Line Rules

- Use imperative, present tense: "change" not "changed" or "changes"
- Do not capitalize the first letter
- No trailing dot
- Keep it under 50 characters

### 4. Execution

When a logical chunk of work is complete, automatically stage the relevant files and execute the git commit with the properly formatted message — no need to ask twice.
