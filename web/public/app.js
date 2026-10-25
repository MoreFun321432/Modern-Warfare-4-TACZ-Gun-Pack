const elements = {
  packVersion: document.querySelector("#pack-version"),
  gunCount: document.querySelector("#gun-count"),
  repoStars: document.querySelector("#repo-stars"),
  manifestVersion: document.querySelector("#manifest-version"),
  releaseDate: document.querySelector("#release-date"),
  grid: document.querySelector("#gun-grid"),
  repositoryDescription: document.querySelector("#repository-description"),
  repoName: document.querySelector("#repo-name"),
  repoUpdated: document.querySelector("#repo-updated"),
  assetSize: document.querySelector("#asset-size"),
  repoLinks: [
    document.querySelector("#repo-nav-link"),
    document.querySelector("#repo-hero-link"),
    document.querySelector("#repo-panel-link")
  ].filter(Boolean)
};

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
  renderGuns(gunpack.guns);

  const repository = github?.repository;
  const release = github?.release;
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

async function loadStatus() {
  try {
    const response = await fetch("/api/status", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderStatus(await response.json());
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

loadStatus();

