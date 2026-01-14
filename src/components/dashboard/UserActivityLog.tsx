import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Activity, CalendarIcon, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";

interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  activity_description: string;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
}

const UserActivityLog = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      fetchLogs();
    }
  }, [selectedUserId, selectedDate]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .order("first_name");

    if (data) {
      setUsers(data);
    }
  };

  const fetchLogs = async () => {
    if (!selectedUserId) return;

    setLoading(true);
    let query = supabase
      .from("user_activity_logs")
      .select("*")
      .eq("user_id", selectedUserId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (selectedDate) {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      query = query
        .gte("created_at", startOfDay.toISOString())
        .lte("created_at", endOfDay.toISOString());
    }

    const { data, error } = await query;

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

  const getActivityTypeBadge = (type: string) => {
    const typeColors: Record<string, string> = {
      login: "bg-green-500",
      logout: "bg-gray-500",
      form_submission: "bg-blue-500",
      form_update: "bg-yellow-500",
      document_upload: "bg-purple-500",
      settings_change: "bg-orange-500",
      appeal: "bg-red-500",
    };
    return (
      <Badge className={`${typeColors[type] || "bg-gray-500"} text-white text-xs`}>
        {type.replace(/_/g, " ")}
      </Badge>
    );
  };

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              User Activity Log
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchLogs}
                disabled={loading || !selectedUserId}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="w-[250px]">
              <SearchableSelect
                value={selectedUserId}
                onValueChange={setSelectedUserId}
                options={users.map(u => ({
                  value: u.id,
                  label: `${u.first_name} ${u.last_name}`,
                }))}
                placeholder="Select user..."
                searchPlaceholder="Search users..."
                emptyMessage="No users found"
              />
            </div>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[200px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Filter by date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setDatePickerOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {selectedDate && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}>
                Clear Date
              </Button>
            )}
          </div>

          {selectedUser && (
            <p className="text-sm text-muted-foreground mb-4">
              Viewing activity for: <strong>{selectedUser.first_name} {selectedUser.last_name}</strong>
            </p>
          )}

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Date (EST)</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!selectedUserId ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Select a user to view their activity
                    </TableCell>
                  </TableRow>
                ) : loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Loading activity...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No activity found for this user
                      {selectedDate && ` on ${format(selectedDate, "PPP")}`}
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{formatToEST(log.created_at)}</TableCell>
                      <TableCell>{getActivityTypeBadge(log.activity_type)}</TableCell>
                      <TableCell className="text-sm">{log.activity_description}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.reference_type && log.reference_id && (
                          <span>{log.reference_type}: {log.reference_id.substring(0, 8)}...</span>
                        )}
                      </TableCell>
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

export default UserActivityLog;
