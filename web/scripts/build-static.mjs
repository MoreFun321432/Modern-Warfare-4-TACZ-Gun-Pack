import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readGunPackManifest } from "../server.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(scriptDir, "..");
const projectRoot = resolve(webDir, "..");
export function toStaticManifest(manifest) {
  return {
    ...manifest,
    guns: manifest.guns.map((gun) => ({
      ...gun,
      iconUrl: `${gun.iconUrl}.png`
    }))
  };
}

export async function buildStaticSite() {
  const publicDir = join(webDir, "public");
  const distDir = join(webDir, "dist");
  const iconSourceDir = join(projectRoot, "assets", "mw4", "textures", "gun", "slot");
  const iconOutputDir = join(distDir, "api", "icons");

  await rm(distDir, { recursive: true, force: true });
  await mkdir(iconOutputDir, { recursive: true });
  await cp(publicDir, distDir, { recursive: true });

  const manifest = await readGunPackManifest();
  const staticManifest = toStaticManifest(manifest);
  await writeFile(join(distDir, "api", "gunpack.json"), `${JSON.stringify(staticManifest, null, 2)}\n`, "utf8");

  const iconNames = new Set(manifest.guns.map((gun) => `${gun.id}.png`));
  const sourceFiles = await readdir(iconSourceDir);
  for (const name of sourceFiles) {
    if (iconNames.has(name)) {
      await cp(join(iconSourceDir, name), join(iconOutputDir, name));
    }
  }

  console.log(`Built static site: ${manifest.version}, ${manifest.guns.length} guns`);
  return staticManifest;
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  await buildStaticSite();
}

