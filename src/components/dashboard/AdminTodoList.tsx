import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Star, AlertCircle, Clock, ArrowRight } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface TodoItem {
  id: string;
  type: "reimbursement" | "review" | "appeal_reimbursement" | "appeal_review";
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

      const items: TodoItem[] = [];

      // Map reimbursements
      reimbursements?.forEach((r) => {
        items.push({
          id: r.id,
          type: r.status === "appeal" ? "appeal_reimbursement" : "reimbursement",
          title: `Reimbursement #${String(r.reimbursement_number).padStart(5, "0")}`,
          subtitle: r.mover_full_name,
          createdAt: new Date(r.created_at),
          status: r.status,
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
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "appeal") {
      return <Badge variant="outline" className="border-orange-500 text-orange-600">Appeal</Badge>;
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

  const pendingReimbursements = todoItems.filter(i => i.type === "reimbursement").length;
  const pendingReviews = todoItems.filter(i => i.type === "review").length;
  const appeals = todoItems.filter(i => i.type.includes("appeal")).length;

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("requests")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Reimbursements</p>
                  <p className="text-2xl font-bold">{pendingReimbursements}</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate("reviews")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Star className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Reviews</p>
                  <p className="text-2xl font-bold">{pendingReviews}</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Appeals to Review</p>
                <p className="text-2xl font-bold">{appeals}</p>
              </div>
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
                      {getStatusBadge(item.status)}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigate(item.type.includes("reimbursement") ? "requests" : "reviews")}
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
