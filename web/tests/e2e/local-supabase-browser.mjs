import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.ATS_BASE_URL || "http://127.0.0.1:3000";
if (!["127.0.0.1", "localhost"].includes(new URL(baseUrl).hostname)) {
  throw new Error(
    "This write-enabled fixture suite runs only against disposable loopback services.",
  );
}
const artifactDir = process.env.ATS_E2E_ARTIFACT_DIR || "/tmp/ats-browser-e2e";
await fs.mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const pageErrors = [];
const failedRequests = [];
const failedResponses = [];
const contexts = [];
let activePage;
function observePage(page) {
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", async (response) => {
    if (
      response.status() >= 400 &&
      response.url().includes("127.0.0.1:54321")
    ) {
      failedResponses.push(
        `${response.status()} ${response.url()} ${((await response.text().catch(() => "")) || "").slice(0, 2000)}`,
      );
    }
  });
  page.on("requestfailed", (request) =>
    failedRequests.push(
      `${request.method()} ${request.url()} — ${request.failure()?.errorText || "request failed"}`,
    ),
  );
}
async function loginAs(email) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  contexts.push(context);
  const page = await context.newPage();
  activePage = page;
  observePage(page);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: "Mở đăng nhập thử nghiệm cục bộ" })
    .click();
  await page.getByLabel("Email thử nghiệm").fill(email);
  await page.getByLabel("Mật khẩu thử nghiệm").fill("LocalTestOnly-2026-ATS!");
  await page
    .getByRole("button", { name: "Đăng nhập thử", exact: true })
    .click();
  await page
    .locator(".account-email")
    .getByText(email, { exact: true })
    .waitFor({ state: "visible", timeout: 20000 });
  return page;
}
async function acceptConfirmation(page) {
  page.once("dialog", (dialog) => dialog.accept());
}
async function assertStage(details, expected) {
  await details
    .locator(".application-fields dd")
    .nth(1)
    .getByText(expected === "SCREEN" ? "Sơ loại" : "Mới ứng tuyển", {
      exact: true,
    })
    .waitFor({ state: "visible", timeout: 10000 });
}
async function moveStage(page, details, direction) {
  const label =
    direction === "forward" ? "Chuyển sang Sơ loại" : "Chuyển về Mới ứng tuyển";
  await acceptConfirmation(page);
  await details.getByRole("button", { name: label, exact: true }).click();
  await assertStage(details, direction === "forward" ? "SCREEN" : "NEW");
  await details
    .locator(".timeline li")
    .last()
    .waitFor({ state: "visible", timeout: 10000 });
}
async function openRolePipeline(page) {
  await page
    .getByRole("button", { name: "Mở pipeline TEST ONLY Application E2E" })
    .waitFor({ state: "visible", timeout: 20000 });
  await page
    .getByRole("button", { name: "Mở pipeline TEST ONLY Application E2E" })
    .click();
  const pipeline = page.getByRole("region", {
    name: "Pipeline TEST ONLY Application E2E",
  });
  await pipeline.waitFor({ state: "visible", timeout: 15000 });
  const card = pipeline.getByRole("button", {
    name: /Mở hồ sơ của TEST ONLY Manual E2E Candidate/,
  });
  await card.waitFor({ state: "visible", timeout: 15000 });
  await card.click();
  const details = page.getByRole("complementary", {
    name: "Chi tiết ứng viên",
  });
  await details.waitFor({ state: "visible", timeout: 10000 });
  await details
    .getByText("TEST ONLY Manual E2E Candidate", { exact: true })
    .waitFor();
  return { pipeline, card, details };
}

// Effective CSS widths cover a 1366px laptop at 100%, 125% and 150% zoom.
// This tests reflow; it does not claim to reproduce Chrome's browser zoom UI.
async function checkLaptopReflow(page) {
  await page
    .getByRole("button", { name: "Đóng chi tiết", exact: true })
    .click();
  for (const [name, width, height] of [
    ["100", 1366, 768],
    ["125", 1093, 614],
    ["150", 911, 512],
  ]) {
    await page.setViewportSize({ width, height });
    await page
      .getByRole("button", { name: "Thêm ứng viên", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Thêm ứng viên vào Job",
      exact: true,
    });
    await dialog.waitFor();
    await page
      .getByLabel("Họ và tên ứng viên", { exact: true })
      .fill("TEST ONLY unsaved laptop draft");
    const geometry = await dialog.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        vw: innerWidth,
        vh: innerHeight,
        overflow: el.scrollWidth - el.clientWidth,
      };
    });
    assert.ok(
      geometry.x >= 0 &&
        geometry.y >= 0 &&
        geometry.x + geometry.width <= geometry.vw + 1 &&
        geometry.y + geometry.height <= geometry.vh + 1,
      "Dialog must fit the effective laptop viewport",
    );
    assert.ok(
      Math.abs(geometry.x * 2 + geometry.width - geometry.vw) <= 3,
      "Dialog must be horizontally centered",
    );
    assert.ok(
      geometry.overflow <= 1,
      "Candidate fields must not overflow horizontally",
    );
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press("Tab");
      assert.ok(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
        "Native modal must contain keyboard focus",
      );
    }
    await page.screenshot({
      path: path.join(artifactDir, `candidate-laptop-${name}.png`),
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    assert.equal(await dialog.count(), 0, "Escape closes candidate entry");
    assert.ok(
      await page
        .getByRole("button", { name: "Thêm ứng viên", exact: true })
        .evaluate((el) => el === document.activeElement),
      "Focus returns to Add candidate",
    );
    await page
      .getByRole("button", { name: "Thêm ứng viên", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Họ và tên ứng viên", { exact: true }).inputValue(),
      "TEST ONLY unsaved laptop draft",
    );
    await page.getByRole("button", { name: "Hủy", exact: true }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    assert.ok(
      overflow <= 1,
      "Horizontal scrolling must stay inside the board/table",
    );
    await page.screenshot({
      path: path.join(artifactDir, `pipeline-laptop-${name}.png`),
      fullPage: false,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Thêm ứng viên", exact: true })
    .click();
  await page
    .getByLabel("Họ và tên ứng viên", { exact: true })
    .fill("TEST ONLY bilingual draft");
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page
    .getByLabel("Ngôn ngữ / Language", { exact: true })
    .selectOption("en");
  await page
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();
  assert.equal(
    await page
      .getByLabel("Candidate’s full name", { exact: true })
      .inputValue(),
    "TEST ONLY bilingual draft",
  );
  await page.getByLabel("Google Drive CV link", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByLabel("Ngôn ngữ / Language", { exact: true })
    .selectOption("vi");
}

async function createJobAndAssign(page) {
  const title = `TEST ONLY Browser Job ${Date.now()}`;
  await page.getByRole("tab", { name: /1.3/ }).click();
  const admin = page.getByRole("region", { name: "Quản lý Job", exact: true });
  await admin.getByRole("button", { name: "Tạo Job", exact: true }).click();
  const form = admin.getByRole("region", { name: "Tạo Job", exact: true });
  await form.getByLabel("Tên vị trí", { exact: true }).fill(title);
  await form.getByLabel("Bộ phận", { exact: true }).fill("TEST ONLY");
  await form.getByLabel("Địa điểm", { exact: true }).fill("TEST ONLY HCM");
  await form.getByLabel("Cấp độ", { exact: true }).selectOption("3");
  await form
    .getByLabel("Nhóm chức năng", { exact: true })
    .selectOption("Tech/Product");
  await form
    .getByLabel("Mùa tuyển dụng", { exact: true })
    .selectOption("Normal Time");
  await form.getByRole("button", { name: "Lưu Job nháp", exact: true }).click();
  const row = admin.getByRole("row").filter({ hasText: title });
  await row.waitFor({ timeout: 15000 });
  await row.getByRole("button", { name: "Quản lý", exact: true }).click();
  await admin
    .getByRole("button", { name: "Phân công đội ngũ", exact: true })
    .click();
  await admin
    .getByLabel("Email người dùng", { exact: true })
    .fill("ta-e2e@example.invalid");
  await admin.getByRole("button", { name: "Gán quyền", exact: true }).click();
  await admin
    .getByText("ta-e2e@example.invalid", { exact: true })
    .waitFor({ timeout: 15000 });
  await admin.getByRole("button", { name: "Mở tuyển", exact: true }).click();
  await admin
    .getByLabel("Mã Job", { exact: true })
    .fill(`TEST-BROWSER-${Date.now()}`);
  page.once("dialog", (dialog) => dialog.accept());
  await admin
    .getByRole("button", { name: "Xác nhận mở tuyển", exact: true })
    .click();
  await admin.getByText(/Đã mở tuyển Job/).waitFor({ timeout: 15000 });
  await row.getByText("Đang nhận ứng viên", { exact: true }).waitFor();
  await page.getByRole("tab", { name: /1.1/ }).click();
  return title;
}

let page;
try {
  page = await loginAs("ta-e2e@example.invalid");
  await page
    .getByRole("button", { name: "Mở pipeline TEST ONLY Application E2E" })
    .waitFor({ state: "visible", timeout: 20000 });
  assert.equal(
    await page
      .getByText("TEST ONLY Admin Metadata Job", { exact: false })
      .count(),
    0,
    "TA should not see the Admin-only metadata Job",
  );

  const taView = await openRolePipeline(page);
  await taView.pipeline
    .getByText("Mục tiêu: ≤ 2 ngày")
    .waitFor({ state: "visible" });
  assert.equal(
    await taView.card.getAttribute("draggable"),
    "true",
    "Assigned TA should be able to drag an active Application",
  );
  await assertStage(taView.details, "NEW");
  await moveStage(page, taView.details, "forward");
  await moveStage(page, taView.details, "backward");
  page.once("dialog", (dialog) => dialog.accept());
  await taView.card.dragTo(
    taView.pipeline.getByRole("region", {
      name: "Giai đoạn Sơ loại",
      exact: true,
    }),
  );
  await assertStage(taView.details, "SCREEN");
  await moveStage(page, taView.details, "backward");
  await checkLaptopReflow(page);
  await page.screenshot({
    path: path.join(artifactDir, "ta-job-pipeline.png"),
    fullPage: true,
  });

  const adminPage = await loginAs("admin-e2e@example.invalid");
  const adminView = await openRolePipeline(adminPage);
  assert.equal(
    await adminView.card.getAttribute("draggable"),
    "true",
    "Admin should be able to manage an Application on any Job",
  );
  await assertStage(adminView.details, "NEW");
  await moveStage(adminPage, adminView.details, "forward");
  await moveStage(adminPage, adminView.details, "backward");
  await adminPage
    .getByRole("button", { name: "Đóng chi tiết", exact: true })
    .click();
  const newJobTitle = await createJobAndAssign(adminPage);
  const freshTa = await loginAs("ta-e2e@example.invalid");
  await freshTa
    .getByRole("button", { name: `Mở pipeline ${newJobTitle}`, exact: true })
    .click();
  await freshTa
    .getByRole("button", { name: "Thêm ứng viên", exact: true })
    .click();
  await freshTa
    .getByLabel("Họ và tên ứng viên", { exact: true })
    .fill("TEST ONLY Browser Candidate");
  await freshTa
    .getByLabel("Email ứng viên", { exact: true })
    .fill(`browser-${Date.now()}@example.invalid`);
  await freshTa
    .getByLabel("Link CV Google Drive", { exact: true })
    .fill("https://drive.google.com/file/d/TESTONLYDRIVEFILE000002/view");
  await freshTa
    .getByLabel("Tên tệp CV", { exact: true })
    .fill("TEST ONLY Browser CV.pdf");
  await freshTa
    .getByLabel("Nguồn ứng viên", { exact: true })
    .selectOption("ITViec");
  freshTa.once("dialog", (dialog) => dialog.accept());
  await freshTa
    .getByRole("button", { name: "Thêm vào pipeline", exact: true })
    .click();
  await freshTa
    .getByText("Đã thêm ứng viên vào Job ở vòng NEW.", { exact: true })
    .waitFor({ timeout: 15000 });
  await freshTa.getByRole("button", { name: "Đóng", exact: true }).click();
  await freshTa
    .getByRole("button", { name: /Mở hồ sơ của TEST ONLY Browser Candidate/ })
    .waitFor();
  await freshTa.waitForFunction(
    () =>
      document.querySelector(".pipeline-summary strong")?.textContent === "1",
  );
  await freshTa.screenshot({
    path: path.join(artifactDir, "job-create-assign-open-add.png"),
    fullPage: true,
  });
  await adminPage.screenshot({
    path: path.join(artifactDir, "admin-job-pipeline.png"),
    fullPage: true,
  });

  const hmPage = await loginAs("hm-e2e@example.invalid");
  const hmView = await openRolePipeline(hmPage);
  assert.equal(
    await hmView.card.getAttribute("draggable"),
    "false",
    "Hiring Manager must not drag Applications",
  );
  await hmPage
    .getByText("Chế độ chỉ xem.", { exact: false })
    .waitFor({ state: "visible" });
  assert.equal(
    await hmView.details
      .getByRole("button", { name: /Chuyển (sang|về)/ })
      .count(),
    0,
    "Hiring Manager must not see stage controls",
  );
  assert.equal(
    await hmPage.getByText("Thêm ứng viên vào Job", { exact: true }).count(),
    0,
    "Hiring Manager must not see the add-candidate control",
  );
  await hmPage.screenshot({
    path: path.join(artifactDir, "hiring-manager-readonly.png"),
    fullPage: true,
  });

  // Interviewers receive a per-interview context through the interviews function;
  // they are intentionally not granted read access to the whole Job or Pipeline.
  const interviewerPage = await loginAs("interviewer-e2e@example.invalid");
  assert.equal(
    await interviewerPage
      .getByRole("button", { name: "Mở pipeline TEST ONLY Application E2E" })
      .count(),
    0,
    "Interviewer must not see the Job-wide Pipeline",
  );
  assert.equal(
    await interviewerPage
      .getByText("TEST ONLY Application E2E", { exact: true })
      .count(),
    0,
  );
  await interviewerPage.screenshot({
    path: path.join(artifactDir, "interviewer-job-scope.png"),
    fullPage: true,
  });

  const unassignedPage = await loginAs("unassigned-ta-e2e@example.invalid");
  assert.equal(
    await unassignedPage
      .getByRole("button", { name: "Mở pipeline TEST ONLY Application E2E" })
      .count(),
    0,
    "An unassigned TA must not see the Job",
  );
  assert.deepEqual(
    pageErrors,
    [],
    "The browser UI should not throw uncaught runtime errors",
  );
  console.log(
    "Browser E2E passed: assigned TA and Admin can move NEW ↔ SCREEN; assigned Hiring Manager has read-only pipeline access; Interviewer has no Job-wide access; unassigned TA cannot see the Job.",
  );
} catch (error) {
  const visibleText =
    (await activePage
      ?.locator("body")
      .innerText()
      .catch(() => "(không đọc được nội dung trang)")) ||
    "(trang chưa khởi chạy)";
  console.error("E2E visible page text:\n" + visibleText.slice(0, 12000));
  console.error("E2E uncaught browser errors:\n" + pageErrors.join("\n"));
  console.error("E2E failed requests:\n" + failedRequests.join("\n"));
  console.error(
    "E2E failed Supabase responses:\n" + failedResponses.join("\n"),
  );
  await activePage
    ?.screenshot({
      path: path.join(artifactDir, "failure.png"),
      fullPage: true,
    })
    .catch(() => {});
  throw error;
} finally {
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
}
