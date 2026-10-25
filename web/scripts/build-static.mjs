import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  normalizeRelease,
  readGunPackManifest,
  readWebsiteUpdates,
  sortReleasesByDate
} from "../server.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(scriptDir, "..");
const projectRoot = resolve(webDir, "..");
const repositoryOwner = process.env.GITHUB_OWNER || "MoreFun321432";
const repositoryName = process.env.GITHUB_REPO || "Modern-Warfare-4-TACZ-GunPack";

export async function fetchStaticReleases({
  owner = repositoryOwner,
  repo = repositoryName,
  token = process.env.GITHUB_TOKEN
} = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "mw4-gunpack-pages-build",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=30`,
      { headers, signal: AbortSignal.timeout(10_000) }
    );
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    const releases = await response.json();
    return sortReleasesByDate(releases.filter((release) => !release.draft).map(normalizeRelease));
  } catch (error) {
    console.warn(`Could not snapshot GitHub Releases: ${error.message}`);
    return [];
  }
}

export async function fetchStaticRepository({
  owner = repositoryOwner,
  repo = repositoryName,
  token = process.env.GITHUB_TOKEN
} = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "mw4-gunpack-pages-build",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { headers, signal: AbortSignal.timeout(10_000) }
    );
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    const repository = await response.json();
    return {
      owner,
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
      description: repository.description,
      defaultBranch: repository.default_branch,
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      openIssues: repository.open_issues_count,
      updatedAt: repository.updated_at,
      pushedAt: repository.pushed_at
    };
  } catch (error) {
    console.warn(`Could not snapshot GitHub repository status: ${error.message}`);
    return null;
  }
}

export function toStaticManifest(manifest) {
  return {
    ...manifest,
    guns: manifest.guns.map((gun) => ({
      ...gun,
      iconUrl: `${gun.iconUrl}.png`
    }))
  };
}

export function toDetailPage(template, updateId) {
  if (!/^[a-z0-9._-]+$/i.test(updateId)) {
    throw new Error(`Invalid website update id: ${updateId}`);
  }
  return template.replaceAll("{{UPDATE_ID}}", updateId);
}

export async function buildStaticSite() {
  const publicDir = join(webDir, "public");
  const distDir = join(webDir, "dist");
  const iconSourceDir = join(projectRoot, "assets", "mw4", "textures", "gun", "slot");
  const iconOutputDir = join(distDir, "api", "icons");
  const detailOutputDir = join(distDir, "website-updates");

  await rm(distDir, { recursive: true, force: true });
  await mkdir(iconOutputDir, { recursive: true });
  await mkdir(detailOutputDir, { recursive: true });
  const publicEntries = await readdir(publicDir);
  for (const name of publicEntries) {
    if (!name.includes(".bak")) {
      await cp(join(publicDir, name), join(distDir, name), { recursive: true });
    }
  }

  const [manifest, releases, repository] = await Promise.all([
    readGunPackManifest(),
    fetchStaticReleases(),
    fetchStaticRepository()
  ]);
  const staticManifest = toStaticManifest(manifest);
  await writeFile(join(distDir, "api", "gunpack.json"), `${JSON.stringify(staticManifest, null, 2)}\n`, "utf8");
  await writeFile(join(distDir, "api", "releases.json"), `${JSON.stringify(releases, null, 2)}\n`, "utf8");
  await writeFile(join(distDir, "api", "repository.json"), `${JSON.stringify(repository, null, 2)}\n`, "utf8");
  await cp(join(webDir, "website-updates.json"), join(distDir, "api", "website-updates.json"));

  const [detailTemplate, websiteUpdates] = await Promise.all([
    readFile(join(webDir, "templates", "website-update-detail.html"), "utf8"),
    readWebsiteUpdates()
  ]);
  for (const update of websiteUpdates) {
    await writeFile(
      join(detailOutputDir, `${update.id}.html`),
      toDetailPage(detailTemplate, update.id),
      "utf8"
    );
  }

  const iconNames = new Set(manifest.guns.map((gun) => `${gun.id}.png`));
  const sourceFiles = await readdir(iconSourceDir);
  for (const name of sourceFiles) {
    if (iconNames.has(name)) {
      await cp(join(iconSourceDir, name), join(iconOutputDir, name));
    }
  }

  console.log(
    `Built static site: ${manifest.version}, ${manifest.guns.length} guns, ` +
      `${releases.length} releases, ${websiteUpdates.length} website detail pages`
  );
  return staticManifest;
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  await buildStaticSite();
}

