import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.ATS_BASE_URL || "http://127.0.0.1:3000";
const artifactDir = process.env.ATS_E2E_ARTIFACT_DIR || "/tmp/ats-browser-e2e";
await fs.mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByLabel("Email thử nghiệm").fill("ta-e2e@example.invalid");
  await page.getByLabel("Mật khẩu thử nghiệm").fill("LocalTestOnly-2026-ATS!");
  await page.getByRole("button", { name: "Đăng nhập thử" }).click();

  const jobButton = page.getByRole("button", { name: "Chọn Job TEST ONLY Application E2E" });
  await jobButton.waitFor({ state: "visible", timeout: 20000 });
  assert.equal(
    await page.getByText("TEST ONLY Admin Metadata Job", { exact: false }).count(),
    0,
    "TA should not see the Admin-only metadata Job",
  );

  await jobButton.click();
  const pipeline = page.getByRole("region", { name: "Pipeline TEST ONLY Application E2E" });
  await pipeline.waitFor({ state: "visible", timeout: 15000 });
  await pipeline.getByText("SLA vòng: ≤ 2 ngày").waitFor({ state: "visible" });
  const candidateCard = pipeline.getByRole("button", {
    name: /Mở hồ sơ của TEST ONLY Manual E2E Candidate/,
  });
  await candidateCard.waitFor({ state: "visible", timeout: 15000 });
  await candidateCard.click();

  const details = page.getByRole("complementary", { name: "Chi tiết ứng viên" });
  await details.waitFor({ state: "visible", timeout: 10000 });
  await details.getByText("TEST ONLY Manual E2E Candidate", { exact: true }).waitFor();
  assert.deepEqual(pageErrors, [], "The browser UI should not throw uncaught runtime errors");
  await page.screenshot({ path: path.join(artifactDir, "ta-job-pipeline.png"), fullPage: true });
  console.log("Browser E2E passed: TA login, Job scope, pipeline, round SLA, source-backed candidate detail.");
} catch (error) {
  await page.screenshot({ path: path.join(artifactDir, "failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
