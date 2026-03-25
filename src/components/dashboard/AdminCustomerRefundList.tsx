import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
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
  comments: string | null;
  created_at: string;
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
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

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
    // Get unique submitter IDs from refunds, then fetch profiles
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .order("first_name");

    if (data) {
      setSubmitters(data);
    }
  };

  const filteredRefunds = useMemo(() => {
    return refunds.filter((r) => {
      if (filterUser !== "all" && r.submitted_by !== filterUser) return false;
      if (filterMethod !== "all") {
        const method = r.payment_method_other ? "other" : r.payment_method;
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
  }, [refunds, filterUser, filterMethod, startDate, endDate]);

  const userOptions = submitters
    .filter((s) => refunds.some((r) => r.submitted_by === s.id))
    .map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }));

  const getSubmitterName = (id: string) => {
    const s = submitters.find((p) => p.id === id);
    return s ? `${s.first_name} ${s.last_name}` : "Unknown";
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
        <div className="w-full sm:w-48">
          <Select value={filterMethod} onValueChange={setFilterMethod}>
            <SelectTrigger>
              <SelectValue placeholder="Payment Method" />
            </SelectTrigger>
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
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Refunds</p>
            <p className="text-2xl font-bold">{filteredRefunds.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-2xl font-bold">${filteredRefunds.reduce((sum, r) => sum + Number(r.amount), 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Avg Refund</p>
            <p className="text-2xl font-bold">
              ${filteredRefunds.length > 0 ? (filteredRefunds.reduce((sum, r) => sum + Number(r.amount), 0) / filteredRefunds.length).toFixed(2) : "0.00"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Comments</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRefunds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No customer refund forms found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRefunds.map((refund) => (
                    <TableRow key={refund.id}>
                      <TableCell className="font-medium">{getSubmitterName(refund.submitted_by)}</TableCell>
                      <TableCell>{refund.customer_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{refund.reimbursement_reason}</TableCell>
                      <TableCell>{format(new Date(refund.request_date), "MM/dd/yyyy")}</TableCell>
                      <TableCell>${Number(refund.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {refund.payment_method_other || refund.payment_method.charAt(0).toUpperCase() + refund.payment_method.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">{refund.comments || "—"}</TableCell>
                      <TableCell>{format(new Date(refund.created_at), "MM/dd/yyyy hh:mm a")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCustomerRefundList;
