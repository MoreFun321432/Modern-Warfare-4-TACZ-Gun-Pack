import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import {
  createAppServer,
  normalizeRelease,
  pickPackRelease,
  readGunPackManifest,
  readWebsiteUpdates,
  sortReleasesByDate
} from "../server.mjs";
import { toStaticManifest } from "../scripts/build-static.mjs";
import {
  extractReleaseSummary,
  isPackRelease,
  isWebsiteRelease,
  normalizeRelease as normalizeClientRelease
} from "../public/release-data.js";

test("reads the live gun pack manifest", async () => {
  const manifest = await readGunPackManifest();
  assert.equal(manifest.namespace, "mw4");
  assert.match(manifest.version, /-Release$/);
  assert.equal(manifest.license, "GPL-3.0");
  assert.ok(manifest.guns.length >= 14);
  assert.ok(manifest.guns.every((gun) => gun.id && gun.name && gun.iconUrl));
});

test("creates file-based icon URLs for static hosting", async () => {
  const manifest = await readGunPackManifest();
  const staticManifest = toStaticManifest(manifest);
  assert.ok(staticManifest.guns.every((gun) => gun.iconUrl.endsWith(".png")));
  assert.equal(manifest.guns[0].iconUrl.includes(".png"), false);
});

test("keeps release notes and zip metadata in the release feed", () => {
  const release = normalizeRelease({
    tag_name: "v1.8.1-Release",
    name: "Hotfix",
    html_url: "https://github.com/example/releases/tag/v1.8.1-Release",
    published_at: "2026-10-25T12:00:00Z",
    body: "## Bug 修复\n\n- 修复换弹音效",
    assets: [{
      name: "Modern.Warfare.4-1.8.1-Release.zip",
      size: 26229060,
      download_count: 3,
      updated_at: "2026-10-25T12:00:00Z",
      browser_download_url: "https://github.com/example/release.zip"
    }]
  });

  assert.equal(release.tag, "v1.8.1-Release");
  assert.match(release.body, /换弹音效/);
  assert.equal(release.asset.size, 26229060);
  assert.equal(extractReleaseSummary(release.body), "修复换弹音效");
  assert.equal(normalizeClientRelease(release), release);
});

test("keeps downloads attached to the pack release when a site release is newer", () => {
  const siteRelease = { tag: "website-v1.0.0", asset: null, prerelease: false };
  const packRelease = { tag: "v1.8.0-Release", asset: { name: "pack.zip" }, prerelease: false };
  assert.equal(pickPackRelease([siteRelease, packRelease]), packRelease);
});

test("sorts the release feed by publication time", () => {
  const releases = sortReleasesByDate([
    { tag: "older", publishedAt: "2026-10-25T11:00:00Z" },
    { tag: "newer", publishedAt: "2026-10-25T12:00:00Z" }
  ]);
  assert.deepEqual(releases.map((release) => release.tag), ["newer", "older"]);
});

test("separates website releases from downloadable gun-pack releases", () => {
  const website = { tag: "website-v1.0.0", asset: null };
  const pack = { tag: "v1.8.1-Release", asset: { name: "pack.zip" } };
  assert.equal(isWebsiteRelease(website), true);
  assert.equal(isPackRelease(website), false);
  assert.equal(isWebsiteRelease(pack), false);
  assert.equal(isPackRelease(pack), true);
});

test("keeps a repository-driven website update log", async () => {
  const updates = await readWebsiteUpdates();
  assert.ok(updates.length >= 6);
  assert.equal(updates[0].id, "website-v1.0.6");
  assert.ok(Array.isArray(updates[0].changes));
  assert.equal("downloadUrl" in updates[0], false);
});

test("serves health and local gun pack data", async (t) => {
  const server = createAppServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const healthResponse = await fetch(`${baseUrl}/healthz`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), {
    ok: true,
    service: "mw4-gunpack-site"
  });

  const packResponse = await fetch(`${baseUrl}/api/gunpack`);
  assert.equal(packResponse.status, 200);
  const payload = await packResponse.json();
  assert.equal(payload.namespace, "mw4");
  assert.ok(payload.guns.length >= 14);

  const pageResponse = await fetch(baseUrl);
  assert.equal(pageResponse.status, 200);
  const pageHtml = await pageResponse.text();
  assert.match(pageHtml, /Modern Warfare 4/);
  assert.match(pageHtml, /id="website-log"/);
  assert.match(pageHtml, /id="homepage-website-updates"/);

  const changelogResponse = await fetch(`${baseUrl}/changelog.html`);
  assert.equal(changelogResponse.status, 200);
  assert.match(await changelogResponse.text(), /更新日志/);

  const websiteUpdatesResponse = await fetch(`${baseUrl}/website-updates.html`);
  assert.equal(websiteUpdatesResponse.status, 200);
  assert.match(await websiteUpdatesResponse.text(), /网页更新/);

  const websiteUpdateApiResponse = await fetch(`${baseUrl}/api/website-updates`);
  assert.equal(websiteUpdateApiResponse.status, 200);
  const websiteUpdateApi = await websiteUpdateApiResponse.json();
  assert.ok(websiteUpdateApi.updates.length >= 2);
});

