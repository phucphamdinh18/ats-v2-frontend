import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { preparePages } from "../scripts/prepare-pages.mjs";
const revision = "1".repeat(40);
async function project(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ats-single-fe-"));
  try {
    await mkdir(path.join(root, "web/out/offer-approval"), { recursive: true });
    await mkdir(path.join(root, "web/out/_next"));
    await writeFile(path.join(root, "web/out/index.html"), '<head></head><script src="/ats-v2-frontend/_next/app.js"></script><p>Approved app</p>');
    await writeFile(path.join(root, "web/out/offer-approval/index.html"), "Current approval route");
    await writeFile(path.join(root, "web/out/_next/app.js"), "Current bundle");
    await writeFile(path.join(root, "private-source.txt"), "must never publish");
    await fn(root, path.join(root, "site"));
  } finally { await rm(root, { recursive: true, force: true }); }
}
test("publishes the approved root app and approval route without needing a legacy frontend", () => project(async (root, destination) => {
  await preparePages({ mode: "single", root, revision, destination });
  const app = await readFile(path.join(destination, "index.html"), "utf8");
  assert.ok(app.includes("Approved app"));
  assert.ok(app.includes(`${revision}:single`));
  assert.equal(await readFile(path.join(destination, "offer-approval/index.html"), "utf8"), "Current approval route");
  assert.equal(await readFile(path.join(destination, "_next/app.js"), "utf8"), "Current bundle");
  assert.ok(!(await readdir(destination)).includes("private-source.txt"));
  assert.deepEqual(JSON.parse(await readFile(path.join(destination, "release.json"), "utf8")), {revision, mode:"single",appPath:"/ats-v2-frontend/"});
}));
test("retired URLs redirect OAuth callbacks and approval links to the same root application", () => project(async (root, destination) => {
  for (const alias of ["preview", "next"]) {
    await mkdir(path.join(root, "web/out", alias, "_next"), {recursive:true});
    await writeFile(path.join(root, "web/out", alias, "_next/old.js"), "Retired bundle");
  }
  await writeFile(path.join(root,"web/out/qa.html"), "Retired QA");
  await preparePages({ mode:"single",root,revision,destination });
  for (const alias of ["preview/index.html", "next/index.html", "qa.html", "responsive-check.html", "preview/offer-approval/index.html", "next/offer-approval/index.html"]) {
    const html = await readFile(path.join(destination, alias), "utf8");
    assert.ok(!html.includes("Retired"));
    let target; const link={};
    const location={origin:"https://phucphamdinh18.github.io",search:"?offer=123&next=https://untrusted.invalid",hash:"#access_token=test&refresh_token=test",replace:(url)=>{target=new URL(url);}};
    vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {URL,location,document:{getElementById:()=>link}});
    assert.equal(target.origin,location.origin);
    assert.equal(target.pathname,alias.includes("offer-approval")?"/ats-v2-frontend/offer-approval/":"/ats-v2-frontend/");
    assert.equal(target.search,location.search); assert.equal(target.hash,location.hash);
    assert.equal(link.href,target.href);
  }
  for (const alias of ["preview","next"]) assert.deepEqual((await readdir(path.join(destination,alias))).sort(),["index.html","offer-approval"]);
}));
test("rejects old publishing modes, missing revision and incorrect basePath before creating output", () => project(async (root,destination)=>{
  for (const mode of ["preview","path-preview","qa","next","unknown"]) await assert.rejects(preparePages({mode,root,revision,destination}),/Unsupported/);
  await assert.rejects(preparePages({mode:"single",root,revision:"",destination}),/source commit/);
  await writeFile(path.join(root,"web/out/index.html"),'<head></head><script src="/ats-v2-frontend/preview/_next/app.js"></script>');
  await assert.rejects(preparePages({mode:"single",root,revision,destination}),/basePath/);
  assert.ok(!(await readdir(root)).includes("site"));
}));
test("refuses a stale destination so retired assets cannot survive republishing", () => project(async(root,destination)=>{
  await mkdir(destination); await writeFile(path.join(destination,"old.html"),"old");
  await assert.rejects(preparePages({mode:"single",root,revision,destination}),/new directory/);
  assert.equal(await readFile(path.join(destination,"old.html"),"utf8"),"old");
}));
