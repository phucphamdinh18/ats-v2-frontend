"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, reviewCall } from "@/lib/supabase";
import {
  driveLink,
  RequestGate,
  reviewPermissions,
  type Detail,
  type Draft,
  type Kind,
  type ReviewState,
} from "@/lib/policy";
import { useLanguage } from "./language";
import Icon from "./icon";
import LoadingState from "./loading-state";
import { format, friendlyError, type Copy } from "@/lib/i18n";
const fieldLabels: Record<string, keyof Copy> = {
  full_name: "fieldName",
  email: "fieldEmail",
  phone: "fieldPhone",
  current_title: "fieldTitle",
  primary_role: "fieldRole",
  total_experience_years: "fieldExperience",
  seniority: "fieldSeniority",
  skills: "fieldSkills",
  domains: "fieldDomains",
  location: "fieldLocation",
  current_company: "fieldCompany",
  position: "fieldPosition",
  business_unit: "fieldUnit",
  proposed_job_id: "fieldProposed",
  summary: "fieldSummary",
};
export default function ReviewQueue({
  onAccessLost,
}: {
  onAccessLost: () => void;
}) {
  const { t } = useLanguage();
  const labels: Record<ReviewState, string> = {
    pending_review: t.pending,
    approved: t.approved,
    rejected: t.rejected,
  };
  const documentTitle = (draft: Draft) =>
    draft.full_name || draft.position || t.untitled;
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
      setError(err instanceof Error ? err.message : "requestFailed");
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
        throw new Error("mismatched");
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
      setError("correctionRestricted");
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
      setError("reasonRequired");
      return;
    }
    const prompt =
      action === "correct_title"
        ? t.confirmCorrection
        : decision === "approved"
          ? kind === "cv"
            ? t.confirmApproveCV
            : t.confirmApproveJD
          : t.confirmReject;
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
              ? "savedCorrection"
              : "noChange"
            : "savedDecision",
        );
    } catch (err) {
      if (!alive.current) return;
      if (err instanceof ApiError && err.status === 409) {
        details.current.invalidate();
        setDetail(null);
        await loadList();
        if (alive.current) setError("stale");
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
  const intakeLabel = (value: string) =>
    ({
      ready_for_review: t.ready,
      possible_duplicate: t.duplicate,
      processing: t.processing,
      received: t.received,
      failed: t.failed,
    })[value] || t.failed;
  return (
    <section className="panel review-panel" aria-label={t.reviewRegion}>
      <ol className="review-steps" aria-label={t.help}>
        <li>
          <span>1</span>
          {t.stepChoose}
        </li>
        <li>
          <span>2</span>
          {t.stepCheck}
        </li>
        <li>
          <span>3</span>
          {t.stepDecide}
        </li>
      </ol>
      <div className="toolbar">
        <div className="segmented" aria-label={t.draftKind}>
          <button
            disabled={busy}
            aria-pressed={kind === "cv"}
            onClick={() => {
              setKind("cv");
              setPage(0);
            }}
          >
            <Icon name="team" size={16} />
            {t.cv}
          </button>
          <button
            disabled={busy}
            aria-pressed={kind === "jd"}
            onClick={() => {
              setKind("jd");
              setPage(0);
            }}
          >
            <Icon name="review" size={16} />
            {t.jd}
          </button>
        </div>
        <select
          aria-label={t.reviewState}
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
          <Icon name="refresh" size={16} />
          {t.refresh}
        </button>
      </div>
      {error && (
        <div className="notice error" role="alert">
          <Icon name="help" size={18} />
          {friendlyError(error, t)}
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          <Icon name="check" size={18} />
          {t[message as keyof Copy] || t.savedDecision}
        </div>
      )}
      <div className="review-grid">
        <div className="draft-list" aria-busy={loading}>
          {loading ? (
            <LoadingState label={t.loadingDrafts} />
          ) : drafts.length ? (
            drafts.map((draft) => (
              <button
                className={`draft-item ${detail?.draft.id === draft.id ? "selected" : ""}`}
                key={draft.id}
                aria-label={`${kind.toUpperCase()} ${documentTitle(draft)}`}
                aria-pressed={detail?.draft.id === draft.id}
                disabled={busy}
                onClick={() => void loadDetail(draft.id)}
              >
                <span className="draft-kind">{kind.toUpperCase()}</span>
                <span>
                  <strong>{documentTitle(draft)}</strong>
                  <small>
                    {draft.email || draft.business_unit || t.noExtra}
                  </small>
                </span>
                <Icon name="arrow" size={16} className="chevron" />
              </button>
            ))
          ) : (
            <div className="empty">
              <span className="empty-icon mint">
                <Icon name="check" size={27} />
              </span>
              <h3>
                {page
                  ? t.noDrafts
                  : state === "pending_review"
                    ? format(t.emptyPending, { kind: kind.toUpperCase() })
                    : t.noDrafts}
              </h3>
              <p>
                {page
                  ? t.emptyPage
                  : state === "pending_review"
                    ? t.emptyPendingBody
                    : t.emptyOther}
              </p>
            </div>
          )}
          <div className="pagination">
            <button
              className="quiet"
              disabled={busy || loading || page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              {t.previous}
            </button>
            <span>{format(t.page, { page: page + 1 })}</span>
            <button
              className="quiet"
              disabled={busy || loading || drafts.length < 50 || page >= 1000}
              onClick={() => setPage((p) => p + 1)}
            >
              {t.next}
            </button>
          </div>
        </div>
        <div className="detail" aria-busy={detailLoading}>
          {detailLoading ? (
            <LoadingState label={t.loadingDetail} rows={4} />
          ) : !detail ? (
            <div className="empty">
              <span className="empty-icon purple">
                <Icon name="review" size={28} />
              </span>
              <h3>{t.selectDraft}</h3>
              <p>{t.selectDraftBody}</p>
            </div>
          ) : (
            <>
              <div className="detail-heading">
                <span
                  className={`badge ${detail.draft.review_state === "approved" ? "green" : ""}`}
                >
                  {labels[detail.draft.review_state]}
                </span>
                <h2>{documentTitle(detail.draft)}</h2>
                <p>{detail.intake.original_name}</p>
                {source ? (
                  <a
                    className="source-link"
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="external" size={17} />
                    {t.openSource}
                  </a>
                ) : (
                  <p className="muted">{t.noSource}</p>
                )}
              </div>
              <div className="detail-section-title">{t.extracted}</div>
              <dl>
                {keys.map((key) => {
                  const item = detail.draft[key];
                  return (
                    <div key={key}>
                      <dt>{t[fieldLabels[key]]}</dt>
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
                  <dt>{t.intakeState}</dt>
                  <dd>{intakeLabel(detail.intake.state)}</dd>
                </div>
                {detail.review && (
                  <>
                    <div>
                      <dt>{t.decision}</dt>
                      <dd>
                        {labels[detail.review.decision as ReviewState] || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>{t.reason}</dt>
                      <dd>{detail.review.reason || "—"}</dd>
                    </div>
                  </>
                )}
              </dl>
              {permission?.fixture && (
                <div className="notice">
                  <Icon name="help" size={18} />
                  {t.testOnly}
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
                    {kind === "cv" ? t.correctionLabelCV : t.correctionLabelJD}
                  </label>
                  <input
                    id="correct-value"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                    minLength={kind === "cv" ? 1 : 3}
                    maxLength={200}
                    disabled={busy}
                    placeholder={t.correctionPlaceholder}
                  />
                  <button className="secondary" type="submit" disabled={busy}>
                    {t.saveCorrection}
                  </button>
                </form>
              )}
              {permission?.reject && (
                <div className="review-form">
                  {!permission.approve && (
                    <div className="notice">{t.cannotApprove}</div>
                  )}
                  <label htmlFor="reason">{t.rejectReason}</label>
                  <textarea
                    id="reason"
                    value={reason}
                    maxLength={1000}
                    disabled={busy}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t.rejectPlaceholder}
                  />
                  {permission.approve && (
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={(e) => setChecked(e.target.checked)}
                      />
                      {t.verifiedSource}
                    </label>
                  )}
                  <div className="actions">
                    <button
                      className="danger"
                      disabled={busy}
                      onClick={() => void mutate("decide", "rejected")}
                    >
                      {t.reject}
                    </button>
                    <button
                      className="primary"
                      disabled={busy || !permission.approve || !checked}
                      onClick={() => void mutate("decide", "approved")}
                    >
                      {busy
                        ? t.saving
                        : kind === "cv"
                          ? t.approveCV
                          : t.approveJD}
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
