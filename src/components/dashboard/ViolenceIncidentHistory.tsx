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
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";
import { violenceIncidentTranslations, ViolenceIncidentLanguage } from "@/lib/violenceIncidentTranslations";
import ViolenceIncidentDetails from "./ViolenceIncidentDetails";

interface ViolenceIncident {
  id: string;
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

interface ViolenceIncidentHistoryProps {
  userId: string;
  refreshKey: number;
  language: ViolenceIncidentLanguage;
}

const ViolenceIncidentHistory = ({ userId, refreshKey, language }: ViolenceIncidentHistoryProps) => {
  const [incidents, setIncidents] = useState<ViolenceIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<ViolenceIncident | null>(null);

  const t = violenceIncidentTranslations[language];

  useEffect(() => {
    fetchIncidents();
  }, [userId, refreshKey]);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("violence_incidents")
        .select("*")
        .eq("mover_id", userId)
        .order("created_at", { ascending: false });

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
    return <Badge variant={variants[severity] || "default"}>{severity.toUpperCase()}</Badge>;
  };

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  if (incidents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t.noReports}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.incidentDate}</TableHead>
              <TableHead>{t.jobId}</TableHead>
              <TableHead>{t.clientName}</TableHead>
              <TableHead>{t.severityLevel}</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incidents.map((incident) => (
              <TableRow key={incident.id}>
                <TableCell>
                  {format(new Date(incident.incident_date), "MMM d, yyyy")}
                </TableCell>
                <TableCell>{incident.job_id}</TableCell>
                <TableCell>{incident.client_name}</TableCell>
                <TableCell>{getSeverityBadge(incident.severity_level)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedIncident(incident)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    {t.viewDetails}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedIncident && (
        <ViolenceIncidentDetails
          incident={selectedIncident}
          open={!!selectedIncident}
          onOpenChange={(open) => !open && setSelectedIncident(null)}
          language={language}
          canEdit={false}
        />
      )}
    </>
  );
};

export default ViolenceIncidentHistory;
