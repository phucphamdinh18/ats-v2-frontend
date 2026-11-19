import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { preparePages } from "../scripts/prepare-pages.mjs";

const revision = (char: string) => char.repeat(40);

test("single release continues redirecting the old preview path to the ATS root", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "ats-pages-single-"));
  const productionRoot = path.join(temp, "production");
  const destination = path.join(temp, "assembled");
  try {
    await mkdir(path.join(productionRoot, "web/out"), { recursive: true });
    await writeFile(path.join(productionRoot, "web/out/index.html"), '<html><head><script src="/ats-v2-frontend/_next/app.js"></script></head><body>production</body></html>');
    await preparePages({ mode: "single", root: temp, productionRoot, revision: revision("c"), destination });
    assert.match(await readFile(path.join(destination, "preview/index.html"), "utf8"), /location\.replace/);
    const release = JSON.parse(await readFile(path.join(destination, "release.json"), "utf8"));
    assert.equal(release.mode, "single");
    assert.equal(release.revision, revision("c"));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("calendar preview combines an unchanged root with a test app at /preview", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "ats-pages-"));
  const productionRoot = path.join(temp, "production");
  const previewRoot = path.join(temp, "preview-source");
  const destination = path.join(temp, "assembled");
  try {
    await mkdir(path.join(productionRoot, "web/out/preview"), { recursive: true });
    await mkdir(path.join(productionRoot, "web/out/_next"), { recursive: true });
    await mkdir(path.join(previewRoot, "web/out/_next"), { recursive: true });
    await writeFile(path.join(productionRoot, "web/out/index.html"), '<html><head><script src="/ats-v2-frontend/_next/app.js"></script></head><body>production</body></html>');
    await writeFile(path.join(productionRoot, "web/out/_next/app.js"), "production asset");
    await writeFile(path.join(productionRoot, "web/out/preview/index.html"), "old redirect");
    await writeFile(path.join(previewRoot, "web/out/index.html"), '<html><head><script src="/ats-v2-frontend/preview/_next/app.js"></script></head><body>calendar test</body></html>');
    await writeFile(path.join(previewRoot, "web/out/_next/app.js"), "preview asset");

    await preparePages({
      mode: "calendar-preview",
      root: temp,
      productionRoot,
      previewRoot,
      revision: revision("a"),
      previewRevision: revision("b"),
      destination,
    });

    assert.match(await readFile(path.join(destination, "index.html"), "utf8"), /production/);
    assert.match(await readFile(path.join(destination, "preview/index.html"), "utf8"), /calendar test/);
    assert.equal(await readFile(path.join(destination, "preview/_next/app.js"), "utf8"), "preview asset");
    const release = JSON.parse(await readFile(path.join(destination, "release.json"), "utf8"));
    assert.equal(release.revision, revision("a"));
    assert.equal(release.mode, "calendar-preview");
    assert.equal(release.previewRevision, revision("b"));
    assert.equal(release.previewPath, "/ats-v2-frontend/preview/");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("calendar preview fails closed if either app has the wrong base path", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "ats-pages-invalid-"));
  const productionRoot = path.join(temp, "production");
  const previewRoot = path.join(temp, "preview-source");
  const destination = path.join(temp, "assembled");
  try {
    await mkdir(path.join(productionRoot, "web/out"), { recursive: true });
    await mkdir(path.join(previewRoot, "web/out"), { recursive: true });
    await writeFile(path.join(productionRoot, "web/out/index.html"), '<html><head><script src="/ats-v2-frontend/_next/app.js"></script></head></html>');
    await writeFile(path.join(previewRoot, "web/out/index.html"), '<html><head><script src="/ats-v2-frontend/_next/app.js"></script></head></html>');
    await assert.rejects(preparePages({
      mode: "calendar-preview",
      root: temp,
      productionRoot,
      previewRoot,
      revision: revision("a"),
      previewRevision: revision("b"),
      destination,
    }), /Calendar preview basePath/);
    assert.equal(await readFile(path.join(destination, "index.html"), "utf8").catch(() => null), null);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
