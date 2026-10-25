# Domestic mirror admin

The admin console is served by the Node.js backend at `/admin/`. It uses
GitHub OAuth and rejects every account except the immutable GitHub user ID
configured in `ADMIN_GITHUB_ID` (default `317516594`).

## GitHub OAuth app

Create a GitHub OAuth app under the repository owner's GitHub settings:

- Homepage URL: the public backend URL.
- Authorization callback URL: `<public backend URL>/auth/github/callback`.
- Device Flow: not required.

Set the generated client ID and secret, plus the public backend URL, in the
server environment:

```text
PUBLIC_BASE_URL=https://admin.example.com
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
ADMIN_GITHUB_ID=317516594
ADMIN_GITHUB_LOGIN=Skydeps1459
```

The OAuth request uses `read:user public_repo`. The signed-in owner's token is
kept only in the server-side session and is used to commit
`web/domestic-mirror.json` through the GitHub Contents API. No repository write
token is exposed to the browser.

After saving, the Pages workflow rebuilds automatically and publishes the new
Lanzou mirror to `api/domestic-mirror.json`.

