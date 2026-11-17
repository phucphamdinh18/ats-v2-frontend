import { cp, mkdir, readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const APP_PATH = "/ats-v2-frontend/";
function redirectPage(targetPath) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ATS V2</title></head><body><p>ATS đã chuyển về giao diện chính. <a id="ats-main-link" href="${targetPath}">Mở ATS</a></p><script>const target=new URL(${JSON.stringify(targetPath)},location.origin);target.search=location.search;target.hash=location.hash;document.getElementById('ats-main-link').href=target.href;location.replace(target.href);</script></body></html>`;
}

export async function preparePages({ mode, root, revision, destination }) {
  if (mode !== "single") throw new Error("Unsupported Pages mode: only single is supported");
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("A full source commit is required");
  try {
    await access(destination);
    throw new Error("Destination must be a new directory");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const out = path.join(root, "web/out");
  const app = await readFile(path.join(out, "index.html"), "utf8");
  if (!app.includes(`${APP_PATH}_next/`)) throw new Error("Next export basePath does not match the main app");
  if (!app.includes("</head>")) throw new Error("Missing HTML head");
  await mkdir(destination, { recursive: true });
  // Publish only the current Next export. Retired entry points below are redirects,
  // never another application or an archived bundle.
  await cp(out, destination, { recursive: true, filter: (source) => {
    const relative = path.relative(out, source).split(path.sep)[0];
    return !["preview", "next", "qa.html", "responsive-check.html"].includes(relative);
  }});
  await writeFile(path.join(destination, "index.html"), app.replace("</head>", `<meta name="ats-release" content="${revision}:single"></head>`));
  for (const alias of ["preview", "next"]) {
    await mkdir(path.join(destination, alias, "offer-approval"), { recursive: true });
    await writeFile(path.join(destination, alias, "index.html"), redirectPage(APP_PATH));
    await writeFile(path.join(destination, alias, "offer-approval/index.html"), redirectPage(`${APP_PATH}offer-approval/`));
  }
  for (const alias of ["qa.html", "responsive-check.html"]) {
    await writeFile(path.join(destination, alias), redirectPage(APP_PATH));
  }
  await writeFile(path.join(destination, ".nojekyll"), "");
  await writeFile(path.join(destination, "release.json"), JSON.stringify({ revision, mode: "single", appPath: APP_PATH }) + "\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  await preparePages({ mode: process.argv[2], root,
    revision: process.env.GITHUB_SHA || process.env.ATS_BUILD_REVISION || "",
    destination: path.join(root, "web/.pages-site") });
  console.log("Prepared one ATS frontend at the main URL");
}
