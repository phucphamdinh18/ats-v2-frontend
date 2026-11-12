"use client";
import { useEffect, useRef, useState } from "react";
import type { Job } from "@/lib/policy";
import ManualCandidateForm from "./manual-candidate-form";
import { useUiText } from "./ui-text";

export default function CandidateEntryDialog({
  job,
  isOpen,
  onDismiss,
  onCreated,
  onSessionLost,
}: {
  job: Job;
  isOpen: boolean;
  onDismiss: () => void;
  onCreated: () => Promise<void>;
  onSessionLost: () => void;
}) {
  const tr = useUiText();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!isOpen) {
      if (dialog.open) dialog.close();
      return;
    }
    // Native modal dialog supplies focus containment, an inert background and
    // focus restoration to the Add candidate trigger when the dialog closes.
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);
  return (
    <dialog
      ref={dialogRef}
      className="candidate-entry-dialog"
      aria-label={tr("Thêm ứng viên vào Job")}
      aria-modal="true"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
          ),
        ).filter((element) => !element.closest("[hidden]"));
        const first = controls[0];
        const last = controls.at(-1);
        if (!first || !last) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onDismiss();
      }}
      onClose={onDismiss}
    >
      <ManualCandidateForm
        job={job}
        onCreated={onCreated}
        onSessionLost={onSessionLost}
        onCancel={onDismiss}
        onSavingChange={setSaving}
      />
    </dialog>
  );
}
