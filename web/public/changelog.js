import {
  acceleratedReleaseUrl,
  formatReleaseBytes,
  formatReleaseDate,
  loadReleases,
  releaseAnchor,
  renderReleaseNotes
} from "./release-data.js?v=20261025-2";

const list = document.querySelector("#changelog-list");
const count = document.querySelector("#release-count");

function createReleaseEntry(release) {
  const article = document.createElement("article");
  article.className = "release-entry";
  article.id = releaseAnchor(release.tag);

  const header = document.createElement("header");
  header.className = "release-entry-header";
  const copy = document.createElement("div");
  const tag = document.createElement("span");
  tag.className = "update-version";
  tag.textContent = release.tag;
  const heading = document.createElement("h2");
  heading.textContent = release.name;
  const time = document.createElement("time");
  time.dateTime = release.publishedAt || "";
  time.textContent = formatReleaseDate(release.publishedAt);
  copy.append(tag, heading, time);

  const actions = document.createElement("div");
  actions.className = "release-actions";
  const accelerated = document.createElement("a");
  accelerated.className = "button button-primary";
  accelerated.href = acceleratedReleaseUrl(release.downloadUrl);
  accelerated.rel = "noreferrer";
  accelerated.textContent = "加速下载";
  const direct = document.createElement("a");
  direct.className = "button button-ghost";
  direct.href = release.url;
  direct.rel = "noreferrer";
  direct.textContent = "GitHub Release ↗";
  actions.append(accelerated, direct);
  header.append(copy, actions);

  const facts = document.createElement("div");
  facts.className = "release-facts";
  if (release.asset) {
    const asset = document.createElement("span");
    asset.textContent = `${release.asset.name} · ${formatReleaseBytes(release.asset.size)}`;
    facts.append(asset);
  } else {
    const asset = document.createElement("span");
    asset.textContent = "该版本没有附带 zip 文件";
    facts.append(asset);
  }

  const notes = document.createElement("div");
  notes.className = "release-notes";
  renderReleaseNotes(release.body, notes);

  article.append(header, facts, notes);
  return article;
}

async function renderChangelog() {
  try {
    const releases = await loadReleases();
    count.textContent = `${releases.length} 个版本`;
    list.replaceChildren();
    if (releases.length === 0) {
      const empty = document.createElement("div");
      empty.className = "log-empty";
      empty.textContent = "暂时没有可展示的 Release 更新日志。";
      list.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    releases.forEach((release) => fragment.append(createReleaseEntry(release)));
    list.append(fragment);

    if (window.location.hash) {
      document.querySelector(window.location.hash)?.scrollIntoView();
    }
  } catch (error) {
    console.error(error);
    list.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "log-empty";
    empty.textContent = "更新日志暂时无法载入，请稍后重试。";
    list.append(empty);
  }
}

renderChangelog();

