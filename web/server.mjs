import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const serverDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(serverDir, "..");
const publicDir = join(serverDir, "public");
const websiteUpdatesPath = join(serverDir, "website-updates.json");
const gunpackRoot = join(projectRoot, "assets", "mw4");
const gunIndexRoot = join(projectRoot, "data", "mw4", "index", "guns");
const gunIconRoot = join(projectRoot, "assets", "mw4", "textures", "gun", "slot");

const cache = {
  gunpack: null,
  gunpackAt: 0,
  github: null,
  githubAt: 0,
  githubError: null
};

const GUNPACK_CACHE_MS = 30_000;
const GITHUB_CACHE_MS = 5 * 60_000;

const staticFiles = new Map([
  ["/", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/index.html", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/changelog.html", { file: "changelog.html", type: "text/html; charset=utf-8" }],
  ["/website-updates.html", { file: "website-updates.html", type: "text/html; charset=utf-8" }],
  ["/website-update.html", { file: "website-update.html", type: "text/html; charset=utf-8" }],
  ["/styles.css", { file: "styles.css", type: "text/css; charset=utf-8" }],
  ["/app.js", { file: "app.js", type: "text/javascript; charset=utf-8" }],
  ["/changelog.js", { file: "changelog.js", type: "text/javascript; charset=utf-8" }],
  ["/website-updates.js", { file: "website-updates.js", type: "text/javascript; charset=utf-8" }],
  ["/website-update.js", { file: "website-update.js", type: "text/javascript; charset=utf-8" }],
  ["/website-update-redirect.js", { file: "website-update-redirect.js", type: "text/javascript; charset=utf-8" }],
  ["/website-update-data.js", { file: "website-update-data.js", type: "text/javascript; charset=utf-8" }],
  ["/release-data.js", { file: "release-data.js", type: "text/javascript; charset=utf-8" }]
]);

const mimeTypes = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"]
]);

const gunTypeLabels = {
  rifle: "突击步枪",
  sniper: "狙击步枪",
  pistol: "手枪",
  smg: "冲锋枪",
  shotgun: "霰弹枪",
  lmg: "轻机枪",
  mg: "机枪",
  dmr: "精确射手步枪",
  launcher: "发射器"
};

class GitHubRequestError extends Error {
  constructor(status, body) {
    super(`GitHub API ${status}: ${body}`);
    this.name = "GitHubRequestError";
    this.status = status;
  }
}

function stripJsonComments(text) {
  let output = "";
  let inString = false;
  let escaped = false;
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      index += 1;
      continue;
    }

    if (char === "\"") {
      inString = true;
      output += char;
      index += 1;
      continue;
    }

    if (char === "/" && text[index + 1] === "/") {
      while (index < text.length && text[index] !== "\n") index += 1;
      continue;
    }

    if (char === "/" && text[index + 1] === "*") {
      const end = text.indexOf("*/", index + 2);
      index = end === -1 ? text.length : end + 2;
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
}

async function readJson(file) {
  const source = await readFile(file, "utf8");
  try {
    return JSON.parse(source);
  } catch {
    return JSON.parse(stripJsonComments(source));
  }
}

async function readConfig() {
  try {
    return await readJson(join(serverDir, "config.json"));
  } catch {
    return {};
  }
}

function plainText(value) {
  return String(value ?? "").replace(/^§[0-9a-fklmnor]/gi, "").trim();
}

export async function readGunPackManifest() {
  const info = await readJson(join(gunpackRoot, "gunpack_info.json"));
  const [zhLang, enLang, indexFiles] = await Promise.all([
    readJson(join(gunpackRoot, "lang", "zh_cn.json")).catch(() => ({})),
    readJson(join(gunpackRoot, "lang", "en_us.json")).catch(() => ({})),
    readdir(gunIndexRoot)
  ]);

  const indexes = await Promise.all(
    indexFiles
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const id = name.slice(0, -5);
        const data = await readJson(join(gunIndexRoot, name));
        return {
          id,
          name: plainText(zhLang[data.name] || enLang[data.name] || id),
          description: plainText(zhLang[data.tooltip] || enLang[data.tooltip] || ""),
          type: data.type || "rifle",
          typeLabel: gunTypeLabels[data.type] || data.type || "枪械",
          sort: Number(data.sort ?? 999),
          iconUrl: `api/icons/${encodeURIComponent(id)}`
        };
      })
  );

  indexes.sort((left, right) => left.sort - right.sort || left.name.localeCompare(right.name, "zh-CN"));

  return {
    name: plainText(info.name),
    description: plainText(zhLang[info.desc] || enLang[info.desc] || info.desc),
    version: info.version,
    license: info.license,
    authors: info.authors || [],
    packDate: info.date,
    namespace: "mw4",
    guns: indexes
  };
}

export async function readWebsiteUpdates() {
  const payload = await readJson(websiteUpdatesPath);
  const updates = Array.isArray(payload.updates) ? payload.updates : [];
  return updates.sort((left, right) => {
    const leftTime = new Date(left.publishedAt || 0).getTime();
    const rightTime = new Date(right.publishedAt || 0).getTime();
    return rightTime - leftTime;
  });
}

async function getGunPackManifest() {
  const now = Date.now();
  if (!cache.gunpack || now - cache.gunpackAt > GUNPACK_CACHE_MS) {
    cache.gunpack = await readGunPackManifest();
    cache.gunpackAt = now;
  }
  return cache.gunpack;
}

export function normalizeRelease(release) {
  if (!release) return null;
  const zipAsset = (release.assets || []).find((asset) => /\.zip$/i.test(asset.name));
  return {
    tag: release.tag_name,
    name: release.name || release.tag_name,
    url: release.html_url,
    publishedAt: release.published_at,
    body: release.body || "",
    prerelease: Boolean(release.prerelease),
    downloadUrl: zipAsset?.browser_download_url || release.html_url,
    asset: zipAsset
      ? {
          name: zipAsset.name,
          size: zipAsset.size,
          downloadCount: zipAsset.download_count,
          updatedAt: zipAsset.updated_at
        }
      : null
  };
}

export function pickPackRelease(releases) {
  return releases.find((release) => !release.prerelease && release.asset)
    || releases.find((release) => release.asset)
    || releases.find((release) => !release.prerelease)
    || releases[0]
    || null;
}

export function sortReleasesByDate(releases) {
  return releases.sort((left, right) => {
    const leftTime = new Date(left.publishedAt || 0).getTime();
    const rightTime = new Date(right.publishedAt || 0).getTime();
    return rightTime - leftTime;
  });
}

async function githubRequest(url, token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "mw4-gunpack-site",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) {
    throw new GitHubRequestError(response.status, await response.text());
  }
  return response.json();
}

async function getGitHubData(force = false) {
  const now = Date.now();
  if (!force && cache.github && now - cache.githubAt < GITHUB_CACHE_MS) {
    return { data: cache.github, error: cache.githubError };
  }

  const config = await readConfig();
  const owner = process.env.GITHUB_OWNER || config.github?.owner;
  const repo = process.env.GITHUB_REPO || config.github?.repo;
  if (!owner || !repo) {
    cache.githubError = "GitHub repository is not configured.";
    return { data: null, error: cache.githubError };
  }

  const apiBase = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const token = process.env.GITHUB_TOKEN;
  const [repoResult, releasesResult] = await Promise.allSettled([
    githubRequest(apiBase, token),
    githubRequest(`${apiBase}/releases?per_page=30`, token)
  ]);

  const repository = repoResult.status === "fulfilled"
    ? {
        owner,
        name: repoResult.value.name,
        fullName: repoResult.value.full_name,
        url: repoResult.value.html_url,
        description: repoResult.value.description,
        defaultBranch: repoResult.value.default_branch,
        stars: repoResult.value.stargazers_count,
        forks: repoResult.value.forks_count,
        openIssues: repoResult.value.open_issues_count,
        updatedAt: repoResult.value.updated_at,
        pushedAt: repoResult.value.pushed_at
      }
    : null;
  const releases = releasesResult.status === "fulfilled"
    ? sortReleasesByDate(
        releasesResult.value.filter((release) => !release.draft).map(normalizeRelease)
      )
    : [];
  const release = pickPackRelease(releases);
  const errors = [repoResult, releasesResult]
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message || "GitHub request failed");

  cache.github = { repository, release, releases };
  cache.githubAt = now;
  cache.githubError = errors.length ? errors.join("; ") : null;
  return { data: cache.github, error: cache.githubError };
}

function sendJson(response, statusCode, payload, cacheControl = "no-store") {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": cacheControl
  });
  response.end(body);
}

function applySecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; " +
      "connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
  );
}

async function serveFile(response, file, type, method) {
  const fileStat = await stat(file);
  response.writeHead(200, {
    "Content-Type": type,
    "Content-Length": fileStat.size,
    "Cache-Control": "public, max-age=300"
  });
  if (method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
}

function redirect(response, location) {
  response.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store"
  });
  response.end();
}

async function handleRequest(request, response) {
  applySecurityHeaders(response);
  const method = request.method || "GET";
  if (method !== "GET" && method !== "HEAD") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const origin = `http://${request.headers.host || "localhost"}`;
  const url = new URL(request.url || "/", origin);

  if (url.pathname === "/healthz") {
    sendJson(response, 200, { ok: true, service: "mw4-gunpack-site" });
    return;
  }

  if (url.pathname === "/api/gunpack") {
    sendJson(response, 200, await getGunPackManifest(), "public, max-age=30");
    return;
  }

  if (url.pathname === "/api/status") {
    const [gunpack, github] = await Promise.all([
      getGunPackManifest(),
      getGitHubData(url.searchParams.get("refresh") === "1")
    ]);
    sendJson(response, 200, {
      gunpack,
      github: github.data,
      githubError: github.error,
      refreshedAt: new Date().toISOString()
    });
    return;
  }

  if (url.pathname === "/api/download") {
    const gunpack = await getGunPackManifest();
    const github = await getGitHubData();
    const location = github.data?.release?.downloadUrl
      || github.data?.repository?.url
      || `https://github.com/MoreFun321432/Modern-Warfare-4-TACZ-Gun-Pack/releases/tag/v${gunpack.version}`;
    const accelerated = url.searchParams.get("accelerated") === "1"
      ? `https://github.akams.cn/?url=${encodeURIComponent(location)}`
      : location;
    redirect(response, accelerated);
    return;
  }

  if (url.pathname === "/api/releases") {
    const github = await getGitHubData(url.searchParams.get("refresh") === "1");
    sendJson(response, 200, {
      releases: github.data?.releases || [],
      error: github.error,
      refreshedAt: new Date().toISOString()
    }, "public, max-age=60");
    return;
  }

  if (url.pathname === "/api/website-updates") {
    sendJson(response, 200, {
      updates: await readWebsiteUpdates()
    });
    return;
  }

  if (url.pathname.startsWith("/api/icons/")) {
    const id = decodeURIComponent(url.pathname.slice("/api/icons/".length));
    const manifest = await getGunPackManifest();
    if (!manifest.guns.some((gun) => gun.id === id)) {
      sendJson(response, 404, { error: "Gun icon not found" });
      return;
    }
    const file = join(gunIconRoot, `${id}.png`);
    await serveFile(response, file, "image/png", method);
    return;
  }

  const detailMatch = url.pathname.match(/^\/website-updates\/([a-z0-9._-]+)\.html$/i);
  if (detailMatch) {
    const updateId = detailMatch[1];
    const template = await readFile(join(serverDir, "templates", "website-update-detail.html"), "utf8");
    const body = template.replaceAll("{{UPDATE_ID}}", updateId);
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
      "Cache-Control": "public, max-age=300"
    });
    response.end(body);
    return;
  }

  const staticEntry = staticFiles.get(url.pathname);
  if (staticEntry) {
    await serveFile(response, join(publicDir, staticEntry.file), staticEntry.type, method);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

export function createAppServer() {
  return createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      console.error(error);
      if (!response.headersSent) {
        sendJson(response, 500, { error: "Internal server error" });
      } else {
        response.destroy(error);
      }
    });
  });
}

export function startServer(port = Number(process.env.PORT || 3000)) {
  const server = createAppServer();
  server.listen(port, "0.0.0.0", () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    console.log(`MW4 gun pack site listening on http://localhost:${actualPort}`);
  });
  return server;
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  startServer();
}

