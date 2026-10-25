const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function formatWebsiteUpdateDate(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? "--" : dateFormatter.format(date);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function loadWebsiteUpdates() {
  const localApi = new URL("api/website-updates", document.baseURI);
  localApi.searchParams.set("v", Date.now().toString());
  const staticApi = new URL("api/website-updates.json", document.baseURI);
  staticApi.searchParams.set("v", Date.now().toString());

  for (const source of [localApi, staticApi]) {
    try {
      const payload = await fetchJson(source);
      if (Array.isArray(payload.updates)) {
        return payload.updates.sort((left, right) =>
          new Date(right.publishedAt || 0).getTime() - new Date(left.publishedAt || 0).getTime()
        );
      }
    } catch (error) {
      console.info(`Website update source unavailable: ${source}`, error.message);
    }
  }
  return [];
}

export function createHomepageWebsiteUpdate(update) {
  const article = document.createElement("article");
  article.className = "home-website-update";

  const meta = document.createElement("div");
  meta.className = "home-website-update-meta";
  const version = document.createElement("span");
  version.textContent = update.id;
  const time = document.createElement("time");
  time.dateTime = update.publishedAt || "";
  time.textContent = formatWebsiteUpdateDate(update.publishedAt);
  meta.append(version, time);

  const heading = document.createElement("h3");
  heading.textContent = update.title;
  const summary = document.createElement("p");
  summary.textContent = update.summary || "查看本次网页版本包含的完整变更。";
  const link = document.createElement("a");
  link.href = `./website-updates.html?v=20261025-8#web-update-${update.id}`;
  link.textContent = "查看完整记录";

  article.append(meta, heading, summary, link);
  return article;
}

