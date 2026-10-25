# Repository website

This Node.js service reads the gun pack metadata and icons directly from the
repository, then combines them with GitHub repository and release information.
It has no third-party runtime dependencies.

The public static build is published by GitHub Pages at:
<https://morefun321432.github.io/Modern-Warfare-4-TACZ-Gun-Pack/>.
It falls back to the GitHub API and a generated `api/gunpack.json` when the
Node.js backend is not running. GitHub Pages also receives a generated
`api/releases.json` snapshot for the home-page recent updates and the full
`changelog.html` history.

Website history is isolated on `website-updates.html` and never appears in the
gun-pack changelog. Every visible website change must update
`web/website-updates.json` in the same commit. The page reads this file through
`GET /api/website-updates` locally and `api/website-updates.json` on Pages.
Standalone `website-*` Releases are optional and never provide a download.

The gun pack content follows TACZ's GPL-3.0 license. This website's source
code and documentation are licensed separately under MIT.

Run locally from the repository root:

```powershell
node web/server.mjs
```

Open `http://localhost:3000`.

Environment variables:

- `PORT`: HTTP port, default `3000`.
- `GITHUB_OWNER` / `GITHUB_REPO`: override `web/config.json`.
- `GITHUB_TOKEN`: optional token for a higher GitHub API rate limit.

Endpoints:

- `GET /api/status`: gun pack, repository and latest release status.
- `GET /api/gunpack`: local gun pack manifest.
- `GET /api/releases`: up to 30 GitHub Releases with notes and asset metadata.
- `GET /api/website-updates`: repository-managed website update history.
- `GET /api/download`: redirects to the latest release zip.
- `GET /api/download?accelerated=1`: redirects through `github.akams.cn`.
- `GET /api/icons/:id`: serves a gun icon from the pack.
- `GET /healthz`: health check.

Run the tests with:

```powershell
node --test web/test/server.test.mjs
```

Build the container from the repository root:

```powershell
docker build -f web/Dockerfile -t mw4-gunpack-site .
```

Build the GitHub Pages artifact:

```powershell
node web/scripts/build-static.mjs
```

