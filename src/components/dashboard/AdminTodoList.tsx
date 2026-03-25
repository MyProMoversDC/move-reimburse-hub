import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Star, AlertCircle, Clock, ArrowRight, MessageCircle, Shield, DollarSign, HelpCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TodoItem {
  id: string;
  type: "reimbursement" | "review" | "appeal_reimbursement" | "appeal_review" | "missing_payment" | "mover_feedback" | "performance_report" | "violence_incident";
  title: string;
  subtitle: string;
  createdAt: Date;
  status: string;
}

interface AdminTodoListProps {
  onNavigate: (tab: string) => void;
}

const AdminTodoList = ({ onNavigate }: AdminTodoListProps) => {
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingItems();
  }, []);

  const fetchPendingItems = async () => {
    try {
      // Fetch pending reimbursements
      const { data: reimbursements } = await supabase
        .from("reimbursements")
        .select("id, reimbursement_number, mover_full_name, created_at, status")
        .in("status", ["pending", "appeal"])
        .order("created_at", { ascending: true });

      // Fetch pending reviews
      const { data: reviews } = await supabase
        .from("review_bonuses")
        .select("id, invoice_number, client_full_name, foreman_name, submission_date, status")
        .in("status", ["pending", "appeal"])
        .order("submission_date", { ascending: true });

      // Fetch pending missing payments
      const { data: missingPayments } = await supabase
        .from("missing_payments")
        .select("id, job_number, mover_full_name, created_at, status, missing_amount")
        .in("status", ["pending", "appeal"])
        .order("created_at", { ascending: true });

      // Fetch pending mover feedback
      const { data: moverFeedback } = await supabase
        .from("mover_feedback")
        .select("id, mover_name, feedback_type, priority, created_at, status")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      // Fetch performance reports
      const { data: performanceReports } = await supabase
        .from("performance_reports")
        .select("id, title, worker_name, incident_category, severity_level, created_at")
        .order("created_at", { ascending: true });

      // Fetch unreviewed violence incidents
      const { data: violenceIncidents } = await supabase
        .from("violence_incidents")
        .select("id, mover_name, incident_date, severity_level, created_at")
        .is("admin_actions", null)
        .order("created_at", { ascending: true });

      const items: TodoItem[] = [];

      // Map reimbursements
      reimbursements?.forEach((r) => {
        items.push({
          id: r.id,
          type: r.status === "appeal" ? "appeal_reimbursement" : "reimbursement",
          title: `Reimbursement #${String(r.reimbursement_number).padStart(5, "0")}`,
          subtitle: r.mover_full_name,
          createdAt: new Date(r.created_at!),
          status: r.status!,
        });
      });

      // Map reviews
      reviews?.forEach((r) => {
        items.push({
          id: r.id,
          type: r.status === "appeal" ? "appeal_review" : "review",
          title: `Review - ${r.invoice_number}`,
          subtitle: `${r.foreman_name} | ${r.client_full_name}`,
          createdAt: new Date(r.submission_date),
          status: r.status,
        });
      });

      // Map missing payments
      missingPayments?.forEach((mp) => {
        items.push({
          id: mp.id,
          type: "missing_payment",
          title: `Missing Payment - Job #${mp.job_number}`,
          subtitle: `${mp.mover_full_name} | $${mp.missing_amount}`,
          createdAt: new Date(mp.created_at),
          status: mp.status,
        });
      });

      // Map mover feedback
      moverFeedback?.forEach((f) => {
        items.push({
          id: f.id,
          type: "mover_feedback",
          title: `Feedback - ${f.feedback_type}`,
          subtitle: `${f.mover_name} | ${f.priority === 'needs_attention_soon' ? 'Urgent' : 'General'}`,
          createdAt: new Date(f.created_at),
          status: f.status,
        });
      });

      // Map performance reports
      performanceReports?.forEach((pr) => {
        items.push({
          id: pr.id,
          type: "performance_report",
          title: pr.title,
          subtitle: `${pr.worker_name} | ${pr.incident_category}`,
          createdAt: new Date(pr.created_at),
          status: pr.severity_level,
        });
      });

      // Map violence incidents
      violenceIncidents?.forEach((vi) => {
        items.push({
          id: vi.id,
          type: "violence_incident",
          title: `Violence Incident - ${vi.severity_level}`,
          subtitle: `${vi.mover_name} | ${vi.incident_date}`,
          createdAt: new Date(vi.created_at),
          status: vi.severity_level,
        });
      });

      // Sort by date (oldest first)
      items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      setTodoItems(items);
    } catch (error) {
      console.error("Error fetching pending items:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "reimbursement":
        return <FileText className="h-5 w-5 text-blue-500" />;
      case "review":
        return <Star className="h-5 w-5 text-yellow-500" />;
      case "appeal_reimbursement":
      case "appeal_review":
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case "missing_payment":
        return <DollarSign className="h-5 w-5 text-green-500" />;
      case "mover_feedback":
        return <MessageCircle className="h-5 w-5 text-purple-500" />;
      case "performance_report":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "violence_incident":
        return <Shield className="h-5 w-5 text-red-600" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getStatusBadge = (status: string, type: string) => {
    if (status === "appeal") {
      return <Badge variant="outline" className="border-orange-500 text-orange-600">Appeal</Badge>;
    }
    if (type === "performance_report") {
      return <Badge variant="outline" className="border-red-500 text-red-600">New Report</Badge>;
    }
    if (type === "violence_incident") {
      return <Badge variant="outline" className="border-red-600 text-red-700">Needs Review</Badge>;
    }
    if (type === "mover_feedback") {
      return <Badge variant="outline" className="border-purple-500 text-purple-600">Feedback</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  const getTimeWarning = (date: Date) => {
    const hoursDiff = (Date.now() - date.getTime()) / (1000 * 60 * 60);
    if (hoursDiff > 72) {
      return (
        <span className="flex items-center text-destructive text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Overdue
        </span>
      );
    }
    if (hoursDiff > 48) {
      return (
        <span className="flex items-center text-orange-500 text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Due soon
        </span>
      );
    }
    return null;
  };

  const getNavigationTab = (type: string) => {
    switch (type) {
      case "reimbursement":
      case "appeal_reimbursement":
        return "requests";
      case "review":
      case "appeal_review":
        return "reviews";
      case "missing_payment":
        return "missing-payments";
      case "mover_feedback":
        return "mover-feedback";
      case "performance_report":
        return "performance-reports";
      case "violence_incident":
        return "violence-incidents";
      default:
        return "dashboard";
    }
  };

  const pendingReimbursements = todoItems.filter(i => i.type === "reimbursement").length;
  const pendingReviews = todoItems.filter(i => i.type === "review").length;
  const appeals = todoItems.filter(i => i.type.includes("appeal")).length;
  const pendingMissingPayments = todoItems.filter(i => i.type === "missing_payment").length;
  const pendingFeedback = todoItems.filter(i => i.type === "mover_feedback").length;
  const pendingPerformanceReports = todoItems.filter(i => i.type === "performance_report").length;
  const pendingViolenceIncidents = todoItems.filter(i => i.type === "violence_incident").length;

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("requests")}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reimbursements</p>
                  <p className="text-xl font-bold">{pendingReimbursements}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("reviews")}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Star className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reviews</p>
                  <p className="text-xl font-bold">{pendingReviews}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("missing-payments")}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Missing Payments</p>
                  <p className="text-xl font-bold">{pendingMissingPayments}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Appeals</p>
                <p className="text-xl font-bold">{appeals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("mover-feedback")}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <MessageCircle className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mover Feedback</p>
                  <p className="text-xl font-bold">{pendingFeedback}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("performance-reports")}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Misconduct Reports</p>
                  <p className="text-xl font-bold">{pendingPerformanceReports}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("violence-incidents")}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Shield className="h-5 w-5 text-red-700" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Violence Incidents</p>
                  <p className="text-xl font-bold">{pendingViolenceIncidents}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Todo List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Items Awaiting Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todoItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              All caught up! No pending items to review.
            </p>
          ) : (
            <div className="space-y-3">
              {todoItems.slice(0, 10).map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getIcon(item.type)}
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getTimeWarning(item.createdAt)}
                    <div className="text-right">
                      {getStatusBadge(item.status, item.type)}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigate(getNavigationTab(item.type))}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {todoItems.length > 10 && (
                <p className="text-center text-muted-foreground text-sm pt-2">
                  And {todoItems.length - 10} more items...
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminTodoList;
