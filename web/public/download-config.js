const DEFAULT_PREFIX = "https://gh-proxy.com/";
const DOMESTIC_MIRROR_RAW_URL = "https://raw.githubusercontent.com/Skydeps1459/Modern-Warfare-4-TACZ-GunPack/main/web/domestic-mirror.json";
const DOMESTIC_MIRROR_CDN_URL = "https://cdn.jsdelivr.net/gh/Skydeps1459/Modern-Warfare-4-TACZ-GunPack@main/web/domestic-mirror.json";
const DOMESTIC_MIRROR_API_URL = "https://api.github.com/repos/Skydeps1459/Modern-Warfare-4-TACZ-GunPack/contents/web/domestic-mirror.json?ref=main";

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
  const liveEndpoint = new URL(DOMESTIC_MIRROR_RAW_URL);
  liveEndpoint.searchParams.set("v", Date.now().toString());
  const cdnEndpoint = new URL(DOMESTIC_MIRROR_CDN_URL);
  cdnEndpoint.searchParams.set("v", Date.now().toString());
  const apiEndpoint = new URL(DOMESTIC_MIRROR_API_URL);
  apiEndpoint.searchParams.set("v", Date.now().toString());

  const sources = [
    { url: new URL("api/domestic-mirror", siteBase) },
    { url: liveEndpoint },
    { url: apiEndpoint, githubContents: true },
    { url: cdnEndpoint },
    { url: endpoint }
  ];
  for (const source of sources) {
    try {
      const response = await fetch(source.url, {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let mirror = await response.json();
      if (source.githubContents) {
        mirror = JSON.parse(atob(String(mirror.content || "").replace(/\s/g, "")));
      }
      const url = new URL(mirror.url);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid URL");
      return {
        label: String(mirror.label || "国内分流"),
        url: url.href,
        password: String(mirror.password || ""),
        source: source.url.hostname
      };
    } catch (error) {
      console.info(`Domestic mirror source unavailable: ${source.url.hostname}`, error.message);
    }
  }
  return null;
}

