import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import DateRangeFilter from "./DateRangeFilter";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface Refund {
  id: string;
  submitted_by: string;
  customer_name: string;
  reimbursement_reason: string;
  request_date: string;
  amount: number;
  payment_method: string;
  payment_method_other: string | null;
  check_address: string | null;
  zelle_phone: string | null;
  comments: string | null;
  created_at: string;
  status: string;
  decline_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface SubmitterProfile {
  id: string;
  first_name: string;
  last_name: string;
}

const AdminCustomerRefundList = () => {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitters, setSubmitters] = useState<SubmitterProfile[]>([]);
  const [filterUser, setFilterUser] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<Refund | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineErr, setDeclineErr] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<Refund | null>(null);

  useEffect(() => {
    fetchRefunds();
    fetchSubmitters();
  }, []);

  const fetchRefunds = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customer_refunds" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRefunds(data as any);
    }
    setLoading(false);
  };

  const fetchSubmitters = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .order("first_name");

    if (data) setSubmitters(data);
  };

  const markCompleted = async (r: Refund) => {
    setActioning(r.id);
    const { error } = await supabase
      .from("customer_refunds" as any)
      .update({ status: "completed", decline_reason: null, reviewed_at: new Date().toISOString() })
      .eq("id", r.id);
    setActioning(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marked as Refund Completed");
    fetchRefunds();
  };

  const openDecline = (r: Refund) => {
    setDeclineTarget(r);
    setDeclineReason("");
    setDeclineErr("");
    setDeclineOpen(true);
  };

  const openDetails = (r: Refund) => {
    setDetailsTarget(r);
    setDetailsOpen(true);
  };

  const submitDecline = async () => {
    if (!declineTarget) return;
    if (!declineReason.trim()) {
      setDeclineErr("Please provide a reason");
      return;
    }
    setActioning(declineTarget.id);
    const { error } = await supabase
      .from("customer_refunds" as any)
      .update({
        status: "declined",
        decline_reason: declineReason.trim(),
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", declineTarget.id);
    setActioning(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Refund declined");
    setDeclineOpen(false);
    setDeclineTarget(null);
    fetchRefunds();
  };

  const filteredRefunds = useMemo(() => {
    return refunds.filter((r) => {
      if (filterUser !== "all" && r.submitted_by !== filterUser) return false;
      if (filterStatus !== "all" && (r.status || "pending") !== filterStatus) return false;
      if (filterMethod !== "all") {
        if (filterMethod === "other" && !r.payment_method_other) return false;
        if (filterMethod !== "other" && r.payment_method !== filterMethod) return false;
      }
      if (startDate && new Date(r.created_at) < startDate) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        if (new Date(r.created_at) >= end) return false;
      }
      return true;
    });
  }, [refunds, filterUser, filterMethod, filterStatus, startDate, endDate]);

  const userOptions = submitters
    .filter((s) => refunds.some((r) => r.submitted_by === s.id))
    .map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }));

  const getSubmitterName = (id: string) => {
    const s = submitters.find((p) => p.id === id);
    return s ? `${s.first_name} ${s.last_name}` : "Unknown";
  };

  const statusBadge = (status: string) => {
    const s = status || "pending";
    if (s === "completed") return <Badge className="bg-green-600 hover:bg-green-700">Refund Completed</Badge>;
    if (s === "declined") return <Badge variant="destructive">Declined</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <div className="w-full sm:w-64">
          <SearchableSelect
            options={[{ value: "all", label: "All Users" }, ...userOptions]}
            value={filterUser}
            onValueChange={setFilterUser}
            placeholder="Filter by submitter"
          />
        </div>
        <div className="w-full sm:w-44">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Refund Completed</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <Select value={filterMethod} onValueChange={setFilterMethod}>
            <SelectTrigger><SelectValue placeholder="Payment Method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="zelle">Zelle</SelectItem>
              <SelectItem value="check">Check</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClear={() => { setStartDate(undefined); setEndDate(undefined); }}
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Total Refunds</p>
          <p className="text-2xl font-bold">{filteredRefunds.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-2xl font-bold">${filteredRefunds.reduce((sum, r) => sum + Number(r.amount), 0).toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold">{filteredRefunds.filter(r => (r.status || "pending") === "pending").length}</p>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRefunds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No customer refund forms found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRefunds.map((refund) => {
                    const status = refund.status || "pending";
                    return (
                      <TableRow key={refund.id}>
                        <TableCell className="font-medium">{getSubmitterName(refund.submitted_by)}</TableCell>
                        <TableCell>{refund.customer_name}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={refund.reimbursement_reason}>{refund.reimbursement_reason}</TableCell>
                        <TableCell>{format(new Date(refund.request_date), "MM/dd/yyyy")}</TableCell>
                        <TableCell>${Number(refund.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {refund.payment_method_other || refund.payment_method.charAt(0).toUpperCase() + refund.payment_method.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {statusBadge(status)}
                          {status === "declined" && refund.decline_reason && (
                            <p className="text-xs text-muted-foreground mt-1 max-w-[180px]" title={refund.decline_reason}>
                              {refund.decline_reason}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{format(new Date(refund.created_at), "MM/dd/yyyy hh:mm a")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end items-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDetails(refund)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              View
                            </Button>
                            {status === "pending" ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => markCompleted(refund)}
                                  disabled={actioning === refund.id}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                  Refund Completed
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => openDecline(refund)}
                                  disabled={actioning === refund.id}
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-1" />
                                  Decline
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {refund.reviewed_at ? format(new Date(refund.reviewed_at), "MM/dd/yyyy hh:mm a") : "—"}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Refund</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Provide a reason. The submitter will see this on their refund.
            </p>
            <Textarea
              value={declineReason}
              onChange={(e) => { setDeclineReason(e.target.value); if (declineErr) setDeclineErr(""); }}
              placeholder="Reason for declining..."
              rows={4}
            />
            {declineErr && <p className="text-xs text-destructive">{declineErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={submitDecline} disabled={actioning === declineTarget?.id}>
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Refund Request Details</DialogTitle>
          </DialogHeader>
          {detailsTarget && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Submitted By</p>
                  <p className="font-medium">{getSubmitterName(detailsTarget.submitted_by)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Submitted On</p>
                  <p className="font-medium">{format(new Date(detailsTarget.created_at), "MM/dd/yyyy hh:mm a")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Customer Name</p>
                  <p className="font-medium">{detailsTarget.customer_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Request Date</p>
                  <p className="font-medium">{format(new Date(detailsTarget.request_date), "MM/dd/yyyy")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-medium">${Number(detailsTarget.amount).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Method</p>
                  <p className="font-medium">
                    {detailsTarget.payment_method_other || detailsTarget.payment_method.charAt(0).toUpperCase() + detailsTarget.payment_method.slice(1)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Status</p>
                  <div className="mt-1">{statusBadge(detailsTarget.status || "pending")}</div>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground text-sm mb-1">Reason</p>
                <p className="text-sm bg-muted rounded-md p-3">{detailsTarget.reimbursement_reason}</p>
              </div>

              {detailsTarget.comments && (
                <div>
                  <p className="text-muted-foreground text-sm mb-1">Comments</p>
                  <p className="text-sm bg-muted rounded-md p-3">{detailsTarget.comments}</p>
                </div>
              )}

              {detailsTarget.status === "declined" && detailsTarget.decline_reason && (
                <div>
                  <p className="text-muted-foreground text-sm mb-1">Decline Reason</p>
                  <p className="text-sm bg-destructive/10 text-destructive rounded-md p-3">{detailsTarget.decline_reason}</p>
                </div>
              )}

              {detailsTarget.reviewed_at && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Reviewed At</p>
                    <p className="font-medium">{format(new Date(detailsTarget.reviewed_at), "MM/dd/yyyy hh:mm a")}</p>
                  </div>
                  {detailsTarget.reviewed_by && (
                    <div>
                      <p className="text-muted-foreground">Reviewed By</p>
                      <p className="font-medium">{getSubmitterName(detailsTarget.reviewed_by)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCustomerRefundList;
