import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Search, Eye, RefreshCw, CheckCircle, XCircle, Inbox, Send } from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

interface EmailLog {
  id: string;
  created_at: string;
  from_email: string;
  to_emails: string[];
  subject: string;
  body_html: string | null;
  email_type: string;
  reference_id: string | null;
  reference_type: string | null;
  status: string;
  error_message: string | null;
}

const AdminEmailLogs = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [activeTab, setActiveTab] = useState("outbound");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!error && data) {
      setLogs(data);
    }
    setLoading(false);
  };

  const formatToEST = (dateString: string) => {
    const date = new Date(dateString);
    const estDate = toZonedTime(date, "America/New_York");
    return format(estDate, "MM/dd/yyyy hh:mm a");
  };

  const getEmailTypeBadge = (type: string) => {
    const typeColors: Record<string, string> = {
      reimbursement_submission: "bg-blue-500",
      reimbursement_decline: "bg-red-500",
      reimbursement_confirmation: "bg-green-500",
      appeal_submission: "bg-yellow-500",
      review_submission: "bg-purple-500",
      performance_report: "bg-orange-500",
      admin_mover_email: "bg-teal-500",
      mover_approval_notification: "bg-green-600",
      mover_decline_notification: "bg-red-600",
    };
    return (
      <Badge className={`${typeColors[type] || "bg-gray-500"} text-white text-xs`}>
        {type.replace(/_/g, " ")}
      </Badge>
    );
  };

  // Separate inbound and outbound emails
  // Outbound: emails sent FROM the system (notifications@mypromoversreimbursements.com)
  // Inbound: replies or emails TO the system addresses
  const outboundEmails = logs.filter(
    (log) => log.from_email.includes("notifications@") || log.from_email.includes("mypromovers")
  );
  const inboundEmails = logs.filter(
    (log) => !log.from_email.includes("notifications@") && !log.from_email.includes("mypromovers")
  );

  const filterLogs = (emailList: EmailLog[]) =>
    emailList.filter(
      (log) =>
        log.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.to_emails.some((e) => e.toLowerCase().includes(searchTerm.toLowerCase())) ||
        log.email_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.from_email.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const renderEmailTable = (emails: EmailLog[]) => (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Date (EST)</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>{activeTab === "outbound" ? "To" : "From"}</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead className="w-[60px]">View</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Loading emails...
              </TableCell>
            </TableRow>
          ) : emails.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No email logs found
              </TableCell>
            </TableRow>
          ) : (
            emails.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs">{formatToEST(log.created_at)}</TableCell>
                <TableCell>{getEmailTypeBadge(log.email_type)}</TableCell>
                <TableCell className="text-sm max-w-[200px] truncate">
                  {activeTab === "outbound" ? log.to_emails.join(", ") : log.from_email}
                </TableCell>
                <TableCell className="text-sm max-w-[250px] truncate">{log.subject}</TableCell>
                <TableCell>
                  {log.status === "sent" ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(log)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Communications Log
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by subject, recipient, sender, or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="outbound" className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Outbound ({outboundEmails.length})
              </TabsTrigger>
              <TabsTrigger value="inbound" className="flex items-center gap-2">
                <Inbox className="h-4 w-4" />
                Inbound ({inboundEmails.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="outbound">
              {renderEmailTable(filterLogs(outboundEmails))}
            </TabsContent>

            <TabsContent value="inbound">
              {renderEmailTable(filterLogs(inboundEmails))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Email Detail Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Details
            </DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">From:</span>
                  <p>{selectedEmail.from_email}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Date:</span>
                  <p>{formatToEST(selectedEmail.created_at)}</p>
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-muted-foreground">To:</span>
                  <p>{selectedEmail.to_emails.join(", ")}</p>
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-muted-foreground">Subject:</span>
                  <p className="font-medium">{selectedEmail.subject}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Type:</span>
                  <p>{getEmailTypeBadge(selectedEmail.email_type)}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Status:</span>
                  <Badge variant={selectedEmail.status === "sent" ? "default" : "destructive"}>
                    {selectedEmail.status}
                  </Badge>
                </div>
                {selectedEmail.error_message && (
                  <div className="col-span-2">
                    <span className="font-medium text-red-500">Error:</span>
                    <p className="text-red-600">{selectedEmail.error_message}</p>
                  </div>
                )}
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Content:</span>
                <ScrollArea className="h-[300px] mt-2 border rounded-md p-4 bg-muted/20">
                  {selectedEmail.body_html ? (
                    <div dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }} />
                  ) : (
                    <p className="text-muted-foreground">No content available</p>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEmailLogs;
