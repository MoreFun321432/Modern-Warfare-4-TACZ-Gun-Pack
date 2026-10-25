import {
  createHomeReleaseCard,
  loadPackReleases,
  loadReleases,
  pickPackRelease
} from "./release-data.js?v=20261025-5";
import {
  createHomepageWebsiteUpdate,
  loadWebsiteUpdates
} from "./website-update-data.js?v=20261025-1";

const elements = {
  packVersion: document.querySelector("#pack-version"),
  gunCount: document.querySelector("#gun-count"),
  repoStars: document.querySelector("#repo-stars"),
  manifestVersion: document.querySelector("#manifest-version"),
  manifestLicense: document.querySelector("#manifest-license"),
  releaseDate: document.querySelector("#release-date"),
  grid: document.querySelector("#gun-grid"),
  repositoryDescription: document.querySelector("#repository-description"),
  repoName: document.querySelector("#repo-name"),
  repoUpdated: document.querySelector("#repo-updated"),
  assetSize: document.querySelector("#asset-size"),
  downloadAccelerated: document.querySelector("#download-accelerated"),
  downloadDirect: document.querySelector("#download-direct"),
  recentReleases: document.querySelector("#recent-releases"),
  homepageWebsiteUpdates: document.querySelector("#homepage-website-updates"),
  repoLinks: [
    document.querySelector("#repo-nav-link"),
    document.querySelector("#repo-panel-link")
  ].filter(Boolean)
};

const repositoryConfig = {
  owner: "MoreFun321432",
  repo: "Modern-Warfare-4-TACZ-Gun-Pack"
};

const repositoryUrl = `https://github.com/${repositoryConfig.owner}/${repositoryConfig.repo}`;
const releasesUrl = `${repositoryUrl}/releases`;
const acceleratedDownloadUrl = (url) => `https://github.akams.cn/?url=${encodeURIComponent(url)}`;

const numberFormatter = new Intl.NumberFormat("zh-CN");
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function formatDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : dateFormatter.format(date);
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "--";
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function applyRepositoryLinks(url) {
  if (!url) return;
  for (const link of elements.repoLinks) link.href = url;
}

function applyDownloadLinks(url) {
  const target = url || releasesUrl;
  elements.downloadAccelerated.href = acceleratedDownloadUrl(target);
  elements.downloadDirect.href = target;
}

function createGunCard(gun, index) {
  const article = document.createElement("article");
  article.className = "gun-card";

  const top = document.createElement("div");
  top.className = "gun-card-top";
  const number = document.createElement("span");
  number.textContent = String(index + 1).padStart(2, "0");
  const type = document.createElement("span");
  type.className = "gun-type";
  type.textContent = gun.typeLabel;
  top.append(number, type);

  const imageWrap = document.createElement("div");
  imageWrap.className = "gun-image-wrap";
  const image = document.createElement("img");
  image.className = "gun-image";
  image.src = gun.iconUrl;
  image.alt = `${gun.name} 图标`;
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => image.remove(), { once: true });
  imageWrap.append(image);

  const heading = document.createElement("h3");
  heading.textContent = gun.name;
  const description = document.createElement("p");
  description.textContent = gun.description || "Modern Warfare 4 枪械平台";

  article.append(top, imageWrap, heading, description);
  return article;
}

function renderGuns(guns) {
  elements.grid.replaceChildren();
  if (!Array.isArray(guns) || guns.length === 0) {
    const empty = document.createElement("div");
    empty.className = "loading-panel";
    empty.textContent = "仓库中暂未找到枪械索引。";
    elements.grid.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  guns.forEach((gun, index) => fragment.append(createGunCard(gun, index)));
  elements.grid.append(fragment);
}

function renderStatus(data) {
  const { gunpack, github, githubError } = data;
  elements.packVersion.textContent = gunpack.version;
  elements.gunCount.textContent = numberFormatter.format(gunpack.guns.length);
  elements.manifestVersion.textContent = `MW4 / ${gunpack.version.replace("-Release", "")}`;
  elements.manifestLicense.textContent = gunpack.license;
  renderGuns(gunpack.guns);

  const repository = github?.repository;
  const release = github?.release;
  applyDownloadLinks(release?.downloadUrl);
  if (repository) {
    elements.repoName.textContent = repository.fullName;
    elements.repoStars.textContent = numberFormatter.format(repository.stars);
    elements.repoUpdated.textContent = formatDate(repository.pushedAt || repository.updatedAt);
    elements.repositoryDescription.textContent = repository.description || "仓库已连接。";
    applyRepositoryLinks(repository.url);
  } else {
    elements.repoName.textContent = "GitHub API 暂不可用";
    elements.repoStars.textContent = "--";
    elements.repoUpdated.textContent = "--";
    elements.repositoryDescription.textContent = githubError
      ? "枪包数据已加载；GitHub 状态暂时无法同步。"
      : "等待仓库状态同步。";
  }

  if (release) {
    elements.releaseDate.textContent = formatDate(release.publishedAt);
    elements.assetSize.textContent = release.asset
      ? `${formatBytes(release.asset.size)} / ${numberFormatter.format(release.asset.downloadCount)} 次`
      : release.tag;
  } else {
    elements.releaseDate.textContent = "NO RELEASE";
    elements.assetSize.textContent = "--";
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadFromLocalBackend() {
  return fetchJson(new URL("api/status", document.baseURI), {
    headers: { Accept: "application/json" }
  });
}

async function loadFromGitHubPages() {
  const apiBase = `https://api.github.com/repos/${repositoryConfig.owner}/${repositoryConfig.repo}`;
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  const [gunpack, repositoryResult, releases] = await Promise.all([
    fetchJson(new URL("api/gunpack.json", document.baseURI)),
    fetchJson(apiBase, { headers }),
    loadReleases()
  ]);
  const packRelease = pickPackRelease(releases);

  return {
    gunpack,
    github: {
      repository: {
        owner: repositoryResult.owner?.login,
        name: repositoryResult.name,
        fullName: repositoryResult.full_name,
        url: repositoryResult.html_url,
        description: repositoryResult.description,
        defaultBranch: repositoryResult.default_branch,
        stars: repositoryResult.stargazers_count,
        forks: repositoryResult.forks_count,
        openIssues: repositoryResult.open_issues_count,
        updatedAt: repositoryResult.updated_at,
        pushedAt: repositoryResult.pushed_at
      },
      release: packRelease
    },
    githubError: null,
    refreshedAt: new Date().toISOString()
  };
}

async function loadStatus() {
  try {
    let data;
    try {
      data = await loadFromLocalBackend();
    } catch {
      data = await loadFromGitHubPages();
    }
    renderStatus(data);
  } catch (error) {
    console.error(error);
    elements.grid.replaceChildren();
    const panel = document.createElement("div");
    panel.className = "loading-panel";
    panel.textContent = "网页后端暂时无法连接，请稍后刷新。";
    elements.grid.append(panel);
    elements.packVersion.textContent = "OFFLINE";
    elements.gunCount.textContent = "--";
    elements.repoStars.textContent = "--";
  }
}

async function loadRecentReleases() {
  try {
    const releases = await loadPackReleases();
    elements.recentReleases.replaceChildren();
    if (releases.length === 0) {
      const empty = document.createElement("div");
      empty.className = "loading-panel";
      empty.textContent = "暂时没有可展示的 Release 更新。";
      elements.recentReleases.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    releases.slice(0, 3).forEach((release) => fragment.append(createHomeReleaseCard(release)));
    elements.recentReleases.append(fragment);
  } catch (error) {
    console.error(error);
    elements.recentReleases.replaceChildren();
    const panel = document.createElement("div");
    panel.className = "loading-panel";
    panel.textContent = "更新日志暂时无法载入，请稍后重试。";
    elements.recentReleases.append(panel);
  }
}

async function loadHomepageWebsiteUpdates() {
  try {
    const updates = await loadWebsiteUpdates();
    elements.homepageWebsiteUpdates.replaceChildren();
    if (updates.length === 0) {
      const empty = document.createElement("div");
      empty.className = "loading-panel";
      empty.textContent = "暂时没有网页更新记录。";
      elements.homepageWebsiteUpdates.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    updates.slice(0, 3).forEach((update) => fragment.append(createHomepageWebsiteUpdate(update)));
    elements.homepageWebsiteUpdates.append(fragment);
  } catch (error) {
    console.error(error);
    elements.homepageWebsiteUpdates.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "loading-panel";
    empty.textContent = "网页更新记录暂时无法载入。";
    elements.homepageWebsiteUpdates.append(empty);
  }
}

applyDownloadLinks(releasesUrl);
loadStatus();
loadRecentReleases();
loadHomepageWebsiteUpdates();
