import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDownloadConfig,
  fetchStaticReleases
} from "./build-static.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(scriptDir, "..");
const mirrorConfigPath = join(webDir, "download-mirrors.json");
const selectionPath = join(webDir, "download-selection.json");

const [mirrorConfig, releases] = await Promise.all([
  readFile(mirrorConfigPath, "utf8").then(JSON.parse),
  fetchStaticReleases()
]);
const packRelease = releases.find((release) =>
  release.asset && !/^website-/i.test(release.tag)
);
if (!packRelease?.downloadUrl) {
  throw new Error("No downloadable gun-pack release was found.");
}

const config = await buildDownloadConfig(
  packRelease.downloadUrl,
  mirrorConfig.mirrors || []
);
if (config.selected?.latencyMs == null) {
  throw new Error("No stable download mirror passed the speed test.");
}

await writeFile(selectionPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(
  `Selected ${config.selected.name} at ${config.selected.latencyMs} ms ` +
    `for ${packRelease.tag}`
);

