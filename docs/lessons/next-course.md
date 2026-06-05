# Microservices & a Gateway: How Agronomy Studio Talks to a Dozen APIs

> **This file is the seed for the next LLM Academy course.** Edit it before you
> merge to `master`. On deploy, the `export-course-on-deploy` workflow sends this
> content to the Academy, which drafts a course and opens a PR for review.
>
> The first `# Heading` above becomes the suggested course title. Everything
> below is the raw material Claude builds the lessons from — outlines, bullet
> points, code snippets, and links all help. Delete this blockquote when you
> make it your own. If you leave the file empty, the automation falls back to the
> deploy's commit + changed files instead.

## What this course should teach

Agronomy Studio is a Blazor WebAssembly app whose backend is a set of TypeScript
Netlify functions arranged as **domain microservices behind a gateway**. The
frontend never calls the domain services directly — it calls one gateway
(`/agronomy-api/*`) plus a mock AI search. Turn that real architecture into a
course on building a small, honest microservices + gateway system.

### Suggested lessons

1. **Why a gateway?** — coupling, fan-out, and one front door. Contrast the
   frontend calling 12 services directly vs. calling a single gateway that
   composes them. Trade-offs: latency, partial failure, versioning.
2. **Domain modules vs. function wrappers** — `netlify/lib/*` (cimis, fret, soil,
   crop, cnra, waterquality, gateway, ai-search) hold the logic; thin
   `netlify/functions/*` wrappers expose them. Why that separation pays off.
3. **Redirects as routing** — how `netlify.toml` maps `/agronomy-api/*` to a
   function, and what a request's full path looks like end to end.
4. **Determinism at the boundary** — the AI search is a deterministic mock; LLM
   calls are stubbed. Why keeping AI out of the core compute path makes the
   system testable and the results trustworthy.

### Notes / raw material

- The frontend talks to exactly two surfaces: the gateway and the mock AI search.
- Local dev uses `tools/mock-apis.mjs`; production proxies through Netlify
  redirects to `netlify/functions/*.mjs`.
- Tests: `npm test` / `npm run typecheck` for the functions.
- Good place to discuss: separation of concerns, inversion of control, and how a
  gateway is itself an application of the "one front door" pattern.
