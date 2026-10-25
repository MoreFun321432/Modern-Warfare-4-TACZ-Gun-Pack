# Repository website

This Node.js service reads the gun pack metadata and icons directly from the
repository, then combines them with GitHub repository and release information.
It has no third-party runtime dependencies.

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
- `GET /api/download`: redirects to the latest release zip.
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

