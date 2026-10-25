const list = document.querySelector("#website-update-list");
const count = document.querySelector("#website-release-count");
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function formatDate(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? "--" : dateFormatter.format(date);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadWebsiteUpdates() {
  const localApi = new URL("api/website-updates", document.baseURI);
  localApi.searchParams.set("v", Date.now().toString());
  const staticApi = new URL("api/website-updates.json", document.baseURI);

  for (const source of [localApi, staticApi]) {
    try {
      const payload = await fetchJson(source);
      if (Array.isArray(payload.updates)) return payload.updates;
    } catch (error) {
      console.info(`Website update source unavailable: ${source}`, error.message);
    }
  }
  return [];
}

function createChangeSection(title, items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const section = document.createElement("section");
  section.className = "website-change-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const changes = document.createElement("ul");
  for (const item of items) {
    const entry = document.createElement("li");
    entry.textContent = item;
    changes.append(entry);
  }
  section.append(heading, changes);
  return section;
}

function createWebsiteUpdateEntry(update) {
  const article = document.createElement("article");
  article.className = "release-entry website-release-entry";
  article.id = `web-update-${update.id}`;

  const header = document.createElement("header");
  header.className = "release-entry-header";
  const copy = document.createElement("div");
  const version = document.createElement("span");
  version.className = "update-version";
  version.textContent = update.id;
  const heading = document.createElement("h2");
  heading.textContent = update.title;
  const time = document.createElement("time");
  time.dateTime = update.publishedAt || "";
  time.textContent = formatDate(update.publishedAt);
  copy.append(version, heading, time);

  const actions = document.createElement("div");
  actions.className = "release-actions";
  if (update.releaseUrl) {
    const releaseLink = document.createElement("a");
    releaseLink.className = "button button-ghost";
    releaseLink.href = update.releaseUrl;
    releaseLink.rel = "noreferrer";
    releaseLink.textContent = "GitHub 发行说明 ↗";
    actions.append(releaseLink);
  }
  header.append(copy, actions);

  const facts = document.createElement("div");
  facts.className = "release-facts";
  facts.textContent = "网页版本记录 · 不提供网站文件下载";

  const notes = document.createElement("div");
  notes.className = "release-notes website-release-notes";
  const summary = document.createElement("p");
  summary.textContent = update.summary || "查看本次网页版本包含的完整变更。";
  notes.append(summary);

  const changes = createChangeSection("更新内容", update.changes);
  if (changes) notes.append(changes);
  const bugFixes = createChangeSection("问题修复", update.bugFixes);
  if (bugFixes) notes.append(bugFixes);

  article.append(header, facts, notes);
  return article;
}

async function renderWebsiteUpdates() {
  try {
    const updates = (await loadWebsiteUpdates()).sort((left, right) =>
      new Date(right.publishedAt || 0).getTime() - new Date(left.publishedAt || 0).getTime()
    );
    count.textContent = `${updates.length} 次网页更新`;
    list.replaceChildren();

    if (updates.length === 0) {
      const empty = document.createElement("div");
      empty.className = "log-empty";
      empty.textContent = "暂时没有网页更新记录。";
      list.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    updates.forEach((update) => fragment.append(createWebsiteUpdateEntry(update)));
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

