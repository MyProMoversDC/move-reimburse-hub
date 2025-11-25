import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { dashboardTranslations, DashboardLanguage } from "@/lib/dashboardTranslations";

interface Mover {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

interface MoversListProps {
  language: DashboardLanguage;
}

const MoversList = ({ language }: MoversListProps) => {
  const [movers, setMovers] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(true);
  
  const t = dashboardTranslations[language];

  useEffect(() => {
    const fetchMovers = async () => {
      try {
        // Get all users with mover role
        const { data: moverRoles, error: rolesError } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "mover");

        if (rolesError) throw rolesError;

        const moverIds = moverRoles?.map((r) => r.user_id) || [];

        if (moverIds.length === 0) {
          setMovers([]);
          setLoading(false);
          return;
        }

        // Fetch profiles for all movers
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", moverIds)
          .order("first_name");

        if (profilesError) throw profilesError;

        setMovers(profiles || []);
      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMovers();
  }, []);

  if (loading) {
    return <div>{t.loading}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.moversDirectory}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.name}</TableHead>
              <TableHead>{t.username}</TableHead>
              <TableHead>{t.email}</TableHead>
              <TableHead>{t.phone}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  {t.noMoversFound}
                </TableCell>
              </TableRow>
            ) : (
              movers.map((mover) => (
                <TableRow key={mover.id}>
                  <TableCell className="font-medium">
                    {mover.first_name} {mover.last_name}
                  </TableCell>
                  <TableCell>{mover.username}</TableCell>
                  <TableCell>{mover.email}</TableCell>
                  <TableCell>{mover.phone}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default MoversList;
