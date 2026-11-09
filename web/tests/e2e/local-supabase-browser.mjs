import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.ATS_BASE_URL || "http://127.0.0.1:3000";
const artifactDir = process.env.ATS_E2E_ARTIFACT_DIR || "/tmp/ats-browser-e2e";
await fs.mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const pageErrors = [];
const failedRequests = [];
const failedResponses = [];
const contexts = [];
function observePage(page) {
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", async (response) => {
    if (response.status() >= 400 && response.url().includes("127.0.0.1:54321")) {
      failedResponses.push(`${response.status()} ${response.url()} ${((await response.text().catch(() => "")) || "").slice(0, 2000)}`);
    }
  });
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText || "request failed"}`));
}
async function loginAs(email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  contexts.push(context);
  const page = await context.newPage();
  observePage(page);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Mở đăng nhập thử nghiệm cục bộ" }).click();
  await page.getByLabel("Email thử nghiệm").fill(email);
  await page.getByLabel("Mật khẩu thử nghiệm").fill("LocalTestOnly-2026-ATS!");
  await page.getByRole("button", { name: "Đăng nhập thử", exact: true }).click();
  return page;
}
async function acceptConfirmation(page) {
  page.once("dialog", (dialog) => dialog.accept());
}
async function assertStage(details, expected) {
  await details.locator(".application-fields dd").nth(1).getByText(expected, { exact: true }).waitFor({ state: "visible", timeout: 10000 });
}
async function moveStage(page, details, direction) {
  const label = direction === "forward" ? "Chuyển sang SCREEN" : "Chuyển về NEW";
  await acceptConfirmation(page);
  await details.getByRole("button", { name: label, exact: true }).click();
  await assertStage(details, direction === "forward" ? "SCREEN" : "NEW");
  await details.getByText("MOVED", { exact: true }).last().waitFor({ state: "visible", timeout: 10000 });
}
async function openRolePipeline(page) {
  await page.getByRole("button", { name: "Mở pipeline TEST ONLY Application E2E" }).waitFor({ state: "visible", timeout: 20000 });
  await page.getByRole("button", { name: "Mở pipeline TEST ONLY Application E2E" }).click();
  const pipeline = page.getByRole("region", { name: "Pipeline TEST ONLY Application E2E" });
  await pipeline.waitFor({ state: "visible", timeout: 15000 });
  const card = pipeline.getByRole("button", { name: /Mở hồ sơ của TEST ONLY Manual E2E Candidate/ });
  await card.waitFor({ state: "visible", timeout: 15000 });
  await card.click();
  const details = page.getByRole("complementary", { name: "Chi tiết ứng viên" });
  await details.waitFor({ state: "visible", timeout: 10000 });
  await details.getByText("TEST ONLY Manual E2E Candidate", { exact: true }).waitFor();
  return { pipeline, card, details };
}

let page;
try {
  page = await loginAs("ta-e2e@example.invalid");
  await page.getByRole("button", { name: "Mở pipeline TEST ONLY Application E2E" }).waitFor({ state: "visible", timeout: 20000 });
  assert.equal(
    await page.getByText("TEST ONLY Admin Metadata Job", { exact: false }).count(),
    0,
    "TA should not see the Admin-only metadata Job",
  );

  const taView = await openRolePipeline(page);
  await taView.pipeline.getByText("SLA vòng: ≤ 2 ngày").waitFor({ state: "visible" });
  assert.equal(await taView.card.getAttribute("draggable"), "true", "Assigned TA should be able to drag an active Application");
  await assertStage(taView.details, "NEW");
  await moveStage(page, taView.details, "forward");
  await moveStage(page, taView.details, "backward");
  await page.screenshot({ path: path.join(artifactDir, "ta-job-pipeline.png"), fullPage: true });

  const adminPage = await loginAs("admin-e2e@example.invalid");
  const adminView = await openRolePipeline(adminPage);
  assert.equal(await adminView.card.getAttribute("draggable"), "true", "Admin should be able to manage an Application on any Job");
  await assertStage(adminView.details, "NEW");
  await moveStage(adminPage, adminView.details, "forward");
  await moveStage(adminPage, adminView.details, "backward");
  await adminPage.screenshot({ path: path.join(artifactDir, "admin-job-pipeline.png"), fullPage: true });

  for (const [role, email] of [
    ["Hiring Manager", "hm-e2e@example.invalid"],
    ["Interviewer", "interviewer-e2e@example.invalid"],
  ]) {
    const rolePage = await loginAs(email);
    const view = await openRolePipeline(rolePage);
    assert.equal(await view.card.getAttribute("draggable"), "false", `${role} must not drag Applications`);
    await rolePage.getByText("Chế độ chỉ xem.", { exact: false }).waitFor({ state: "visible" });
    assert.equal(await view.details.getByRole("button", { name: /Chuyển (sang|về) (NEW|SCREEN|INTERVIEW)/ }).count(), 0, `${role} must not see stage controls`);
    assert.equal(await rolePage.getByText("Thêm ứng viên vào Job", { exact: true }).count(), 0, `${role} must not see the add-candidate control`);
    await rolePage.screenshot({ path: path.join(artifactDir, `${role.toLowerCase().replaceAll(" ", "-")}-readonly.png`), fullPage: true });
  }

  const unassignedPage = await loginAs("unassigned-ta-e2e@example.invalid");
  assert.equal(
    await unassignedPage.getByRole("button", { name: "Mở pipeline TEST ONLY Application E2E" }).count(),
    0,
    "An unassigned TA must not see the Job",
  );
  assert.deepEqual(pageErrors, [], "The browser UI should not throw uncaught runtime errors");
  console.log("Browser E2E passed: assigned TA and Admin can move NEW ↔ SCREEN; Hiring Manager and Interviewer are read-only; unassigned TA cannot see the Job.");
} catch (error) {
  const visibleText = await page?.locator("body").innerText().catch(() => "(không đọc được nội dung trang)") || "(trang chưa khởi chạy)";
  console.error("E2E visible page text:\n" + visibleText.slice(0, 12000));
  console.error("E2E uncaught browser errors:\n" + pageErrors.join("\n"));
  console.error("E2E failed requests:\n" + failedRequests.join("\n"));
  console.error("E2E failed Supabase responses:\n" + failedResponses.join("\n"));
  await page?.screenshot({ path: path.join(artifactDir, "failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
}
