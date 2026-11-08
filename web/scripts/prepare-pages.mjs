import { cp, mkdir, readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export async function preparePages({ mode, root, revision, destination, previewExport, previewRevision, legacyRoot = root }) {
  if (!["preview", "next", "qa", "path-preview"].includes(mode))
    throw new Error("Unsupported Pages mode");
  if (!/^[a-f0-9]{40}$/.test(revision))
    throw new Error("A full source commit is required");
  // Fresh destination only: accidental reuse must never leave unrelated stale files.
  try {
    await access(destination);
    throw new Error("Destination must be a new directory");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  const legacy = await readFile(path.join(legacyRoot, "index.html"), "utf8");
  const oldCallback =
    "redirectTo: window.location.origin + window.location.pathname";
  if (legacy.split(oldCallback).length !== 2)
    throw new Error("Legacy OAuth callback changed; review packaging");
  const qa = legacy.replace(
    oldCallback,
    'redirectTo: window.location.origin + "/ats-v2-frontend/"',
  );
  const marker = `<meta name="ats-release" content="${revision}:${mode}">`;
  const mark = (html, rev = revision, releaseMode = mode) => {
    if (!html.includes("</head>")) throw new Error("Missing HTML head");
    return html.replace("</head>", `<meta name="ats-release" content="${rev}:${releaseMode}"></head>`);
  };
  const previewLanding = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ATS · Tuyển dụng</title>${marker}</head><body><p>Đang mở ATS… <a id="ats-next-link" href="./next/">Mở ATS</a></p><script>const target=new URL('./next/',window.location.href);target.search=window.location.search;target.hash=window.location.hash;document.getElementById('ats-next-link').href=target.href;window.location.replace(target.href);</script></body></html>`;
  let next;
  const out = path.join(root, "web", "out");
  if (mode !== "qa") {
    next = await readFile(path.join(out, "index.html"), "utf8");
    const expected = mode === "preview"
      ? "/ats-v2-frontend/next/_next/"
      : "/ats-v2-frontend/_next/";
    if (!next.includes(expected))
      throw new Error("Next export basePath does not match Pages mode");
  }
  let preview;
  if (mode === "path-preview") {
    if (!previewExport) throw new Error("A separate preview export is required");
    if (!/^[a-f0-9]{40}$/.test(previewRevision || ""))
      throw new Error("A full preview source commit is required");
    preview = await readFile(path.join(previewExport, "index.html"), "utf8");
    if (!preview.includes("/ats-v2-frontend/preview/_next/"))
      throw new Error("Preview export basePath does not match /preview");
  }
  await mkdir(destination, { recursive: true });
  if (mode === "next" || mode === "path-preview") {
    await cp(out, destination, { recursive: true });
    await writeFile(path.join(destination, "index.html"), mark(next));
    if (mode === "path-preview") {
      await cp(previewExport, path.join(destination, "preview"), { recursive: true });
      const oauthRootBridge = `<script>(()=>{try{const k="ats.preview.oauth.return",t=Number(localStorage.getItem(k)||0),cb=location.hash.includes("access_token=")||new URLSearchParams(location.search).has("code");if(t&&Date.now()-t<600000&&cb){localStorage.removeItem(k);const u=new URL("/ats-v2-frontend/preview/",location.origin);u.search=location.search;u.hash=location.hash;location.replace(u.href)}else if(t&&Date.now()-t>=600000)localStorage.removeItem(k)}catch{}})()</script>`;
      const oauthPreviewArm = `<script>(()=>{document.addEventListener("click",e=>{try{if(e.target instanceof Element&&e.target.closest(".auth-google-button"))localStorage.setItem("ats.preview.oauth.return",String(Date.now()))}catch{}},true)})()</script>`;
      await writeFile(path.join(destination, "index.html"), mark(next).replace("</head>", oauthRootBridge + "</head>"));
      await writeFile(path.join(destination, "preview", "index.html"), mark(preview.replace("</head>", oauthPreviewArm + "</head>"), previewRevision, "path-preview"));
    }
  } else {
    await writeFile(
      path.join(destination, "index.html"),
      mode === "preview" ? previewLanding : mark(qa),
    );
    if (mode === "preview") {
      await cp(out, path.join(destination, "next"), { recursive: true });
      await writeFile(path.join(destination, "next", "index.html"), mark(next));
    }
  }
  await writeFile(path.join(destination, "qa.html"), mark(qa));
  if (mode !== "qa") {
    const appPath = mode === "preview" ? "next/" : mode === "path-preview" ? "preview/" : "./";
    await writeFile(
      path.join(destination, "responsive-check.html"),
      `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ATS · Mobile QA</title></head><body style="margin:24px;background:#edf1ed;font:14px Arial;color:#243a2c"><h1>Kiểm tra mobile · 375 × 812</h1><p>Ứng dụng thật trong khung 375px. Chỉ dùng phiên đã đăng nhập; không đăng nhập Google bên trong iframe.</p><iframe title="ATS mobile 375px" src="${appPath}" style="width:375px;height:812px;border:1px solid #cbd8cb;background:white"></iframe></body></html>`,
    );
  }
  await writeFile(path.join(destination, ".nojekyll"), "");
  await writeFile(
    path.join(destination, "release.json"),
    JSON.stringify({ revision, mode, ...(mode === "path-preview" ? { preview: { path: "preview/", revision: previewRevision } } : {}) }) + "\n",
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  await preparePages({
    mode: process.argv[2],
    root,
    revision: process.env.GITHUB_SHA || process.env.ATS_BUILD_REVISION || "",
    destination: path.join(root, "web", ".pages-site"),
    previewExport: process.env.PAGES_PREVIEW_EXPORT,
    previewRevision: process.env.PAGES_PREVIEW_REVISION,
    legacyRoot: process.env.PAGES_LEGACY_ROOT || root,
  });
  console.log(`Prepared Pages: ${process.argv[2]}`);
}
