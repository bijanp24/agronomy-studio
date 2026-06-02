# Static Content to Netlify App Workflow

This note captures a repeatable workflow for turning graphic-designer-provided static content into a small app that can be deployed to Netlify from GitHub.

The goal is to avoid debugging the same hosting, routing, and build-output problems for every new project.

## Core Idea

Use a preconfigured starter app as the baseline, then treat the designer's files as content that gets imported into the app.

The flow should look like this:

```text
clone starter app
drop designer files into a known folder
run an import/validation script
review locally
push to GitHub
Netlify deploys
```

This keeps app structure, deployment config, and designer content separate.

## Recommended Starter Repo

Create or maintain a template repository that already includes:

- A working app shell, such as Blazor WebAssembly.
- Known-good Netlify configuration.
- SPA routing fallback.
- A verified publish command.
- A deploy sanity check that fails if the build output is incomplete.
- Optional GitHub Actions deployment for projects where Netlify's build environment is unreliable.
- A documented folder where designer content belongs.

For a Blazor WebAssembly app, the starter should include a `netlify.toml` pattern like:

```toml
[build]
  command = '''
    curl -sSL https://dot.net/v1/dotnet-install.sh | bash /dev/stdin --channel 8.0 --install-dir "${HOME}/.dotnet" && \
    export DOTNET_ROOT="${HOME}/.dotnet" && \
    export PATH="${DOTNET_ROOT}:${PATH}" && \
    dotnet --version && \
    dotnet publish YourApp.csproj -c Release -o release && \
    test -f release/wwwroot/_framework/blazor.boot.json
  '''
  publish = "release/wwwroot"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

If the Netlify UI insists on publishing `wwwroot`, the build can copy the publish output into `wwwroot` after `dotnet publish`. The important rule is that Netlify must deploy the published `wwwroot`, not the source `wwwroot`.

## Designer Drop Zone

Give designers a simple folder contract. For example:

```text
designer-input/
  assets/
  css/
  pages/
  metadata.json
```

Suggested responsibilities:

- `assets/`: images, PDFs, fonts, downloads, icons, and other media.
- `css/`: designer-provided stylesheet files.
- `pages/`: static HTML snippets or page files.
- `metadata.json`: optional structured content, such as page titles, navigation labels, route slugs, hero text, and asset references.

The designer should avoid:

- Absolute local paths like `C:\Users\...`.
- Links to files outside the package.
- Inline references to unpublished build artifacts.
- Framework-specific deployment assumptions.
- Manually editing generated Blazor `_framework` files.

## Import Script

The starter repo should eventually include a script that turns designer content into app content.

The script can:

- Copy assets into `wwwroot/designer/` or another stable public path.
- Normalize file names and paths.
- Convert simple HTML pages into app route content.
- Generate route metadata from `metadata.json`.
- Rewrite asset references to match the app's public paths.
- Warn about broken links and missing assets.
- Fail if required files are missing.

An example target structure after import:

```text
wwwroot/
  designer/
    assets/
    css/

Content/
  pages.json

Pages/
  DesignerPage.razor
```

The app can then render designer pages from structured content instead of requiring every page to be hand-coded.

## GitHub Handoff

Use GitHub as the handoff and deployment trigger.

Recommended flow:

1. Start from the template repo.
2. Add designer files to `designer-input/`.
3. Run the import script locally.
4. Review with `dotnet run`.
5. Commit the source content and generated app content.
6. Push to GitHub.
7. Netlify builds and deploys.

For projects with more collaboration, use pull requests:

```text
designer-content branch
review rendered app
merge to main
Netlify deploys production
```

## Netlify Deployment Rules

For Blazor WebAssembly, the deployed folder must contain:

```text
index.html
_framework/
css/
assets or designer content folders
```

The deployed `index.html` must be the result of `dotnet publish`. It should not contain Blazor placeholder syntax such as:

```html
_framework/blazor.webassembly#[.{fingerprint}].js
```

A healthy deployed script tag looks more like:

```html
<script src="_framework/blazor.webassembly.js"></script>
```

or a fingerprinted build output such as:

```html
<script src="_framework/blazor.webassembly.abc123.js"></script>
```

## Deployment Verification

After each deploy, verify:

- `https://<site>/_framework/blazor.boot.json` returns JSON, not HTML.
- The deployed page source does not include `#[.{fingerprint}]`.
- The browser console has no `Unexpected token '<'` error.
- Direct navigation to app routes works, such as `/about` or `/portfolio`.
- Refreshing a nested route still loads the app.

The `Unexpected token '<'` error usually means the browser requested JavaScript but received HTML. Common causes:

- Netlify published the source `wwwroot` instead of the published output.
- `_framework` was not deployed.
- A redirect rule is catching framework file requests.
- The script URL in `index.html` is malformed.

## GitHub Actions Fallback

If Netlify's own build environment is unreliable, use GitHub Actions to build and deploy.

The workflow should:

1. Check out the repo.
2. Install the correct .NET SDK.
3. Run `dotnet publish`.
4. Verify `_framework/blazor.boot.json` exists.
5. Deploy `release/wwwroot` to Netlify.

Required GitHub secrets:

- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID`

In this setup, Netlify automatic builds can be disabled or ignored, and GitHub Actions becomes the source of truth for deployment.

## Template Checklist

Before using a starter repo for client or designer projects, confirm it has:

- A working local development command.
- A working production publish command.
- A known-good `netlify.toml`.
- SPA fallback redirects.
- Build checks for `_framework`.
- Documentation for where designer content goes.
- An import or validation script.
- A deploy verification checklist.
- Clear GitHub secrets documentation if using GitHub Actions.

## Long-Term Goal

The long-term goal is to make designer-to-app conversion predictable:

```text
static design package + starter app + import script = deployable Netlify app
```

That lets each new project focus on content quality and app polish instead of repeated deployment troubleshooting.
