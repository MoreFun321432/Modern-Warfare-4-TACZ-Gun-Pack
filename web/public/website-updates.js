import {
  formatReleaseDate,
  loadWebsiteReleases,
  releaseAnchor,
  renderReleaseNotes
} from "./release-data.js?v=20261025-5";

const list = document.querySelector("#website-update-list");
const count = document.querySelector("#website-release-count");

function createWebsiteUpdateEntry(release) {
  const article = document.createElement("article");
  article.className = "release-entry website-release-entry";
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
  const releaseLink = document.createElement("a");
  releaseLink.className = "button button-ghost";
  releaseLink.href = release.url;
  releaseLink.rel = "noreferrer";
  releaseLink.textContent = "GitHub 发行说明 ↗";
  actions.append(releaseLink);
  header.append(copy, actions);

  const facts = document.createElement("div");
  facts.className = "release-facts";
  facts.textContent = "网页版本记录 · 不提供网站文件下载";

  const notes = document.createElement("div");
  notes.className = "release-notes";
  renderReleaseNotes(release.body, notes);

  article.append(header, facts, notes);
  return article;
}

async function renderWebsiteUpdates() {
  try {
    const releases = await loadWebsiteReleases();
    count.textContent = `${releases.length} 次网页更新`;
    list.replaceChildren();

    if (releases.length === 0) {
      const empty = document.createElement("div");
      empty.className = "log-empty";
      empty.textContent = "暂时没有网页更新记录。";
      list.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    releases.forEach((release) => fragment.append(createWebsiteUpdateEntry(release)));
    list.append(fragment);

    if (window.location.hash) {
      document.querySelector(window.location.hash)?.scrollIntoView();
    }
  } catch (error) {
    console.error(error);
    list.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "log-empty";
    empty.textContent = "网页更新记录暂时无法载入，请稍后重试。";
    list.append(empty);
  }
}

renderWebsiteUpdates();

