import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { preparePages } from "../scripts/prepare-pages.mjs";
const revision = "1".repeat(40);
async function project(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ats-pages-"));
  try {
    await mkdir(path.join(root, "web/out"), { recursive: true });
    await writeFile(
      path.join(root, "index.html"),
      "<head></head><p>Legacy QA</p><script>const options = {redirectTo: window.location.origin + window.location.pathname};</script>",
    );
    await writeFile(
      path.join(root, "private-source.txt"),
      "must never publish",
    );
    await fn(root, path.join(root, "site"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
for (const mode of ["preview", "next"])
  test(`packages ${mode} at the correct basePath and preserves QA callback`, () =>
    project(async (root, destination) => {
      const prefix =
        mode === "preview" ? "/ats-v2-frontend/next" : "/ats-v2-frontend";
      await writeFile(
        path.join(root, "web/out/index.html"),
        `<head></head><script src="${prefix}/_next/app.js"></script>`,
      );
      await preparePages({ mode, root, revision, destination });
      const html = await readFile(
        path.join(
          destination,
          mode === "preview" ? "next/index.html" : "index.html",
        ),
        "utf8",
      );
      assert.ok(html.includes(`${prefix}/_next/app.js`));
      assert.ok(html.includes(`${revision}:${mode}`));
      if (mode === "preview") {
        const landing = await readFile(path.join(destination, "index.html"), "utf8");
        assert.ok(landing.includes("./next/"));
        assert.ok(landing.includes("target.hash=window.location.hash"));
        assert.ok(!landing.includes("Legacy QA"));
      }
      const qa = await readFile(path.join(destination, "qa.html"), "utf8");
      assert.ok(
        qa.includes('redirectTo: window.location.origin + "/ats-v2-frontend/"'),
      );
      assert.ok(!qa.includes("window.location.pathname"));
      assert.ok(!(await readdir(destination)).includes("private-source.txt"));
      assert.equal(
        await readFile(path.join(destination, ".nojekyll"), "utf8"),
        "",
      );
    }));
test("QA rollback publishes original QA at root without requiring Next export", () =>
  project(async (root, destination) => {
    await preparePages({ mode: "qa", root, revision, destination });
    assert.ok(
      (await readFile(path.join(destination, "index.html"), "utf8")).includes(
        "Legacy QA",
      ),
    );
    assert.ok(!(await readdir(destination)).includes("next"));
  }));
test("path preview adds a separate /preview app while retaining the deployed root export", () =>
  project(async (root, destination) => {
    const previewExport = path.join(root, "preview-out");
    const productionRoot = path.join(root, "production");
    await mkdir(previewExport);
    await mkdir(productionRoot);
    await writeFile(
      path.join(root, "web/out/index.html"),
      '<head></head><script src="/ats-v2-frontend/_next/live.js"></script><p>Production app</p>',
    );
    await writeFile(
      path.join(productionRoot, "index.html"),
      '<head></head><p>Production QA</p><script>const options = {redirectTo: window.location.origin + window.location.pathname};</script>',
    );
    await writeFile(
      path.join(previewExport, "index.html"),
      '<head></head><script src="/ats-v2-frontend/preview/_next/demo.js"></script><p>Preview app</p>',
    );
    const previewRevision = "2".repeat(40);
    await preparePages({ mode: "path-preview", root, revision, destination, previewExport, previewRevision, legacyRoot: productionRoot });
    const liveRoot = await readFile(path.join(destination, "index.html"), "utf8");
    const preview = await readFile(path.join(destination, "preview/index.html"), "utf8");
    const qa = await readFile(path.join(destination, "qa.html"), "utf8");
    assert.ok(liveRoot.includes("Production app"));
    assert.ok(liveRoot.includes("/ats-v2-frontend/_next/live.js"));
    assert.ok(liveRoot.includes(`${revision}:path-preview`));
    assert.ok(liveRoot.includes("ats.preview.oauth.return"));
    assert.ok(!liveRoot.includes("Preview app"));
    assert.ok(preview.includes("Preview app"));
    assert.ok(preview.includes(`${previewRevision}:path-preview`));
    assert.ok(preview.includes("auth-google-button"));
    assert.ok(qa.includes("Production QA"));
    const release = JSON.parse(await readFile(path.join(destination, "release.json"), "utf8"));
    assert.deepEqual(release.preview, { path: "preview/", revision: previewRevision });
  }));
test("fails on a mismatched Next basePath before creating output", () =>
  project(async (root, destination) => {
    await writeFile(
      path.join(root, "web/out/index.html"),
      '<head></head><script src="/_next/app.js"></script>',
    );
    await assert.rejects(
      preparePages({ mode: "preview", root, revision, destination }),
      /basePath/,
    );
    assert.ok(!(await readdir(root)).includes("site"));
  }));
test("refuses reusing an existing destination instead of publishing stale files", () =>
  project(async (root, destination) => {
    await mkdir(destination);
    await writeFile(path.join(destination, "stale.txt"), "old");
    await assert.rejects(
      preparePages({ mode: "qa", root, revision, destination }),
      /new directory/,
    );
    assert.equal(
      await readFile(path.join(destination, "stale.txt"), "utf8"),
      "old",
    );
  }));
test("rejects unknown release modes and missing source revision", () =>
  project(async (root, destination) => {
    await assert.rejects(
      preparePages({ mode: "unknown", root, revision, destination }),
      /Unsupported/,
    );
    await assert.rejects(
      preparePages({ mode: "qa", root, revision: "", destination }),
      /source commit/,
    );
  }));
