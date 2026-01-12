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
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Trash2, Edit, DollarSign, Save } from "lucide-react";
import { dashboardTranslations, DashboardLanguage } from "@/lib/dashboardTranslations";
import { handleError } from "@/lib/errorHandler";
import { Label } from "@/components/ui/label";

interface Mover {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  hourly_rate: number;
  avatar_url: string | null;
}

interface MoverBalance {
  mover_id: string;
  balance: number;
}

interface MoversListProps {
  language: DashboardLanguage;
}

const MoversList = ({ language }: MoversListProps) => {
  const [movers, setMovers] = useState<Mover[]>([]);
  const [balances, setBalances] = useState<MoverBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [moverToDelete, setMoverToDelete] = useState<Mover | null>(null);
  
  // Edit hourly rate state
  const [editingMover, setEditingMover] = useState<Mover | null>(null);
  const [newHourlyRate, setNewHourlyRate] = useState<string>("");
  const [savingRate, setSavingRate] = useState(false);
  
  const t = dashboardTranslations[language];

  const extraTranslations = {
    en: {
      hourlyRate: "Hourly Rate",
      balance: "Balance",
      editHourlyRate: "Edit Hourly Rate",
      save: "Save",
      saving: "Saving...",
      hourlyRateUpdated: "Hourly rate updated successfully!",
    },
    es: {
      hourlyRate: "Tarifa por Hora",
      balance: "Balance",
      editHourlyRate: "Editar Tarifa por Hora",
      save: "Guardar",
      saving: "Guardando...",
      hourlyRateUpdated: "¡Tarifa por hora actualizada exitosamente!",
    },
    ru: {
      hourlyRate: "Почасовая Ставка",
      balance: "Баланс",
      editHourlyRate: "Изменить Почасовую Ставку",
      save: "Сохранить",
      saving: "Сохранение...",
      hourlyRateUpdated: "Почасовая ставка успешно обновлена!",
    },
  };

  const et = extraTranslations[language];

  useEffect(() => {
    fetchMovers();
  }, []);

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
        .select("id, username, first_name, last_name, email, phone, hourly_rate, avatar_url")
        .in("id", moverIds)
        .order("first_name");

      if (profilesError) throw profilesError;

      setMovers(profiles || []);

      // Fetch balances for all movers
      const { data: balanceData, error: balanceError } = await supabase
        .from("mover_balances")
        .select("mover_id, balance")
        .in("mover_id", moverIds);

      if (balanceError) throw balanceError;

      setBalances(balanceData || []);
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setLoading(false);
    }
  };

  const getBalance = (moverId: string) => {
    const balance = balances.find((b) => b.mover_id === moverId);
    return balance?.balance || 0;
  };

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

  const handleEditHourlyRate = (mover: Mover) => {
    setEditingMover(mover);
    setNewHourlyRate(mover.hourly_rate?.toString() || "0");
  };

  const handleSaveHourlyRate = async () => {
    if (!editingMover) return;

    setSavingRate(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ hourly_rate: parseFloat(newHourlyRate) || 0 })
        .eq("id", editingMover.id);

      if (error) throw error;

      toast.success(et.hourlyRateUpdated);
      setMovers(movers.map((m) =>
        m.id === editingMover.id
          ? { ...m, hourly_rate: parseFloat(newHourlyRate) || 0 }
          : m
      ));
      setEditingMover(null);
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setSavingRate(false);
    }
  };

  if (loading) {
    return <div>{t.loading}</div>;
  }

  return (
    <>
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
                <TableHead>{et.hourlyRate}</TableHead>
                <TableHead>{et.balance}</TableHead>
                <TableHead className="text-right">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t.noMoversFound}
                  </TableCell>
                </TableRow>
              ) : (
                movers.map((mover) => {
                  const balance = getBalance(mover.id);
                  return (
                    <TableRow key={mover.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={mover.avatar_url || undefined} alt={`${mover.first_name} ${mover.last_name}`} />
                            <AvatarFallback className="text-xs">
                              {mover.first_name?.[0]}{mover.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span>{mover.first_name} {mover.last_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{mover.username}</TableCell>
                      <TableCell>{mover.email}</TableCell>
                      <TableCell>{mover.phone}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>${mover.hourly_rate?.toFixed(2) || "0.00"}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditHourlyRate(mover)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${balance.toFixed(2)}
                        </span>
                      </TableCell>
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
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Hourly Rate Dialog */}
      <Dialog open={!!editingMover} onOpenChange={(open) => !open && setEditingMover(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {et.editHourlyRate}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.name}</Label>
              <Input
                value={`${editingMover?.first_name} ${editingMover?.last_name}`}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>{et.hourlyRate} ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newHourlyRate}
                onChange={(e) => setNewHourlyRate(e.target.value)}
              />
            </div>
            <Button
              onClick={handleSaveHourlyRate}
              disabled={savingRate}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {savingRate ? et.saving : et.save}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
    </>
  );
};

export default MoversList;
