"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, reviewCall } from "@/lib/supabase";
import {
  driveLink,
  RequestGate,
  reviewPermissions,
  titleOf,
  type Detail,
  type Draft,
  type Kind,
  type ReviewState,
} from "@/lib/policy";
const labels: Record<ReviewState, string> = {
  pending_review: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
};
const fieldLabels: Record<string, string> = {
  full_name: "Họ và tên",
  email: "Email",
  phone: "Điện thoại",
  current_title: "Vị trí hiện tại",
  primary_role: "Vai trò",
  total_experience_years: "Kinh nghiệm (năm)",
  seniority: "Cấp độ",
  skills: "Kỹ năng",
  domains: "Lĩnh vực",
  location: "Địa điểm",
  current_company: "Công ty hiện tại",
  position: "Vị trí",
  business_unit: "Bộ phận",
  proposed_job_id: "Mã Job đề xuất",
  summary: "Tóm tắt",
};
export default function ReviewQueue({
  onAccessLost,
}: {
  onAccessLost: () => void;
}) {
  const [kind, setKind] = useState<Kind>("cv");
  const [state, setState] = useState<ReviewState>("pending_review");
  const [page, setPage] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const lists = useRef(new RequestGate());
  const details = useRef(new RequestGate());
  const alive = useRef(true);
  // A ref closes the same-tick double-submit gap before React renders disabled buttons.
  const submitting = useRef(false);
  const fail = useCallback(
    (err: unknown) => {
      if (!alive.current) return;
      if (
        err instanceof ApiError &&
        (err.status === 401 || err.status === 403)
      ) {
        onAccessLost();
        return;
      }
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu.");
    },
    [onAccessLost],
  );
  const loadList = useCallback(async () => {
    const ticket = lists.current.next();
    details.current.invalidate();
    setLoading(true);
    setDetail(null);
    setDetailLoading(false);
    setDrafts([]);
    setError("");
    setMessage("");
    try {
      const result = await reviewCall<{ drafts: Draft[] }>({
        action: "list",
        kind,
        state,
        page,
      });
      if (lists.current.current(ticket)) setDrafts(result.drafts || []);
    } catch (err) {
      if (lists.current.current(ticket)) fail(err);
    } finally {
      if (lists.current.current(ticket)) setLoading(false);
    }
  }, [kind, state, page, fail]);
  useEffect(() => {
    alive.current = true;
    void loadList();
    return () => {
      alive.current = false;
      lists.current.invalidate();
      details.current.invalidate();
    };
  }, [loadList]);
  async function loadDetail(id: string) {
    const ticket = details.current.next();
    setDetail(null);
    setDetailLoading(true);
    setError("");
    setReason("");
    setChecked(false);
    setValue("");
    try {
      const result = await reviewCall<Detail>({ action: "detail", kind, id });
      if (!details.current.current(ticket)) return;
      if (
        !result.intake ||
        result.intake.kind !== kind ||
        result.draft.id !== id
      )
        throw new Error("Dữ liệu bản nháp không khớp. Hãy tải lại.");
      setDetail(result);
    } catch (err) {
      if (details.current.current(ticket)) fail(err);
    } finally {
      if (details.current.current(ticket)) setDetailLoading(false);
    }
  }
  async function mutate(
    action: "correct_title" | "decide",
    decision?: "approved" | "rejected",
  ) {
    if (!detail || submitting.current) return;
    const permission = reviewPermissions(kind, detail);
    if (
      action === "correct_title" &&
      (!permission.correct || !value.trim().startsWith("[TEST ONLY]"))
    ) {
      setError("Chỉ sửa bản nháp giả cho phép, với nhãn [TEST ONLY].");
      return;
    }
    if (
      action === "decide" &&
      !(decision === "approved"
        ? permission.approve && checked
        : permission.reject)
    )
      return;
    if (decision === "rejected" && !reason.trim()) {
      setError("Vui lòng nhập lý do từ chối.");
      return;
    }
    const prompt =
      action === "correct_title"
        ? "Lưu tên mới cho bản nháp TEST ONLY?"
        : decision === "approved"
          ? `Duyệt bản nháp và tạo ${kind === "cv" ? "Candidate" : "Job nháp"}?`
          : "Từ chối bản nháp này?";
    if (!window.confirm(prompt)) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const id = detail.draft.id;
    try {
      const result = await reviewCall<{ correction?: { changed: boolean } }>(
        action === "correct_title"
          ? {
              action,
              kind,
              id,
              expected_value:
                (kind === "cv"
                  ? detail.draft.full_name
                  : detail.draft.position) ?? null,
              value: value.trim(),
            }
          : { action, kind, id, decision, reason: reason.trim() },
      );
      if (!alive.current) return;
      // Reload canonical server values; never patch a stale draft optimistically.
      await loadList();
      if (!alive.current) return;
      if (action === "correct_title") await loadDetail(id);
      if (alive.current)
        setMessage(
          action === "correct_title"
            ? result.correction?.changed
              ? "Đã lưu tên mới và nhật ký chỉnh sửa."
              : "Giá trị không đổi; không ghi thêm nhật ký."
            : "Đã lưu quyết định.",
        );
    } catch (err) {
      if (!alive.current) return;
      if (err instanceof ApiError && err.status === 409) {
        details.current.invalidate();
        setDetail(null);
        await loadList();
        if (alive.current)
          setError(
            "Bản nháp đã thay đổi. Mở lại bản nháp để kiểm tra dữ liệu mới trước khi tiếp tục.",
          );
      } else fail(err);
    } finally {
      submitting.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const permission = detail ? reviewPermissions(kind, detail) : null;
  const source = detail ? driveLink(detail.intake.drive_url) : null;
  const keys =
    kind === "cv"
      ? [
          "full_name",
          "email",
          "phone",
          "current_title",
          "primary_role",
          "total_experience_years",
          "seniority",
          "skills",
          "domains",
          "location",
          "current_company",
        ]
      : [
          "position",
          "business_unit",
          "proposed_job_id",
          "seniority",
          "location",
          "skills",
          "domains",
          "summary",
        ];
  return (
    <section className="panel review-panel" aria-label="Hàng chờ CV và JD">
      <div className="toolbar">
        <div className="segmented" aria-label="Loại bản nháp">
          <button
            disabled={busy}
            aria-pressed={kind === "cv"}
            onClick={() => {
              setKind("cv");
              setPage(0);
            }}
          >
            CV ứng viên
          </button>
          <button
            disabled={busy}
            aria-pressed={kind === "jd"}
            onClick={() => {
              setKind("jd");
              setPage(0);
            }}
          >
            JD tuyển dụng
          </button>
        </div>
        <select
          aria-label="Trạng thái bản nháp"
          value={state}
          disabled={busy}
          onChange={(e) => {
            setState(e.target.value as ReviewState);
            setPage(0);
          }}
        >
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button
          className="secondary"
          disabled={busy || loading}
          onClick={() => void loadList()}
        >
          ↻ Tải lại
        </button>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      <div className="review-grid">
        <div className="draft-list" aria-busy={loading}>
          {loading ? (
            <div className="empty" role="status">
              Đang tải bản nháp…
            </div>
          ) : drafts.length ? (
            drafts.map((draft) => (
              <button
                className={`draft-item ${detail?.draft.id === draft.id ? "selected" : ""}`}
                key={draft.id}
                aria-label={`${kind.toUpperCase()} ${titleOf(draft)}`}
                disabled={busy}
                onClick={() => void loadDetail(draft.id)}
              >
                <span className="draft-kind">{kind.toUpperCase()}</span>
                <span>
                  <strong>{titleOf(draft)}</strong>
                  <small>
                    {draft.email ||
                      draft.business_unit ||
                      "Chưa có thông tin bổ sung"}
                  </small>
                </span>
                <span className="chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            ))
          ) : (
            <div className="empty">
              <div className="empty-icon" aria-hidden="true">
                ✓
              </div>
              <h3>Không có bản nháp</h3>
              <p>
                {page
                  ? "Không có dữ liệu ở trang này."
                  : `Danh sách ${labels[state].toLowerCase()} đang trống.`}
              </p>
            </div>
          )}
          <div className="pagination">
            <button
              className="quiet"
              disabled={busy || loading || page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Trước
            </button>
            <span>Trang {page + 1}</span>
            <button
              className="quiet"
              disabled={busy || loading || drafts.length < 50 || page >= 1000}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau →
            </button>
          </div>
        </div>
        <div className="detail" aria-busy={detailLoading}>
          {detailLoading ? (
            <div className="empty" role="status">
              Đang tải chi tiết…
            </div>
          ) : !detail ? (
            <div className="empty">
              <div className="empty-icon" aria-hidden="true">
                ▤
              </div>
              <h3>Chọn bản nháp để xem</h3>
              <p>
                Thông tin trích xuất và tệp gốc
                <br />
                sẽ hiển thị tại đây.
              </p>
            </div>
          ) : (
            <>
              <div className="detail-heading">
                <span className="badge">
                  {labels[detail.draft.review_state]}
                </span>
                <h2>{titleOf(detail.draft)}</h2>
                <p>{detail.intake.original_name}</p>
                {source ? (
                  <a
                    className="text-link"
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Mở tệp gốc trên Drive ↗
                  </a>
                ) : (
                  <p className="muted">Không có liên kết Drive hợp lệ.</p>
                )}
              </div>
              <dl>
                {keys.map((key) => {
                  const item = detail.draft[key];
                  return (
                    <div key={key}>
                      <dt>{fieldLabels[key]}</dt>
                      <dd>
                        {Array.isArray(item)
                          ? item.join(", ") || "—"
                          : typeof item === "string" || typeof item === "number"
                            ? String(item)
                            : "—"}
                      </dd>
                    </div>
                  );
                })}
                <div>
                  <dt>Trạng thái intake</dt>
                  <dd>{detail.intake.state}</dd>
                </div>
                {detail.review && (
                  <>
                    <div>
                      <dt>Quyết định</dt>
                      <dd>{detail.review.decision}</dd>
                    </div>
                    <div>
                      <dt>Lý do</dt>
                      <dd>{detail.review.reason || "—"}</dd>
                    </div>
                  </>
                )}
              </dl>
              {permission?.fixture && (
                <div className="notice">
                  Bản nháp giả phục vụ kiểm thử sửa tên. Không tạo Candidate
                  hoặc Job.
                </div>
              )}
              {permission?.correct && (
                <form
                  className="review-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutate("correct_title");
                  }}
                >
                  <label htmlFor="correct-value">
                    {kind === "cv" ? "Tên CV" : "Vị trí JD"} sau chỉnh sửa
                  </label>
                  <input
                    id="correct-value"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                    minLength={kind === "cv" ? 1 : 3}
                    maxLength={200}
                    disabled={busy}
                    placeholder="[TEST ONLY] …"
                  />
                  <button className="secondary" type="submit" disabled={busy}>
                    Lưu chỉnh sửa TEST ONLY
                  </button>
                </form>
              )}
              {permission?.reject && (
                <div className="review-form">
                  {!permission.approve && (
                    <div className="notice">
                      Bản nháp chưa đủ điều kiện duyệt. Cần xử lý trạng thái
                      intake trước khi tạo hồ sơ.
                    </div>
                  )}
                  <label htmlFor="reason">Ghi chú / lý do từ chối</label>
                  <textarea
                    id="reason"
                    value={reason}
                    maxLength={1000}
                    disabled={busy}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Bắt buộc khi từ chối"
                  />
                  {permission.approve && (
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={(e) => setChecked(e.target.checked)}
                      />
                      Tôi đã đối chiếu dữ liệu với tệp gốc.
                    </label>
                  )}
                  <div className="actions">
                    <button
                      className="danger"
                      disabled={busy}
                      onClick={() => void mutate("decide", "rejected")}
                    >
                      Từ chối
                    </button>
                    <button
                      className="primary"
                      disabled={busy || !permission.approve || !checked}
                      onClick={() => void mutate("decide", "approved")}
                    >
                      {busy ? "Đang lưu…" : "Duyệt bản nháp"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
