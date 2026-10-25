import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createAppServer, readGunPackManifest } from "../server.mjs";

test("reads the live gun pack manifest", async () => {
  const manifest = await readGunPackManifest();
  assert.equal(manifest.namespace, "mw4");
  assert.match(manifest.version, /-Release$/);
  assert.equal(manifest.license, "MIT");
  assert.ok(manifest.guns.length >= 14);
  assert.ok(manifest.guns.every((gun) => gun.id && gun.name && gun.iconUrl));
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
  assert.match(await pageResponse.text(), /Modern Warfare 4/);
});

