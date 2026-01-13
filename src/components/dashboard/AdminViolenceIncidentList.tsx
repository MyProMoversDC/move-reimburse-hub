import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";
import DateRangeFilter from "./DateRangeFilter";
import ViolenceIncidentDetails from "./ViolenceIncidentDetails";

interface ViolenceIncident {
  id: string;
  mover_id: string;
  mover_name: string;
  phone_number: string;
  created_at: string;
  incident_date: string;
  incident_time: string;
  job_id: string;
  incident_address: string;
  client_name: string;
  incident_types: string[];
  incident_description: string;
  anyone_injured: boolean;
  injury_description: string | null;
  property_damaged: boolean;
  damage_description: string | null;
  police_contacted: boolean;
  emergency_services_called: boolean;
  severity_level: string;
  admin_actions: string | null;
  operations_manager_actions: string | null;
}

interface AdminViolenceIncidentListProps {
  userRole: "admin" | "operations_manager";
}

const AdminViolenceIncidentList = ({ userRole }: AdminViolenceIncidentListProps) => {
  const [incidents, setIncidents] = useState<ViolenceIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<ViolenceIncident | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  useEffect(() => {
    fetchIncidents();
  }, [startDate, endDate]);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("violence_incidents")
        .select("*")
        .order("created_at", { ascending: false });

      if (startDate) {
        query = query.gte("incident_date", format(startDate, "yyyy-MM-dd"));
      }
      if (endDate) {
        const endDatePlusOne = new Date(endDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        query = query.lt("incident_date", format(endDatePlusOne, "yyyy-MM-dd"));
      }

      const { data, error } = await query;

      if (error) throw error;
      setIncidents(data || []);
    } catch (error) {
      toast.error(handleError(error));
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "secondary",
      medium: "default",
      high: "destructive",
      critical: "destructive",
    };
    const colors: Record<string, string> = {
      critical: "bg-red-600 hover:bg-red-600",
    };
    return (
      <Badge variant={variants[severity] || "default"} className={colors[severity]}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const getStatusIndicator = (incident: ViolenceIncident) => {
    const hasActions = userRole === "admin" 
      ? incident.admin_actions 
      : incident.operations_manager_actions;
    
    return hasActions ? (
      <Badge variant="outline" className="text-green-600 border-green-600">Reviewed</Badge>
    ) : (
      <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pending Review</Badge>
    );
  };

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onClear={() => {
          setStartDate(undefined);
          setEndDate(undefined);
        }}
      />

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Submitted At</TableHead>
              <TableHead>Incident Date</TableHead>
              <TableHead>Mover</TableHead>
              <TableHead>Job ID</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incidents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No violence incident reports found.
                </TableCell>
              </TableRow>
            ) : (
              incidents.map((incident) => {
                const submittedAtEST = toZonedTime(new Date(incident.created_at), "America/New_York");
                return (
                  <TableRow key={incident.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(submittedAtEST, "MMM d, yyyy h:mm a")} EST
                    </TableCell>
                    <TableCell>
                      {format(new Date(incident.incident_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">{incident.mover_name}</TableCell>
                    <TableCell>{incident.job_id}</TableCell>
                    <TableCell>{incident.client_name}</TableCell>
                    <TableCell>{getSeverityBadge(incident.severity_level)}</TableCell>
                    <TableCell>{getStatusIndicator(incident)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedIncident(incident)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {selectedIncident && (
        <ViolenceIncidentDetails
          incident={selectedIncident}
          open={!!selectedIncident}
          onOpenChange={(open) => !open && setSelectedIncident(null)}
          language="en"
          canEdit={true}
          userRole={userRole}
          onUpdate={() => {
            fetchIncidents();
            setSelectedIncident(null);
          }}
        />
      )}
    </div>
  );
};

export default AdminViolenceIncidentList;
