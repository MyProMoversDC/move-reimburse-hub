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
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { dashboardTranslations, DashboardLanguage } from "@/lib/dashboardTranslations";
import { handleError } from "@/lib/errorHandler";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [moverToDelete, setMoverToDelete] = useState<Mover | null>(null);
  
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
      } catch (error: unknown) {
        toast.error(handleError(error));
      } finally {
        setLoading(false);
      }
    };

    fetchMovers();
  }, []);

  const handleDeleteClick = (mover: Mover) => {
    setMoverToDelete(mover);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!moverToDelete) return;

    setDeletingId(moverToDelete.id);
    try {
      const { error } = await supabase.rpc("delete_user_account", {
        user_id_to_delete: moverToDelete.id,
      });

      if (error) throw error;

      toast.success(t.moverDeleted);
      setMovers(movers.filter((m) => m.id !== moverToDelete.id));
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setDeletingId(null);
      setShowDeleteDialog(false);
      setMoverToDelete(null);
    }
  };

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
              <TableHead className="text-right">{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(mover)}
                      disabled={deletingId === mover.id}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deletingId === mover.id ? t.deleting : t.deleteMover}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteMover}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmDelete}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.close}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground"
            >
              {deletingId ? t.deleting : t.deleteMover}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default MoversList;
