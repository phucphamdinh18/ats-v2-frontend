"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Job } from "@/lib/policy";
import { useUiText } from "./ui-text";
import Icon from "./icon";

export default function PipelineJobSwitcher({
  jobs,
  selected,
  onChange,
}: {
  jobs: Job[];
  selected: Job;
  onChange: (job: Job) => void;
}) {
  const tr = useUiText();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const matches = jobs.filter((job) =>
    `${job.title} ${job.job_code || ""} ${job.business_unit || ""}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  function dismiss(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }
  function launch() {
    setQuery("");
    setActive(
      Math.max(
        0,
        jobs.findIndex((job) => job.id === selected.id),
      ),
    );
    setOpen(true);
  }
  function choose(job: Job) {
    onChange(job);
    dismiss(true);
  }
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open)
      root.current
        ?.querySelectorAll<HTMLElement>('[role="option"]')
        [active]?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, query]);
  return (
    <div
      ref={root}
      className="pipeline-job-switcher"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          dismiss(true);
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (!open) launch();
          else if (matches.length)
            setActive(
              (current) =>
                (current +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  matches.length) %
                matches.length,
            );
        } else if (event.key === "Enter" && open && matches[active]) {
          event.preventDefault();
          choose(matches[active]);
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="pipeline-job-trigger"
        aria-label={tr("Chọn Job cho Hiring Pipeline")}
        aria-haspopup="listbox"
        aria-describedby={`${id}-current`}
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        onClick={() => (open ? dismiss() : launch())}
      >
        <span className="pipeline-job-icon">
          <Icon name="jobs" size={20} />
        </span>
        <span className="pipeline-job-label" id={`${id}-current`}>
          <strong title={selected.title}>{selected.title}</strong>
          <small>
            {selected.job_code || tr("Chưa có mã")}
            {selected.business_unit ? ` · ${selected.business_unit}` : ""}
          </small>
        </span>
        <ChevronDown aria-hidden="true" size={17} />
      </button>
      {open && (
        <div className="pipeline-job-menu">
          <label className="search">
            <Icon name="search" size={16} />
            <input
              ref={input}
              role="combobox"
              aria-label={tr("Tìm Job")}
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-activedescendant={
                matches[active] ? `${id}-${matches[active].id}` : undefined
              }
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              placeholder={tr("Tìm tên vị trí hoặc mã…")}
            />
          </label>
          <div
            role="listbox"
            id={`${id}-list`}
            aria-label={tr("Chọn Job cho Hiring Pipeline")}
          >
            {matches.map((job, index) => (
              <button
                type="button"
                role="option"
                tabIndex={-1}
                id={`${id}-${job.id}`}
                key={job.id}
                aria-selected={selected.id === job.id}
                className={
                  index === active ? "job-option active" : "job-option"
                }
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(job)}
              >
                <span>
                  <strong>{job.title}</strong>
                  <small>{job.job_code || tr("Chưa có mã")}</small>
                </span>
                {job.id === selected.id && <Icon name="check" size={16} />}
              </button>
            ))}
          </div>
          {!matches.length && (
            <p role="status">{tr("Không tìm thấy Job phù hợp")}</p>
          )}
        </div>
      )}
    </div>
  );
}
