import assert from "node:assert/strict";
import { test } from "node:test";
import {
  vi,
  en,
  getCopy,
  savedLocale,
  format,
  jobStatusLabel,
  roleLabel,
  friendlyError,
} from "../lib/i18n";
test("Vietnamese and English have matching non-empty keys and interpolation tokens", () => {
  assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort());
  for (const key of Object.keys(vi) as (keyof typeof vi)[]) {
    assert.ok(vi[key].trim(), key);
    assert.ok(en[key].trim(), key);
    assert.deepEqual(
      vi[key].match(/\{\w+\}/g) || [],
      en[key].match(/\{\w+\}/g) || [],
      key,
    );
  }
});
test("saved locale accepts only supported values and falls back safely", () => {
  assert.equal(savedLocale("en"), "en");
  for (const value of ["vi", null, "fr", "EN", "<script>"])
    assert.equal(savedLocale(value), "vi");
});
test("job status and role labels translate without changing API codes", () => {
  assert.equal(jobStatusLabel("OPEN", getCopy("en")), "Hiring");
  assert.equal(jobStatusLabel("OPEN", getCopy("vi")), "Đang tuyển");
  assert.equal(roleLabel("ADMIN", en), "Workspace admin");
  assert.equal(roleLabel("HIRING_MANAGER", vi), "Quản lý tuyển dụng");
  assert.equal(jobStatusLabel("FUTURE_STATUS", en), "FUTURE_STATUS");
});
test("counts, page numbers and unknown errors use the selected language", () => {
  assert.equal(
    format(en.jobsShown, { shown: 2, total: 4 }),
    "Showing 2 of 4 loaded roles · Based on your access",
  );
  assert.equal(format(vi.page, { page: 3 }), "Trang 3");
  assert.equal(friendlyError("stale", en), en.stale);
  assert.equal(
    friendlyError("database detail with private text", en),
    en.requestFailed,
  );
  assert.equal(
    friendlyError("Tài khoản không có quyền TA hoặc Admin.", en),
    en.scopeChanged,
  );
});

import { uiCopy, uiText, uiNotice, uiError, eventLabel } from "../lib/ui-copy";
test("workspace interface translations preserve interpolation and document data", () => {
  for (const [key, [vietnamese, english]] of Object.entries(uiCopy)) {
    assert.ok(vietnamese.trim(), key);
    assert.ok(english.trim(), key);
    assert.deepEqual(
      vietnamese.match(/\{\d+\}/g) || [],
      english.match(/\{\d+\}/g) || [],
      key,
    );
  }
  assert.equal(
    uiText("en", "Chuyển sang {0}", ["Screening"]),
    "Move to Screening",
  );
  assert.equal(uiText("en", "Nguyễn Văn A"), "Nguyễn Văn A");
  const notice = uiText("en", "Đã tạo Job nháp “{0}”.", ["Kỹ sư QA"]);
  assert.equal(uiNotice("vi", notice), "Đã tạo Job nháp “Kỹ sư QA”.");
  assert.equal(uiNotice("vi", "Stage conflict"), "Stage conflict");
});

test("unknown backend errors and event codes use friendly localized copy", () => {
  assert.equal(
    uiError("en", "Không tải được hồ sơ trong Job. Vui lòng thử lại."),
    en.requestFailed,
  );
  assert.equal(uiError("vi", "Internal error 500"), vi.requestFailed);
  assert.equal(eventLabel("vi", "MOVED"), "Đã chuyển vòng");
  assert.equal(eventLabel("en", "FUTURE_EVENT_CODE"), "Application updated");
});
