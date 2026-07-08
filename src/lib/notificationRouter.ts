/**
 * Centralized notification → in-app navigation router.
 *
 * Push notifications carry `data.reference_type` (e.g. "chat", "reimbursement",
 * "job_assignment"). This module resolves that to a dashboard tab id per role,
 * and provides a small pub/sub for cold-start + background-resume taps.
 *
 * Flow:
 *   1. `usePushNotifications` receives a tap and calls `emitDeepLink(payload)`.
 *      That both persists the payload to `localStorage` (survives a cold boot
 *      before React has mounted / before auth hydrates) and dispatches a
 *      window `app-deep-link` CustomEvent for the foreground case.
 *   2. Each dashboard calls `useDeepLink(role, setActiveTab)`. On mount it
 *      drains any pending link (cold start). While mounted it listens for
 *      the runtime event.
 *   3. Chat retains its extra behaviour (auto-select conversation, scroll to
 *      message) via the existing `open-chat` event, which the router re-fires
 *      for `reference_type === "chat"`.
 *
 * Adding a new notification type = one line in the ROUTES table per role.
 */

export type DeepLinkPayload = {
  referenceType?: string;
  referenceId?: string;
  notificationType?: string;
  messageId?: string;
};

/** Per-role map: reference_type → tab id in that dashboard. */
const ROUTES: Record<string, Record<string, string>> = {
  admin: {
    chat: "chat",
    reimbursement: "requests",
    review_bonus: "reviews",
    missing_payment: "missing-payments",
    performance_report: "performance",
    document_review: "documents",
    payment_question: "payment-questions",
    customer_refund: "refunds",
    referral: "referrals",
    mover_feedback: "feedback",
    signup: "signups",
    checkr_candidate: "signups",
    job_assignment: "assignments",
    shift: "shifts",
    system: "dashboard",
  },
  mover: {
    chat: "chat",
    reimbursement: "history",
    review_bonus: "reviews",
    missing_payment: "missing-payments",
    performance_report: "misconduct",
    document_review: "documents",
    payment_question: "payment-questions",
    referral: "referrals",
    mover_feedback: "feedback",
    job_assignment: "assignments",
    shift: "shifts",
    birthday: "feed",
    system: "feed",
  },
  accountant: {
    chat: "chat",
    reimbursement: "requests",
    payment_question: "payment-questions",
    customer_refund: "refunds",
  },
  operations_manager: {
    chat: "chat",
    performance_report: "performance",
    job_assignment: "assignments",
  },
  reviews_admin: {
    chat: "chat",
    review_bonus: "reviews",
    missing_payment: "missing-payments",
  },
  hr_manager: {
    chat: "chat",
    document_review: "documents",
    signup: "signups",
    checkr_candidate: "signups",
    mover_feedback: "feedback",
  },
  office_staff: {
    chat: "chat",
    customer_refund: "refunds",
  },
  warehouse_keeper: {
    chat: "chat",
  },
};

/** Resolve a target tab id for the given role + reference_type. */
export const resolveDeepLinkTab = (
  role: string | null | undefined,
  refType: string | null | undefined,
): string | undefined => {
  if (!role || !refType) return undefined;
  return ROUTES[role]?.[refType];
};

const PENDING_KEY = "pendingDeepLink";
const EVENT_NAME = "app-deep-link";

export const storePendingDeepLink = (payload: DeepLinkPayload) => {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
  } catch {}
};

export const consumePendingDeepLink = (): DeepLinkPayload | null => {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw) as DeepLinkPayload;
  } catch {
    return null;
  }
};

/**
 * Persist + broadcast a deep-link. Called by the push notification tap handler
 * for BOTH cold-start (persists to localStorage) and background-resume
 * (dispatches the event so a mounted dashboard reacts immediately).
 */
export const emitDeepLink = (payload: DeepLinkPayload) => {
  storePendingDeepLink(payload);
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
  } catch {}
};

export const DEEP_LINK_EVENT = EVENT_NAME;
