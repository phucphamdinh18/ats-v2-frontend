"use client";
import OfferApprovalWorkspace from "./offer-approval-workspace";
import type { Job } from "@/lib/policy";

export default function BoschOffersWorkspace({
  job,
  onAccessLost,
}: {
  job: Job;
  onAccessLost: () => void;
}) {
  return (
    <OfferApprovalWorkspace
      key={job.id}
      embedded
      scopedJob={job}
      onAccessLost={onAccessLost}
    />
  );
}
