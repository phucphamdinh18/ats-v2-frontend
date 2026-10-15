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
