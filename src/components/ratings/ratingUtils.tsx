// Shared rating helpers and components
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";

export type RatingStatus = "Excellent" | "Good" | "Warning" | "Critical";

export function getRatingStatus(score: number): {
  label: RatingStatus;
  color: string;
  bgClass: string;
  textClass: string;
  rowClass: string;
} {
  if (score >= 40) return { label: "Excellent", color: "#16a34a", bgClass: "bg-green-100 dark:bg-green-900/30", textClass: "text-green-700 dark:text-green-300", rowClass: "" };
  if (score >= 30) return { label: "Good", color: "#2563eb", bgClass: "bg-blue-100 dark:bg-blue-900/30", textClass: "text-blue-700 dark:text-blue-300", rowClass: "" };
  if (score >= 20) return { label: "Warning", color: "#ea580c", bgClass: "bg-orange-100 dark:bg-orange-900/30", textClass: "text-orange-700 dark:text-orange-300", rowClass: "" };
  return { label: "Critical", color: "#dc2626", bgClass: "bg-red-100 dark:bg-red-900/30", textClass: "text-red-700 dark:text-red-300", rowClass: "bg-red-50 dark:bg-red-950/40 hover:bg-red-100/70 dark:hover:bg-red-950/60" };
}

export function scoreToStars(score: number): number {
  return Math.round((score / 10) * 10) / 10;
}

export function StarRating({ score, size = 16 }: { score: number; size?: number }) {
  const stars = scoreToStars(score);
  const full = Math.floor(stars);
  const hasHalf = stars - full >= 0.5;
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${stars} stars out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = i < full || (i === full && hasHalf);
        return (
          <Star
            key={i}
            size={size}
            className={filled ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}
          />
        );
      })}
      <span className="ml-1 text-xs font-medium tabular-nums">{stars.toFixed(1)}</span>
    </div>
  );
}

export function RatingStatusBadge({ score }: { score: number }) {
  const s = getRatingStatus(score);
  return <Badge className={`${s.bgClass} ${s.textClass} border-0`}>{s.label}</Badge>;
}

export const EVENT_LABELS: Record<string, string> = {
  misconduct_filed: "Misconduct Filed",
  misconduct_confirmed: "Misconduct Confirmed",
  violence_incident: "Violence Incident",
  alcohol_test_failed: "Alcohol Test Failed",
  alcohol_test_missed: "Alcohol Test Missed",
  reimbursement_declined: "Reimbursement Declined",
  customer_refund_fault: "Customer Refund (At Fault)",
  compliance_docs_overdue: "Compliance Docs Overdue",
  negative_review: "Negative Review",
  review_bonus_approved: "Review Bonus Approved",
  referral_approved: "Referral Approved",
  perfect_month: "Perfect Month",
  alcohol_compliance_monthly: "Alcohol Compliance (Monthly)",
  docs_on_time: "Docs On Time",
  positive_feedback: "Positive Feedback",
};

export const EVENT_OPTIONS = Object.keys(EVENT_LABELS);
