import type { ApprovalStatus, QuoteStatus } from "../generated/prisma/enums.js";

/*
 * The quote lifecycle in one place. Controllers and services ask this module;
 * none of them compares statuses on its own.
 *
 *   DRAFT ──save below threshold, by someone who may not approve──▶ PENDING_APPROVAL
 *   DRAFT ──save below threshold, by an approver──▶ DRAFT (approved by the saver)
 *   PENDING_APPROVAL ──approve──▶ READY_TO_SEND
 *   PENDING_APPROVAL ──reject───▶ DRAFT
 *   READY_TO_SEND ──edit──▶ DRAFT or PENDING_APPROVAL (the check runs again)
 *   READY_TO_SEND ──▶ SENT ──▶ ACCEPTED | DECLINED | EXPIRED   (later steps)
 */
export const QUOTE_TRANSITIONS: Readonly<Record<QuoteStatus, readonly QuoteStatus[]>> = {
  DRAFT: ["PENDING_APPROVAL", "READY_TO_SEND", "CANCELLED"],
  PENDING_APPROVAL: ["DRAFT", "READY_TO_SEND", "CANCELLED"],
  READY_TO_SEND: ["DRAFT", "PENDING_APPROVAL", "SENT", "CANCELLED"],
  SENT: ["ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"],
  ACCEPTED: [],
  DECLINED: [],
  EXPIRED: [],
  CANCELLED: [],
};

/** Staying in the same status is always allowed: it is not a transition. */
export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return from === to || QUOTE_TRANSITIONS[from].includes(to);
}

/**
 * Statuses in which saving an edit (a new revision) is allowed. Once a quote
 * has gone to the client its figures are what the client holds; revising it
 * from there belongs to a later step.
 */
export const EDITABLE_STATUSES: readonly QuoteStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "READY_TO_SEND",
];

export function isEditable(status: QuoteStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

/** The approval state a save gives its new revision. */
export type SaveApproval = Extract<ApprovalStatus, "NOT_REQUIRED" | "PENDING" | "APPROVED">;

/**
 * Below the threshold, whoever saves the revision decides who answers for it:
 * someone who may approve (quote.approve) answers for it themselves — the
 * revision is recorded as approved by them and they are only warned — while
 * anyone else's save waits for an approver. Decided per save, by the person
 * saving, not by the quote's original author.
 */
export function approvalOnSave(belowThreshold: boolean, saverMayApprove: boolean): SaveApproval {
  if (!belowThreshold) return "NOT_REQUIRED";
  return saverMayApprove ? "APPROVED" : "PENDING";
}

/**
 * Where a save lands. Every save re-runs the approval check, so an approval
 * given to an earlier revision never carries over to changed figures.
 */
export function statusAfterSave(approval: SaveApproval): QuoteStatus {
  return approval === "PENDING" ? "PENDING_APPROVAL" : "DRAFT";
}
