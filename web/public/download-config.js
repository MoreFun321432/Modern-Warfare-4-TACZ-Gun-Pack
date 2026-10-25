const DEFAULT_PREFIX = "https://gh-proxy.com/";

export function accelerateDownloadUrl(url, prefix = DEFAULT_PREFIX) {
  if (!url) return "";
  return `${prefix}${url}`;
}

export async function loadDownloadConfig(baseUrl = new URL("./", document.baseURI)) {
  const siteBase = typeof baseUrl === "string"
    ? new URL(baseUrl, document.baseURI)
    : baseUrl;
  const endpoint = new URL("api/download-config.json", siteBase);
  endpoint.searchParams.set("v", Date.now().toString());

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const config = await response.json();
    const prefix = String(config?.selected?.prefix || "");
    if (!/^https:\/\/[^/]+\/$/.test(prefix)) {
      throw new Error("Invalid accelerator prefix");
    }
    return {
      ...config,
      selected: {
        ...config.selected,
        prefix
      }
    };
  } catch (error) {
    console.info("Download accelerator config unavailable; using default.", error.message);
    return {
      selected: {
        id: "gh-proxy",
        name: "gh-proxy.com",
        prefix: DEFAULT_PREFIX
      },
      fallback: null
    };
  }
}

export async function loadDomesticMirror(baseUrl = new URL("./", document.baseURI)) {
  const siteBase = typeof baseUrl === "string"
    ? new URL(baseUrl, document.baseURI)
    : baseUrl;
  const endpoint = new URL("api/domestic-mirror.json", siteBase);
  endpoint.searchParams.set("v", Date.now().toString());

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const mirror = await response.json();
    const url = new URL(mirror.url);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid URL");
    return {
      label: String(mirror.label || "国内分流"),
      url: url.href,
      password: String(mirror.password || "")
    };
  } catch (error) {
    console.info("Domestic mirror unavailable.", error.message);
    return null;
  }
}

